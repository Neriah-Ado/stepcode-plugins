---
description: 汇聚 commit 历史按 feat/fix/breaking 分类生成 CHANGELOG 条目，给出 semver 升级建议，用户确认后打 tag
argument-hint: [起始 tag 或目标版本，可选；默认从最近一个 tag 到 HEAD]
---

# /changelog — 发布辅助

把 commit 历史聚合为 CHANGELOG 条目，建议下一个 semver 版本；打 tag 必须经用户确认。

## 安全规则（与 /commit 同源）

- 只读分析不改动代码；写 `CHANGELOG.md` 前展示条目预览。
- **打 tag 前必须征得用户明确确认**，绝不静默创建；禁止 `-f` 覆盖已有 tag。
- 不执行 push（完成后提示用户 `git push --follow-tags`）。

## 1. 确定范围

- 无参数：`git describe --tags --abbrev=0` 取最近一个 tag，范围为 `<tag>..HEAD`；无 tag 时取全部历史。
- 参数为起始 tag/commit：`<ref>..HEAD`。
- `git log <range> --pretty=%H%n%s%n%b%n---` 读取；超过 500 条时按时间取最近 500 条并在汇报中注明（token 经济）。

## 2. 解析与分类

对每条提交解析 subject（`type(scope)!?: subject`）与正文；正文含 `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer 时同样视为破坏性变更。分类规则：

| 分类 | 判定 | CHANGELOG 节 |
| --- | --- | --- |
| 破坏性变更 | subject 含 `!` 或 footer 含 BREAKING CHANGE | `### Changed`（条目尾附 `**BREAKING CHANGE:** 迁移说明`） |
| 功能 | type = `feat` | `### Added` |
| 修复 | type = `fix` | `### Fixed` |
| 其他 | docs/style/refactor/perf/test/build/ci/chore/revert/无法解析 | `### Other Changes`（仅在非空时输出） |

条目 = 去掉 `type(scope)!?: ` 前缀后的 subject 原文；issue footer（`Closes #N` 等）转为条目尾 `(#N)`。空节不输出。

## 3. semver 升级建议

<!-- SEMVER-RULES-START -->
```json
{
  "bump_priority": [
    { "when": "breaking", "bump": "major" },
    { "when": "feat", "bump": "minor" },
    { "when": "any", "bump": "patch" }
  ],
  "aggregate": "取全部提交中优先级最高的 bump；空范围返回 null 并提示无变更",
  "sections": { "feat": "Added", "fix": "Fixed", "breaking": "Changed", "other": "Other Changes" }
}
```
<!-- SEMVER-RULES-END -->

建议版本 = 当前最新版本号按建议 bump 递增（无 tag/无版本文件时从 `0.0.0` 起算并以条目内容提示用户）。

## 4. 写入 CHANGELOG.md

- 更新仓库根（或 `--file` 指定）的 `CHANGELOG.md`：在头部说明之后**插入**新版本节，不改动既有条目；文件不存在时创建并附「遵循 Keep a Changelog 风格，版本号遵循 semver」头部。
- 节格式：`## [版本号] - YYYY-MM-DD`（日期取当天），其后为各分类节。
- 同时在会话中完整展示该节内容供用户核对。

## 5. 打 tag（G3：先确认，再执行）

1. 展示：建议版本、bump 依据（几条 feat / 几条 fix / 是否 breaking）、CHANGELOG 节预览。
2. 用户确认后执行 `git tag vX.Y.Z`（版本号前缀 `v` 与仓库既有 tag 风格一致；本仓库另有 `step-commit-vX.Y.Z` 插件级 tag 时询问用户采用哪种）。
3. 拒绝或要求改版本号时，按用户意见重出建议，不写任何文件不打 tag。

## 6. 汇报

版本建议与依据、CHANGELOG 节统计（Added/Fixed/Changed/Other 条数）、tag 是否创建、提醒 `git push --follow-tags`。
