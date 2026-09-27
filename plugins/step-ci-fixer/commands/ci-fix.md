---
description: 定位失败的 CI run → 截取错误段 → 本地修复 → push 重跑闭环（上限 3 轮，push 前必须确认）
argument-hint: [run ID 或 --workflow 名，可选]
---

# /ci-fix — CI 失败修复闭环

## 前置检查（G4/C4）

先调 `check_gh`：gh 缺失 → 输出安装指引停止；未认证 → 输出 `gh auth login` / `GITHUB_TOKEN` 两条路径的指引停止；均不裸报错。

## 1. 定位失败 run

- 参数给 run ID → 直接用；否则 `list_failed_runs`，多个失败 run 时列出表格（编号/标题/workflow/分支/时间）请用户选择。
- `--workflow <名>` 过滤；不确定 workflow 名时先 `list_workflows`。

## 2. 截取错误段（C5）

`fetch_run_log` 只取**尾部 16KB**；把日志交给 `classify_failure` 分类（v1.1.0）：

| 分类 | 典型信号 | 修复策略 |
| --- | --- | --- |
| lint | eslint/stylelint/ES 规则码 | 跑本地 lint --fix，只改报错文件 |
| test | 用例失败/断言对比 | 转 test-fix-loop skill（最小改动，3 轮上限） |
| build | TS 报错/模块缺失/编译失败 | 本地复现构建命令，修编译错误 |
| deploy | 发布/上传/凭据错误 | 检查 secrets 与发布配置；**secrets 缺失类问题转人工**，不猜凭据 |
| unknown | 无法归类 | 摘录错误最后 30 行请用户判断 |

## 3. 修复与重跑（上限 3 轮）

1. 本地修复（最小改动原则；环境凭据类问题转人工，绝不伪造凭据）。
2. 提交走 /commit 规范（`fix(ci): ...`）。
3. **push 前必须向用户确认**（G3）：展示将要推送的提交；确认后 `git push`。
4. push 触发的 run 启动后用 `run_status` 轮询（间隔 60s，最多等 20 分钟/轮）。
5. 绿 → 汇报闭环（轮次、修复点、run 链接）；仍红 → 回到第 2 步；3 轮未解决 → 停止，输出未解决清单与日志路径转人工。

## 4. PR 评论交互（v1.2.0）

参数 `--pr <号>` 时先 `fetch_pr_comments`（截断 8KB），把 reviewer 意见转化为修复任务清单，逐条归入第 2 步分类处理；回复评论前征得用户同意。

## 5. 多平台（v1.3.0）

- GitLab：远端为 gitlab 时改用 glab 获取 job 日志，失败段解析规则与 tests/lib/ci-log.mjs 的 GitLab 适配一致（只取尾部错误段）。
- Jenkins：构建日志 `BUILD FAILURE`/`[ERROR]` 段截取适配（解析规则见 tests/lib/ci-log.mjs，与本文档语义一致）。
- 平台判定：`git remote get-url origin`；无法识别时询问用户。
