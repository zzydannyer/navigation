# 《平板海事导航》P1 阶段 — 海图 SDK / 数据 / 标准 前置桌面调研报告

- 调研日期：2026-11-04
- 范围：纯网络/文档调研，未做真机/设备验证（凡涉及真机行为均标注"未验证"）。
- 移动端目标：Expo SDK 58 / React Native 0.88 / `@maplibre/maplibre-react-native` ^11.5.1；Android 平板 + iPad 优先；离线。
- 核心问题：哪个专业海图 SDK 可试用、可能同时支持 Android 与 iPad、能真实读取/显示/点选/更新 S-57、S-63、S-101。
- 标注约定：【官方确认】= 来自厂商/IHO/官方文档；【未确认】= 未找到官方依据，禁止据此下结论。

---

## 目录

1. 结论速览（TL;DR）
2. 专业海图 SDK 候选评估
   - 2.1 Teledyne SevenCs — Nautilus Maritime SDK（原 EC2007 / SevenCs 现状）
   - 2.2 Esri ArcGIS Maps SDK（原 ArcGIS Runtime）
   - 2.3 IIC Technologies
   - 2.4 dKart Navigator
   - 2.5 Wärtsilä / Transas
   - 2.6 GDAL / OGR
   - 2.7 OpenCPN（GPL 参考实现）
3. 合法样本清单（详见 samples-list.md）
4. 标准现状：S-63 / S-100 / S-101
5. MapLibre 与 PMTiles
6. P1 阻塞项清单
7. 来源汇总

---

## 1. 结论速览（TL;DR）

- **唯一同时具备"S-101 显示 + ECDIS 级 S-52 + 官方 60 天试用"的商业 SDK 是 Teledyne SevenCs 的 Nautilus Maritime SDK**；但官网未公开列出 Android/iOS 支持，移动端可用性【未确认】，必须向 Teledyne 发询价确认（这是 P1 头号待办）。
- **文档最完整、官方同时支持 Android + iOS、且明确支持 S-57 与 S-63 加密 ENC 并可点选要素的是 Esri ArcGIS Maps SDK**（原 Runtime，Android + Swift/iOS）；但其移动 ENC 图层是 **S-57 only，未见 S-101 设备端显示**，且 ENC 能力至少需 Standard 许可档、无官方 React Native 绑定。
- **GDAL/OGR 只能只读解析 S-57（无 S-52 显示、无 S-63、无 S-101）**，适合做解析/验收对照，不能做海图显示引擎。
- **OpenCPN（GPL）** 是 S-57/S-52 显示 + S-63 插件的开源参考实现，适合作为"显示对不对"的验收基准；S-101 支持【未确认/未见】。GPL 传染性使其不能直接嵌入闭源 RN 应用。
- **S-101 当前为 Edition 1.1.0**，IHO 明确"仅供实现与测试"；官方 testbed 注册表是密码保护的，需申请。
- **`@maplibre/maplibre-react-native` 11.5.1 已自带 PMTiles 能力**（它锁定原生 Android 13.6.1 / iOS 6.31.0，远高于 PMTiles 所需的 Android 11.7+/iOS 6.10）。PMTiles 侧无障碍。
- **最大外部阻塞不是技术而是授权**：要在产品里合法分发/解密 S-63 ENC，需成为 S-63 授权 OEM（向 IHB Scheme Administrator 申请 M_ID/M_KEY）并与 RENC（PRIMAR 或 IC-ENC）签数据服务合同。

---

## 2. 专业海图 SDK 候选评估

### 2.1 Teledyne SevenCs — Nautilus Maritime SDK（原 SevenCs / EC2007）

> 即任务中提到的"IIC Technologies（原 SevenCs）"。**澄清：SevenCs 与 IIC Technologies 是两家不同公司。** SevenCs GmbH 已被 Teledyne 收购，现为 **Teledyne SevenCs**（姊妹公司含 Teledyne CARIS、Raymarine Commercial）；其当代海图 SDK 名为 **Nautilus Maritime SDK**（前身 EC2007 ECDIS Kernel）。

