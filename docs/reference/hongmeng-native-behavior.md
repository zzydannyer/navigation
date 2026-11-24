# hongmeng-native 原生交互与平台能力调研

> 调研对象：`E:\project\Hongmeng\hongmeng-native`（海 e 行 / HarmonyOS，ArkTS + ArkUI，API 5.0.4(16)）。
> 全文路径相对该工程根目录。证据标注：**[实现]** 代码里确认存在；**[注释]** 只在注释/文档/占位中；**[未找到]** 全仓检索无实现。
> 检索范围：`features/`、`common/`、`lib/`（无此目录）、`products/` 下全部 `.ets/.ts`，外加打包进 `products/entry/src/main/resources/resfile` 的 H5 海图产物（`map/`、`assets/`）。

## 0. 一句话结论

这不是"原生地图 + 原生导航"的工程，而是 **ArkWeb 里跑 MapLibre GL JS + S-52 样式的 H5 海图**（`README.md:8`「海图渲染：H5 WebView + JSBridge 双向通信」），ArkUI 只做面板、卡片、权限、定位、传感器、TTS、窗口与下载。因此**手势、航点拾取、航线绘制、ETA/剩余计算全部在 H5 侧**；原生侧能复用的实质是"平台能力适配层 + JSBridge 契约"，不是地图交互实现。

分层对照：

| 层 | 归谁 | 证据 |
| --- | --- | --- |
| 海图渲染、图层、点击命中、航线绘制、模拟推进、剩余/ETA | H5（`window.top.EMAP`） | `assets/home.js`（`I.handleSimulate=Le` 等整表 API）、`assets/useMapClick.js:1` |
| 容器 | ArkWeb `Web` 组件，加载 `resourceDir/index.html` 或在线 H5 | `features/home/src/main/ets/pages/HomeView.ets:368`、`:384-395` |
| 桥接 | `registerJavaScriptProxy(…, 'ohos', methodList)` | `HomeView.ets:394`、`WebJavaScript.ets:77-111` |
| 平台能力 | 定位/权限/传感器/TTS/窗口/下载/接续 | 见 §2、§5、§6 |

## 1. 地图组件与手势

### 1.1 是什么地图

- **[实现]** 无 `MapComponent`/`@kit.MapKit` 渲染：全仓 `MapComponent` 0 次；`@kit.MapKit` 仅用于坐标/距离计算（`features/home/src/main/ets/pages/HomeMapIconView.ets:3804` `map.calculateDistance(...)`，`common/basic/src/main/ets/models/vtsType.ets:1`）。**不是原生地图。**
- **[实现]** H5 里创建 MapLibre 实例：`resfile/assets/clickMap.js:1`（`new maplibregl.Map({container:"map", touchPitch:!1, style:{…name:"海图"…}, center:[122.28179,30.005598], zoom:2})`）。
- **[实现]** 矢量海图瓦片 + S-52 样式引擎：`clickMap.js:1` `a.map.loadS52({tilesUrl:"http://seamap.ehanghai.cn/services_vector/out/tiles/{z}/{x}/{y}.pbf", spriteUrl:…/sprite, colorSchema:0, pointStyle:1, …})`；样式产物为 `resfile/map/js/s52style.js` + `s52style.wasm`（1.47 MB），底图为天地图/全球海图栅格。
- **[实现]** 加载入口两态：`BuildProfile.h5Online` 为真则 `loadUrl(commonConstants.H5_URL)`（`common/basic/src/main/ets/constants/commonConstants.ets:19`，值 `http://192.168.1.16:5173/`，本地调试地址），否则 `loadUrl("file://" + resourceDir + "/index.html")`（`HomeView.ets:384-395`）。构建档位里 `h5Online` 在部分 product 为 true（`build-profile.json5:51,74,97,120,143`）。

### 1.2 手势：缩放/旋转/平移

