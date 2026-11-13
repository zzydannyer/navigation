# 候选海图 SDK 对比表

> 调研日期 2026-11-04；"支持"均以官方文档为准，未找到官方依据处标【未确认】。真机行为一律【未验证】。

| SDK / 产品 | 格式与 edition 支持 | 平台 | 显示规则 | React Native 集成 | 许可/计费 | 试用可得性 | 官方 URL | 结论 |
|---|---|---|---|---|---|---|---|---|
| **Teledyne SevenCs Nautilus Maritime SDK**（原 SevenCs，前身 EC2007） | S-57 ENC ✅；S-100/S-101 ENC ✅（另 S-102/104/111 HDF5）；S-63 运行时解密【部分确认，需询价】；S-63 配套加密/许可工具存在 | 官网未列 Android/iOS ⚠️【未确认】；历史 EC2007 面向 Windows/Linux/嵌入式 | ECDIS 级、GPU 加速；S-100 表达用 Lua；S-52 主题/安全水深细节【未确认】 | 无官方 RN 绑定（C++ 内核，需自写原生桥） | OEM/设备授权；EC2007 已售 4.8 万 license；价格询价 | ✅ 官方 60 天试用 | https://www.sevencs.com/products/maritime-sdk/nautilus-maritime-sdk | 功能最全（唯一明确 S-101 显示+可试用），**头号待确认：是否支持 Android/iOS** |
| **Esri ArcGIS Maps SDK**（原 Runtime） | S-57 ENC ✅（含 base+update .000/.001+）；S-63 加密 ENC ✅；S-101 设备端 ❌【未确认，倾向不支持；S-101 在 Pro/Enterprise Maritime】 | ✅ Android + iOS(Swift) 官方 ENC；另 .NET MAUI/Qt/WASM | ✅ S-52 显示；需外挂 resource 样式包；mariner/viewing/text-group 设置；点选 EncFeature ✅ | 无官方 RN 绑定（需原生桥接 Android/iOS MapView） | 4 档 Lite/Basic/Standard/Advanced；**ENC 需 Standard 档**；开发免费带水印，生产 named-user/deployment key | 注册开发者免费起步；生产档付费报价 | https://developers.arcgis.com/android/layers/display-electronic-navigational-charts/ | 双端官方 + S-57/S-63 + 点选最稳；短板 S-101 不上设备、商业重、无 RN 绑定 |
| **IIC Technologies** | S-57↔S-101 转换/校验工具；免费 S-101 Viewer | 桌面工具/服务为主；移动运行时 SDK【未确认】 | S-101 Viewer 显示；非嵌入式引擎 | 无 | 服务/工具授权，询价 | ✅ S-101 Viewer 免费下载 | https://s100.iictechnologies.com/products | 作 S-101 验收/对照工具，非 RN 运行时 SDK |
| **dKart Navigator** | S-57 + C-MAP CM93v3 | Windows 10+ / Linux 成品 ECDIS | 成品 ECDIS 显示 | 无可嵌入 SDK【未确认】 | 成品软件 | 成品，无 SDK 试用 | https://bestikon.ee/dkart-navigator/ | 终端产品，非 OEM 引擎候选 |
| **Wärtsilä/Transas**（Navi-Sailor/Pilot PRO/Navi-Planner） | S-57/S-63（AVCS）+ TX-97 | 成品 ECDIS + 移动 App；图注服务 TADS | 成品 ECDIS 显示 | 无对外 OEM SDK | 整机 + 图注订阅 | 无 SDK 试用 | https://www.wartsila.com/marine/products/marine-navigation-solutions/navi-sailor-ecdis | 产品/数据服务商，非 SDK 候选；可作 S-63 数据渠道参考 |
| **GDAL/OGR**（开源 MIT 式） | S-57 只读 ✅（自动应用更新）；无 S-52 显示；无 S-63 ❌；无 S-101 ❌ | 跨平台库（C++/Python 绑定） | ❌ 无 S-52 符号化，纯几何/属性 | 可经原生桥调用，但仅解析 | 开源免费 | 开源即用 | https://gdal.org/en/stable/drivers/vector/s57.html | 仅解析/转换/验收对照，不能做显示引擎 |
| **OpenCPN**（GPLv2+） | S-57/S-52 ✅；S-63 经插件 ✅；S-101 ❌【未确认/不支持】 | 桌面/嵌入式 Linux | ✅ S-52 日/昏/夜、安全水深 | GPL 传染，不可直接嵌入闭源 RN | 开源 GPL | 开源免费 | https://o-charts.org/manuals/s63_index.php | 开源验收基准（oracle），非可商用嵌入 SDK |

## 推荐优先验证顺序

1. **Teledyne SevenCs Nautilus**：先发 60 天试用申请，书面确认 ① Android/iOS 是否有构建 ② S-63 运行时解密 ③ S-101 Edition 1.1 支持 ④ OEM 报价。
2. **Esri ArcGIS Maps SDK**：注册开发者账号，用 NOAA 免费 S-57 + 一份 S-63 测试数据验证双端显示/点选/更新；同时书面确认 S-101 是否有路线图。
3. 对照基准：OpenCPN（S-57/S-52/S-63）+ IIC 免费 S-101 Viewer（S-101）。