【官方确认】来源：
- 产品页：https://www.sevencs.com/products/maritime-sdk/nautilus-maritime-sdk
- 产品总览：https://www.sevencs.com/products/maritime-sdk/ ；https://www.sevencs.com/products
- S-100 工具：https://www.sevencs.com/products/7cs-s-100-tools
- 公司历史：https://www.sevencs.com/about/history-team

逐项事实：
- **格式/版本**：可视化、查询、渲染 **S-57 ENC** 与 **S-100** 体系；明确提到 S-100 数据类型含 **S-101（ENC）、S-102 水深、S-104 水位、S-111 表层流（HDF5 网格）**。配套 ENC 生产工具含 ENC Encryptor、ENC Permit Generator（S-63 相关工具链存在）。
- **S-63 运行时解密**：SevenCs 自述是 **S-57 / S-52 / S-63 标准的主要起草方之一**，且 Nautilus 走 ECDIS 型式认可路线（IEC 61174）。运行时是否开箱解密 S-63 —— 页面未逐字写明，按其 ECDIS 内核定位高度可能，但仍属【部分确认】，需询价确认。
- **显示能力**：GPU 硬件加速渲染、缩放平移流畅、4K；ECDIS 级显示；S-100 表达（portrayal）用 **Lua 脚本**实现机器可读的符号化（改符号不改软件）。日/昏/夜主题、安全水深/安全等深线 —— 页面未逐项列，ECDIS 内核理应具备，属【未确认，需询价】。
- **平台**：⚠️ **官网未列出 Android / iOS。** 历史 EC2007 主要面向 Windows/Linux/嵌入式实时系统（船用 ECDIS）。Android/iOS 是否有构建 = **【未确认】，这是 P1 向 Teledyne 询价的第一优先问题。**
- **React Native 集成**：无官方 RN 绑定；为 C++/原生内核，若移动端支持则需自写原生视图桥接（【未确认】）。
- **许可与计费**：OEM/设备授权模式；官方称截至 2025-12 其前代 EC2007 已售 48,300 个 license。具体按设备/订阅价格 = 需询价。
- **试用可得性**：✅ **官方提供 60 天试用**（页面"Request SDK 60-day Trial"按钮，填表单沟通）。
- **更新处理**：ECDIS 内核，支持 base+update；撤销/Edition 处理细节【未确认】。
- **结论**：功能最贴近 P1 终态（S-57 + S-100/S-101 + ECDIS 显示 + 可试用），**但移动端平台支持是最大不确定点**。优先发试用申请。

### 2.2 Esri ArcGIS Maps SDK（原 ArcGIS Runtime）

【官方确认】来源：
- Android ENC 显示：https://developers.arcgis.com/android/layers/display-electronic-navigational-charts/
- iOS/Swift ENC 显示：https://developers.arcgis.com/swift/layers/display-electronic-navigational-charts/
- 许可：https://developers.arcgis.com/ios/license-and-deployment/license/ ；https://developers.arcgis.com/qt/license-and-deployment/license-levels-and-capabilities/
- ENC 能力档位（中文）：https://doc.arcgis.com/zh-cn/appstudio/extend-apps/licenceyourapp.htm （"Standard … ENC 图层 (S-57)…"）

