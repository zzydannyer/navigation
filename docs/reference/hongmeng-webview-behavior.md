# 鸿蒙 WebView（hongmeng-webview）导航交互行为参考

> 目标：不读源码也能按本文复刻同样的交互。仅只读调研，参考工程未做任何修改。
> 路径简写：`WV/` = `E:\project\Hongmeng\hongmeng-webview`；`NAT/` = `E:\project\Hongmeng\hongmeng-native`。
> 说明：任务指定的 5 个文件均位于 `WV/`；为定位“入口（按钮/手势/菜单）”，另读了 `NAT/` 中调用 `top.EMAP.*` 的原生页面，正文中以 `NAT/` 前缀标注，其余引用都是 `WV/` 内文件。为还原行为另追读了直接 import 的小文件：`useNav/layers.js`、`useNav/NavSimulation.js`、`useNav/NavConstructor.js`、`useNav/utils/index.js`、`useNav/utils/useCalc.js`、`someS/ohos.js`、`someS/MeaSureBase.js`、`someS/useMapClick.js`、`mapAttribute.js`、`public/map/js/s52style.js`、`SeaListChart.vue`（均已在文中标注）。

## 1. 加航点

### 1.1 入口（三个，全部在“航线规划 / 航线绘制”页）

| 入口 | 位置/证据 | 说明 |
| --- | --- | --- |
| 点地图加点 | `NAT/features/navigation/src/main/ets/views/NavigationView.ets:168-175`（切到“航线绘制”时 `togglePointEdit(1)`）→ `WV/src/components/someS/navMeasure.js:1109-1131`（`isMeasuring=1` 时 `map.on('click', handleMeasureClick)`，光标 `crosshair`） | 主要交互：单击海图即追加一个航点 |
| 顶部“经纬度”按钮 | `NAT/.../NavigationView.ets:1312-1330`（`Text('经纬度')`）→ 弹窗 `新增点`（`:882-937`）→ `addPointByLatLng(lat,lon)`（`:212-219`）→ `WV/.../navMeasure.js:1191-1225` | 输入度分秒后确定，追加点并 `flyTo({zoom:12,duration:800})` |
| 顶部“引用点”按钮 | `NAT/.../NavigationView.ets:1332-1354`（`Text('引用点')`，弹出“我的收藏点”列表）→ `addPoint(POINT(...))`（`:212-219`） | 收藏点 `geom` 为 `POINT(lon lat)`，解析后同经纬度加点 |

非航线绘制模式下点地图**不会**加航点：只会 `changeCPoint` 并抛出 `dot` 事件（`WV/.../useMapClick.js:495-514`、`someS/ohos.js:154-198`）。长按/双击/拖拽等其它加点手势：未找到。

### 1.2 操作过程与写入的数据
1. 点击 → `handleMeasureClick`：`coordinates = e.lngLat.toArray()` → `measurePoints.value.push(coordinates)`（`navMeasure.js:150-160`）。
2. `calculateDistances()`：逐段 `turf.distance(from,to,{units:'kilometers'})` 累加到 `totalDistance`（公里），方位用自实现的 `calculateBearing`（`navMeasure.js:120-148`，`MeaSureBase.js:149-171`）。
3. `updateMeasureLayer()` 重建 GeoJSON 并回传原生（`navMeasure.js:474-1108`）。

数据字段（`measurePoints` 是唯一真源，元素为 `[lng,lat]`）：

| 载体 | 字段 |
| --- | --- |
| 点要素 | `id: measure-point-{i}`、`cid: i`（点击命中用）、`pointType: start|middle|end`、`label: '起'|'终'|''`、`coordText: "纬度\n经度"`、`showElements`（`navMeasure.js:547-565`、`979-1008`） |
| 线要素 | `id: measure-line`（主线）、`id: measure-start-end-line`+`isStartEndLine`（≥3 点时起点直连终点红线）（`:577-606`） |
| 分段标签 | `id: measure-segment-{i}`、`segmentText`、`route`（文字旋转角）（`:636-680`） |
| 带宽面 | `id: measure-path-area`、`pathArea: true`（`pathAreaWidth>0` 时）（`:609-633`） |
| 回传原生 | `window.ohos.setRoute(JSON.stringify(measurePoints))`、`setRouteList(totalDistance/1.852)`（海里）（`:451-454`、`975-976`） |

