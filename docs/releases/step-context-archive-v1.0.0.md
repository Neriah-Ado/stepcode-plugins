# step-context-archive v1.0.0 — 预发布说明（进行中）/ Pre-release Notes (In Progress)

> 状态 / Status: **in-progress** —— v1.0.0 尚未发布（未打 tag），本文件提前挂出、发布时定稿 / v1.0.0 is **not released yet** (no tag); this file is published early and will be finalized at release
> 范围 / Scope: 仓库首个社区贡献插件合入（PR #1，作者 [@uos1231234](https://github.com/uos1231234)）/ First community-contributed plugin merged into this repo (PR #1 by @uos1231234)
> 门禁 / Gate: ALL PASS（739 项断言，含 §31 专属检查区 / 739 assertions incl. the new §31 section）

---

## 中文

### 这个插件做什么

长会话的**上下文归档与召回**：`/archive` 把已完成任务块的**原文**写入项目内
`.stepcode/context-archive/stamp-<id>.md`，对话里只留一行带三点摘要
（目标 / 关键决策 / 是否完成）的 `#STAMP` 索引行；`/recall` 按索引取回原文、
基于原文回答。配套技能 `context-archive` 约定 `#STAMP` 语义、摘要协议与召回纪律。

设计原则是**摘要用于导航，原文用于引用**：摘要可能失真，一切以归档文件为准。
它解决的问题是长会话里早期任务的大段细节（堆栈、命令输出、完整代码）当下用不到、
将来要引用、却持续占用窗口。

### 社区贡献与维护合入

- PR #1 由 [@uos1231234](https://github.com/uos1231234) 于 2026-09-26 发起，
  声明式形态（清单 + 命令 + 技能，无 `entry` / `hooks` / `lspServers`，符合 C1/C2）；
- 评审实测结论：无安全风险（只写默认目录、不覆盖、召回只读、零依赖零网络）、
  与 roadmap/marketplace/README 登记齐全、**诚实标注未完成项**（SCA-100-4 真实项目
  验证未做，状态如实标 in-progress，未谎报 done）；
- 贡献者附带两项高价值发现：① 上游 main 门禁曾因 `tests/lib/dev-log.mjs` 漏提交而崩溃
  （已由 `8d3dfef` 补交修复）；② 实测反馈 Step Code v0.1.1 宿主尚未加载已安装插件的
  `commands/` 与 `skills/`（已如实写入插件 README，待官方核实）；
- 合并后的维护调整：roadmap 冲突按"上游 12 条 done + 追加本插件"解决；
  `latest_version` 按 AGENTS.md §3.4 置空（版本 done 才回填）；命令文本补
  `ARCHIVE-RULES` / `RECALL-RULES` JSON 规则块接入 validate §31 专属检查区；
  §9 CHANGELOG 自举一致性检查接入本插件并按仓库惯例重新自举 CHANGELOG；
- 合并后修正（P3）：`#STAMP` 索引行从绝对路径改为**项目相对路径**（跨机器/移动仓库
  仍可解析）；退化 id（`b` 前缀短 id）明确为 12 位小写十六进制主格式的**显式例外**。

### 发布前待办（Checklist）

- [ ] **SCA-100-4**：在 ≥2 个非玩具真实项目中走完「长会话 → `/archive` → 继续工作 →
      `/recall` 取回细节」全链路，记录索引行与原文一致性（plugin.yaml 验收标准）；
- [ ] 宿主加载通道：确认 Step Code 上游是否已接入插件 `commands/` / `skills/` 加载
      （影响实际可用性，插件 README 已如实标注现状）；
- [ ] 发布时：`step.plugin.json` / plugin.yaml 版本核对 → roadmap 与根 README 回填
      v1.0.0 → 重新自举 CHANGELOG → 打 `step-context-archive-v1.0.0` 标签 →
      本文件去掉"预发布"字样并更新状态行。

### English

`step-context-archive` is the repo's first community-contributed plugin (PR #1 by
[@uos1231234](https://github.com/uos1231234)), merged 2026-09-27. It archives
completed task blocks **verbatim** into `.stepcode/context-archive/stamp-<id>.md`
inside the project, leaving a one-line `#STAMP` index with a three-point summary
(goal / key decisions / done-or-not) in the conversation; `/recall` fetches the
archived original text and answers from it. Design principle: **summaries are for
navigation, originals are for citation**.

Review verdict: declarative form compliant (no `entry`/`hooks`/`lspServers`),
no security risk (default-dir writes only, no overwrite, read-only recall,
zero dependencies, zero network), honest status reporting (SCA-100-4 real-project
verification pending, so the version is correctly `in-progress`, not `done`).

Maintenance after merge: roadmap conflict resolved (upstream 12 done entries kept,
SCA entry appended); `latest_version` left `null` per AGENTS.md §3.4 until release;
`ARCHIVE-RULES` / `RECALL-RULES` JSON blocks added to the command texts and enforced
by a new validate §31 section; validate §9 bootstrap-consistency now covers this
plugin's CHANGELOG (regenerated via `tests/bootstrap-changelog.mjs`); P3 fixes —
`#STAMP` index lines now use **project-relative paths** (portable across machines),
and the `b`-prefixed fallback id is documented as an explicit exception to the
12-hex main format.

Before release: SCA-100-4 (≥2 non-toy real projects, full archive→recall loop),
confirm whether the Step Code host has gained a loader for installed plugins'
`commands/`/`skills/` (honestly documented in the plugin README), then bump,
re-bootstrap the CHANGELOG, tag `step-context-archive-v1.0.0`, and finalize this file.

---

*标签 / Tags: 暂无 —— v1.0.0 发布时打 `step-context-archive-v1.0.0` / none yet — tagged `step-context-archive-v1.0.0` at release*