逐项事实：
- **格式/版本**：✅ 官方明确"ArcGIS Runtime 支持符合 IHO **S-57** 的 ENC"；✅ **S-63**：原文"Access ENCs encrypted conforming to the **S-63** IHO Data Protection Scheme"；✅ 更新：基图 `.000` + 更新 `.001–.999` 一并加载（`EncExchangeSet`，支持独立的 update exchange set 叠加 base）。
- **S-101 设备端**：⚠️ 移动 ENC 文档全程只讲 S-57，经内部编译 **SENC** 文件显示；**未见移动 SDK 读取/显示 S-101 的文档**。S-101 生产/编辑在 ArcGIS Pro / ArcGIS Enterprise Maritime 侧（见 Esri Maritime slick sheet：https://www.esri.com/content/dam/esrisites/en-us/media/fliers/arcgis-maritime-slick-sheet.pdf ），**设备端 S-101 显示 = 未确认（倾向不支持）**。
- **显示能力**：✅ 按 **S-52** 标准显示；需外挂"resource 目录"（含渲染样式，从 downloads 页获取）；`EncEnvironmentSettings` 提供 mariner/viewing-group/text-group 三类显示设置（对应符号化、图层分组、注记可见性）。日/昏/夜、安全水深等具体 S-52 选项 = 【未逐项确认】，但 S-52 框架在。
- **点选/查询**：✅ `identifyLayerAsync` 返回 `EncFeature` 集合并可 `selectFeature()`（官方代码示例确认）。
- **平台**：✅ **Android（Kotlin/Java）与 iOS/Swift 均有官方 ENC 文档**；另有 .NET MAUI（Android/iOS）、Qt、WASM。官方跨双端，匹配 P1 的"Android 平板 + iPad"。
- **React Native 集成**：❌ 无官方 RN 绑定；需自写原生模块把 ArcGIS MapView（Android）/MapView（iOS）桥进 RN。
- **许可与计费**：四档 Lite/Basic/Standard/Advanced；**ENC 图层（S-57）至少需要 Standard 档**；开发许可免费但带水印/调试提示；生产用 named-user 或 deployment license key，需向 Esri 询价。离线可运行（SENC 本地），但 SENC 是设备/版本绑定、不可跨设备拷贝。
- **试用可得性**：注册 Esri 开发者即可免费起步（带水印/开发档）；生产档需付费报价。
- **更新处理**：✅ base + update exchange set 机制官方文档明确；SENC 首载慢（大量 cell 可能数小时），需预载。
- **结论**：双端官方支持 + S-57/S-63 + 点选是其最大优势；短板是 **S-101 不上设备、商业体量大、无 RN 绑定、ENC 需 Standard 档**。

### 2.3 IIC Technologies

【官方确认】来源：https://s100.iictechnologies.com/products ；https://www.iictechnologies.com/ ；https://www.iictechnologies.com/solutions-services/marine-solutions.html

- **产品形态**：S-100 软件套件 = **S-101 Viewer（免费下载）**、**Conversion Validator（S-57↔S-101 转换第三方校验）**、以及 ENC 生产/校验咨询服务。
- **嵌入式移动显示 SDK**：❌ 未发现可嵌入 Android/iOS 的海图显示引擎 SDK；其软件多为桌面工具/数据生产服务。= 【未确认有移动运行时】。
- **对 P1 的价值**：免费 **S-101 Viewer 可作为 S-101 数据验收/对照工具**，Conversion Validator 用于校验 S-57→S-101 转换；不是 RN 应用的运行时 SDK。

### 2.4 dKart Navigator

来源：https://bestikon.ee/dkart-navigator/ （经销商页）；https://slidetodoc.com/d-kart-software-presentation-age-of-electronic-charts/

- 是一套 **ECDIS/ECS 成品软件**（支持 Windows 10+ / Linux），读 S-57 与 C-MAP CM93v3，支持自动/手动更新。
- **是否有可嵌入的 chart engine SDK**：未找到任何官方 SDK/授权开发入口 = 【未确认】。定位是终端产品，不是 OEM 引擎候选。

### 2.5 Wärtsilä / Transas

来源：https://www.wartsila.com/marine/products/marine-navigation-solutions/navi-sailor-ecdis ；https://www.wartsila.com/marine/products/port-optimisation/pilot-pro ；https://www.wartsila.com/marine/products/data-service-downloads