### 1.3 地图显示与文案
- 航点图标：`measure-point-labels` 用 `match pointType` → `upStart / upEnd / upMiddle`，`icon-size .7`（`navMeasure.js:893-926`）；另有一层金色圆点 `measure-points`（`circle-color #FFD700`，`radius .1`）（`:684-709`）。
- 坐标文本：`measure-point-coords` 12px、`text-offset [0,1.7]`、`text-anchor top`，格式随原生 `LatAndLonFormat` 0/1/2 切换 `D°M'S"S` / `D°M.m'` / `D.d°`（`navMeasure.js:521-545`、`951-974`）。
- 分段标签：中点（经纬度算术平均，非大地线中点）显示 `"${(angle+360)%360 保留1位}°.1-${海里保留2位}海里"`，蓝色 `#4876FF`（`navMeasure.js:641-680`、`807-827`）。注意 `.1-` 是源码里的固定字面量。
- 主线 `#0074D9`、宽 3、`line-opacity .8`；≥3 点时红线 `#FF0000` 宽 1 连起终点；带宽面 `rgba(0,140,255,.6)`（`navMeasure.js:726-741`、`845-890`、`928-948`）。
- 视图：仅 `addPointByLatLng` 会 `flyTo` 到新点；点地图加点不移动视野（`navMeasure.js:1213-1217`）。

### 1.4 成功后的状态变化
- 原生收到 `setRouteList` 后更新 `long`（海里），底部“线路总长：X.XX海里”（`NAT/.../NavigationView.ets:1508-1514`），`long>0` 才显示“保存”且才允许模拟/导航（`:1452`、`:1536-1548`）。
- 每加一点调一次 `window.ohos.routeDrawing(点数)`（`navMeasure.js:979-981`），原生据此控制“撤回”行为与编辑态。

### 1.5 删除 / 重命名
- 删除单点：进入“修正航线”（`togglePointEdit(2)`，`NAT/.../NavigationView.ets:194-201`）后点航点 → `fixRoutePointDialog`（`WV/src/components/FMCMap.vue:1005-1025`）→ 原生弹窗“删除此节点”（`NAT/.../NavigationView.ets:1184-1195`，`fixRoutePointEvent('del',...)`）→ 实现为 `measurePoints.splice(index,1)`（`WV/.../ohos.js:482-487`）。
- 弹出点编辑：修正态点航点还会出现“选点前插入/选点后插入”“确认”（`beforeAdd/afterAdd/move`），见 `NAT/.../NavigationView.ets:1066-1180`、`WV/.../ohos.js:463-481`。
- 撤回最后一个：右栏“撤回” → `undoLastMeasure()`（`navMeasure.js:1133-1144`）。
- 重命名航点：**未找到**（参考工程航点没有名称字段，只有坐标与“起/终”标签）。

## 2. 创建航线

- 入口：首页/工具栏进入“航线规划”页；顶部两个 tab：`航线绘制` / `航线查询`（`NAT/.../NavigationView.ets:1254-1310`），标题栏 `航线规划`（`:1208-1209`）。
- 选点顺序：按点击先后顺序写进 `measurePoints`（数组顺序即航线顺序）；终点是最后一个元素。
- 节点排序/移除：
  - 反转顺序 = “切换起始”，直接 `measurePoints.value.reverse()`（`navMeasure.js:1246-1257`，按钮 `NAT/.../NavigationView.ets:1418-1433`）。
  - 撤回末尾点（`undoLastMeasure`）；修正态可“前插/后插/移动/删除”（上节）。
  - 清除整条：返回上一页时 `clearMeasure()`（`NAT/.../NavigationView.ets:1214-1243`），重置 `measurePoints/totalDistance/pathAreaWidth` 并清空数据源（`navMeasure.js:89-117`）。
- 航法选择（恒向线/大圆等）：**未找到**。全部几何都用 turf 默认大圆（`turf.distance/length` + `turf.bearing`）；分段长度 `turf.length(line,{units:'nauticalmiles'})`（`navMeasure.js:137`、`RouteConstructor.js:61`）。唯一的“大圆”字样是原生工具注释（`NAT/common/basic/.../GeoUtils.ets:159`），非可选项。
- 航线命名：底部“保存” → `saveRoute()` 打开“设置航线名称”弹窗（`placeholder: '请输入航线名称'`，`NAT/.../NavigationView.ets:112-126`、`311-321`），名称与 `pathList` 一起落库（`NAT/common/basic/.../HEXMarkDialog.ets:304`、`362-364`）。收藏航线列表左滑有“编辑/删除”，删除确认文案“确定要删除此数据吗?”（`NAT/features/mine/.../collecionRouteView.ets:51-71`、`252-274`）。
- 激活/锁定规则：
  - 模拟/真实导航开始前要求 `long>0`，否则 toast `航线未绘制`（`NAT/.../NavigationView.ets:1536-1548`、`1559-1570`）。
  - 真实导航前弹“航线检测提示”：`该航线可能接近航标和孤立危险物、穿越安全等深线和地理区域边界!请放大比例尺后仔细检查后重新检测。`，按钮“再次检查 / 开始导航”（`NAT/.../NavigationView.ets:133-157`）。
  - 导航会话期间原生用 `measurePointsLCK(false)` 隐藏测量/航线点，结束再 `measurePointsLCK(true)`（`NAT/.../WebJavaScript.ets:846-849`、`WV/.../navMeasure.js:1228-1244`）；`togglePointEdit(0)` 关闭编辑（`NAT/.../NavigationView.ets:177-192`）。
