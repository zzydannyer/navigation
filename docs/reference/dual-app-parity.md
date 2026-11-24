# Tauri / React Native 双端复刻对照与验收

日期：2026-11-24（香港时间）。参考工程 `E:\project\Hongmeng` 只读，未修改。
详细参考行为见：

- [鸿蒙 WebView 行为](hongmeng-webview-behavior.md)
- [鸿蒙原生平台能力](hongmeng-native-behavior.md)

状态标记：**已做**＝主流程可操作；**部分**＝有入口但能力不完整；**未做**＝本批未接。

## 一、复刻范围与两端现状

| 功能 | 鸿蒙参考入口 / 结果 | Tauri | RN | 共享数据 |
| --- | --- | --- | --- | --- |
| 地图与底图 | WebView 内 MapLibre GL JS + S-52；不可旋转；按钮缩放/居中 | 已做：MapLibre GL JS，`chartView` 统一中心/缩放/朝向 | 已做：MapLibre Native，同一 `chartView` | `nav-core/geo/chartView.ts` |
| 本船与参考圈 | 1/2 NM 同心圆、0° 北字、四向方位线/刻度、0.5 NM ±45° 扇形、闪烁航向线 | 已做：1/2 NM 圈 + 扇形 + 航向/航迹向量 | 已做：同一 `buildOwnShipOverlay` | `nav-core/geo/ownShipOverlay.ts` |
| 加航点 | 参考是“航线绘制态 + 地图单击”，无长按；航点无名称、不可重命名 | 已做：地图单击添加，名称 `航点 N`；列表只能删除 | 已做：**地图长按**添加；列表重命名/删除 | 同一 store `addWaypoint/renameWaypoint/removeWaypoint` |
| 创建航线 | 绘制即航线，点序即顺序；“保存”才命名收藏；无航法选择 | 已做：把当前全部航点生成一条航线并激活；可改恒向线/大圆 | 已做：同 Tauri，按钮顺序一致 | 同一 `createRoute/setLegKind` |
| 节点编辑 | 撤回末尾点；修正态前插/后插/移动/删除；横屏长按拖动排序 | 部分：上移/下移/移出航线；无插入、拖动、撤回 | 部分：同 Tauri，按钮为文字 | 同一 `moveRouteNode/removeRouteNode` |
| 航线锁定 | 导航/模拟期间关闭测量点编辑 | 已做：会话航线与航点锁定；其他航线不能激活/开始 | 已做：同一 store 守卫 | `navigation-app` store |
| 模拟航行 | 开始（航速弹窗，默认 8 节）、结束；无暂停/继续；H5 每秒推进 | 已做：开始/暂停/继续/结束；6 节起步；计时器唯一 | 已做：同 Tauri；另有 -1/+1 节调速 | 同一 `stepSimulation` + `elapsedMonotonicSeconds` |
| 模拟计时 | H5 `requestAnimationFrame` + 1000ms 门限 | 已做：单调时钟 + 单 interval（`adapters/navigation/runner.ts`） | 已做：单调时钟 + 单 interval（`src/hooks/useSimulationRunner.ts`） | `navigation-app/clock.ts` |
| 真实导航 | 先做航线检测，再开始；真实定位到点 <50m 结束 | 部分：有效且未过期的真实定位才可开始；无航线检测弹窗 | 部分：同 Tauri；按钮与 store 双重门控 | `hasFreshRealFix` + store |
| 当前航段 | 实时导航按船位重算最近线段；模拟按索引 | 已做：按会话 `routeId + activeIndex` 派生 | 已做：同一选择器 | `selectActiveLeg` |
| 下一航点/剩余距离/ETA | H5 推 `totalDistance/nextPointDistance/nextPointSeconds` | 已做：航线面板与仪表显示 | 已做：航线面板与仪表显示，字段/单位一致 | `selectNavigationGuidance` + `arrivalEstimate` |
| 仪表 | 航迹向/艏向/航速、剩余、下一转向点、剩余秒数 | 已做：航线/状态/位置/航速/航迹向/船首向/方位/距离/偏航/到达 + NMEA 输入 | 已做：同字段顺序，加“下一航点/全程剩余/真实定位”；无 NMEA 输入 | 同一 guidance |
| 轨迹 | 导航期记录、地图尾迹；参考无完整轨迹管理 | 部分：真实定位自动记录并显示，无开始/暂停/列表/导出 | 部分：同一 store，地图显示 | `recordTrackPoint`、`trackCollection` |
| 图层/工具栏 | 右侧竖排图层抽屉；地图类型互斥 | 部分：7 个海图工具（定位/跟随/圈/向量/朝北/缩放），无图层抽屉 | 已做：同一顺序、图标、选中态；手机右侧竖排 | `chartTools/chartToolChrome` |
| 测距 | 独立 `MeaSureBase` + `navMeasure` 两套，点击已有点删除 | 未做 | 未做 | 后续批次 |
| 离线海图 | H5 无本地包读取；原生 `.yhh` 应用内下载，无导入/解析 | 未做（`chart-core` 有 PMTiles 读取器，未接地图） | 未做 | 后续批次 |
| 横屏 | 独立横屏模块、双层桥、两套面板 | 部分：桌面宽屏布局，手机自适应；无方向锁定 | 未做 | 后续批次 |
| 语音 | 原生 TTS 队列，在线音色 | 未做 | 未做 | 最后一批 |

