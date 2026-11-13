# 合法样本清单

> 调研日期 2026-11-04。每条标注格式/版本/覆盖/许可/获取方式。文件大小等未实测项标【未验证】。

## A. S-57（基图 + 连续更新）

| 样本 | 格式/版本 | 覆盖区域 | 许可条款 | 获取方式 / 链接 |
|---|---|---|---|---|
| **NOAA ENC** | IHO S-57 ENC（基图 .000 + 更新 .001+） | 美国沿海水域、内河 | **免费、CC0 1.0 公有领域**，可自由下载/使用/再分发（须遵守 User's Agreement 署名/官方状态条款） | 下载页 https://www.charts.noaa.gov/ENCs/ENCs.shtml ；许可 https://www.charts.noaa.gov/ENCs/Agreement.shtml ；仓储 https://repository.library.noaa.gov/view/noaa/71555 |
| **PRIMAR ENC 服务** | S-57（含 S-63 加密）全球 ENC | 全球（RENC 分发多国海道测量局数据） | 商业订阅/付费；由挪威水文局/ECC 运营的 RENC | https://www.primar.org/about-primar （需联系询价/订阅） |
| **IC-ENC** | S-57 / S-63 全球 ENC | 全球（UKHO 主导 RENC） | 商业收费转售（NOAA 亦经其分发） | 说明见 https://www.nauticalcharts.noaa.gov/charts/noaa-enc.html ；入口需联系 IC-ENC |
| **Shom（法国）ENCs** | S-57 / S-63 | 法国及相关水域 | 经 PRIMAR RENC 分发 | https://diffusion.shom.fr/carte-s-63.html |

> 说明：P1 桌面验证首选 **NOAA ENC**（免费、CC0、即下即用、带更新）。

## B. S-63（受保护数据 / 测试许可）

| 项 | 说明 | 许可/合同 | 获取途径 |
|---|---|---|---|
| **S-63 测试数据 + 测试内核** | 定义于 S-63 **Appendix 1**，由 IHB（Scheme Administrator）发布，专供厂商实现/调试 | 仅限测试，不得对外提供正式 ENC 服务；OEM 须按 S-63 安全体系第 11 章向 **IHB 申请 M_ID/M_KEY** | IHO S-63 FAQ：https://www.iho-ohi.net/english/about-encs/enc-data-protection/s-63-faq.html |
| **个人/小批量 S-63 体验** | OpenCPN o-charts S-63 插件所需 UserPermit | 个人付费 UserPermit（非 OEM 产品化授权） | https://o-charts.org/manuals/s63_index.php |
| **产品化 S-63 分发** | 应用内合法解密/分发商业 ENC | 需成为 S-63 授权 OEM + 与 RENC（PRIMAR 或 IC-ENC）签数据服务合同；涉及公司主体、付费 | PRIMAR https://www.primar.org/about-primar ；IC-ENC（经 NOAA 页说明） |

> 要点：S-63 不是"下载个文件"就能测，**产品路线必须先解决 OEM 资质 + RENC 合同**（见阻塞项）。

## C. S-101（S-100 ENC 产品规范）

| 项 | 版本 | 许可 | 获取途径 |
|---|---|---|---|
| **S-101 产品规范本身** | 当前 **Edition 1.1.0**（IHO 注册表："仅用于实现与测试"） | IHO 标准文档 | https://registry.iho.int/productspec/view.do?idx=195&product_ID=S-101 |
| **S-101PT 测试数据集** | S-101 test dataset | 测试用途；IHO testbed 注册表**密码保护**，需申请 | IHO S-101 资源页（S-101PT Test Datasets / KHOA S100P / UKHO Marine Data Portal / NOAA Precision Navigation 链接入口） |
| **KHOA S-100P testbed** | S-100/S-101 测试数据 | 测试用途，需联系 | 同上 S-101 资源页 |
| **NOAA Precision Navigation** | S-100 框架数据集（含 S-111 等） | 公开/测试 | https://oceanservice.noaa.gov/annualreport/2020/ocs.html |
| **IIC S-101 Viewer** | 免费桌面查看器 | 免费下载 | https://s100.iictechnologies.com/products |

> 说明：S-101 正式商用数据尚未规模化发布（标准仍处"实现与测试"阶段）；P1 用 testbed 数据集验证显示即可。

## D. PMTiles（离线瓦片归档）

| 样本 | 类型 | 内容 | 许可 | 获取/链接 |
|---|---|---|---|---|
| **v4.pmtiles** | 矢量 MVT 底图 | Protomaps 日构建，OpenStreetMap 数据 | ODbL（ODbL，基于 OSM） | 在线加载样例 https://pmtiles.io/ ；基图构建 https://build.protomaps.com/ ；下载文档 https://docs.protomaps.com/basemaps/downloads  |
| **flowers.pmtiles** | 栅格（航拍正射影像 overlay） | 小范围无人机航拍 | 见 Protomaps 许可说明 | https://pmtiles.io/ （选择 flowers.pmtiles） |
| **divisions.pmtiles** | 矢量 overlay | Overture Divisions（2026-08-19 发布） | Overture 许可 | https://pmtiles.io/ |
| **tilezen.pmtiles** | 矢量底图（legacy） | 2019 Mapzen Tiles | 对应开源许可 | https://pmtiles.io/ |

> 文件大小【未验证】：全球 v4 极大，建议用 `pmtiles extract --maxzoom` 裁剪到目标区域再上平板；CLI 见 https://docs.protomaps.com/guide/getting-started 。

## E. 对照/验收工具（非样本，但必需）

- **OpenCPN**（GPL，S-57/S-52/S-63 显示对照）：https://o-charts.org/manuals/s63_index.php
- **IIC S-101 Viewer**（S-101 显示对照）：https://s100.iictechnologies.com/products