- 显示结果：绘制期 `measure-lines/measure-points/measure-point-labels/measure-point-coords/measure-point-labels` 全套；导航期换成 `nav-route-*` 图层：航线 `#0074D9` 宽 3、带宽 `yellow` 透明 .2、点坐标 12px（`WV/src/hooks/useNav/layers.js:15-147`）。导航期分段标签 `text-opacity: 0`（隐藏重复标签，`layers.js:57-63`）；`nav-route-line` 的 `line-opacity: 0`（航线本身不可见，仅带宽与点标签可见，`layers.js:65-75`）。
- 航线查询：按起讫港/吃水/吨位/净空查服务端航线（`NAT/.../NavigationView.ets:360-386`），选中后 `drawPointsAndLine`/`drawAllPointsAndLines` 复用同一条测量管线，并额外画全部航线带宽（`navMeasure.js:246-402`、`1268-1295`）。

## 3. 模拟航行

| 阶段 | 入口/顺序 | 证据 |
| --- | --- | --- |
| 开始 | 底部“模拟导航”按钮 → 要求 `long>0` → 弹“航速设置” → 确定后 `webJavaScript.handleSimulate(速度)` → `EMAP.handleSimulate(sss)` | `NAT/.../NavigationView.ets:1520-1549`；`NAT/.../simulatedNavigationView.ets:81-108`；`WV/src/components/FMCMap.vue:404-417` |
| 暂停 / 继续 | **未找到**。全仓无暂停 API；`NavSimulation` 只有 `start/stop`，`stop` 未挂 UI（`NavSimulation.js:104-120`）。相关“继续导航”只在注释里（`NAT/.../navigationFunctionView.ets:1779`） | — |
| 结束 | ① 时间耗尽自动结束；② 关闭按钮 → 确认“确定要退出模拟导航，是否继续？” → `destroySimulation()` + `measurePointsLCK(true)` + `togglePointEdit(1)` | `NavSimulation.js:127-153`；`NAT/.../simulatedNavigationView.ets:45-80`；`WV/.../FMCMap.vue:389-401` |

