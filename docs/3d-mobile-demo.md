# 手机 3D 最小验证

## Windows Tauri 桌面包

构建：`pnpm --filter @navigation/desktop tauri build`。
每次构建自动生成并打包示例 GLB。桌面程序默认打开 3D Demo，
无需启动 Vite、无需手动导入模型；底图仍需联网。
可以通过 Demo 的“返回导航界面”进入导航页，并通过“3D 模型 Demo”返回。
产物位于 `apps/desktop/src-tauri/target/release/`，安装包位于其 `bundle/` 目录。

入口：`http://电脑局域网IP:1420/?demo3d`。手机与电脑连接同一局域网。

启动：`pnpm --filter @navigation/desktop dev --host 0.0.0.0`。

沿用 Tauri 应用的 React / MapLibre GL JS 前端，使用 Three.js 和 GLTFLoader，
通过正式 CustomLayerInterface 在同一 WebGL 上下文绘制 GLB；无需地图 token。
Three.js 为 MIT 许可。内置模型为本项目脚本生成的原创简化货船。
重新生成模型：`node apps/desktop/scripts/create-demo-ship.mjs`。

## 手机验收

1. 打开页面，应看见底图和货船，而不仅是“模型已加载”文字。
2. 单指平移、双指缩放和倾斜，模型应与地图保持位置关系。
3. 暂停/继续模拟航行，调整航向和大小，回到船位。
4. 导入不超过 20 MB 的自包含、未压缩 GLB。暂不配置 Draco / Meshopt 解码器，
   不支持依赖外部纹理的多文件模型。模型最长边自动缩放为 100 米，默认 Y 向上。
5. 切后台再回来、横竖屏切换，检查画面与帧率；持续运行观察发热。

底图使用 OpenStreetMap 在线公共瓦片，仅用于交互式 Demo；保留署名，
不批量下载、不作离线预取，生产需另选符合用量与授权的数据服务。
这不是 ENC 海图，不用于实际航行。船位为固定区域的模拟数据，不读取 GPS。

## 已验证与限制

- TypeScript 与生产前端构建、修改文件 ESLint。
- 桌面浏览器可见 GLB 模型，暂停按钮状态切换正常。
- 尚未验证手机真机、Tauri Android WebView 或 APK。
- 本机未检测到常规 Android SDK / adb，未生成移动安装包。
- 手机浏览器访问用于先验证图形能力，不能代替安装包验收。
- Vite 仍报告较大 JS chunk；3D Demo 已懒加载，不在普通页面主动初始化。