- **[实现]** 原生只做"按钮 → 调 H5"：放大 `WebJavaScript.ets:509-511` `top.EMAP.zoomIn()`，缩小 `:514-516`；竖屏按钮 `HomeMapIconView.ets:2603-2605`、`:2627-2629`（`ic_plus`/`ic_minus`）。导航页还有"上半屏点击放大、下半屏缩小"的合一手势区：`features/navigation/src/main/ets/views/navigation/navigationFunctionView.ets:1640-1649`。
- **[实现]** WebView 自身缩放被关掉：`HomeView.ets:374` `.zoomAccess(false)`；横屏同样 `features/landscapeMode/src/main/ets/pages/Index.ets:670`。缩放全部交给 H5（MapLibre 内部手势）。
- **[实现]** **地图不可旋转**：H5 `clickMap.js:1` 里 `a.map.dragRotate.disable()`、`a.map.touchZoomRotate.disableRotation()`、`touchPitch:!1`，缩放范围 `setMinZoom(1)`/`setMaxZoom(17)`。原生还提供 `disableMapRotation()` 契约（`WebJavaScript.ets:918-921`），H5 实现在 `home.js` 的 `I.disableMapRotation=yr`。
- **[实现]** "北向上/艏向上"不是旋转地图，而是切视图模式：`WebJavaScript.ets:883-886` `top.EMAP.changeMode()`；H5 侧 `changeMode("shipUp"|"northUp")`（`home.js`）。竖屏定位按钮三态 `center/shipHeadUp/free`，并提示「船艏向上」「北向上」：`HomeMapIconView.ets:2661-2686`。
- **[实现]** 居中锁定：`WebJavaScript.ets:888-891` `changeLock(flag)`，单次居中 `:536-539` `mediate()`，H5 在居中态下用户拖动地图会回调 `moveMap()`（`home.js` `map.on("touchmove")`→`window.ohos?.moveMap()`），原生 `WebJavaScript.ets:347-349` 只发 `EventKey.MoveMap`。
- **[实现]** 比例尺/层级：H5 回调 `changeMapLevel(distance, unit, level)`（`WebJavaScript.ets:367-371`）写入 `pictureReviewModel`（`common/basic/src/main/ets/models/pictureReviewModel.ets:23-27`，初值 200/米/13），竖屏显示 level（`HomeMapIconView.ets:2844`）。

### 1.3 长按加航点 —— **未找到**

- **[未找到]** 原生侧全仓无地图长按：`onLongPress` 0 次，`LongPressGesture` 仅 3 处，且都不是地图：底部弹层拖动 `features/home/src/main/ets/components/ThreeStageModalFrame.ets:1012`、横屏航点列表拖拽排序 `features/landscapeMode/src/main/ets/components/navigation/RouteListComponent.ets:286`。「长按」中文文案 4 处，只有 `RouteListComponent.ets:420`「长按拖动修改航点顺序」与 SOS 消息页，**没有"长按地图加航点"**。
- **[未找到]** H5 产物侧也无：`resfile` 全部 88 个 js 中 `longpress/longPress/长按` 0 次；`contextmenu` 只在 `map/js/maplibre-gl.js` 内部出现，应用代码（`home.js`/`clickMap.js`/`useMapClick.js`）未监听。航点增加走的是**编辑模式 + 点击**：`togglePointEdit(1)` 开启绘制（`features/navigation/src/main/ets/views/NavigationView.ets:171`），按经纬度补点走 `addPointByLatLng`（`WebJavaScript.ets:750-752`，调用点如 `NavigationView.ets:218`、`:639`）。
- 结论：若产品要求"长按地图新增航点"，该交互在本参考工程**没有任何实现或文案证据**，属需新设计的项。

### 1.4 点击选点

- **[实现]** 命中判定在 H5，原生只收结果：`assets/useMapClick.js:1` 的 `$()` 按固定顺序 `queryRenderedFeatures` 依次探测 `nearby-roadsteads-layer → warn-* → announce-* → nav-mark-symbol → fun-ship-layer → ehh-ais-ship-layer/ehh-my-ship-layer → nearby-ports-layer → collectionPointLayer → fish-spot-* → sos-red-flash-layer`，末位兜底 `H()` 回调 `o("dot",{longitude,latitude})`。
- **[实现]** 原生入口 `WebJavaScript.ets:314-344` `clickMap(clickType, data)`，按 `clickType` 派发 `EventKey.ClickDot/ClickBoat/ClickPort/ClickAnchor/ClickWarn/ClickBuoy/ClickCollectPoint/ClickSOS`；类型定义 `common/basic/src/main/ets/models/common.ets:48`（`'none'|'dot'|'boat'|'port'|'anchor'|'warn'|'buoy'|'collectPoint'|'sos'|'fishSpot'`）。
- **[实现]** 点击模式由原生开关：`WebJavaScript.ets:549-552` `changeClick(bool)`；调用点 `products/entry/src/main/ets/pages/Index.ets:369`、`:699-700`，横屏 `features/landscapeMode/src/main/ets/pages/Index.ets:628-630`。
- **[实现]** 航线点修正：点中测距点标签时 H5 调 `window.ohos?.fixRoutePointDialog({longitude,latitude})`（`home.js` `map.on("click","measure-point-labels")`），原生 `WebJavaScript.ets:421-423` → `EventKey.ClickRoutePoint`，由 `NavigationView.ets:466-478` 插点并刷新面板。

