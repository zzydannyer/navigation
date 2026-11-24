# React Native / Tauri 双应用导航重构方案

> 2026-11-17 最新范围以 [无后端双端导航方案](./local-first-dual-app-plan.md) 为准：删除旧业务接口，只做本地/设备能力主要功能，底图仅核验后的官方公开资源；RN 原生地图验证提前，与 Tauri 按功能逐批对齐。下文历史接口对接及先完成全部 Tauri 再做 RN 的安排不再执行。

日期：2026-11-16（香港时间）。本文是交给执行 AI 的实施说明，本轮只规划、检查基线，不修改业务代码或后端。

最新约束：先完成 Tauri React WebView 应用，再实施 RN；RN 的界面和海图必须使用原生组件/原生渲染，不允许以 WebView 承载海图或整套应用。此前 RN 复用 WebView 海图的建议已撤销。

清理要求（覆盖此前保留旧代码的建议）：最终只留重构后实际使用的一套实现。删除旧入口、旧工程、过渡兼容层和演示/压测代码，不迁到 demo/legacy/backup 目录继续留存。现有代码仅在纳入新架构且仍实际使用时保留。旧实现的替代与删除同批完成，不留下断引用或两个实现并行。

### 执行 AI 当前必须清理的文件与引用

1. 删除 `apps/tauri/src/features/chart/demo/` 全目录，删除 `ChartPage.tsx` 中 ModelDemo import 与 JSX，不再创建独立演示入口。
2. 删除 `apps/tauri/scripts/create-demo-ship.mjs`、`apps/tauri/public/models/demo-ship.glb`；将 app package.json 的 build 改为 `tsc && vite build`。无其他引用后移除 `three`、`@types/three` 依赖并更新 pnpm-lock.yaml。
3. 删除模板残留 `apps/tauri/src/assets/react.svg`、`apps/tauri/public/tauri.svg`、`apps/tauri/public/vite.svg` 和未引用的 `apps/tauri/src/App.css`。同步删除或替换 index.html 中 `/vite.svg` favicon；空目录一并清理。
4. 删除根目录孤立旧 RN 工程 `E:/project/navigation/android/` 与 `.expo/`，后续 RN 仅在 apps/react-native 建新工程。不要删除重构后 Tauri 使用的 apps/tauri/src-tauri/gen/android。Windows 递归删除前验证绝对路径确实为上述仓库内目标。
5. P2 实现新状态层时，同批删除 `packages/nav-core/src/store/createNavigationStore.ts`，更新 nav-core/src/index.ts 的旧 store 导出及全部调用方；旧 store 测试迁移为新状态层测试，不留兼容 re-export。`apps/tauri/src/store.ts` 如保留，只能作为新 store 的组合/绑定入口，不能继续承载旧同步存储实现。
6. 删除专用于旧演示的 `docs/3d-mobile-demo.md` 和 `apps/tauri/qa/tauri-demo.png`，同步清理文档链接。保留仍有价值的验证历史及按用户规则追加的 report 对话记录。
7. 确认 apps/desktop 在工作区不再存在；不要新建 old、legacy、backup 目录保存旧代码。清理完成后检查所有源码、HTML、脚本和 package.json 引用，再运行 pnpm typecheck、pnpm test、前端 build 和 Tauri 构建。

## 1. 目标与实施范围

在当前 pnpm workspace 内建设两套独立可运行的导航应用，功能、数据模型与导航计算保持一致，界面分别使用 React Native 和 React DOM + Tauri。