### 结论

主流程四步“加航点 → 创建航线 → 模拟航行 → 查看航段和剩余距离”在两端均已打通，且航线、航段、剩余距离和 ETA 来自同一份共享状态与几何函数。参考工程没有“长按加航点、暂停/继续、航法选择”，这三项按本项目产品要求实现，不冒充参考复刻。

## 二、共享数据边界

新增/调整：

- `packages/navigation-app/src/chart/chartLayers.ts`：海图图层纯数据契约（航点/当前航线/当前航段/轨迹/本船），不含相机与开关。
- `packages/navigation-app/src/chart/projectChartLayers.ts`：唯一投影函数，输入导航状态，输出 `ChartLayers`；两端直接消费同一份 GeoJSON。
- `packages/navigation-app/src/store/selectActiveLeg.ts`：按会话 `routeId + activeIndex` 派生当前航段、下一航点、到点距离、全程剩余。
- `packages/navigation-app/src/store/selectNavigationGuidance.ts`：在 `selectActiveLeg` 上补方位、偏航、ETA 航速、真实定位可用性；两端只读。
- `packages/navigation-app/src/store/fixFreshness.ts`：真实定位新鲜度唯一规则（5 分钟过期、60 秒未来容差）。
- `packages/navigation-app/src/store/createNavigationStore.ts`：航点/航线编辑、会话、到点推进、持久化；新增 `renameWaypoint`，会话引用航点与航线共用一把锁。
- Tauri `apps/tauri/src/features/chart/chartSnapshot.ts`：只剩“共享投影 + `follow`”，相机跟随仍由 `chart-web` 执行。
- RN `App.tsx` 拆为 `screens/ChartScreen`、`screens/RouteScreen`、`screens/InstrumentScreen`，地图常驻，面板覆盖切换。

相机跟随、图层开关、按钮选中态仍留在各端；切换圈/向量只改本船图层，不写导航状态（单测覆盖）。

## 三、同一组输入的验收基线

三点航线（恒向线，模拟 6 节）：

| 航点 | 纬度 | 经度 |
| --- | --- | --- |
| A | 30.00000 | 122.00000 |
| B | 30.01667 | 122.00000 |
| C | 30.03333 | 122.00000 |

开始模拟后：

- 当前航段 A→B；下一航点 B；到下一航点约 1.00 NM；全程剩余约 2.00 NM；ETA 约 20 分钟。
- 运行 12 分钟（720 秒）跨过 B，当前航段切到 B→C；全程剩余约 0.80 NM。
- 暂停时船位不再变化；继续后剩余里程继续消耗；到 C 后会话 `ended`。
- 重启应用后航点、航线、激活航线仍在，`navigation.status` 回到 `idle`，模拟不自动恢复。

