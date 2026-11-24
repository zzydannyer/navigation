# Navigation

本地优先的航海应用。React Native 使用 Expo SDK 58 development build + MapLibre 原生地图；Tauri 2 使用 React WebView + MapLibre GL JS。两端共享导航逻辑，不接业务后端。

所有命令均在仓库根目录执行，只使用 pnpm。完整命令与快捷命令等价，快捷命令也要带 pnpm。以下启动、关闭、安装和构建均由你手动执行。

## Android 真机：从连接到调试

### 1. 连接手机

开启手机开发者选项和 USB 调试，用数据线连接电脑，解锁手机并确认“允许 USB 调试”。必要时将 USB 模式改为文件传输。

检查连接：

```powershell
& "D:\software\Android\Sdk\platform-tools\adb.exe" devices -l
```

设备状态需为 device。unauthorized 时在手机确认授权；列表为空时检查数据线、USB 模式和驱动。Windows 脚本只选择实体手机，一台自动选择，多台提示选择。

### 2. 安装并运行开发包

```powershell
pnpm dra  # RN Android：打开真机开发包并进入 Expo 控制台
pnpm dta  # Tauri Android：构建、安装、运行 WebView 开发包
```

按需要运行其中一个，保持手机 USB 连接及调试授权。

RN 的 `pnpm dra` 自动选择手机，通过 USB 转发 8081 并在当前终端运行 Expo/Metro。已有可调试的 Expo 开发包时跳过 Gradle，直接打开应用。首次或手机上只有 release 包时，先构建并安装开发包。旧版 `dra` 会在后台留着 Metro，升级后首次运行会清理可确认属于本项目的旧后台会话。

Tauri 的 `pnpm dta` 保持前台运行，并通过 USB 转发 Vite 的 1420 和 1421 端口。保存 React、CSS 和前端逻辑后，由 Vite 将修改推给手机 WebView。

### 3. RN 调试

- 保持 `pnpm dra` 和 USB 连接。保存 JS/TS、React 组件或样式后，Fast Refresh 会自动更新。需要手动重载时，在 Expo 终端按 `r`。
- 在 Expo 终端按 `j` 打开 DevTools，也可以摇动手机打开开发菜单，再选择 **Open DevTools**。Console 查看 JS 日志，Sources 设置断点，Components 检查 React 组件。
- 无法摇出菜单时执行（多台手机时添加 -s 实际序列号）：

```powershell
& "D:\software\Android\Sdk\platform-tools\adb.exe" shell input keyevent 82
```

- Expo/Metro 打包日志实时显示在 `pnpm dra` 终端。
- 原生地图/模块错误和 Android 崩溃：Android Studio > Logcat，选手机，过滤 com.navigationmobile。MapLibre 原生视图不能用浏览器 DOM 检查。
- 修改原生依赖、Expo 插件或权限后，先退出当前会话，再执行 `pnpm dra --rebuild`，重新生成 Android 工程、安装并进入开发会话。

### 4. Tauri 调试

保持 dta 运行，在电脑 Chrome 地址栏输入 chrome://inspect/#devices，勾选 Discover USB devices，找到应用 WebView 点 inspect。Elements 检查 DOM/CSS，Console 看日志，Sources 断点，Network 看底图请求。保持手机 USB 调试已授权。

没有 WebView 时检查是否是开发包、应用是否在前台、adb 是否在线。Rust/Android 日志在运行终端或 Android Studio Logcat 查看，过滤 cn.navigation.desktop。

Windows 桌面使用 pnpm dtw，应用菜单“查看 > 打开开发者工具”或 Ctrl+Shift+I 打开工具。

### 5. 真机定位验证

开启手机系统定位，在应用授权定位；尽量到室外等待有效 GPS。检查本船坐标、定位、跟随、速度和航向。室内可能无有效 GPS，行进方向需要实际移动才有意义。

### 6. 结束开发

在运行 `pnpm dra` 或 `pnpm dta` 的终端按 `Ctrl+C` 停止开发服务。如果 Windows CMD 询问是否终止批处理，输入 `Y` 确认。终端恢复提示符后，可以直接再次运行原命令。停止后 Expo 的 8081 或 Vite 的 1420、1421 会释放。

已在荣耀 Android 真机验证 RN 开发包复用、`--rebuild`、`r` 重载和 Fast Refresh，以及 Tauri WebView 的 CSS 热更新。两端退出时均验证了开发端口释放。

## 打包与安装

### Android

```powershell
pnpm bra  # RN 自包含 release APK，不依赖 Metro
pnpm bta  # Tauri arm64 release APK
```

- RN：apps/react-native/android/app/build/outputs/apk/release/app-release.apk；目前使用 debug 签名，仅作本地验证。
- Tauri：apps/tauri/src-tauri/gen/android/app/build/outputs/apk/；未配置正式签名时为 unsigned，必须先签名才能安装。bta 固定 arm64，安装到支持 arm64 的真机。
- RN release 已内嵌 JS，不依赖 Expo/Metro；release 不用于上面的开发调试。正式发布还需正式签名和分发配置。

手动安装 RN 验证包（序列号用设备列表中的实际值）：

```powershell
& "D:\software\Android\Sdk\platform-tools\adb.exe" devices -l
& "D:\software\Android\Sdk\platform-tools\adb.exe" -s 手机序列号 install -r "apps/react-native/android/app/build/outputs/apk/release/app-release.apk"
```

安装后从设备应用列表打开。不要同时卸载清数据来排查连接问题。

### iOS、桌面与鸿蒙