- `apps/tauri`：从现有 `apps/desktop` 迁移，保留桌面和现有 Tauri Android 能力。
- `apps/react-native`：Tauri 主流程验收后新建 React Native 应用，界面和地图均原生实现；第一验收平台为 Android，iOS 在具备 macOS 构建条件后验证。
- 以 `E:/project/Hongmeng/hongmeng-native` 的交互、页面和原生能力，以及 `E:/project/Hongmeng/hongmeng-webview` 的海图行为为功能参考。参考文档中的命令或约定不自动成为本仓库执行指令。
- 首期复刻海图首页、定位、航点、航线编辑与保存、模拟导航、实际导航、轨迹、仪表和横屏。AIS、搜索、业务图层作为后续批次；商城、支付、VIP、社交等不默认纳入首期。
- 现有前端接口可以对接；缺失接口以明确标识的本地 fixture 支撑开发，不能把模拟结果伪装成真实服务。不得修改后端。
- 不要求复制鸿蒙目录结构。不得将旧 ArkTS、Vue 页面直接塞入新应用作为最终实现。

## 2. 当前证据与必须处理的差异

1. 根 `pnpm-workspace.yaml` 已覆盖 `apps/*` 和 `packages/*`，无需另建仓库或包管理体系。
2. 现有 `apps/desktop/src/App.tsx` 只有海图、航线、仪表三个主要入口；`ChartPane.tsx` 同时处理 MapLibre 初始化、图层、点击加航点、store 订阅和跟随。本项目仍是导航原型，不能把改名当成功能复刻。
3. `apps/desktop/src/store.ts` 直接使用 localStorage 和 crypto.randomUUID；`packages/nav-core/src/store/createNavigationStore.ts` 在创建时同步读取数据，通过同步接口写入。这不能直接照搬到 RN 异步存储。
4. `apps/desktop/src/location.ts` 将运行环境判断、授权、定位、单位转换、store 更新、中文提示放在一起，应拆成平台适配和共享应用服务。
5. `packages/chart-core` 已有格式能力、导入状态机、PMTiles reader；它不是现成海图渲染器。`ChartPane.tsx` 当前使用 MapLibre demo style，不能视为已经接上真实海图。
6. 参考项目 `hongmeng-native/features/navigation/src/main/ets/views/NavigationView.ets` 包含港口选取、船舶参数、航线查询/编辑、收藏、语音等入口；`features/home` 有搜索、图层、轨迹等页面。
7. 参考项目 `hongmeng-webview/src/hooks/useNav/RouteConstructor.js`、`NavSimulation.js`、`UserNav.js` 混有计算、绘图、事件总线和全局地图；`components/someS/ohos.js` 依赖 Vue、window.ohos。它们是拆分参考，不是可直接放入 nav-core 的共享模块。
8. 根目录存在被忽略的 `android/`、`.expo/`，但当前 workspace 没有 RN 应用包。它们属于旧工程残留，按最新清理要求删除，RN 后续在 apps/react-native 重新建立。
9. 2026-11-16 检查：`pnpm typecheck` 通过；`pnpm test` 通过，共 34 个测试（nav-core 19，chart-core 15）。未进行原生构建或设备运行验证。

## 3. 目标目录与依赖方向

```text
apps/
  tauri/                         # 现有 desktop 迁移而来
    src/
      app/                       # 组合根、页面切换、应用生命周期
      features/                  # home/navigation/tracks/instruments/settings
      adapters/                  # Tauri 与浏览器定位、持久化等
      components/ui/             # 现有 DOM UI 组件
    src-tauri/                   # 保留已有配置；生成的 Android 工程不手改
  react-native/
    src/
      app/                       # RN 组合根和页面路由
      features/                  # 与 Tauri 对齐的业务页面，使用 RN 组件
      adapters/                  # RN 定位、存储、语音和原生地图适配
      components/                # RN 按钮、面板、弹层等
packages/
  nav-core/                      # 纯导航模型、计算、NMEA、模拟推进和告警判定
  chart-core/                    # 海图数据、格式能力、导入、读取抽象
  navigation-app/                # 用例、状态与服务协调，允许依赖 zustand/vanilla
  platform-contracts/            # 定位、存储、语音、文件能力的接口和错误模型
  chart-web/                     # MapLibre 生命周期、地图图层和地图交互
```