## 2. 定位与权限

### 2.1 定位 API 与新鲜度

- **[实现]** `@kit.LocationKit`：持续定位 `geoLocationManager.on('locationChange', request, cb)`，请求参数 `{ interval: 1, locationScenario: UserActivityScenario.NAVIGATION }`（`common/basic/src/main/ets/utils/LocationManage.ets:200-211`）——**1 秒一次**。
- **[实现]** 单次定位 `geoLocationManager.getCurrentLocation()`（`LocationManage.ets:233-247`），失败时返回上一次缓存并打日志。
- **[实现]** 重复订阅防护：每次 `onLocation` 先 `off` 旧回调（`LocationManage.ets:206-211`），注释说明"否则同一定位被多个回调重复处理"。
- **[实现]** 卫星/北斗：`geoLocationManager.on('satelliteStatusChange')`，过滤星座为「北斗」（`LocationManage.ets:250-290`），供位置卡片展开显示（`features/home/src/main/ets/components/PositionInfoCard.ets:107-109`）。
- **[实现]** 朝向角度：`@kit.SensorServiceKit` `sensor.SensorId.ORIENTATION`，`INTERVAL = 500000000` ns（0.5 s），并留有 `// TODO 确认最终上线的数据更新间隔`（`common/basic/src/main/ets/utils/SensorManage.ets:5-6`、`:28-33`）。
- **[实现]** H5 取定位的节奏与之不同：`SimNavigationState.ets:3` 注释写明「H5 … 仍以约 3 秒一次的节奏调用 ohos.getOnceLocation()」。即**原生持续 1 s，H5 轮询约 3 s**。
- **[实现]** H5 不直接用浏览器定位：`geolocationAccess(true)` 全仓 0 处（唯一相关为登录协议页显式 `false`，`features/mine/src/main/ets/views/LoginView/HuaWeiUserAuthenticationProtocolWebView.ets:64`），定位只能走 `ohos.getLocation/getOnceLocation`。

### 2.2 权限申请 / 拒绝 / 撤回

- **[实现]** 申请集合：`ohos.permission.LOCATION` + `ohos.permission.APPROXIMATELY_LOCATION`（`common/basic/src/main/ets/utils/PermissionManage.ets:12-16`）；`module.json5` 另声明了 `LOCATION_IN_BACKGROUND`（`products/entry/src/main/module.json5:118`）。
- **[实现]** 两条路径：
  - 冷启动一次性申请 `atManager.requestPermissionsFromUser`（`PermissionManage.ets:44-65`），入口 `products/entry/src/main/ets/pages/Index.ets:474-477`；`EntryAbility.ets:145` 的原调用已被注释。
  - 功能级申请：先 `checkPermission()`，未授权则弹自定义弹窗再 `requestPermissionOnSetting`（`PermissionManage.ets:70-125`）。弹窗文案：标题「需要开启定位权限」，正文「提供导航和航线规划服务，需要获取位置信息」（`PermissionManage.ets:86-87`）。
- **[实现]** 授权成功的即时恢复：调 `webJavaScript.reLocation()`（`PermissionManage.ets:58`、`:99`）→ `top.EMAP.tryOhos()` 重新拉定位（`WebJavaScript.ets:495-501`），并发 `EventKey.PortTide`。
- **[实现]** 拒绝/撤回后的界面状态：
  - H5 侧拿到"全 0 定位"继续跑：`WebJavaScript.ets:156-172` 未授权时回调 `{latitude:0, longitude:0, speed:0, …}`。
  - 点「定位」按钮前先做功能级校验，未通过则**按钮无任何动作**（不弹 toast）：`HomeMapIconView.ets:2646-2650`、`features/landscapeMode/src/main/ets/components/MapIconPositionCenterButton.ets:57-58`、`products/entry/src/main/ets/pages/Index.ets:982-990`。
  - 系统开关类失败有轻提示：`LocationManage.ets:69-96`，文案取自资源「位置功能关闭，请检查位置设置」「网络已断开，请检查网络设置」「WiFi或蓝牙关闭，请检查设置」（`common/basic/src/main/resources/base/element/string.json:8-9,12-13,16-17`）。
  - 卡片级"定位成功/定位失败"状态：`features/mine/src/main/ets/components/LocationInfoComponent.ets:103-107`。
  - 未授权时位置卡片不订阅 GNSS，改为等 `EventKey.PositionInfoCardRefresh` 再订阅（`PositionInfoCard.ets:24-35`）。