- RN iOS：Mac + 完整 Xcode，pnpm dri 运行 development build；pnpm bri 编译通用 iOS 设备 Release（不安装），不等同导出已签名 IPA。开发设备与签名需在 Mac 配置。
- Tauri iOS：Mac + Xcode，pnpm dti / pnpm bti。缺少原生工程时先由脚本调用官方 ios init；仍需配置签名。
- Tauri Windows：Windows 上 pnpm dtw / pnpm btw；macOS：Mac 上 pnpm dtm / pnpm btm；Linux：Linux 上 pnpm dtl / pnpm btl。桌面入口不启动 adb 或 Expo。默认构建当前主机架构。
- 桌面打包产物通常位于 apps/tauri/src-tauri/target/release/bundle；自定义 Cargo target 目录时以实际输出为准。
- 鸿蒙原生未接入，drh/brh/dth/bth 只提示未支持；运行 APK 属于 Android 兼容运行。RN Windows/macOS/Linux 未接入。
- 其他系统的入口已配置，但不代表已完成各端实际构建与功能验收。非 Windows Android 需自行配置本机 SDK/JDK/NDK/Cargo，使用官方设备选择流程。

## 全部完整命令与快捷命令

- `pnpm dra` = `pnpm dev:reactnative:android`
- `pnpm dri` = `pnpm dev:reactnative:ios`
- `pnpm drh` = `pnpm dev:reactnative:harmony`
- `pnpm bra` = `pnpm build:reactnative:android`
- `pnpm bri` = `pnpm build:reactnative:ios`
- `pnpm brh` = `pnpm build:reactnative:harmony`
- `pnpm dta` = `pnpm dev:tauri:android`
- `pnpm dti` = `pnpm dev:tauri:ios`
- `pnpm dtw` = `pnpm dev:tauri:windows`
- `pnpm dtm` = `pnpm dev:tauri:macos`
- `pnpm dtl` = `pnpm dev:tauri:linux`
- `pnpm dth` = `pnpm dev:tauri:harmony`
- `pnpm bta` = `pnpm build:tauri:android`
- `pnpm bti` = `pnpm build:tauri:ios`
- `pnpm btw` = `pnpm build:tauri:windows`
- `pnpm btm` = `pnpm build:tauri:macos`
- `pnpm btl` = `pnpm build:tauri:linux`
- `pnpm bth` = `pnpm build:tauri:harmony`

## 环境、依赖与检查

Windows Android 脚本自动配置本机路径：

- SDK：D:/software/Android/Sdk；NDK 默认 27.2.12479018。
- RN：JDK 17，D:/software/jdk17/jdk-17.0.21+9。
- Tauri Android：C:/Program Files/Android/Android Studio/jbr；Cargo：C:/Users/ASUS/.cargo/bin。
- Android Studio 自带 JBR 不能替代 RN 的 JDK17。RN 使用 Expo development build，Expo Go 不包含 MapLibre。

已有依赖可直接运行。需要安装依赖时：当前本机全局 pnpm10 与既有 v11 store 不一致，沿用 pnpm11 安装，不改全局配置：

```powershell
pnpm dlx pnpm@11.28.13 install
pnpm -r typecheck
pnpm -r test
node --test scripts/run-platform.test.mjs
```

只预览、不启动/构建/关闭：

```powershell
pnpm dra --dry-run
pnpm dta --dry-run
pnpm dtw --dry-run
```

预览仍校验目标平台和宿主系统。

## 常见问题

- No authorized physical Android phone：连接手机，用 adb devices -l 检查 device 状态，并确认 USB 调试授权。
- RN 白屏/There was a problem loading the project/ConnectException：原生构建成功但开发包没连上 Expo。若错误地址是 192.168.*:8081，说明使用了 LAN 地址；更新脚本后重新 pnpm dra，它会以 localhost + adb reverse 重新打开，不需要清应用数据。
- 8081 被占用：在占用端口的开发终端按 `Ctrl+C`，再运行 `pnpm dra`。
- 修改 JS 没刷新：确认用 dra/dta 的开发包而非 release，确认服务在运行。原生依赖/插件变更需要重建。

如果退出 RN 后再次运行 `dra` 或 `dta` 卡在设备探测，先在另一个 PowerShell 执行 `adb devices -l`。如果该命令也卡住，结束这次探测，然后重启 adb。重启会断开本机其他 adb 会话，先结束正在运行的真机调试。

```powershell
& "D:\software\Android\Sdk\platform-tools\adb.exe" kill-server
& "D:\software\Android\Sdk\platform-tools\adb.exe" devices -l
```

如果 `kill-server` 也卡住，在任务管理器的「详细信息」中结束 `adb.exe`，再执行第二行。看到手机状态为 `device` 后，重新运行 `pnpm dra` 或 `pnpm dta`。

## 项目结构与约定

- apps/react-native：Expo development build + MapLibre 原生页面/地图。
- apps/tauri：Tauri React WebView 页面与 Web 地图。
- packages/nav-core、chart-core：共享纯业务和海图逻辑。
- packages/navigation-app：共享状态与用例；platform-contracts：平台能力接口。
- packages/chart-web：Web 地图装配，不导入应用 store。

Tauri Android 与 Expo 原生工程由工具生成，不手改生成目录。Tauri beforeDevCommand / beforeBuildCommand 在 apps/tauri 内运行，保持 Vite dev/build。

详细补充见 [开发命令](docs/development-commands.md)、[双端方案](docs/local-first-dual-app-plan.md)、[项目约定](AGENTS.md)。
