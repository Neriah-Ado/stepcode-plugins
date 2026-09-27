---
description: "模板 git-backup-check：定时 git 备份校验（本地与远端差异/未推送提交）"
---

# git 备份校验（git-backup-check）

- 触发频率建议：每日 22:00（`0 22 * * *`）
- 任务 prompt：`git status --porcelain` 检查未提交改动；`git log @{u}..HEAD` 统计未推送提交；`git stash list` 提示遗留 stash；报告写入 `docs/cron/git-backup.md`。
- 输出落盘路径：`docs/cron/git-backup.md`
- 依赖声明：git；无远端时报告「仓库无远端，备份仅本地」。
- 纪律：只读检查，不代做 push/commit。