### 2.3 模拟位置 vs 真实位置

四层机制，原生侧都显式区分：

1. **模拟导航船位快照** `SimNavigationState`（`common/basic/src/main/ets/utils/SimNavigationState.ets`）：H5 每秒 `toNavigation('sim',…)` 写入 → `getOnceLocation()` 优先返回快照；`SIM_LOCATION_EXPIRE_DURATION = 5000` ms 心跳超时（`:10-11`），超时或经纬度同时≈0 视为无效并回落真实定位（`:38-51`）。
2. **模拟绑定任意 AIS 船**：`SimAISType.type && TrackFusionState.segmentStr === TRACK_FUSION_SEGMENT_SIMU`（`LocationManage.ets:103-127`）；关键注释「原生侧不写回 this.location，保证手机定位基准不被模拟 AIS 船位污染，轨迹融合判定能取到真实 GPS」（`:123-124`）。
3. **实际绑定已融合**：位置仍取手机 GPS，但速度/方向换成绑定船 AIS（`LocationManage.ets:130-147`），注释解释是为了让 H5 能算 ETA（「面板底部"-- 剩余"」，`:128-129`）。
4. **两条桥自报身份**：`getLandscapeStatus()` 竖屏返回 `false`（`WebJavaScript.ets:488-490`）、横屏返回 `true`（`features/landscapeMode/src/main/ets/utils/LandscapeJSBridge.ets:398-401`）——H5 用它区分当前宿主布局，**不是**真实旋转状态查询。

## 3. 航点 / 航线 UI

### 3.1 入口与列表

- 竖屏：底部条「线路总长：X海里」+「模拟导航」+「导航」+「绑定当前所在船舶」（`features/navigation/src/main/ets/views/NavigationView.ets:1505-1607`）。无独立航点列表，航点在图上一体化编辑。
- 横屏：独立面板「航线航点列表」，表头「序号 / 经纬度 / 操作」（`RouteListComponent.ets:179`、`:204-222`），每行三个图标＝修改点 / 新增点 / 删除点（`:247-269`），底部「确认修改」（`:392`）。
- **重命名**：仅"收藏航线"支持。侧滑"编辑"打开弹窗标题「设置航线名称」、占位「请输入航线名称」（`features/mine/src/main/ets/views/CollectionView/collecionRouteView.ets:51-52`、`:268-272`）。航点本身无命名。
- **删除**：航点行内删除（`RouteListComponent.ets:262-268`，改后需「确认修改」才回写 H5）；航线删除走确认弹窗「确定要删除此数据吗?」（`collecionRouteView.ets:71`、`:285-288`）。离线海图删除见 §5。
- **排序**：**[实现]** 横屏长按拖动重排——顺序手势 `LongPressGesture` + `PanGesture`（`RouteListComponent.ets:283-384`），步长 `ITEM_INTV=42`（`:123`），`itemMove()` 交换（`:135-138`），提示文案「长按拖动修改航点顺序」（`:420`）。**[未找到]** 竖屏排序。

### 3.2 创建航线与航法

- **[实现]** 绘制模式开关：`togglePointEdit(0|1|2)`（`WebJavaScript.ets:898-901`）；竖屏切 Tab/退出测距/进出导航都会重设模式（`NavigationView.ets:168-210`）。0=关、1=可编辑、2=修正（由 `isCorrect`/`isCorrectRouteInquiry` 驱动，`:194-210`）。
- **[实现]** 航线数据由 H5 回传：`setRoute(json)` / `setRouteList(总航程 number)`（`WebJavaScript.ets:351-361`）；原生 `NavigationView.ets:419-433` 把点写进 `appContinueUtil.route`、把总长写进 `this.long`。**原生不落库**——即航线只在内存 + 应用接续（见 §6.3）。
- **[实现]** 航线查询（起终点规划）：模型仅"出发港/目的港/桅高/吨位/吃水"（`features/navigation/src/main/ets/models/RouteInquiryModel.ets:3-9`）。
- **[未找到]** **航法选择**：`航法/恒向线/大圆航法/等角航线` 全仓 0 处（`大圆` 仅 `GeoUtils` 的注释级引用 1 处）。没有"大圆/恒向线/推荐航法"这类选项。
- **[未找到]** "创建航线"作为按钮/菜单项 0 处；创建即"进入绘制模式点图 + 保存"，保存入口是收藏航线（§3.1）。