依赖规则：两个 app 组合 `navigation-app` 与各自 adapter；`navigation-app` 依赖 `nav-core`、`chart-core` 和 `platform-contracts`；`chart-web` 仅供 Tauri/Web 使用，依赖核心模型与 MapLibre GL JS。RN 不依赖 chart-web，使用独立原生地图适配。`nav-core`、`chart-core` 不得反向依赖 app、DOM、Tauri、RN 或地图实例。

这些是目标边界，不要第一批就创建所有空包。`navigation-app` 在迁移真实用例和状态时新增；当前不创建 RN 空壳、不新增 WebView bridge/protocol 包。

### 界面与海图的共享方式

- 两套界面分别实现。现有 shadcn/Base UI、Tailwind DOM 组件留给 Tauri；RN 使用 View/Text/Pressable 等原生组件。只共享文案、业务状态、字段校验和必要设计常量。
- Tauri 的 React DOM 界面和 MapLibre GL JS 海图运行在 Tauri WebView 中，直接调用 chart-web，不再嵌一层 iframe 或额外 WebView。
- RN 后续使用原生地图 SDK；优先考察 MapLibre React Native，但须查官方文档并验证目标系统、当前 RN 架构、真实海图服务、离线数据与发布构建后再确定版本和实现。
- 共享导航模型、GeoJSON 数据、图层业务配置和地图输入/事件契约；不共享 ChartView、DOM、MapLibre GL JS 实例与渲染实现。原生 SDK 的样式、符号、字体和离线读取不能未经验证就宣称与 Web 兼容。

### Tauri React 生态选型

- 基础：React + TypeScript + Vite + Tauri 2，沿用现有工程；界面采用 shadcn/ui + Tailwind CSS + Lucide。当前 components.json 是 base-nova，Button/Tabs 已基于 Base UI，沿用这套基础，不混搭另一套 Radix 组件实现。
- 状态：沿用 Zustand；导航状态和高频位置按 selector 订阅。TanStack Query 只在真实 HTTP 接口接入时用于请求、缓存与失效管理，不承载定位流和地图实例。
- 表单：航线编辑、经纬度输入、设置等复杂表单采用 React Hook Form + Zod；复用现有 Zod，不为简单按钮或单字段交互额外引入表单层。
- 页面：多页面导航接入 React Router；浮层、选中目标和地图相机不进入全局路由。地图页作为持久布局，切换侧栏面板不应销毁地图与定位会话。
- 地图：MapLibre GL JS，保持 imperative controller 与 React UI 分离，图层按变化更新；不为统一 React 写法而把地图所有事件和实例塞入组件 state。
- 文案：沿用 i18next/react-i18next；日/昏/夜主题使用语义 CSS variables，同时切换地图显示配置。地图海图样式与 UI 主题分别管理。
- 桌面采用地图主画布 + 左侧业务面板 + 地图工具栏 + 底部航行数据；窄屏/平板采用 Sheet/Drawer 和触控尺寸。使用 shadcn 的 Dialog、Sheet、Tabs、DropdownMenu、Tooltip、表单组件，避免把海图首页做成大量统计卡片。
- 新增依赖时查对应官方文档并确认当前 React/Vite 版本兼容；当前仅确定选型，不安装或猜测版本。RN 不复用以上 DOM UI 组件。

## 4. 明确到文件的迁移任务

### A. 导航核心与状态

