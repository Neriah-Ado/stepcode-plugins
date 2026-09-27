---
description: 构建前端产物并通过内置 steppage 插件一键发布，回贴预览链接（steppage 未安装时给出指引）
argument-hint: [产物目录，可选；默认 dist/build/.next]
---

# /publish — 一键发布预览

## 1. 前置检查

- 构建产物存在（`dist/`、`build/`、`.next` 等按框架判断）；不存在则先构建（`npm run build`，构建错误原样摘录最后 30 行）。
- **内置 steppage 插件可用性**：用 `/plugin list` 确认。未安装时输出指引并停止（G4）：

> 未检测到内置插件 steppage。请运行 `/plugin install steppage` 安装后重试；
> 安装后如 MCP 进程未启动，重启一次 `step`。

## 2. 发布

1. 调用 steppage 的 MCP 工具发布产物目录（工具名以 steppage 清单为准，如 `deploy`/`publish`）。
2. 发布是**外向动作**：调用前向用户确认产物目录与项目名（G3）。
3. 成功后把返回的**预览链接**回贴到会话终端，并提示「浏览器打开即可预览」。
4. 失败时摘录 steppage 错误输出最后 30 行；配额/登录类错误给出对应指引，不重试超过 2 次。

## 3. 汇报

项目名、产物目录、预览链接、构建耗时；提醒链接为公网预览，敏感内容先脱敏。
