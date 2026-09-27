---
description: "模板 deps-check：每日依赖更新检查，升级建议报告落盘，不自动升级"
---

# 依赖更新检查（deps-check）

- 触发频率建议：每日 09:00（`0 9 * * *`）
- 任务 prompt：运行 `npm outdated --json`（pnpm 项目用 `pnpm outdated`），按 patch/minor/major 分组统计；major 升级列出 breaking 提示；报告写入 `docs/cron/deps-report.md`（含日期与完整清单）。
- 输出落盘路径：`docs/cron/deps-report.md`
- 依赖声明：npm/pnpm CLI；均缺失时输出安装指引并退出码 2。
- 纪律：**只报告不升级**；升级由用户主动发起。