- 模拟时钟步进：`requestAnimationFrame` + 门限 `interval = 1000ms`，每命中一次 `curLineSecond += 1`、`totalRestSeconds -= 1`（`NavSimulation.js:18-19`、`122-163`）。即 **1 秒模拟时间 = 1 秒真实时间**，不加速；速度只改变位移与预计算秒数。
- 速度设置：输入框默认 `8`（节），确定回调 `parseFloat(data)||0`（`NAT/features/landscapeMode/.../SpeedSettingCustomDialog.ets:8-11`、`93-95`）；`handleSimulate` 默认参数也是 8（`FMCMap.vue:404`）。
- 初始总时长：对每段 `Math.ceil((segmentLengthNm / speedKnots) * 3600)` 求和（`NavSimulation.js:33-35`；当前段同时刻：`curLineTotalSeconds = Math.ceil(curLineLength/speed*3600)`，`:61`）。
- 船位推进：`diffDistance = (curLineSecond/3600) * speedKnots`，`Math.min(diffDistance, curLineLength)`，再 `turf.along(curLine, diffDistance, {units:'nauticalmiles'})` 取点（`NavSimulation.js:82-101`）；跨段时 `curLineIdx += 1` 并把 `curLineSecond` 归零、更新 `curLineBearing`（`:65-78`）。船首方向 = 当前段 `bearing`（`:77`、`initUserPoi :45-53`）。
- 到点判定半径：模拟**没有半径判定**，按线段索引与秒数切换（`curLineSecond >= curLineTotalSeconds`，`NavSimulation.js:65-70`）；最后一程走完返回最后航点（`:68-70`），时间到零后 `stop()` 并 `calcInstance.stopNav()`（`:129-134`）。真实导航到点：距终点 `<50m` 结束，`<100m`/`<200m` 分别播报（`WV/.../useCalc.js:447-491`、`stopNav :508-515`）。
- 暂停后行为：无暂停，故不适用；退出（结束）后：原生 toast `本次导航结束`（`NAT/.../simulatedNavigationView.ets:199-224`），恢复 `measurePointsLCK(true)`、航线绘制态、清空 `simData`、重置 `status='unoffset'`；H5 侧位置回到真实定位（`FMCMap.vue:394-399`）。
- 推送原生（每秒）：`ohos.toNavigation('sim', { totalSeconds: totalRestSeconds, totalDistance: fmtDistance(totalRestDistance), nextPointDistance: fmtDistance(curLineRestDistance), nextPointSeconds: curLineTotalSeconds-curLineSecond, latitude, longitude, shipTrackDirection: |curLineBearing.toFixed(1)| })`（`FMCMap.vue:1098-1121`）。
- 仪表/状态文案：模拟页顶部经纬度、`航迹向 {shipTrackDirection}°`、`艏向 {sensorController.angle}°`、`航速 {speed.toFixed(1)}节`（`NAT/.../simulatedNavigationView.ets:896-949`）；底部 `X时Y分钟/X分钟/X秒 剩余 {totalDistance}` 与 `距离下一个转向点{nextPointDistance} {formatSeconds(nextPointSeconds)}`（`:1379-1425`，`formatSeconds` 见 `:263-275`，空值 `--秒`）。
- 无速度时：`calcSecond` 直接除以 `speedKnots`（`NavConstructor.js:106-108`），0 节会得到 `Infinity/NaN`，需在复刻时补保护。

## 4. 当前航段与剩余距离 / ETA

- 模拟：按索引推进（`curLineIdx`），下一航点即 `points[curLineIdx+1]`（模拟侧只把 `nextLine.length/bearing` 传给播报，`NavSimulation.js:139-148`）；当前段剩余 `curLineRestDistance = curLineLength - 已走`；全程剩余 = 当前段剩余 + 后续各段长度（过滤 `properties.index > curLineIdx`）（`NavSimulation.js:80-94`）。
- 真实导航：**按船位重算**。对每条线段做 `turf.pointToLineDistance`，取最小者，`nextPointIndex = index + 1`；最小距离 `> 0.5 海里` 判为偏航，下一点改为 `turf.nearestPoint` 并画灰色虚线偏航线（`NavConstructor.js:8`、`154-176`，图层 `layers.js:188-197`）。到起点前另有“从最近点开始/从起点开始”二选一（`:129-152`，弹窗 `是否从最近点开始导航？`，`NAT/.../navigationFunctionView.ets:210-236`）。
- 距离：到下一航点 `turf.distance(cur,next,{units:'nauticalmiles'})` 取 2 位（`NavConstructor.js:102-104`）；全程剩余 = 到下一目标 + `index >= nextPointIndex` 各段长度之和（`:110-121`；模拟侧同义 `NavSimulation.js:86-94`）。
- ETA：`seconds = Math.round(distance / speedKnots * 3600)`（`NavConstructor.js:106-108`）。速度基准：模拟 = 用户设定航速；真实 = `window.ohos.getSpeed()`（`UserNav.js:206`，经 `updatePoi` → `emitter.emit('update:position',{speedKnots})` → `NavConstructor.updatePosition` 注入，`NavConstructor.js:35-41`）。无其它时间基准（不用系统时钟、不用对地速度修正）。
- 格式：`fmtDistance(nm)`：`Math.round(nm*100)/100`，`<1` 转米再取 2 位，输出 `X米` / `X海里`（`WV/src/hooks/useNav/utils/index.js:25-34`）。`S2HM(s)`：空值 `0小时0分`；`<60s` → `小于1分钟`；不足 1 小时 → `X分`；否则 `X小时Y分`（`:16-23`）。
- 仪表字段（H5 推送、原生显示）：`speedKnots`（节，显示 1 位）、`totalSeconds`、`totalDistance`（字符串）、`nextPointDistance`（字符串）、`nextPointSeconds`、`COG`；真实导航还发 `shipTrackDirection`（`航速>5` 用航线方位，否则用指南针，`FMCMap.vue:1080-1093`）。原生真实导航页还显示“当前航迹向/艏向/航速”和“剩余 … 距离下一个转向点 …”（`NAT/.../navigationFunctionView.ets:1189-1239`、`1804-1886`）。

