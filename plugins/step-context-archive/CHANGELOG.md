# Changelog — step-context-archive

本文件记录 step-context-archive 的版本变更。

## 1.0.0

首个版本（声明式形态）：

- 新增 `step.plugin.json` 清单（id / version / commands / skills）；
- 新增 `/archive` 命令（`commands/archive.md`）：识别已完成任务块 → 三点摘要
  （目标 / 关键决策 / 是否完成）→ 原文写入 `.stepcode/context-archive/stamp-<id>.md`
  → 输出 `#STAMP` 索引行 → **明确汇报任务是否完成**；
- 新增 `/recall` 命令（`commands/recall.md`）：按 stamp 读取归档原文并基于原文回答；
- 新增 `context-archive` 技能（`skills/context-archive/SKILL.md`）：`#STAMP` 语义、
  三点摘要协议、召回纪律、适用与不适用边界；
- 安全规则内置：只归档不销毁、不覆盖既有归档、不越界写盘、不编造原文、不改用户配置。

待完成：真实项目验证（`SCA-100-4`，≥2 个非玩具仓库的端到端链路）。
