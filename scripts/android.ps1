param(
    [Parameter(Mandatory=$true)][ValidateSet('devrn','buildrn','devtauri','buildtauri')][string]$Action,
    [switch]$Rebuild
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed ($LASTEXITCODE)" }
}

function Get-AdbUtf8Text {
    # Windows PowerShell decodes native output with the console code page (GBK in cmd),
    # which mangles UTF-8 names such as Chinese Bluetooth device names. Read the raw bytes
    # and decode them as UTF-8, the encoding adb and the Tauri CLI both assume.
    # adb has been seen to stop responding, so bound the call and fail loudly instead of
    # handing an empty value to the Tauri CLI.
    param([string[]]$Arguments, [int]$TimeoutSeconds = 15)
    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = (Get-Command adb).Source
    $startInfo.Arguments = $Arguments -join ' '
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $startInfo.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $process = [Diagnostics.Process]::Start($startInfo)
    try {
        # Read both pipes asynchronously so a full buffer cannot deadlock the wait.
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try { $process.Kill() } catch { }
            throw "adb did not respond within $TimeoutSeconds seconds: adb $($Arguments -join ' ')"
        }
        $output = $stdout.Result
        $errorOutput = $stderr.Result.Trim()
        if ($process.ExitCode -ne 0) {
            $detail = if ($errorOutput) { ": $errorOutput" } else { '' }
            throw "adb failed ($($process.ExitCode)): adb $($Arguments -join ' ')$detail"
        }
        return $output
    } finally { $process.Dispose() }
}

function Clear-LegacyMetro {
    $appPath = Join-Path $PWD 'apps\react-native\'
    $legacyProcesses = foreach ($listenerId in @(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerId"
        $shell = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.ParentProcessId)"
        $pnpm = Get-CimInstance Win32_Process -Filter "ProcessId=$($shell.ParentProcessId)"
        $wrapper = Get-CimInstance Win32_Process -Filter "ProcessId=$($pnpm.ParentProcessId)"
        if ($owner.Name -ne 'node.exe' -or !$owner.CommandLine -or !$owner.CommandLine.Contains($appPath) -or
            $owner.CommandLine -notmatch 'expo[\\/]bin[\\/]cli.*\bstart\b' -or
            $shell.Name -ne 'cmd.exe' -or $pnpm.CommandLine -notmatch '--filter @navigation/mobile start\s*$' -or
            $wrapper.Name -ne 'cmd.exe' -or $wrapper.CommandLine -notmatch 'pnpm\.cmd" --filter @navigation/mobile start"\s*$') {
            throw "Port 8081 is in use (PID $listenerId). Stop that development session, then run pnpm dra again."
        }
        $wrapper.ProcessId
    }
    foreach ($legacyId in @($legacyProcesses | Select-Object -Unique)) {
        Write-Host 'Closing the previous background Expo session.'
        Invoke-Checked taskkill @('/PID',"$legacyId",'/T','/F')
    }
}

function Start-RnDeviceLaunch {
    param([string]$Device, [string]$Package, [string]$Url)
    # Expo owns the terminal. This helper only opens the selected phone after Metro is ready.
    Start-Job -ArgumentList (Get-Command adb).Source,$Device,$Package,$Url -ScriptBlock {
        param($Adb, $Device, $Package, $Url)
        $deadline = [DateTime]::UtcNow.AddSeconds(60)
        do {
            try {
                $request = [Net.WebRequest]::Create('http://127.0.0.1:8081/status')
                $request.Proxy = $null
                $request.Timeout = 1500
                $request.ReadWriteTimeout = 1500
                $response = $request.GetResponse()
                try {
                    $reader = New-Object IO.StreamReader($response.GetResponseStream())
                    try { $ready = $reader.ReadToEnd().Trim() -eq 'packager-status:running' }
                    finally { $reader.Dispose() }
                } finally { $response.Dispose() }
            }
            catch { $ready = $false }
            if (!$ready) { Start-Sleep -Milliseconds 300 }
        } until ($ready -or [DateTime]::UtcNow -ge $deadline)
        if (!$ready) { throw 'Metro did not become ready on port 8081.' }
        $launch = @(& $Adb -s $Device shell am start -W -a android.intent.action.VIEW -d $Url -p $Package)
        if ($LASTEXITCODE -ne 0 -or $launch -match '^Error') { throw "Could not open the RN development app: $($launch -join ' ')" }
    }
}