## 5. 避碰参考圈

两个**同名但不同物**的东西必须区分：

### 参考圈几何（`CollisionAvoidance` + `UserNav` 扇形）
- 半径：内圈 `R2 = 1` 海里，外圈 `R3 = 2` 海里，默认值硬编码（`WV/src/hooks/useNav/utils/CollisionAvoidance.js:9-10`）；由原生“安全半径设置”下发 `R1,R2,R3`，默认 `0.5,1.0,2.0 (海里/nmi)`（`NAT/common/basic/.../WebJavaScript.ets:374-387`，`WebJavaScript.ets:377-383`；预设列表 `NAT/features/mine/.../SafetyDistanceView.ets:20-22`，含 `50,100,200 米` 到 `5,10,20 海里` 共 11 档）。
- 数量/结构：2 个同心圆（`steps = R2*128`，即默认 128 边），`北` 文字（红 12px，位于 0° 方向 3 海里处、`text-anchor bottom`；`northTextDistance=3.1` 虽在 `setRadius` 里赋值但未参与几何），4 个方向 `0/90/180/270`：每方向 1 个三角形（绿）、1 条方位线（长 3 海里）、4 条刻度线（`R2/2, R2, (R2+R3)/2, R3`，长 0.02 海里）、2 个距离标签（`1.0海里` / `2.0海里`）（`CollisionAvoidance.js:58-258`、`261-272`；`northTextDistance` 见 `:17`、`:280`；颜色 `CALayers`：`CANT` 红、`CATriangle/CACircle/CALine/CADistanceText/CATick` 绿，标签 `minzoom 8 / maxzoom 24`，`layers.js:199-271`）。
- 船艏扇形：`R1 = 0.5` 海里，`sectorAngle = 45`（即左右各 45°、总 90°），填充绿 `fill-opacity 0.5`（`UserNav.js:14-15`、`47-54`；`layers.js:149-159`）。
- 航向线：`user-dir-line` 黑色 `line-width 2`、`dasharray [2,2]`，由 `requestAnimationFrame` 每 **500ms** 翻转 `line-opacity 1/0` 形成闪烁（`UserNav.js:74-87`；`layers.js:160-170`）。
- 航迹向量：**没有**。参考工程只有船艏扇形 + 航向虚线，没有按速度画的航迹矢量（当前仓库 `buildOwnShipOverlay` 的 `course` 向量在参考中不存在）。
- 与“碰撞风险”的区别：这些圈只是本船固定距离参考几何，**不读取 AIS/他船数据**（`CollisionAvoidance.js` 全文无 AIS 调用）。图层面板里的“避碰圈”（key 21）其实是“商渔船碰撞高风险区”POI（`typeCode=000197`）面图层，与参考圈无关（`WV/src/hooks/useLayer/useCollisionAvoidance.js:9-23`、`:28-36`）。
- 参数换算：`R1<6` 用海里，否则用米；`R1>=6` 时三角形高 20、方向线 `R3+50`、北字 `R3+80`（`CollisionAvoidance.js:274-283`；`UserNav.js:310-321` 同样按 `R1<6` 切单位）。原生 `addCollision` 里把 `>6` 的米值除以 1852 再显示（`navMeasure.js:1176-1189`）。
- 扇形开关：`angle` 为 0 时 `user-sector` 图层 `visibility:none`（`UserNav.js:315-317`）。

## 6. 测距（navMeasure / MeaSureBase 两套）

- 独立测距（`MeaSureBase`）：入口“测距”按钮（`NAT/.../NavigationView.ets:1356-1369`，`HEXRangingIcon title:'测距'`）→ `toggleDistanceMeasure()`（`WV/.../MeaSureBase.js:35-66`）。它**不依赖航线**，也不写入航线点。
- 单击 vs 连续：开测距后每次点击地图加一个测距点并连成折线（`useMapClick.js:186-238`）；点击已存在的测距点则**删除该点**（`:192-197`），因此“单击已有点=删点”，不是“单段一次性测距”。无“连续测距/单击测距”模式切换。
- 显示：总长 `总长度: {nm.toFixed(3)}海里`（`MeaSureBase.js:213-216`）；每段中点标签 `bearing-distance-text`：方位取 3 位补零 + `.` + 1 位小数，距离 2 位海里，形如 `030°.1-2.34`（`MeaSureBase.js:296-307`）；标签随线旋转 `route`（`:278-286`）。
- 单位：海里（3 位总长 / 2 位分段），1 公里 = 0.539956803 海里（`MeaSureBase.js:215`、`290`）。
- 清除：关闭测距即清空点/线/总长/分段图层（`MeaSureBase.js:44-65`）；“撤回”删最后一组线+点并重算（`:69-146`）；“清除”走 `clearMeasure()`（`WV/.../navMeasure.js:89-117`，原生 `EMAP.clearMeasure`，`WebJavaScript.ets:743-745`）。
- 与航线绘制共用管线的一侧：`navMeasure.js` 的 `measurePoints` 同时是航线点数组，加/删/撤销/交换会同步 `setRoute`；分段标签格式为 `"{方位1位}°.1-{nm2位}海里"`（`navMeasure.js:660-663`）。`navMeasure` 的“测距”本质是“画航线”。