### 3.3 锁定规则

- **[实现]** 航线点锁定：`measurePointsLCK(true|false)`（`WebJavaScript.ets:846-849`）；开始模拟/开始导航前 `false`，退出/结束时 `true`（`simulatedNavigationView.ets:50,91,205`；横屏 `NavigationView.ets:151,192,542`）。
- **[实现]** 居中锁定：`changeLock(bool)` + `isCenter.type`（`simulatedNavigationView.ets:1068-1078`，文案「锁定中/居中锁定」）；进入导航/模拟会先判 `isNorth` 与 `isCenter` 再复位（`:53-66`）。
- **[实现]** 导航/测距时禁改：`@Monitor('isMeasure')` 中若在导航或模拟导航，强制 `togglePointEdit(0)`（`NavigationView.ets:177-192`）。
- **[实现]** 横屏"开始导航"弹窗：「开始导航」确认后才 `handleNavigation(false)` + `measurePointsLCK(false)`（`features/landscapeMode/src/main/ets/components/navigation/NavigationView.ets:140-154`）。

### 3.4 与 WebView 版是否共用逻辑

- **[实现]** 与目标仓的 WebView 版**不共用代码**，只共用"H5 海图契约"：H5 产物是独立构建后拷进 `resfile` 的（`README.md:226-234`「npm run build … 复制到 products/entry/src/main/resources/resfile」）。
- **[实现]** 工程内部竖屏/横屏**也不共用**：两套桥（`WebJavaScript` / `LandscapeJSBridge`）、两套面板、两份 `TTSManage`（`common/basic/.../TTSManage.ets` 217 行 vs `features/landscapeMode/.../TTSManage.ets` 286 行，后者绑定 `landscapeJSBridge`），仅共享 `basic` 下的模型/工具。这是最大的一处重复成本。

## 4. 模拟航行

- **[实现]** 开始：竖屏点「模拟导航」→ `isSimulatedNavigation = true` → 弹「航速设置」（`simulatedNavigationView.ets:122-130`、`:81-108`）；横屏先校验 `route.length > 1`，否则 toast「航线未绘制」（`NavigationView.ets:2342-2350`），确认后 `handleSimulate(data)` + `measurePointsLCK(false)`（`:184-193`）。
- **[实现]** 航速：弹窗输入框默认 `'8'` 节（`features/landscapeMode/src/main/ets/components/navigation/SpeedSettingCustomDialog.ets:3,9`），原生把数值透传 H5 `top.EMAP.handleSimulate(speed)`（`WebJavaScript.ets:834-839`，进入前先 `simNavigationState.reset()`）。**推进逻辑在 H5**（`home.js` `I.handleSimulate=Le`、`I.simulationInstance=te`）。
- **[实现]** 结束：只有"退出/结束"，无暂停/继续。退出确认「确定要退出模拟导航，是否继续？」（`simulatedNavigationView.ets:47`）→ `destroySimulation()` + `measurePointsLCK(true)`；H5 回 `changeNavigationStatus('end'|'offset'|'unoffset')`（`WebJavaScript.ets:425-432`），`'end'` 时 toast「本次导航结束」并复位（`simulatedNavigationView.ets:199-233`）。
- **[未找到]** 暂停/继续模拟航行：`暂停` 仅出现在轨迹记录、海图下载、TTS 播报三处；`继续导航` 只在**注释掉的**代码里（`navigationFunctionView.ets:1779`、`simulatedNavigationView.ets:1354`）。
- **[实现]** 仪表字段（竖屏模拟面板，底部 75vp 条）：`剩余` + `totalDistance` + 「距离下一个转向点{nextPointDistance} {nextPointSeconds}」（`simulatedNavigationView.ets:1379-1425`）；上方小面板：航迹向 `°`、艏向 `°`、航速 `x.x节`（`:900-949`）。
- **[实现]** 字段来源：H5 每秒推 `toNavigation('sim', data)`（`WebJavaScript.ets:403-412`），模型字段 `totalSeconds`（航时）/`totalDistance`（剩余距离）/`nextPointDistance`/`nextPointSeconds`/`shipTrackDirection`（`common/basic/src/main/ets/models/navigationType.ets:46-53`）。**ETA 与剩余距离都由 H5 算**，原生只格式化显示。
- **[实现]** 竖屏**真实**导航面板无剩余/ETA：那段 UI 被整块注释（`navigationFunctionView.ets:1655-1735`），实际显示「目的地方位 / 风向 / 风速(米/秒) / 目的地直线距离 / 海里 / 目的地经纬度」（`:2307,2329,2364,2405,2417,2429`）+ 航速仪表 `InstrumentPanelView`（`:2283`）。
- **[实现]** 横屏导航面板对 H5 push `0` 做兜底：`countTotalSeconds/countNextPointSeconds` 连续 >3 次收到 0 就显示 `--`（`NavigationView.ets:513-524`、`:2536-2540`），避免手机静止时面板显示 0 秒/0 海里。
- **[实现]** 仪表是自绘：`InstrumentPanelView.ets:3`「转换自 Android InstrumentPanelView」、`DirectionDialView.ets:3` 同（Canvas `fillText`，`:238`、`:274`）。
- **[实现]** 语音：`ttsSpeak` → `@kit.CoreSpeechKit`，`language:'zh-CN'`、`person:0`、`online:1`、`style:'interaction-broadcast'`（`common/basic/src/main/ets/utils/TTSManage.ets:41-51`）；队列串行播报，遇「已到达目的地附近」清空队列并播完即释放（`:131-137`、`:180-182`）；设备不支持时 toast「当前设备不支持文字转语音功能」（`:119-121`）。

