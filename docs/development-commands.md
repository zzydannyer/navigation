# 运行与构建命令

完整的首次配置、真机、调试、打包、安装与故障排查流程统一见[根目录 README](../README.md)。

在仓库根目录执行。完整命令按操作、技术方案、目标平台区分，快捷命令与完整命令等价。快捷命令也需要 pnpm 前缀，例如 `pnpm dra`。

## 命令清单

- `pnpm dev:reactnative:android` = `pnpm dra`
- `pnpm dev:reactnative:ios` = `pnpm dri`
- `pnpm dev:reactnative:harmony` = `pnpm drh`
- `pnpm build:reactnative:android` = `pnpm bra`
- `pnpm build:reactnative:ios` = `pnpm bri`
- `pnpm build:reactnative:harmony` = `pnpm brh`
- `pnpm dev:tauri:android` = `pnpm dta`
- `pnpm dev:tauri:ios` = `pnpm dti`
- `pnpm dev:tauri:windows` = `pnpm dtw`
- `pnpm dev:tauri:macos` = `pnpm dtm`
- `pnpm dev:tauri:linux` = `pnpm dtl`
- `pnpm dev:tauri:harmony` = `pnpm dth`
- `pnpm build:tauri:android` = `pnpm bta`
- `pnpm build:tauri:ios` = `pnpm bti`
- `pnpm build:tauri:windows` = `pnpm btw`
- `pnpm build:tauri:macos` = `pnpm btm`
- `pnpm build:tauri:linux` = `pnpm btl`
- `pnpm build:tauri:harmony` = `pnpm bth`

## Android 真机调试

连接手机并允许 USB 调试，运行 pnpm dra 或 pnpm dta；Windows 脚本仅选择实体手机。RN 摇手机打开开发菜单后选择 Open DevTools；Tauri 用 Chrome 的 chrome://inspect/#devices。系统定位与应用定位权限都需开启，GPS 建议在室外验证。完整流程见[根目录 README](../README.md)。

## 平台与执行方式

- Windows Android：`pnpm dra` 和 `pnpm dta` 使用前台会话，保存前端文件自动更新，按 `Ctrl+C` 停止。RN 复用手机已安装的开发包，修改原生配置后运行 `pnpm dra --rebuild`。
- RN Android 构建：自包含 release APK 位于 `apps/react-native/android/app/build/outputs/apk/release/app-release.apk`，当前仅使用本地 debug 签名。Tauri Android 构建：arm64 APK 位于 `apps/tauri/src-tauri/gen/android/app/build/outputs/apk/`，尚未配置正式签名。
- macOS/Linux Android：提前设置 SDK、JDK（RN 使用 17）、NDK 和 Rust/Cargo；RN 调用 Expo 原生运行或 Gradle release，Tauri 使用官方 Android CLI。开发时使用设备选择器；不会套用 Windows 的硬编码工具链和 USB 自动管理逻辑。
- RN iOS：仅在 Mac + Xcode 上执行。开发使用 Expo development build 的设备选择器；构建使用 `expo run:ios --configuration Release --device generic --no-bundler`，只编译通用 iOS 设备 Release，不启动应用，不等于导出已签名 IPA 或完成 App Store 发布。
- Tauri iOS：仅在 Mac + Xcode 上执行，原生工程缺失时先调用官方 `tauri ios init`，然后执行 `tauri ios dev/build`；设备签名和分发证书需在 Mac 配置。
- Tauri Windows/macOS/Linux：分别在对应系统调用 `tauri dev/build`；桌面入口不连接 adb，也不启动 Expo。构建默认打包当前主机架构，桌面产物位于 Cargo target 的 release/bundle 目录（未自定义 target 时在 `apps/tauri/src-tauri/target/release/bundle`）。
- 鸿蒙：两套技术方案均未接入鸿蒙原生工程，预留命令会明确失败；能运行 APK 的设备使用 Android 命令，不能据此宣称鸿蒙原生支持。

只有 Windows Android 沿用已有构建运行验证；本次新增其他平台调度入口，不代表这些平台已经通过实际构建或功能验收。iOS 定位适配仍需单独验收。

## 检查与预览

- `pnpm dra --dry-run`、`pnpm dtw --dry-run`：只展示实际执行命令，不构建、不启动、不连接设备；不匹配当前主机的目标依然报错。
- `node --test scripts/run-platform.test.mjs`：检查所有完整/快捷命令、平台拒绝及调度分支，不执行构建。
- `pnpm -r typecheck`、`pnpm -r test`：工作区检查。

旧 `devrn/buildrn/devtauri/buildtauri` 根命令已移除。Tauri 配置中的 beforeDevCommand / beforeBuildCommand 继续调用 app 内 Vite 脚本。首次 USB 授权仍需在手机确认；RN 调试从手机开发菜单打开 DevTools，Tauri Android 使用 Chrome 的 `chrome://inspect/#devices`。

## 包结构

- `apps/tauri`：Tauri 2 桌面 + 现有 Tauri Android，React DOM + MapLibre GL JS。
- `packages/nav-core`：导航模型、计算、NMEA、模拟与告警（纯逻辑，不依赖 DOM/Tauri/RN/地图实例）。
- `packages/chart-core`：海图数据、格式能力、导入状态机、PMTiles reader。
- `packages/navigation-app`：用例状态、异步持久化协调与写队列（zustand/vanilla），依赖 nav-core 与 platform-contracts。
- `packages/platform-contracts`：定位、存储等平台能力接口与错误码，不含平台实现。
- `packages/chart-web`：Web 地图控制器、图层、点选与 React 容器，仅供 Tauri/Web 使用。

`apps/react-native` 使用 Expo SDK 58 + `@maplibre/maplibre-react-native`。MapLibre 是原生地图，必须用 development build，不能使用 Expo Go。原生目录由 Expo prebuild 从 app.json 生成，不维护旧 RN CLI 模板；变更插件或权限配置后重新 prebuild。iOS 需要 macOS 构建。