## 7. 离线海图

- H5 有真正的 S-52 渲染引擎：`index.html` 引入 `maplibre-gl.js` 与 `s52style.js`（含 `s52style.wasm`，`WV/public/map/js/`），`FMCMap.vue:598` 调 `EMAP.map.loadS52(EMAPLoadOptions)`，后接 `initFgLayer()`（`:607-616`）。
- 但底图与 S-52 瓦片都是**在线**：`tilesUrl: http://seamap.ehanghai.cn/services_vector/out/tiles/{z}/{x}/{y}.pbf`，`spriteUrl` 指向本机 `localhost:8080/sprite`（由 `HEXModule.prot` 决定），`glyphs` 指向 `res.ehanghai.cn`；baselayer 全是天地图/海图在线 raster（`WV/src/components/mapAttribute.js:1351-1422`；`FMCMap.vue:664-693`）。
- H5 内**未找到读取本地离线海图包的代码**：`loadS52` 只接收在线 URL 与本地 sprite，无文件/路径参数。
- “离线下载”在原生侧：`ChartDownLoadView` 用 `DownloadTask` 断点续传下载图幅（`NAT/features/mine/.../ChartDownLoadView.ets:126-263`），文案 `中国沿海官方海图定期更新服务，离线下载；`（`:391`）、`支持下载离线查看，没有网络也不怕；`（`:704`）、已下载项 `海图及导航(NN)`（`:1311`）。
- H5 在该页面里只负责**画海图覆盖范围**（`WV/src/views/layout/SeaListChart.vue:84-218`），并且它自己的地图也用同一套在线 S-52（`:441-489`）。`showChart(index)` → `showChinaCoastal/showHongKongChart/showYangtzeRiver`（`NAT/common/basic/.../ChartDownLoadWebJs.ets:57-63`）。
- 结论：H5/WebView 侧**不支持离线海图**（无本地包读取，仅在线矢量 + 原生下载管理）；离线查看若存在，属原生能力，本仓库文档范围内无法证实。文件格式：H5 只出现 `.pbf` 瓦片与 `.wasm`；原生下载的文件名/格式未在本参考包内取证，**不猜**。

## 8. 图层与工具栏

### 8.1 海图类型与图层（原生抽屉，顺序即 id 1..29；28 原生列表未定义，仅 H5 分支保留）
`NAT/features/home/.../models/mapLayer.ets:114-483`，小组顺序：地图类型 → 船舶展示 → 地图展示 → 航线安全 → 长江要素：

| id | 标题 | 默认 | 备注（图标字段） |
| --- | --- | --- | --- |
| 1 | 官方海图 | 开 | `map_ChinaSea` / `_Active`，单选组 |
| 2 | 标准地图 | 关 | 单选 |
| 3 | 卫星地图 | 关 | 单选 |
| 4 | 海陆融合图 | 关 | 单选 |
| 5 | 影像图融合图 | 关 | 单选 |
| 6 | 船舶绿点 | 开 | `lvdian` |
| 7 | AIS船位 | 开 | `AIS` |
| 8 | 船队 | 开 | `boatTeam` |
| 9 | 经纬网格 | 关 | `GridMode` |
| 10 | 夜间模式 | — | **整段被注释，无效果**（`:233-244`） |
| 11 | 我的收藏 | 开 | `favorite` |
| 12 | 领海基线 | 关 | `layer_lhjx` |
| 13 | 渔区边界 | 关 | `Boundary` |
| 14 | 船舶尾迹 | 关 | `Wake` |
| 15 | 航线警告 | 关 | `routeWarning` |
| 16 | 航行通告 | 关 | `layer_annunciate` |
| 17 | 通航相关 | 关 | `layer_custom` |
| 18 | 东海VTS报告线 | 关 | `layer_dhvts` |
| 19 | 南海VTS报告线 | 关 | `layer_nhvts` |
| 20 | 黄渤海VTS报告线 | 关 | `layer_hbhvts` |
| 21 | 避碰圈 | 关 | `bp`（实际是高风险管理区面） |
| 22 | 禁钓区 | 关 | `layer_closed` |
| 23 | 航标 | 关 | `layer_fairway_buoy` |
| 24 | 长江航标 | 关 | 会员禁用 `layer_fairway_buoy_vip` |
| 25 | 水位站 | 关 | 会员禁用 `layer_jiuzhanwei_vip` |
| 26 | 黄浦江警戒线 | 关 | `HuangpuRiverCordon` |
| 27 | 黄浦江浮筒 | 关 | `HuangpuRiverPontoon` |
| 28 | 横屏钓点 | — | 仅 H5 分支（`FMCMap.vue:1261-1264`） |
| 29 | 沿海航路 | 关 | `layer_CoastingRoute` |