## 5. 离线海图

- **[实现]** 有真实下载与删除，**不是占位**：下载用 `@hadss/super_fast_file_trans` 的 `DownloadManager`（`features/mine/src/main/ets/views/ChartDownLoadView.ets:38`），4 线程 + 断点续传 + 3 次重试（`:126-135`、`:178-206`），支持暂停/继续（`:209-259`）。
- **[实现]** 格式与位置：文件后缀 `.yhh`，落在应用私有 `context.filesDir`（`:236`、`:973`、`:1007` `item.filePath = downloadDir + '/' + item.name + '.yhh'`）。`filesDir` 被额外放行给 WebView 跨域访问（`HomeView.ets:379-382` 与 `filesDir + "/example"`），供 H5 侧读取。
- **[实现]** 分区：按 `areaNo` 分「中国沿海 / 香港 / 长江」，尾号 `SC_1_00000013`、`14` 为长江，`24` 为香港（`ChartDownLoadView.ets:977-987`，另有设计注释 `:261-267`）。仅会员可看最新版（`getSubscribeStatus()` `:1089-1098`，文案「已订阅」/「订阅最新版本」）。营销文案「中国沿海官方海图定期更新服务，离线下载；」「支持下载离线查看，没有网络也不怕；」（`:391`、`:704`）。
- **[未找到]** 文件选择器：`DocumentViewPicker` 仅用于导出航线 docx（`features/navigation/src/main/ets/views/export/exportRouteView.ets:122-123`）。离线海图**只能应用内下载，不能导入本地文件**。
- **[未找到]** 原生侧 `.yhh` 读取器：全仓 `.yhh` 只出现在写入路径（`ChartDownLoadView`、`ChartDownLoadInfo`），无 `fileIo` 读取/解析海图的代码；渲染仍由 H5 用自身瓦片源完成。`common/database/src/main/ets/utils/chartDataBase.ets:4` 甚至标着 `// TODO 替换掉这个类`，属遗留。
- **[实现]** 图层开关（不等于离线开关，但同属海图控制）：`features/home/src/main/ets/models/mapLayer.ets` 统一定义 5 类共 24 个开关，全部 `webJavaScript.changeXxx()` 透传 H5：
  - 地图类型 5：官方海图/标准地图/卫星地图/海陆融合图/影像图融合图（`:114-167`，`toggleMapType`→`reash(id)`）；
  - 船舶 3：船舶绿点/AIS 船位/船队（`:173-213`）；
  - 地图展示 6：经纬网格/我的收藏/领海基线/渔区边界/船舶尾迹（夜间模式已注释，`:233-244`）；
  - 航线安全 10：航线警告/航行通告/通航相关/东海·南海·黄渤海 VTS/避碰圈/禁钓区/航标/沿海航路（`:300-423`）；
  - 长江要素 4：长江航标/水位站/黄浦江警戒线/黄浦江浮筒（`:428-483`）。
  - 会员限制：`VIP_LAYER = ['长江航标','水位站']`（`:15`），`disableLayer()` 用 `computeMapChart()` 判定（`:85-93`）。
  - 图层初值由 `getChartInitList` 反向提供给 H5（`WebJavaScript.ets:151-153` → `mapLayer.ets:524-529`），**竖屏每次下发的是代码内默认值**，不读本地持久化；横屏才持久化（§6.3）。