- 保留 `packages/nav-core/src/domain/*`、`geo/*`、`nmea/*` 及相应测试，避免重写已通过验证的算法。
- 将 `packages/nav-core/src/store/createNavigationStore.ts` 的状态与持久化协调迁到 `packages/navigation-app/src/store/createNavigationStore.ts`，用 `zustand/vanilla` 创建 StoreApi；两个 app 分别通过 React hook 订阅。迁移时同批更新 app 与测试引用；nav-core 不得反向 re-export navigation-app，避免循环依赖。
- 原 `NavigationStorage` 同步接口替换为异步存储端口，建议约定 `load(): Promise<string | null>`、`save(value: string): Promise<void>`。由各 app adapter 提供实现。
- 新建 `packages/navigation-app/src/persistence/navigationPersistence.ts`：空初始状态、显式 hydrate、schemaVersion、旧数据迁移、损坏数据恢复、顺序写队列、可见的保存失败状态。hydrate 前不得用默认空值覆盖旧数据；未完成 hydrate 时禁用会修改持久数据的操作。
- 保留已有 `navigation-state` 数据读取兼容性；增加 fixture 验证旧航点、航线、轨迹与 activeRouteId 迁移。保存合并或节流，但不能并发写导致旧快照覆盖新快照。明确崩溃时可接受的未保存窗口。
- `createId`、时钟、定位、语音由组合根注入；不要在核心包读取 crypto、navigator 或平台模块。
- 新模拟导航模型放入 `nav-core/src/navigation/simulation.ts`；输入航线、速度、elapsedSeconds，返回新状态和导航事件，不在内部开启 timer。计时由应用服务负责。
- 将 `nav-core/src/i18n/en.ts`、`zh.ts` 的界面文案逐步移到 `navigation-app/src/i18n/`；领域层只输出错误码、事件和数据。

### B. 海图与地图交互

- 从 `apps/desktop/src/ChartPane.tsx` 提取 MapLibre 实例创建/销毁到 `packages/chart-web/src/MapController.ts`，图层更新到 `layers/`，地图点击/选择到 `interactions/`，React 地图容器到 `ChartView.tsx`。`ChartView` 通过 props/controller 接收数据和回调，不 import app store。
- `apps/desktop/src/main.tsx` 的 worker 和 CSS 设置迁到明确的 `chart-web` 入口或宿主初始化流程；必须在地图创建前执行，验证 Tauri 发布包中的 worker、字体、图标和样式能加载。
- 原 `ChartPane.tsx` 改为页面级容器，仅连接应用状态与 Web 地图视图；按钮/弹层留在 app。RN 后续实现 `src/features/chart/ChartScreen.tsx` 和 `src/adapters/chart/NativeChart.tsx`，只接共享数据与事件契约。
- 删除 ModelDemo、stressData、演示船模型和生成脚本，不在新代码中保留演示/压测入口。
- 按真实需要拆解参考项目 `RouteConstructor.js`、`NavSimulation.js`、`UserNav.js`：纯计算进入 nav-core；绘制进入 chart-web；语音与数据请求进入应用服务；删除对 window.top.EMAP、window.ohos 和 Vue ref/watch 的隐式依赖。
- 参考 `hooks/useLayer/*`、`components/someS/ship*.js` 迁移图层和 AIS 行为时，先确认原海图扩展（如 baselayer）实际来源、接口与资源；它不一定是标准 MapLibre 功能。不得把 demo style 替换一下就宣称海图复刻完成。
- 保留 `chart-core/src/pmtiles/reader.ts` 的 FileSource / Decompressor 注入。先验证 RN Hermes 对实际二进制解码、BigInt、压缩与文件随机读取的支持，不能因 TypeScript 通过就认为运行兼容。

### C. 平台能力与原生地图边界

- `apps/desktop/src/location.ts` 拆为应用定位服务和 `apps/tauri/src/adapters/location/{tauri,browser}.ts`；RN 在 `apps/react-native/src/adapters/location/` 实现相同端口。
- 统一位置数据的经纬度、精度、速度单位、航向状态、时间戳和来源；区分 GPS course 与磁/真 heading。统一禁止授权、定位关闭、超时、无定位、运行错误；不要全部归类为权限拒绝。
- 导航使用持续定位订阅，提供 start/stop 和取消订阅；后台定位另设真机验收，不把前台 watch 等同于后台持续可用。
- `platform-contracts/src/` 首批只建立 `location.ts`、`storage.ts`；语音与文件端口随对应批次加入。返回稳定错误码，由两端各自显示界面文案。
- 在 `chart-core/src/view.ts` 定义最小平台无关契约：相机位置、选中对象、业务叠加数据与地图点选事件；不暴露 DOM 元素、Web 地图类或 RN 组件类型，不预建无实际用途的统一大接口。
- Web 与 RN 原生地图都消费应用状态，地图事件转成应用 action，不各自维护第二份导航业务状态。处理地图 ready/style 重载后的图层恢复和订阅清理；高频定位、AIS、轨迹更新按变化批量提交。
- RN 后续验证原生 SDK 的资源加载和本地文件访问，数据读取接口由平台 adapter 实现；不能以 WebView、注入脚本或复制 Web 地图引擎作为原生地图的替代方案。