- 选中态：每项 `isActive` 切换，图标用 `mapLayerImg` / `mapLayerImgActive`（`mapLayer.ets:45-68`、`486-506`）；VIP 图层 `isDisable`，`长江航标/水位站` 在未购海图时置灰（`mapLayer.ets:15`、`85-93`、`437`、`451`）。
- 手机端位置：首页右侧竖排工具条：`图层 / 反馈`（`NAT/features/home/.../constants/homeList.ets:5-40`），图层按钮打开抽屉。H5 只暴露 key→开关 的映射（`WV/.../FMCMap.vue:1154-1269`：1-5→`reash`，6 绿点，7 AIS，8 船队，9 网格，10 夜间（注释），11 收藏，12 基线，13 渔区，14 尾迹，15-29 各专题图层）。
- 地图类型 1-5 是**互斥单选**，会重建底图（`mapSwitch`：1 栅格海图、2 陆地图、3 卫星图、4 海陆融合、5 影像融合，`WV/.../ohos.js:37-74`；`mapLayer.ets:493-506`）。其余 6-29 只 `setLayoutProperty('visibility')`，**不改导航状态**（各 hook 实现，如 `useCollisionAvoidance.js:28-36`）。
- 持久化：`chartInit()` 把 6-29 的 `{key,title,isActive}` 与当前地图类型下发给 H5（`mapLayer.ets:532-584`），H5 首帧 `idle` 时 `getChartInitList` 逐项应用（`FMCMap.vue:1154-1269`）。

### 8.2 航线规划页工具栏（手机竖屏）
- 顶部：标题“航线规划”；tab `航线绘制 | 航线查询`（各 50% 宽，选中项主题色 + 2px 下边框）（`NAT/.../NavigationView.ets:1208-1310`）。
- 左列（`top:140,left:10`）：`经纬度`、`引用点`、`测距`（`:1312-1379`）。
- 右列（`top:140,right:10`）：`撤回`、`修正航线`、`切换起始`、`保存`（`long>0` 才显示）、`航线带宽`（`:1382-1482`）。
- 左下 `居中`（`bottom:150,left:10`）（`:1485-1503`）。
- 底部条：`线路总长：X.XX海里` + `模拟导航`（描边）/`导航`（实心）+`绑定当前所在船舶`（`:1505-1607`）。
- 航线带宽弹窗：`范围设置` 输入 `0-2.0` 海里，越界 toast `范围在0-2海里之间`，确定调 `togglePathArea(width)`（`:787-878`）。**注意**：H5 `navMeasure` 用 `turf.buffer(...,{units:'kilometers'})`（`navMeasure.js:617`、`1038`），而导航绘制 `RouteConstructor` 用 `{units:'nauticalmiles'}`（`RouteConstructor.js:82`），同一数值会有 1.852 倍差。
- 导航/模拟页 HUD 按钮顺序：右侧竖排 `居中锁定 / 北向上 / 切换模式`（`NAT/.../navigationFunctionView.ets:1426-1492`），左侧 `测距`（`:1494-1522`）、`轨迹融合`（仅真实导航，`:1526-1560`），右下 `全屏` + `+/-`，底部 75px 条显示剩余时间/距离 + 关闭导航（`:1592-1652`、`1804-1913`）。
- 会改导航/交互状态的开关（**不是**图层开关）：`togglePointEdit(0/1/2)`、`toggleDistanceMeasure`、`togglePathArea`、`changeLock`、`changeMode`、`measurePointsLCK`、`changeClick`（`isClick` 控制首页地图点击是否触发居中解锁，`FMCMap.vue:1028-1049`、`1288-1295`；`ohos.js:210-219`）。复刻时不要把图层开关接到这些入口。

