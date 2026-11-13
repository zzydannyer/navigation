这是 Tauri 2 桌面和 Android 应用。界面在 `apps/desktop`（Vite + React），共享逻辑在 `packages/nav-core` 和 `packages/chart-core`。

## 不要凭记忆写 Tauri API

Tauri 2 的 API 与 1.x 不同。写 Tauri、插件或 Android 相关代码前，先查 https://v2.tauri.app/ 。

## 命令

只使用 pnpm。在仓库根目录执行：

```bash
pnpm dev            # 桌面调试
pnpm build          # 桌面正式包
pnpm web            # 只开网页
pnpm android        # Android 调试
pnpm android:build  # Android 正式包
pnpm typecheck      # 类型检查
pnpm test           # 共享包测试
```

`apps/desktop/src-tauri/tauri.conf.json` 里的 `beforeDevCommand` 和 `beforeBuildCommand` 是在 `apps/desktop` 内执行的，对应这里的 Vite `dev` / `build`，不要改成根目录脚本。

## 规则

- 原生 Android 工程由 Tauri 生成在 `apps/desktop/src-tauri/gen/android`。不要手改生成文件，配置写在 `tauri.conf.json` 和 capabilities。
- 新增依赖加到实际使用的包，不要加回根目录。
- 第三方库先查官方文档再安装。