### D. 工程入口和脚本

- 完成基线保护后，将整个 `apps/desktop` 用保留历史的目录移动方式迁至 `apps/tauri`，包括 `src-tauri`、scripts、public 和配置。首批保留包名 `@navigation/desktop`，避免把目录移动与所有 workspace import 改名混在一起；后续可独立改名。
- 检查 `apps/tauri/vite.config.ts`、tsconfig alias、资源生成脚本、说明文档及所有旧路径引用。
- `tauri.conf.json` 的 beforeDevCommand / beforeBuildCommand 仍指向 app 内 Vite dev/build，不得改成根 Tauri 包装命令，否则可能递归。保持产品 identifier，避免目录改名顺带改变应用身份和用户数据位置。
- 根 package.json 保留现有 dev/build/web/android/android:build 的 Tauri 语义；先增加明确的 `dev:tauri`、`build:tauri`。`dev:rn`、`android:rn`、`build:rn:android` 仅在后续 RN 工程真实可运行时增加，不提供空命令。不能用调试 APK 冒充正式构建。
- RN 阶段依据原生地图 SDK、持续定位等要求选择 Expo development build 或 RN CLI；Expo 开发构建可包含原生模块，不等于 WebView，也不要求依赖 Expo Go。先查官方文档并完成原生模块验证，不沿用旧文档写死的 SDK 版本。
- RN 与 Web 可以需要不同 React 版本，不强制 override 为现有 Web 版本。React 各自在使用的 app 内声明；共享 React 组件以 peerDependency 声明；验证 Metro workspace 解析和最终 bundle 没有重复 React。
- 依赖只加到实际使用的 package；只用 pnpm，保留唯一根锁文件。新增框架/库前查官方文档；写 Tauri/插件/Android 代码前查 https://v2.tauri.app/ 。
- 删除根目录旧 `android/`、`.expo/`，不搬入新 app。新工程脚本、生成目录和 gitignore 必须按选定工具链验证。
- 更新 `AGENTS.md`、`docs/development-commands.md`，并在 `docs/marine-navigation-implementation-plan.md` 顶部注明新的双应用方案和范围关系；既有海图格式验证记录继续保留。

## 5. 分批执行与验收门槛

### P0：保护 Tauri 基线并确认复刻清单

记录 git status、工具链和现有命令结果；检查被忽略 Android 工程是否有定制。按参考项目逐个登记海图首页、图层、航线编辑、模拟导航、仪表和横屏入口，明确真实数据源和待实现项。确认现有 Base UI/shadcn 组件及所需新增组件。此阶段不创建 RN 工程。

交付：基线命令结果、页面/行为清单、Tauri 桌面当前运行截图与海图资源清单。确认原参考海图引擎扩展与服务如何替换或接入；不凭参考截图认定当前 demo style 已满足需求。

### P1：Tauri 目录迁移与 React 应用骨架

迁移 desktop → tauri，提取 chart-web，保留原三个页面、定位、点击加航点、航线和轨迹行为。在 `src/app/AppShell.tsx` 建立持久地图布局，在 `src/app/router.tsx` 组织业务页面；`src/features/chart/ChartPage.tsx` 连接地图，`src/features/navigation/RoutePanel.tsx`、`src/features/instruments/InstrumentPanel.tsx` 承接原 RoutePane/InstrumentPane。`src/components/ui` 沿用现有 shadcn/Base UI，只按需要补组件。

验收：pnpm typecheck、pnpm test、Tauri 前端构建、Tauri 桌面启动；Tauri Android 原有启动路径可用。面板切换保持地图相机、不重新创建地图；发布包资源可加载。前端构建不等同原生打包成功。