## 9. 与当前仓库主流程的对照要点

1. **航法**：参考工程没有恒向线/大圆选项，距离一律 turf 大圆 `length`、方位一律大圆初始方位；当前仓库 `Route.legKind` 有 `RHUMB/GREAT_CIRCLE`（默认 `RHUMB`，`packages/navigation-app/src/store/createNavigationStore.ts:456-475`）。照搬数值时须明确参考值属于“大圆”口径。
2. **当前航段确定方式**：参考的实时导航每帧按船位重算最近线段，并允许“>0.5 海里→偏航、改连最近点”（`NavConstructor.js:154-176`）；当前仓库严格按 `nav.activeIndex` + 会话 routeId 派生，不从船位回推（`packages/navigation-app/src/store/selectActiveLeg.ts:31-50`）。两者在“船位跳到后面航段”时结果不同。
3. **模拟推进**：参考按固定 1000ms 墙钟逐秒 +1，`totalRestSeconds` 递减到 0 才结束（`NavSimulation.js:122-163`）；当前仓库用显式 `simulationTick(elapsedSeconds)` 纯函数推进并支持 pause/resume（`packages/nav-core/src/navigation/simulation.ts:61-145`）。参考无暂停，复刻时不要凭空加暂停按钮。
4. **到点半径**：参考模拟无半径（走完段才切换），真实导航 `<50m` 结束、`100/200m` 播报（`useCalc.js:447-491`）；当前仓库 `ARRIVAL_RADIUS_NAUTICAL_MILES = 0.05`（≈93m）吸附/跨段（`packages/nav-core/src/geo/navigation.ts:7`、`simulation.ts:100-112`）。同名“到点”语义不同。
5. **ETA 速度基准**：参考模拟用设定航速、真实用 `ohos.getSpeed()`，且 0 节会产生 `Infinity`（`NavConstructor.js:106-108`）；当前仓库把“模拟航速 vs 真实航速”显式拆开（`selectNavigationGuidance.ts:37-38`），并要求有效定位才可启动真实导航。移植 ETA 时需补零速/无速分支。
6. **名称撞车**：参考的“避碰圈”图层 = 商渔船碰撞高风险区面（`typeCode 000197`），与雷达 1/2 海里圈无关；“测距”有两套（独立测距 `MeaSureBase`，与 `navMeasure` 画航线共用 `measurePoints` 的“测距”）。当前仓库参考圈几何与参考一致（1/2NM 圈、0.5NM±45° 扇形；参考工程无航迹向量，当前仓库额外有 `course = speed/10` 六分钟矢量，`packages/nav-core/src/geo/ownShipOverlay.ts:19-46`）。
7. **单位与小数位**：参考显示 `fmtDistance` 2 位（<1 海里转米）、`S2HM` 小时/分、分段标签 2 位海里 + 1 位方位；`MeaSureBase` 总长 3 位、分段 2 位、方位补零到 3 位。当前仓库若统一格式，需逐处对齐，别把“米/海里”混用。
8. **带宽单位**：参考 H5 内部 kilometre/nauticalmile 混用（见 §8.2），这是真实缺陷；当前仓库带宽若定义为海里，需在所有绘制/校验处统一，不能照抄那两处 `units`。
9. **图层 key 契约**：参考的 1-29 + `{key,title,isActive}` 是 H5 首帧初始化协议（`mapLayer.ets:532-584`、`FMCMap.vue:1154-1269`），且 24/25 是会员图层、10 夜间模式无效。当前仓库若做图层投影，需保留“默认开”的五项（官方海图/绿点/AIS/船队/我的收藏）与 24/25 的禁用语义。
10. **入口与文案**：加航点的主入口是“地图单击”，并非按钮；“航线未绘制”“本次导航结束”“确定要退出导航，是否继续？”“距离下一个转向点…”等文案是产品语义的一部分（`NAT/.../NavigationView.ets:1546`、`simulatedNavigationView.ets:203`、`:1422`）。

## 10. 明确“未找到”的清单

- 航点重命名：未找到。
- 航线航法选择（恒向线/大圆切换）：未找到。
- 模拟航行暂停/继续：未找到（只有开始、结束）。
- 每段/全程 ETA 使用“对地速度、风流压差、预计到达时刻 (ETA clock)”：未找到；只有“剩余秒数”。
- 离线海图包在 H5 内的读取/切换：未找到。
- 参考圈与 AIS 的联动、碰撞风险判定：未找到（仅固定几何）。
