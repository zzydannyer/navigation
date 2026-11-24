这是 Tauri 2 桌面和 Android 应用加 React Native 原生应用（方案见 `docs/local-first-dual-app-plan.md`）。界面在 `apps/tauri`（Vite + React）与 `apps/react-native`（原生页面 + 原生地图），共享逻辑在 `packages/nav-core`、`packages/chart-core`、`packages/navigation-app`、`packages/platform-contracts`，Web 地图生命周期在 `packages/chart-web`。应用不接后端，生产联网只允许官方公开底图资源。

## 不要凭记忆写 Tauri API

Tauri 2 的 API 与 1.x 不同。写 Tauri、插件或 Android 相关代码前，先查 https://v2.tauri.app/ 。

## 命令

只使用 pnpm。在仓库根目录执行，命令格式为 `pnpm <dev|build>:<reactnative|tauri>:<平台>`，每项都有快捷命令（详见 `docs/development-commands.md`）。

- React Native：android（dra/bra）、ios（dri/bri）。
- Tauri：android（dta/bta）、ios（dti/bti）、windows（dtw/btw）、macos（dtm/btm）、linux（dtl/btl）。
- 鸿蒙预留 reactnative:harmony（drh/brh）和 tauri:harmony（dth/bth），执行会明确提示尚未接入，不生成伪鸿蒙产物。


调度入口为 `scripts/run-platform.mjs`，先检查平台与宿主系统；iOS/macOS 必须在 Mac 本地运行，Windows/Linux 桌面命令在各自系统运行。非 Windows 的 Android 需要预先配置本机工具链；Windows Android 复用 `scripts/android.ps1`，自动设置本机工具链，仅选择实体手机，一台自动选择，多台才提示选择。旧 devrn/buildrn/devtauri/buildtauri 根命令已移除，避免隐式指向 Android。

`apps/tauri/src-tauri/tauri.conf.json` 里的 `beforeDevCommand` 和 `beforeBuildCommand` 在 `apps/tauri` 内执行，对应 Vite `dev` / `build`，不要改成根目录脚本。

检查使用 `pnpm -r typecheck` 与 `pnpm -r test`；调度器检查使用 `node --test scripts/run-platform.test.mjs`。加 `--dry-run` 可预览命令而不启动/构建，仍会校验宿主系统。RN DevTools 从手机开发菜单打开；Tauri WebView 使用 Chrome 的 `chrome://inspect/#devices`。

## 规则

- 原生 Android 工程由 Tauri 生成在 `apps/tauri/src-tauri/gen/android`。不要手改生成文件，配置写在 `tauri.conf.json` 和 capabilities。
- `apps/tauri` 的包名暂保留为 `@navigation/desktop`；目录已从 `apps/desktop` 迁到 `apps/tauri`，应用 identifier 保持 `cn.navigation.desktop`，不要借目录改名改变应用身份和用户数据位置。
- `packages/chart-web` 只承载 Web/MapLibre 地图装配、图层与点选，不 import 应用 store；业务状态由 `apps/tauri` 投影成纯数据快照传入。
- 应用状态在 `packages/navigation-app`（zustand/vanilla），平台能力接口在 `packages/platform-contracts`；`nav-core` 不依赖应用状态或平台存储。持久化走异步 `StoragePort`，由 app adapter 实现，不在状态层读 localStorage/crypto。
- 新增依赖加到实际使用的包，不要加回根目录。
- 第三方库先查官方文档再安装。
- `apps/react-native` 使用 Expo SDK 58 development build + `@maplibre/maplibre-react-native`，禁止改回 RN CLI 或 WebView 地图。Expo Go 不包含 MapLibre，使用本地 development build；Metro 配置继承 expo/metro-config。原生目录由 Expo prebuild 生成，配置以 app.json/plugins 为准。pnpm 不提升依赖，`@react-native/gradle-plugin` 与 `@react-native/codegen` 保留在 app 的 devDependencies。
- RN Android 构建：`JAVA_HOME` 指向 JDK 17（本机 `D:\software\jdk17\jdk-17.0.21+9`），`ANDROID_HOME=D:\software\Android\Sdk`，在 `apps/react-native/android` 执行 `gradlew.bat assembleDebug`。Android Studio 自带 JBR 是 JDK 25，不满足 RN gradle-plugin 的 17 工具链要求。