对应自动检查：

- `packages/navigation-app/test/chartProjection.test.ts`：共享投影、下一航点/剩余/ETA、图层开关不改状态、暂停/继续/跨点/结束、重启恢复。
- `apps/tauri/test/chartSnapshot.test.ts`：Tauri 快照与共享投影逐字段相等，只有 `follow` 是 Web 端附加。

## 四、自动检查结果

| 检查 | 结果 |
| --- | --- |
| `pnpm -r typecheck` | 通过（7 个 workspace 项目） |
| `pnpm -r test` | 通过：nav-core 32、chart-core 15、navigation-app 52、tauri 8、react-native 24 |
| `pnpm build:tauri:android` | 通过：`app-universal-release-unsigned.apk`；已用本机 debug key 签到 `qa/navigation-tauri-arm64-debug-signed.apk`，仅用于真机验收 |
| `pnpm build:tauri:windows` | 通过：`apps/tauri/src-tauri/target/release/bundle/nsis/navigation_0.1.0_x64-setup.exe`（1.88 MiB）与 `.../msi/navigation_0.1.0_x64_en-US.msi`（2.54 MiB） |
| `pnpm build:reactnative:android` | 通过：`apps/react-native/android/app/build/outputs/apk/release/app-release.apk`（约 114 MiB，本地 debug 签名） |
| 真机截图 | 已完成（设备 25053RT47C / Android 17 / 1280×2772）：`qa/rn-same-scene.png`、`qa/tauri-same-scene.png`；航段证据：`qa/rn-leg2-panel.png`、`qa/tauri-leg2-panel.png` |

## 五、真机对照验收步骤

### 1. 准备同一台手机

```powershell
adb devices -l
pnpm dra          # RN development build（需先装 development build）
pnpm dta          # Tauri Android（或安装 pnpm bta 产物）

# 或直接安装本次 release APK（Tauri 为 debug key 签名，仅验收）
adb install -r apps\react-native\android\app\build\outputs\apk\release\app-release.apk
adb install -r qa\navigation-tauri-arm64-debug-signed.apk
```

### 1.1 本次真机记录（2026-11-24）

- 设备：`25053RT47C`，Android 17（API 37），1280×2772，density 520。
- 两端都安装成功（`com.navigationmobile`、`cn.navigation.desktop`），GPS 有效，模拟船位标识与“真实定位已缓存（不覆盖模拟）”均显示。
- RN：三点航线 `0.58 海里`，模拟运行截图 `qa/rn-same-scene.png`（第一航段、速度 6.0 kn）；暂停到第二航段后面板截图 `qa/rn-leg2-panel.png`（下一航点 3、全程剩余 0.17 海里）。
- Tauri：三点航线 `0.46 海里`，模拟运行截图 `qa/tauri-same-scene.png`（第一航段、速度 6.0 kn）；第二航段证据 `qa/tauri-leg2-panel.png`（下一航点 3、全程剩余 0.08 海里）。
- 两端地图范围、底图、三点航线、第一航段和 1/2 NM 圈一致；船位进度略有差异（各自模拟起点不同），第二航段由各自航线面板截图补充。

**真机发现的问题**

1. MIUI 长按手势会弹出“文本识别”浮层，覆盖在海图上；航点仍会在浮层下成功添加。`settings put system intelligent_recognition_service 0` 未关闭该浮层，需用户手动关闭或换用非长按的加点入口。
2. Tauri toast 不会自动消失，会挡住底部“海图/航线/仪表”导航；点 toast 右侧关闭按钮时若点偏会落到地图上并新增航点。
3. Tauri 航线面板在手机上把“暂停/结束”等底部按钮排到视口之外，面板滚动未生效；本次通过临时放大 `wm size` 才点到暂停。需要给面板加可靠的滚动/固定底部操作区。
4. Tauri 发布 APK 为 unsigned，本次用本机 debug key 重新签名后安装；正式分发仍需配置签名。

