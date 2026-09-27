---
description: 前端 dev server 生命周期管理：框架检测 → 后台启动 → 就绪确认 → 端口占用处理 → 停止（Windows 兼容）
argument-hint: [启动/停止/重启 或框架提示，可选]
---

# /dev — dev server 管理

## 1. 框架检测与启动命令

<!-- DEV-DETECT-START -->
```json
{
  "detectors": [
    { "dep": "vite", "stack": "vite", "start": "npm run dev" },
    { "dep": "next", "stack": "next", "start": "npm run dev" },
    { "dep": "webpack", "stack": "webpack", "start": "npm run dev" },
    { "fallback": "无前端依赖时询问用户；不猜测" }
  ],
  "cwd": "在项目根运行；monorepo 中在目标 package 目录运行"
}
```
<!-- DEV-DETECT-END -->

## 2. 启动与就绪确认

1. **后台启动**（Windows 兼容，C6）：`start /b npm run dev > .dev-server.log 2>&1`（Git Bash：`nohup npm run dev > .dev-server.log 2>&1 &`）；记录 PID（`tasklist`/`$!`）。
2. 轮询日志确认就绪（最多 60s），解析规则与 tests/lib/dev-log.mjs 一致：

<!-- DEV-LOG-RULES-START -->
```json
{
  "vite": {
    "ready": "Local:\\s+http://localhost:(\\d+)/",
    "error": "error during build|EADDRINUSE"
  },
  "next": {
    "ready": "(- Local:|ready on)\\s+http://localhost:(\\d+)",
    "error": "EADDRINUSE|Failed to compile"
  }
}
```
<!-- DEV-LOG-RULES-END -->

3. **端口占用**：日志出现 EADDRINUSE → 找占用进程（`netstat -ano | findstr :PORT` → PID）→ 列出并询问用户换端口（`-- --port 3001`）还是杀进程；**杀进程前必须确认**（G3）。
4. **热重载确认**：改代码后检查日志尾部出现 HMR/update 行（vite：`hmr update`；next：`Compiled .* in Xs`），超时未出现则提示可能需要手动刷新。

## 3. 停止

杀启动时记录的 PID（`taskkill /PID <pid> /F` / `kill <pid>`）；PID 未知时按端口反查。停止前确认目标进程确实是本项目的 dev server（命令行含 vite/next）。

## 4. 汇报

框架、端口、URL、就绪耗时、热重载是否生效；日志文件路径 `.dev-server.log`（C5，不内联全文）。
