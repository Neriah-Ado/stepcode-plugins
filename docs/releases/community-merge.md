# Release Notes — 自 PR #1 合并起 / From PR #1 Merge Onward

> 起点 / Start: 2026-09-27，PR #1 合入 main（merge commit `c039372`）
> 范围 / Scope: v1.3.0 收官波次之后的**仓库级更新**——首个社区贡献插件、门禁与 CI 建设、行尾规范化；本文件滚动追加，直到下一个版本波次定稿 / repo-level updates after the v1.3.0 wave — first community plugin, gate & CI, line-ending hygiene; this file keeps rolling until the next version wave is finalized
> 门禁 / Gate: ALL PASS（745 项断言、31 个检查区 / 745 assertions across 31 sections）；GitHub Actions `validate` ubuntu + windows 双平台 SUCCESS

---

## 中文

收官之后的第一批更新不是版本波次，而是一次**社区贡献的合入**，以及围绕它把仓库的
工程底盘补齐：门禁接入新插件、CI 上线双平台、行尾规范统一。节奏不同，标准不变——
每一项改动都过完整门禁，每一处诚实标注都保留。

### 2026-09-27 — PR #1 合并与合并后维护

**合入 / Merged**

- 新增第 13 个插件 **step-context-archive**（社区贡献 [@uos1231234](https://github.com/uos1231234)，
  声明式形态：`/archive` 把已完成任务块原文落盘、对话只留 `#STAMP` 三点摘要索引行，
  `/recall` 按索引取回原文；配套技能约定索引语义与召回纪律）；
- roadmap / marketplace / README 三处登记齐，状态如实 **in-progress**：SCA-100-4
  （≥2 个真实项目验证）未完成，`latest_version` 置空待发布回填（AGENTS.md §3.4）。

**合并后维护 / Post-merge maintenance**（main 侧 11 个提交，含 1 个 merge；另带入贡献者分支 8 个提交）

- **版本口径**：README 徽章改进行中标注、总量表述修正——v1.0.0 未发布前不冒领版本号；
- **门禁接入**：`/archive`、`/recall` 补 `ARCHIVE-RULES` / `RECALL-RULES` JSON 规则块
  （与既有插件同一"单一事实源"模式）；validate 新增 **§31 专属检查区**（规则块字段、
  frontmatter、安全红线、G1 诚实状态守卫：SCA-100-4 未完成前不得标 done、
  latest_version 必须为 null）；**§9 自举一致性检查**接入新插件，CHANGELOG 按仓库惯例
  由 `tests/bootstrap-changelog.mjs` 从 git 历史重新自举；
- **内容修正（P3）**：`#STAMP` 索引行从绝对路径改为**项目相对路径**（跨机器/移动仓库
  仍可解析），退化 id（`b` 前缀短 id）明确为 12 位小写十六进制主格式的**显式例外**；
- **CI 上线**：新增 `.github/workflows/validate.yml`（ubuntu + windows 双平台跑
  `node tests/validate.mjs`，`fetch-depth: 0` 保障历史校验）——首跑即抓到一个真问题：
  windows 检出 CRLF 导致 §9 自举比对假失败；修复方式为 §9 比对归一化 CRLF +
  `.gitattributes` 统一仓库 LF（本地以 `autocrlf=true` 克隆精确复现后修复）；
- **文档**：[step-context-archive v1.0.0 预发布说明](./step-context-archive-v1.0.0.md)
  （双语，含发布前 checklist）挂 README；本文件即 v1.3.0 波次之后的滚动发布说明。

**贡献者的两项上游反馈**（评审中核实并处理）：上游 main 门禁曾因 `tests/lib/dev-log.mjs`
漏提交崩溃（已由 `8d3dfef` 补交修复）；Step Code v0.1.1 宿主尚未加载已安装插件的
`commands/` / `skills/`（已如实写入插件 README 与 risks，待官方核实）。

### English

The first update after the wrap-up wave is not a version wave but a **community
contribution**, plus the engineering groundwork that came with it: gating the new
plugin into the repo's checks, standing up two-platform CI, and normalizing line
endings. Different rhythm, same standard — every change went through the full gate,
and every honest "pending" marker was preserved.

**Merged**: the 13th plugin **step-context-archive** (community contribution by
[@uos1231234](https://github.com/uos1231234), declarative form) — `/archive` writes
completed task blocks **verbatim** into the project and leaves a one-line `#STAMP`
three-point summary index in the conversation; `/recall` fetches the original text
and answers from it. Registered in roadmap/marketplace/README; honestly
**in-progress** (SCA-100-4 real-project verification pending, `latest_version`
left `null` until release, per AGENTS.md §3.4).

**Post-merge maintenance** (11 commits on main incl. one merge; 8 commits brought
in from the contributor's branch): version bookkeeping corrected; `ARCHIVE-RULES` /
`RECALL-RULES` JSON blocks added to the command texts and enforced by a new validate
**§31** section (block fields, frontmatter, safety red lines, and a G1 honesty guard);
validate **§9** bootstrap-consistency now covers the plugin, whose CHANGELOG was
regenerated from git history per repo convention; P3 fixes — `#STAMP` index lines
switched to **project-relative paths** and the `b`-prefixed fallback id documented
as an explicit exception to the 12-hex main format; **CI onboarded**
(`.github/workflows/validate.yml`, ubuntu + windows) — its very first run caught a
real bug (CRLF checkouts breaking the §9 bootstrap comparison), fixed by normalizing
the comparison and adding `.gitattributes` (repo-wide LF); and the pre-release
bilingual notes for step-context-archive v1.0.0 were published with a release
checklist.

The contributor's two upstream findings were verified and handled: the missing
`tests/lib/dev-log.mjs` that broke the main-branch gate (fixed in `8d3dfef`), and
the report that Step Code v0.1.1 does not yet load installed plugins' `commands/`
and `skills/` (documented honestly in the plugin README and `risks`).

---

*门禁 / Gate: `node tests/validate.mjs` — 745 PASS / 0 FAIL；CI: `validate (ubuntu-latest)` ✅ + `validate (windows-latest)` ✅*
*提交 / Commits: `c039372..ed357d7`（main 侧 11 个；范围总计 19 个 / 11 on main, 19 total）*