try {
    # Serialize builds per app: Gradle cannot safely configure debug/release concurrently.
    $lockName = if ($Action.EndsWith('rn')) { 'Local\NavigationMobileBuild' } else { 'Local\NavigationTauriBuild' }
    $buildMutex = New-Object Threading.Mutex($false, $lockName)
    $ownsBuildMutex = $false
    try { $ownsBuildMutex = $buildMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsBuildMutex = $true }
    if (-not $ownsBuildMutex) { throw 'This app is already building/running in another terminal. Stop that command before starting another.' }
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'D:\software\Android\Sdk' }
    $isRn = $Action.EndsWith('rn')
    if ($isRn) {
        # Expo compiles more native modules than the former RN CLI template.
        $env:GRADLE_OPTS = "$env:GRADLE_OPTS -Dorg.gradle.jvmargs=`"-Xmx4096m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8`" -Dorg.gradle.project.kotlin.compiler.execution.strategy=in-process"
        $env:NODE_ENV = if ($Action -eq 'buildrn') { 'production' } else { 'development' }
    }
    $env:JAVA_HOME = if ($isRn) { 'D:\software\jdk17\jdk-17.0.21+9' } else { 'C:\Program Files\Android\Android Studio\jbr' }
    if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw "JDK missing: $env:JAVA_HOME" }
    if (-not $env:NDK_HOME) {
        $env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk\27.2.12479018'
    }
    $env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:USERPROFILE\.cargo\bin;$env:Path"

    if ($Action.StartsWith('dev')) {
        $deviceList = Get-AdbUtf8Text @('devices')
        $devices = @($deviceList -split "\r?\n" | Select-Object -Skip 1 | Where-Object { $_ -match '^\S+\s+device\s*$' } | ForEach-Object { ($_ -split '\s+')[0] })
        $phones = @($devices | Where-Object { $_ -notmatch '^emulator-' })
        $choices = @($phones)
        if (-not $choices.Count) { throw 'No authorized physical Android phone. Connect USB and accept debugging on the phone.' }
        if ($choices.Count -eq 1) { $serial = $choices[0] }
        else {
            for ($i=0; $i -lt $choices.Count; $i++) { Write-Host "$($i+1). $($choices[$i])" }
            $selection = 0
            if (-not [int]::TryParse((Read-Host 'Select device number'), [ref]$selection) -or $selection -lt 1 -or $selection -gt $choices.Count) { throw 'Invalid device selection' }
            $serial = $choices[$selection-1]
        }
        $env:ANDROID_SERIAL = $serial
        Write-Host "Device: $serial"
    }

    switch ($Action) {
        'devrn' {
            Clear-LegacyMetro
            $package = 'com.navigationmobile'
            $url = 'navigation-mobile://?__expo_url=http%3A%2F%2F127.0.0.1%3A8081'
            # Android exposes the debuggable flag in dumpsys even on phones whose run-as is restricted.
            $packageDetails = @(adb -s $serial shell dumpsys package $package)
            if ($LASTEXITCODE -ne 0) { throw 'Could not check the installed Android package.' }
            $hasDebugPackage = [bool]($packageDetails -match '^\s*flags=\[.*\bDEBUGGABLE\b')
            $activity = @(adb -s $serial shell cmd package resolve-activity --brief -a android.intent.action.VIEW -d $url -p $package)
            if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the Expo development launcher.' }
            $hasDevClient = $hasDebugPackage -and [bool]($activity -match '^com\.navigationmobile/')
            if ($Rebuild -or !$hasDevClient) {
                if ($Rebuild -or !(Test-Path apps/react-native/android/gradlew.bat)) {
                    Invoke-Checked pnpm @('--filter','@navigation/mobile','exec','expo','prebuild','--platform','android','--no-install')
                }
                Push-Location apps/react-native/android
                try { Invoke-Checked .\gradlew.bat @(':app:assembleDebug') } finally { Pop-Location }
                # Install only on the selected device. Do not automatically uninstall an incompatible signed app.
                Invoke-Checked adb @('-s',$serial,'install','-r','apps/react-native/android/app/build/outputs/apk/debug/app-debug.apk')
            } else {
                Write-Host 'Development build already installed. Skipping Gradle; use pnpm dra --rebuild after native changes.'
            }
            Invoke-Checked adb @('-s',$serial,'reverse','tcp:8081','tcp:8081')
            Invoke-Checked adb @('-s',$serial,'shell','am','force-stop',$package)
            $launchJob = Start-RnDeviceLaunch -Device $serial -Package $package -Url $url
            Write-Host 'Expo console: r reloads, j opens DevTools, Ctrl+C stops this session.'
            Invoke-Checked pnpm @('--filter','@navigation/mobile','start','--port','8081')
        }
        'buildrn' {
            if (-not (Test-Path apps/react-native/android/gradlew.bat)) {
                Invoke-Checked pnpm @('--filter','@navigation/mobile','exec','expo','prebuild','--platform','android','--no-install')
            }
            Push-Location apps/react-native/android
            try { Invoke-Checked .\gradlew.bat @('assembleRelease') } finally { Pop-Location }
            Write-Host 'APK: apps/react-native/android/app/build/outputs/apk/release/app-release.apk (local debug signing)'
        }
        'devtauri' {
            Invoke-Checked adb @('-s',$serial,'reverse','tcp:1420','tcp:1420')
            Invoke-Checked adb @('-s',$serial,'reverse','tcp:1421','tcp:1421')
            Write-Host 'WebView debugging: Chrome > chrome://inspect/#devices. Ctrl+C stops development.'
            $tauriArgs = @('--filter','@navigation/desktop','tauri','android','dev')
            # Tauri matches its positional argument by device name (Bluetooth name, falling back
            # to ro.product.model), not by serial. With a single connected device it selects that
            # device itself, so only pass a name when there is more than one to choose from.
            $onlyConnectedDevice = $devices.Count -eq 1 -and $devices[0] -eq $serial
            if (-not $onlyConnectedDevice) {
                $details = Get-AdbUtf8Text @('-s',$serial,'shell','dumpsys','bluetooth_manager')
                $match = [regex]::Match($details, '\bname: (?<name>.*)')
                $deviceName = if ($match.Success) { $match.Groups['name'].Value.Trim() } else { (Get-AdbUtf8Text @('-s',$serial,'shell','getprop','ro.product.model')).Trim() }
                $tauriArgs += $deviceName
            }
            $tauriArgs += @('--host','127.0.0.1')
            Invoke-Checked pnpm $tauriArgs
        }
        'buildtauri' {
            Invoke-Checked pnpm @('--filter','@navigation/desktop','tauri','android','build','--apk','--target','aarch64')
            Write-Host 'APK directory: apps/tauri/src-tauri/gen/android/app/build/outputs/apk/ (release signing must be configured for distribution)'
        }
    }
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
} finally {
    if ($launchJob) {
        Receive-Job -Job $launchJob -ErrorAction Continue
        Remove-Job -Job $launchJob -Force -ErrorAction SilentlyContinue
    }
    if ($ownsBuildMutex) { $buildMutex.ReleaseMutex() }
    if ($buildMutex) { $buildMutex.Dispose() }
}
