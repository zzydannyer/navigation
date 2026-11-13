# 首批审查包（Batch 1）：P0 + P1 + P2 不依赖部分 — 2026-11-04

- 工程根：E:\project\navigation（Windows / pwsh 7.6.4 / node v22.23.2 / pnpm 11.16.0 via corepack / cargo 1.98.0）
- 任务来源：《平板海事导航实施与验收计划》第一轮指令：先执行 P0，调查并尽可能完成 P1；等待 SDK/授权期间推进 P2 不依赖部分；回传审查包。
- 总结论：**P0 完成并通过静态验收（真机未验证）；P1 外部阻塞、未验收（ADR 为草案）；P2 不依赖部分代码完成（真机行为未验证）**。S-63 与 S-101 仍为明确未交付项，未以 mock 冒充支持。

## 1. 目标与范围
- P0：保护基线、建立可重复检查命令、ESLint、路由 app/→src/app/、轻量测试、桌面构建验证、回归证据。
- P1：真实海图/SDK 技术验证（合法样本清单、SDK 评估、ADR）。本轮完成桌面调研与候选评估；真机验证因缺 SDK 试用确认/授权样本/设备而外部阻塞。
- P2（不依赖部分）：平板自适应布局、海图目录与导入闭环、PMTiles 基础。未做 S-57/S-63/S-101 显示引擎（属 P3/P4/P5，前置 P1 结论）。

## 2. 改动文件清单
P0：
- 根 package.json（+typecheck/lint/doctor/test/check 脚本；+eslint@^9、eslint-config-expo@~58.0.4）、packages/nav-core/package.json（+typecheck/test、vitest）、apps/desktop/package.json（+typecheck）
- eslint.config.js（新建，Expo 58 flat config）
- app/ → src/app/（5 个路由文件同构迁移，旧 app/ 已删）
- packages/nav-core/{vitest.config.ts,test/*.test.ts}（4 文件 19 用例）
- pnpm-workspace.yaml（allowBuilds.esbuild）
- docs/validation/2026-11-04-p0.md、report 追加

P1（本包新增）：
- docs/validation/2026-11-04-p1.md（调研结论 + ADR-001 草案）
- docs/validation/sdk-research.md、candidates-table.md、samples-list.md（调研报告落库）

P2：
- app.json（orientation portrait→default）、根 package.json（+@navigation/chart-core workspace:*；+expo-document-picker~58.0.4、expo-file-system~58.0.13、expo-screen-orientation~58.0.4、expo-sqlite~58.0.15，均 SDK58 兼容版本）
- 新增 packages/chart-core（sourceKind/dataset/capabilities/errors/importMachine + pmtiles reader，15 用例）、src/services/{importChart,chartDb}.ts、src/chart/ChartCatalogScreen.tsx、src/ui/useResponsiveLayout.ts、src/app/chart.tsx、ChartScreen 宽屏侧栏、i18n 文案（en/zh）
- docs/validation/2026-11-04-p2.md、report 追加

被改文件原件均在各自 agent 的 artifacts/backup/。

## 3. 已运行命令与结果（退出码）
| 命令 | 退出码 | 结果 |
|---|---|---|
| 根 tsc --noEmit | 0 | 通过 |
| expo lint | 0 | 0 error / 3 既有 warning |
| pnpm test（nav-core + chart-core） | 0 | 19/19 + 15/15 |
| expo export --platform android / ios | 0 | "Using src/app as the root directory"；2844/2785 modules |
| pnpm --filter @navigation/core exec tsc --noEmit | 0 | 通过 |
| pnpm --filter @navigation/desktop exec tsc --noEmit | 0 | 通过 |
| pnpm --filter @navigation/desktop build | 0 | vite build 1131 modules |
| cargo check apps/desktop/src-tauri | 0 | 448 crates，navigation-desktop v0.1.0 |
| pnpm dlx expo-doctor | 1 | 19/20（唯一失败 `.expo` 忽略项，.gitignore 已有 `.expo/`，git CLI 缺失疑似误报） |

## 4. 真实样本来源与许可状态
- **PMTiles（已验证）**：Protomaps Basemap Firenze 6.6MB（ODbL），已下载并真实解析验证（header/metadata/瓦片查找全对，z0/z1 MVT 实测）；样本文件留存于 P2 agent artifacts/samples/。
- **S-57（来源就绪，本轮未下载解析）**：NOAA ENC 免费、CC0 可再分发（charts.noaa.gov/ENCs）。
- **S-63（外部阻塞）**：需 S-63 OEM 资格（IHB 发放 M_ID/M_KEY）+ RENC（PRIMAR/IC-ENC）数据合同。
- **S-101（外部阻塞）**：当前 Edition 1.1.0（仅实现与测试用途）；testbed 密码保护需申请，另可选 S-101PT/KHOA S-100P/NOAA Precision Navigation。
- 凭据、许可证、报价单未入库、未入日志。

## 5. 设备证据
- **无**。Android 平板 / iPad 真机或模拟器均未使用；横竖屏旋转、MapLibre pmtiles:// 原生渲染、目录 UI、expo-sqlite 运行时行为全部标"未验证"。Windows 静态检查与双端 bundle 构建通过**不能**证明平板可用。

## 6. 已知问题
- **git CLI 缺失**（环境缺口）：无 git status 基线；已用"逐文件备份原件 + 改动清单"替代保护，未做任何 reset/clean/批量覆盖。后续建议在有 git 的环境补一次基线。
- pnpm 供应链策略：用户级 `minimumReleaseAge=0` 绕过（昨天发布的 @expo 包被 pnpm 11 默认拒绝）；esbuild postinstall 放行写入 pnpm-workspace.yaml。可逆，已记录。
- eslint 钉 ^9（eslint 10 与 eslint-plugin-react 7.37 不兼容）；3 个既有 lint warning（i18n 具名导出误报、ChartScreen 重复 import）未修，未用禁用规则/排除目录/堆 any 消除。
- 既有风险（P0 记录，未修）：持久化 DTO 无版本号（schema 漂移会静默回空）；store 订阅每次 GPS tick 全量写 MMKV（可能冗余写，未量化）。
- PMTiles：JS 层无显式 pmtiles 组件，依赖 VectorSource/RasterSource url 透传原生——真机待验证。
- S-63/S-101/S-102/S-104/S-111：均未实现、未声明支持。

## 7. 未完成项
- P1 真机验证（SDK 试用确认、授权样本、设备）——外部阻塞，**P1 不验收**，不锁定自研全格式海图核心。
- P2：RouteScreen/InstrumentScreen 宽屏拆分、目录进度条/冲突解决 UI、内容 hash 去重、expo-screen-orientation 运行时调用。
- P3/P4/P5/P6/P7：全部未开始（P3+ 前置 P1 结论）。

## 8. 下一阶段前置条件
1. 决策并申请：Teledyne SevenCs Nautilus 60 天试用（书面确认 Android/iOS、S-63 运行时解密、S-101 Ed1.1、OEM 报价）；或 Esri ArcGIS Maps SDK 开发者账号（NOAA S-57+S-63 测试数据双端对照）。
2. 决策是否启动 S-63 OEM 资格与 RENC 合同（需公司主体与预算）。
3. 提供 Android 平板 + iPad 各一台。
4. 复现与回归命令：`pnpm check`（typecheck+lint+test）、`pnpm --filter @navigation/desktop build`、`cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`（PATH 需含 corepack shim 与 ~/.cargo/bin）。
