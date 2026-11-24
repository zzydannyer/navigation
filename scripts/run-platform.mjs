import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function createPlan(action, app, target, host = process.platform, rebuild = false) {
  if (rebuild && !(action === 'dev' && app === 'reactnative' && target === 'android' && host === 'win32')) {
    throw new Error('--rebuild 仅支持 Windows 上的 RN Android 开发命令。');
  }
  if (!['dev', 'build'].includes(action) || !['reactnative', 'tauri'].includes(app)) {
    throw new Error('用法：node scripts/run-platform.mjs <dev|build> <reactnative|tauri> <android|ios|windows|macos|linux|harmony> [--dry-run]');
  }
  if (target === 'harmony') {
    throw new Error('鸿蒙原生尚未接入当前 Expo/MapLibre 与 Tauri 工程。支持 APK 的设备请使用 Android 命令；这不代表鸿蒙原生支持。');
  }
  const targets = app === 'reactnative' ? ['android', 'ios'] : ['android', 'ios', 'windows', 'macos', 'linux'];
  if (!targets.includes(target)) throw new Error(`${app} 不支持目标 ${target ?? '(未指定)'}；可选：${targets.join(', ')}`);
  const requiredHost = { ios: 'darwin', macos: 'darwin', windows: 'win32', linux: 'linux' }[target];
  if (requiredHost && host !== requiredHost) {
    throw new Error(`${target} 本地运行/构建需要 ${requiredHost === 'darwin' ? 'macOS（iOS 还需要完整 Xcode）' : target} 主机；当前为 ${host}。`);
  }
  const pnpm = (...args) => ({ program: 'pnpm', args });
  if (target === 'android' && host === 'win32') {
    const legacyAction = `${action}${app === 'reactnative' ? 'rn' : 'tauri'}`;
    return [{ program: 'powershell', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/android.ps1', legacyAction, ...(rebuild ? ['-Rebuild'] : [])] }];
  }
  if (app === 'reactnative') {
    if (target === 'ios') {
      return [pnpm('--filter', '@navigation/mobile', 'exec', 'expo', 'run:ios', ...(action === 'build' ? ['--configuration', 'Release', '--device', 'generic', '--no-bundler'] : ['--device']))];
    }
    if (action === 'dev') return [pnpm('--filter', '@navigation/mobile', 'exec', 'expo', 'run:android', '--device')];
    return [
      { ...pnpm('--filter', '@navigation/mobile', 'exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'), unlessExists: 'apps/react-native/android/gradlew' },
      { program: './gradlew', args: ['assembleRelease'], cwd: 'apps/react-native/android' },
    ];
  }
  if (['android', 'ios'].includes(target)) {
    return [
      { ...pnpm('--filter', '@navigation/desktop', 'tauri', target, 'init'), unlessExists: `apps/tauri/src-tauri/gen/${target === 'ios' ? 'apple' : 'android'}` },
      pnpm('--filter', '@navigation/desktop', 'tauri', target, action, ...(target === 'android' && action === 'build' ? ['--apk', '--target', 'aarch64'] : [])),
    ];
  }
  return [pnpm('--filter', '@navigation/desktop', 'tauri', action)];
}

function main() {
  const [action, app, target, ...options] = process.argv.slice(2);
  if (options.some((option) => !['--dry-run', '--rebuild'].includes(option))) throw new Error('仅支持额外参数 --dry-run 和 --rebuild。');
  const plan = createPlan(action, app, target, process.platform, options.includes('--rebuild'));
  const dryRun = options.includes('--dry-run');
  for (const step of plan) {
    const cwd = join(root, step.cwd ?? '');
    if (step.unlessExists && existsSync(join(root, step.unlessExists))) continue;
    console.log(`[${app}/${target}] ${step.program} ${step.args.join(' ')}${step.cwd ? ` (cwd: ${step.cwd})` : ''}`);
    if (dryRun) continue;
    const env = { ...process.env, NODE_ENV: action === 'build' ? 'production' : 'development' };
    // Windows pnpm is a .cmd shim; only pass fixed, internally constructed arguments to cmd.exe.
    const result = process.platform === 'win32' && step.program === 'pnpm'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `pnpm ${step.args.join(' ')}`], { cwd, stdio: 'inherit', env })
      : spawnSync(step.program, step.args, { cwd, stdio: 'inherit', env });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