两台应用使用同一底图配置：中心 `122°E, 30°N`、zoom 12、bearing 0。

### 2. 同一场景操作

1. 地图长按（RN）或单击（Tauri）依次加 A、B、C 三个航点；三点大致沿经线、间隔 0.0167°。
2. 进入航线面板，生成航线，确认当前航段为 A→B，记录“到下一航点/全程剩余/ETA”。
3. 开始模拟航行；确认本船箭头、1 NM/2 NM 圈、当前航段高亮同时可见。
4. 等待约 12 分钟或把模拟航速调到更高，确认跨过 B 后当前航段切到 B→C。
5. 暂停，确认船位数值不再变化；继续，确认剩余距离继续减少；到 C 后显示结束。
6. 杀掉应用重开，确认航点和航线仍在，导航状态为未导航。
7. 截图：RN 与 Tauri 各一张，必须包含工具栏、本船箭头、1/2 NM 圈、当前航段；地图范围一致。

```powershell
adb exec-out screencap -p > qa\rn-same-scene.png
adb exec-out screencap -p > qa\tauri-same-scene.png
```

### 3. 真实 GPS

1. 授权定位，确认“本船 · GPS”和坐标出现；点“定位”居中，再开“跟随”，拖动地图后跟随应取消。
2. 开始真实导航前断开定位或等待超过 5 分钟，确认“真实导航”按钮禁用，store 也会拒绝。
3. 模拟航行期间观察真实定位缓存：界面应显示“模拟船位”，真实定位只作缓存，不覆盖模拟画面。
4. 到系统设置撤回定位，回到应用确认授权状态与提示更新，不崩溃。

### 4. Tauri 底图重载

临时把 `packages/nav-core/src/geo/chartView.ts` 的 `chartUseTestShip` 改为 `true`，重新构建/运行；地图就绪 1.6 秒后会用同一 style 重载一次底图。确认航点、航线、航段、本船箭头与图标恢复后改回 `false`。该开关原本就用于此验收，不要提交为 `true`。

## 六、依赖旧后台 / 账号 / 私有数据的功能（不迁移）

| 功能 | 依赖 | 处理 |
| --- | --- | --- |
| 航线查询（起讫港/吃水/吨位/净空） | 服务端航线规划 | 不迁移；只保留手工选点 + 本地几何 |
| 收藏点/收藏航线云同步 | 账号、RDB/服务端 | 只用本地 store；导入导出后续批次 |
| 离线海图下载 | 会员状态、官方 `.yhh` 下载服务 | 不接；后续只做用户本地文件导入 |
| AIS/船队/航行通告/天气潮汐 | 业务后台、AIS 源 | 不显示在线目标；有本地设备再单独立项 |
| TTS 在线音色 | 系统/云语音 | 最后一批，本地可用性单独验证 |
| 官方底图 | 公开瓦片/样式服务 | 当前 `demotiles.maplibre.org` 仅开发验证；生产需按方案核验官方公开底图与署名 |

## 七、后续批次

1. **海图测距**：独立测距与航线绘制分离；点击已有点删点、总长/分段格式、清除/撤回；两端共用几何，UI 各自实现。
2. **航线与轨迹导入导出**：GeoJSON/GPX、预览、冲突决策、活动会话锁；先共享解析与校验，再接文件选择器。
3. **离线海图**：沿用 `chart-core` PMTiles；Tauri 文件导入 + Web 渲染，RN 原生 SDK 本地资源单独验证；不支持的压缩/格式明确拒绝。
4. **横屏推进**：Tauri 手机横屏布局、RN 方向锁定与安全区；参考工程横屏是独立模块，不能直接复用。
5. **语音**：最后做；先确认设备本地 TTS 能力，再排队播报到点/偏航/完成。

每批仍按“同一组输入、两端对照、先自动检查再真机”的顺序验收。