- 成品：Navi-Sailor ECDIS、Pilot PRO（移动领航，支持 S-63/S-57 + TX-97 ENC 与更新）、Navi-Planner；数据服务 TADS（AVCS 等 S-57/S-63 图注订阅）。
- **可嵌入的 chart-engine SDK**：❌ 未见对外 OEM SDK，定位为整机产品 + 图注服务。= 非 SDK 候选；但其 RENC/图注商业模式可作为 S-63 数据渠道参考。

### 2.6 GDAL / OGR（开源，MIT 式许可）

【官方确认】来源：https://gdal.org/en/stable/drivers/vector/s57.html

- ✅ **S-57 只读**：内置驱动，读 `.000` 基图并**自动应用 `.001+` 更新**（`UPDATES=APPLY` 默认），按对象类出层；需 `s57objectclasses.csv`/`s57attributes.csv` 目录。
- ❌ **无 S-52 显示规则**：纯几何/属性翻译，不含任何电子海图符号化/安全水深/主题配色。
- ❌ **无 S-63**：GDAL 开发者邮件列表明确答复 "No, it doesn't"（https://gdal-dev.osgeo.narkive.com/wAS9TLg6/reading-s-63 ）。
- ❌ **无 S-101**：未见 S-101/GML(HDF5) 驱动。
- **结论**：只能做解析、转换、属性级验收对照，**不能当海图显示引擎**。

### 2.7 OpenCPN（GPLv2+，开源参考实现）

来源：官方为开源项目；S-63 插件手册 https://o-charts.org/manuals/s63_index.php ；社区说明 https://forum.openmarine.net/showthread.php?tid=4564

- ✅ 内置 **S-57 矢量海图 + S-52 显示**（含日/昏/夜、安全水深等航海图显示选项）。
- ✅ **S-63** 通过独立插件（o-charts 提供）加载加密 ENC，需购买/申请 UserPermit。
- ❌ **S-101**：未找到 OpenCPN 官方读取 S-101 的能力 = 【未确认/现状不支持】。
- 平台：桌面/嵌入式 Linux 为主；GPL 传染性 → **不能直接链接进闭源 RN 应用**；价值是作为"显示/点选结果对不对"的开源验收基准（oracle）。

---

## 3. 合法样本清单（摘要，完整表见 samples-list.md）

- **S-57 免费样本**：NOAA ENC，美国水域，**免费下载、CC0 1.0 公有领域、可自由再分发**。入口 https://www.charts.noaa.gov/ENCs/ENCs.shtml ；许可 https://www.charts.noaa.gov/ENCs/Agreement.shtml 。
- **S-57 商业渠道**：PRIMAR（挪威水文局/ECC 运营的 RENC，全球 ENC 服务，https://www.primar.org/about-primar ）；IC-ENC（UKHO 主导 RENC，收费转售，见 NOAA 说明页）。
- **S-63 测试**：测试数据与测试内核在 **S-63 Appendix 1**，由 IHB（Scheme Administrator）发放；OEM 须按 S-63 安全体系第 11 章向 IHB 申请 **M_ID/M_KEY**。个人可用 o-charts UserPermit（https://o-charts.org/manuals/s63_index.php ）体验，但产品化须走 OEM + RENC 合同。
- **S-101**：当前 **Edition 1.1.0**（IHO 注册表，"仅用于实现与测试"）。测试数据集来自 S-101PT、KHOA S-100P、UKHO Marine Data Portal、NOAA Precision Navigation；IHO testbed 注册表密码保护，需申请。免费工具：IIC S-101 Viewer。
- **PMTiles**：官方在线样例 https://pmtiles.io/ （v4.pmtiles 矢量/OSM 日构建、flowers.pmtiles 栅格航拍、divisions.pmtiles 矢量 Overture）；基图下载文档 https://docs.protomaps.com/basemaps/downloads 。许可 ODbL（OSM 数据）。

---

## 4. 标准现状（事实概述）

