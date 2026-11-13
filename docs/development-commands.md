# 根目录开发命令

在 `E:/project/navigation` 执行。

- `pnpm dev`：桌面调试，启动 Vite 和桌面窗口。
- `pnpm build`：构建正式桌面程序及安装包。Windows 程序在 `apps/desktop/src-tauri/target/release/navigation-desktop.exe`。
- `pnpm web`：只启动网页前端，不打开桌面窗口。
- `pnpm android`：Android 调试。需已配置 Java、Android SDK/NDK 和 Rust Android 目标；真机需开启 USB 调试并授权。
- `pnpm android:build`：构建正式版 Android 产物。
- `pnpm typecheck`：检查各包 TypeScript。
- `pnpm test`：运行共享包测试。