## 6. 横屏 / 生命周期 / 后台 / 持久化

### 6.1 横屏适配

- **[实现]** "横屏"是一个**独立特性模块 + 独立路由栈**，不是单纯旋转：`products/entry/src/main/ets/pages/Index.ets:998-1011` 依 `tableViewStatusStore.isTableViewMode` 在 `landscapeModePage()` 与竖屏页之间二选一；切换入口在右上角「切换横屏」按钮（`HomeMapIconView.ets:2486-2514`）。
- **[实现]** 真旋转在此模块内设置：`onPageShow` 与 `aboutToAppear` 都 `setPreferredOrientation(AUTO_ROTATION_LANDSCAPE_RESTRICTED)`（`features/landscapeMode/src/main/ets/pages/Index.ets:450-465`、`:467-482`），`aboutToDisappear` 恢复 `AUTO_ROTATION`（`:537-551`）；进入即 `FullScreenManage.hideStatusBarAndNavigationBar()`（`:499`）。`module.json5` 未声明 `orientation`，靠运行时设置。
- **[实现]** 会员门槛：「横屏模式为会员功能，非会员试用期为7天，点击开始试用」（`common/basic/src/main/ets/components/HorizontalVIPDialog.ets:21`），由 `checkHorizontalVipStatusAPI()` 判定（`HomeMapIconView.ets:2498-2513`）。
- **[实现]** 折叠屏兜底：`display.on('foldStatusChange')` 折叠时强制退出横屏（`common/basic/src/main/ets/utils/Breakpoint.ets:45-49`）。
- **[实现]** 沉浸式/安全区：`setWindowLayoutFullScreen(true)` + 按 `AvoidAreaType.TYPE_SYSTEM`/`TYPE_NAVIGATION_INDICATOR` 换算 `topHeight/bottomHeight`（`common/basic/src/main/ets/utils/FullScreenManage.ets:9-26`）。

### 6.2 前后台与恢复

- **[实现]** `onForeground`：恢复定位/传感器（`this.recoverResource()`，`EntryAbility.ets:335`）、`setWindowKeepScreenOn(true)`（`:355-357`）、重启 SOS 轮询（`:338`）。
- **[实现]** `onBackground`：`UploadLocation.stop()`、`releaseResource()`（`locationManage.offLocationChange()` + `sensorController.destroy()` + 置 `isBackground`，`EntryAbility.ets:477-482`、`:364-380`）、`setWindowKeepScreenOn(false)`（`:378`）。
- **[实现]** 恢复按当前布局选桥：横屏用 `landscapeJSBridge.reAngle()/reLocation()`，竖屏用 `webJavaScript.*`（`EntryAbility.ets:484-509`）。
- **[实现]** WebView 侧：`onControllerAttached` 里 `registerJavaScriptProxy` + `refresh()`（`HomeView.ets:376-402`）；`onDisAppear` 置 `isInitted = false`（`:403-406`）；离开页面 `controller.stop()`（`common/basic/src/main/ets/components/WebViewComponent.ets:123-128`）。
- **[实现]** 返回键先回退 H5 历史：`accessBackward()/backward()`（`WebViewComponent.ets:130-136`、`:139-151` 的 HMLifecycle）。

### 6.3 持久化

| 数据 | 载体 | 证据 |
| --- | --- | --- |
| 横/竖屏模式 | `PersistenceV2` `TableViewStatusStore` | `common/basic/src/main/ets/models/landscapeModel.ets:13-18` |
| 横屏图层开关 | Preferences 文件 `hex-table`，键 `LayerListKey` | `landscapeModel.ets:22-49` |
| H5 POI/图层态（原生代为落盘） | Preferences `PoiData`，>13 MB 时落 `filesDir/poi_large_data.json` | `common/basic/src/main/ets/utils/poiDataSetting.ets:10-18`、`:92-118` |
| 离线海图列表 | Preferences `chartDownload` | `ChartDownLoadView.ets:1060`、`common/basic/src/main/ets/constants/history.ets:27` |
| 避碰圈距离/角度 | Preferences `safetyDistance`/`angle` | `WebJavaScript.ets:373-387`、`history.ets:17-18` |
| 收藏点/收藏航线 | RDB（`common/database`） | `HomeView.ets:623-696` |
| 航线（当前） | 内存 `appContinueUtil.route`，仅用于**应用接续** | `common/basic/src/main/ets/utils/AppContinueUtil.ets:19-39`、`EntryAbility.ets:387-415`、`:418-455` |