### 4.1 S-63（ENC 数据保护）
- 来源：IHO S-63 FAQ https://www.iho-ohi.net/english/about-encs/enc-data-protection/s-63-faq.html
- S-63 = IHO 数据保护方案，用于加密/压缩/保护 ENC；源自 PRIMAR 的保护体系（ECC 与 UKHO 为原始贡献方）。
- 机制要点：两级证书链，**IHB 担任 Scheme Administrator（SA）并签发根证书**；OEM 向 IHB 申请 M_ID/M_KEY；终端用户用 UserPermit 解锁图注。加密用 **Blowfish/ECB**（对比 S-100 Part 15 用 AES）。
- 版本：检索到"IHO Data Protection Scheme Edition 1.2(.2)"的表述，但**该条未附可引用 URL**，故确切现行小版本号【未完全核实】，建议以 IHO 注册表 https://registry.iho.int 为准。
- Appendix 1 = 安全测试数据集 + 测试内核（实现/调试 S-63 时用，不得用于正式对外服务）。

### 4.2 S-100 框架
- 来源：IHO 注册表 S-100 https://registry.iho.int/productspec/view.do?category=product_ID&domainS=ALL&idx=194&product_ID=S-100&statusS=5
- S-100 = 通用水文数据模型（Universal Hydrographic Data Model），是 S-57 的后继框架，对齐 ISO 19100 系列，含约 18 个分册；检索到的现行版本为 **Edition 5.2.0（2024-06）**（该条搜索结果未附稳定 URL，以注册表为准）。

### 4.3 S-101（ENC 产品规范，S-100 的 application profile）
- 来源：IHO 注册表 S-101 https://registry.iho.int/productspec/view.do?idx=195&product_ID=S-101
- 当前 **Edition 1.1.0，"released for implementation and testing purposes only"**（仅用于实现与测试）。
- 与 S-57 的主要差异（概述）：
  - **编码**：S-57 为 ISO 8211 二进制交换集；S-100/S-101 用 GML/HDF5 等现代编码。
  - **显示表达**：S-57 靠固定 S-52 规则；S-100 引入可移植的 portrayal 目录/表达模型（厂商如 SevenCs 用 Lua 机器可读符号），新增/变更符号更灵活。
  - **元数据/服务**：S-100 元数据更丰富、可承载更多产品类型（S-102/S-104/S-111 等），并面向 e-Navigation 服务化。
  - **更新**：Edition/update/reissue 概念沿用，但在 S-100 框架下组织；S-164 是 S-64 的 S-100 版测试数据发布。

---

## 5. MapLibre 与 PMTiles

- **MapLibre Native 原生支持 PMTiles 的版本**：
  - Android：官方示例页"Starting MapLibre Android **11.7.0**, PMTiles archives are supported as tile sources"，URL 前缀 `pmtiles://`。来源：https://maplibre.org/maplibre-native/android/examples/data/PMTiles/
  - MapLibre 新闻月报（2025-02）："MapLibre Android **11.8.0** and MapLibre iOS **6.10.0** … included the new PMTiles support"。来源：https://maplibre.org/news/2025-02-03-maplibre-newsletter-january-2025/
  - （11.7.0 与 11.8.0 两处表述略有出入，均指向 2025 年初的 Android 11.7/11.8、iOS 6.10 引入 PMTiles。）
- **`@maplibre/maplibre-react-native` 11.5.1 是否包含**：✅ 包含。该包 v11.4.0（2026-09-19）升级原生 Android 到 **13.6.1**、iOS 到 **6.31.0**；11.5.0/11.5.1（2026-10）为其上的补丁版 → 双端原生版本均远高于 PMTiles 门槛。来源：https://github.com/maplibre/maplibre-react-native/releases ；原生版本列表 https://maplibre.org/maplibre-react-native/docs/setup/getting-started/
- **MapLibre GL JS**：通过 `pmtiles` 协议插件 + `addProtocol` 接入远程/本地 .pmtiles。文档：https://docs.protomaps.com/
- **离线要求**：需把 style JSON、glyphs（字体）、sprites（图标）与 .pmtiles 归档一并随包/预置到设备；不依赖在线瓦片服务器。MapLibre 侧 PMTiles 无阻塞。