### P2：Tauri 状态重构与完整数据流程

迁移 store、异步持久化和定位服务；先在 Tauri 实现航点新增/删除、航线创建/编辑/保存/选择、仪表、轨迹列表与回放。复杂表单接入 React Hook Form/Zod。持久化写失败要能看到并重试。新增存储迁移、hydrate 竞态与写入顺序测试。

验收：fixture 输入产生确定的计算与状态；冷启动恢复已有数据；损坏数据不导致白屏；拒绝授权/超时提示准确；反复进出页面没有多重定位、重复订阅或重复地图。共享包不引入 DOM/Tauri 依赖，为后续 RN 留出真实可用的边界。

### P3：完成 Tauri 导航交互闭环

参照 NavigationView.ets 和横屏模块，完成 Tauri 的导航面板、航线节点操作、航线全览、模拟开始/暂停/继续/结束、实际导航、剩余距离/预计时间、偏航与到点事件、语音播报及横屏布局。参考模拟算法必须拆开绘图与计时后迁移。shadcn 面板、弹层、菜单和触控操作保持一致的交互层级。

验收：用录制定位序列验证到点、偏航和距离；暂停不推进，恢复不跳点；零速度、空航线、单航点、位置过期有明确行为；应用切换/后台行为有目标设备证据。先限定可验证的告警能力，不能把绘制航带等同于完整航线安全检查。

### P4：Tauri 的 AIS、搜索、图层与真实服务

参照 HomeView.ets、WebJavaScript.ets、hooks/useLayer 和船舶图层模块，分功能增加船舶/港口搜索、AIS、图层、收藏、历史轨迹、航线查询/导入导出。先列实际接口/数据源清单、鉴权和字段映射，再逐项对接，不猜接口。用户指定的 shipping-digital-backstage 文档仅适用于 shuzianhang，本项目不默认套用。

离线 PMTiles 与其他海图格式按现有 chart-core 能力和单独验证记录推进；不因本次重构就宣称 S-57/S-63/S-100 已完成。商业瓦片、字体/图标和 SDK 要核对使用及分发条件后再打包。

### P5：RN 原生地图技术验证

Tauri 导航闭环通过验收后，再创建 `apps/react-native`。查原生 SDK 官方文档并验证：Android 发布构建、Hermes 加载共享核心、原生地图真实海图源、船舶/航点符号、线与图层、定位订阅、异步存储、点击事件和生命周期。离线需求另验文件读取与海图源支持。不接受通过 WebView 暂时代替原生地图来完成本批验收。

### P6：RN 原生页面复刻与双端一致性

复用 navigation-app/nav-core/chart-core，用 RN 原生页面和 NativeChart adapter 逐条复刻已验收的 Tauri 功能。使用同一航线、轨迹和定位 fixture 比较导航结果与状态；地图符号和交互分别在真机验证。每端独立持久化，没有同步服务时不要求自动跨应用同步。只把业务与数据契约共享，DOM/CSS/shadcn 组件不迁入 RN。

## 6. 每批执行 AI 的交付格式

每批单独提供：变更文件清单、实现行为、实际执行命令及结果、运行/设备证据、遗留限制。不得把下一批空壳当成本批完成。

现有 nav-core/chart-core 测试必须继续通过；新增测试重点覆盖导航算法、异步持久化与消息恢复，不为简单界面搬迁堆测试。双端地图和原生权限必须实机核查。

本轮审查者后续按 git diff 和上述门槛检查，重点排查：业务逻辑复制两份、RN 引入 WebView 地图或 DOM/Tauri、同步存储假适配、地图维护第二份业务 store、旧数据丢失、地图重载丢状态、发布包依赖开发服务器，以及未经验证的海图能力声明。

执行期间每次对话产生的修改按根目录规则追加到当日 report/report-YYYYMMDD.md；必须先读取绝对路径，再仅用 fs.appendFileSync 追加自己的新记录。