- **[实现]** 接续开关由航线是否为空驱动：有航线 `setMissionContinueState(ACTIVE)`，清空即 `INACTIVE`（`AppContinueUtil.ets:31-39`、`:45-61`）。
- **[实现]** 跨端迁移数据只传坐标数组，迁移后 `restoreWindowStage`（`EntryAbility.ets:405-409`、`:451-453`）；版本过低拒绝并提示「目标端应用版本号过低，不支持接续…」（`:395-400`）。

## 7. 与 WebView 版的差异

**纯壳（照搬即可，不含平台价值）**
1. 海图渲染与样式：MapLibre GL JS + S-52（`resfile`），两端都是 JS 地图，差别只在宿主容器。
2. 点击命中、航线绘制、模拟推进、ETA/剩余距离/下一转向点：全部 H5（`assets/useMapClick.js`、`assets/home.js`）。移植时这些逻辑应回到共享 TS 层，而不是在原生侧重写。
3. 图层内容与会员分层规则（`mapLayer.ets`）——数据驱动，可原样搬到配置层。

**平台特有（HarmonyOS 独有，换端必须重写）**
1. 定位/传感器：`@kit.LocationKit` + `@kit.SensorServiceKit`（§2.1）。WebView 版只能用浏览器 Geolocation / DeviceOrientation，精度与频率不可控。
2. 权限：`abilityAccessCtrl` 两段式（首次申请 + `requestPermissionOnSetting` 半模态），且能感知"撤回后按钮静默失败"（§2.2）。
3. 语音：`@kit.CoreSpeechKit` 本地/在线 TTS + 队列（§4）。WebView 版无等价离线能力。
4. 窗口与生命周期：`setWindowLayoutFullScreen`/`setWindowKeepScreenOn`/`setPreferredOrientation`/`onForeground|onBackground`（§6）。
5. 离线海图：应用私有目录 `.yhh` + 4 线程断点续传 + WebView 放行 `filesDir`（§5）。WebView 版需文件系统插件才能对齐。
6. 应用接续 `setMissionContinueState` + `onContinue/recoverData`（§6.3），HarmonyOS 生态独有。
7. 周边：微信/支付宝支付、极光推送、云信通话、AIS 解析（`common/library`）等，见各 `oh-package.json5`。

**契约缺口（移植时要显式补齐，否则 H5 会打到空方法）**
1. `methodList` 里 `'routeDrawing'`、`'clickRoutePoint'` 有声明**无实现**（`WebJavaScript.ets:84,88`、`LandscapeJSBridge.ets:70,74`，全仓 0 处定义），而 H5 确实会调 `window.ohos?.routeDrawing(pointCount)`（`assets/ohos.js`，航线绘制模块内逐点调用）。
2. `getLandscapeStatus()` 硬编码（竖屏 `false` / 横屏 `true`，§2.3），不是真实布局查询。
3. `changeLatAndLonFormat` 在横屏 `methodList` 里重复声明了两次（`LandscapeJSBridge.ets:63-98`）。
4. 竖屏不给 H5 下发持久化图层，横屏才下发（§5 末尾），两端表现会不一致。
5. 竖屏真实导航的"剩余时间/剩余距离"UI 被整块注释（§4），若以本工程为准会误判该字段缺失。

## 8. 明确未找到 / 需产品确认

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 长按地图加航点 | 未找到 | 原生与 H5 产物均无长按监听/文案（§1.3） |
| 航法选择（大圆/恒向线） | 未找到 | `航法` 0 处（§3.2） |
| 模拟航行暂停/继续 | 未找到 | 只有开始/退出/结束（§4） |
| 航点排序（竖屏） | 未找到 | 仅横屏长按拖动（§3.1） |
| 本地文件导入海图 | 未找到 | 只能应用内下载（§5） |
| 原生读取/解析 `.yhh` | 未找到 | 渲染仍走 H5 瓦片源（§5） |
| 地图旋转 | 实现为"禁用" | `dragRotate.disable()` + `disableMapRotation()`（§1.2） |
| "创建航线"独立入口 | 未找到 | 靠绘制模式 + 收藏航线保存（§3.2） |