---

## 6. P1 阻塞项清单（需外部条件才能推进真机验证）

1. **Teledyne Nautilus 移动平台确认**：官网未列 Android/iOS。须提交 60 天试用申请并书面确认是否有 Android/iOS 构建、S-63 运行时解密、S-101 Edition 1.1 支持、OEM 报价。入口即产品页试用表单。
2. **S-63 OEM 资格**：作为图注产品方，需向 IHB Scheme Administrator 申请成为 S-63 授权制造商（M_ID/M_KEY），并与 RENC（PRIMAR 或 IC-ENC）签数据服务/分发合同——涉及公司主体、合同与付费。
3. **S-101 测试数据获取**：IHO testbed 注册表密码保护，需申请访问；并取得 S-101PT / KHOA S-100P / UKHO Marine Data Portal / NOAA Precision Navigation 的 S-101 测试集。
4. **ArcGIS 路线（若选）**：注册 Esri 开发者账号；ENC 能力需 **Standard 档生产许可报价**；下载 ENC resource/style 资源包。
5. **NOAA ENC 再分发**：CC0 基本无障碍，但需接受其 User's Agreement（点击/署名规则）。
6. **设备**：Android 平板 + iPad（真机验证不在本次桌面调研范围）。
7. **RN 原生桥接工程量**：ArcGIS 与 Nautilus 均无官方 RN 绑定，需自写原生视图模块把海图视图嵌进 Expo/RN——属内部工程排期，非外部阻塞。

---

## 7. 来源汇总（关键 URL）

- Teledyne SevenCs Nautilus SDK：https://www.sevencs.com/products/maritime-sdk/nautilus-maritime-sdk
- SevenCs S-100 工具：https://www.sevencs.com/products/7cs-s-100-tools
- ArcGIS Android ENC：https://developers.arcgis.com/android/layers/display-electronic-navigational-charts/
- ArcGIS iOS/Swift ENC：https://developers.arcgis.com/swift/layers/display-electronic-navigational-charts/
- ArcGIS 许可档位：https://developers.arcgis.com/ios/license-and-deployment/license/
- GDAL S-57 驱动：https://gdal.org/en/stable/drivers/vector/s57.html
- IHO S-63 FAQ：https://www.iho-ohi.net/english/about-encs/enc-data-protection/s-63-faq.html
- IHO 注册表 S-101：https://registry.iho.int/productspec/view.do?idx=195&product_ID=S-101
- IHO 注册表 S-100：https://registry.iho.int/productspec/view.do?category=product_ID&domainS=ALL&idx=194&product_ID=S-100&statusS=5
- NOAA ENC 下载：https://www.charts.noaa.gov/ENCs/ENCs.shtml
- NOAA ENC 许可：https://www.charts.noaa.gov/ENCs/Agreement.shtml
- NOAA ENC 仓储(CC0)：https://repository.library.noaa.gov/view/noaa/71555
- PRIMAR：https://www.primar.org/about-primar
- IIC S-100 产品：https://s100.iictechnologies.com/products
- OpenCPN S-63 插件：https://o-charts.org/manuals/s63_index.php
- PMTiles 在线样例：https://pmtiles.io/
- Protomaps 基图下载：https://docs.protomaps.com/basemaps/downloads
- MapLibre Android PMTiles 示例：https://maplibre.org/maplibre-native/android/examples/data/PMTiles/
- MapLibre 新闻月报(PMTiles)：https://maplibre.org/news/2025-02-03-maplibre-newsletter-january-2025/
- maplibre-react-native releases：https://github.com/maplibre/maplibre-react-native/releases
- maplibre-react-native 原生版本：https://maplibre.org/maplibre-react-native/docs/setup/getting-started/

> 凡上文标【未确认】者，均未找到可引用的官方依据，P1 前须向对应厂商/机构书面核实。
