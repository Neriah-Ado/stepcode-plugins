# step-context-archive

长会话的**上下文归档与召回**插件：把已完成任务块的原文写进项目内的归档文件，对话里只保留一行带三点摘要的 `#STAMP` 索引；需要细节时按 stamp 取回全文。

## 它解决什么

长会话里真正吃掉窗口的，往往是**早期任务的大段细节**——报错堆栈、命令输出、被改动的完整代码。
这些内容：

- 当下不需要（当前任务用不到）；
- 但将来可能要引用（"上次那个报错的完整堆栈是什么"）；
- 全留在对话里会持续占用窗口。

本插件把它们**移出对话、写入文件**，并在原地留一行索引。于是窗口里承载的是
"有哪些历史块、各自讲什么、完成没完成"，而逐字原文按需取回。

## 机制

```
/archive
  1. 挑出已完成、且细节当前不需要的任务块
  2. 每块生成三点摘要：目标 / 关键决策 / 是否完成
  3. 块原文 → .stepcode/context-archive/stamp-<id>.md
  4. 对话里留下索引行：
     #STAMP <id> → .stepcode/context-archive/stamp-<id>.md — 目标：…；关键决策：…；是否完成：…
  5. 明确汇报每个任务的完成状态（已完成 / 部分完成 / 未完成）

/recall <id>
  读取 stamp-<id>.md 原文 → 基于原文回答（而不是凭摘要或记忆复述）
```

设计原则：**摘要用于导航，原文用于引用**。摘要可能失真，一切以归档文件为准。

## 安装

```bash
# 把本集合添加为插件市场源
/plugin marketplace add Neriah-Ado/stepcode-plugins

# 安装本插件
/plugin install step-context-archive
```

## 使用

| 命令 | 作用 |
| --- | --- |
| `/archive` | 归档已完成任务块，产出 `#STAMP` 索引行并汇报完成状态 |
| `/recall <id>` | 按 stamp 取回归档原文 |

归档目录默认为项目内 `.stepcode/context-archive/`；`stamp-<id>.md` 的内容是该块**归档前的原文**。
索引行记录**项目相对路径**（跨机器/移动仓库仍可解析）；`<id>` 优先为 12 位小写十六进制
（无法计算哈希时退化为 `b` 前缀短 id）。

配套技能 `skills/context-archive/SKILL.md` 说明 `#STAMP` 语义、三点摘要协议与召回纪律。

> **宿主加载状态（如实说明）**：截至 Step Code v0.1.1，插件安装目录
> （`~/.stepcode/plugins/<name>/`）**尚未接入宿主的命令 / 技能加载器**——`/plugin install`
> 当前只交付 `mcpServers` 与 `provision`，安装后的 `commands/*.md` 与 `skills/*/SKILL.md`
> **不会**自动变成斜杠命令或技能（本地实测：安装后 `/archive` 零命中，`/reload` 与完全重启
> 进程后仍零命中；源码侧 `core/resource-loader.ts` 只从扩展 API 取命令，未读取插件目录）。
> 本插件的 Markdown 资源本身符合宿主清单规范（`node tests/validate.mjs` 全绿），但**需要宿主
> 补齐该加载通道后才会生效**。该行为已反馈给上游维护者，详见本 PR 的评论。

## 形态与范围（重要）

本目录是**声明式实现**：只有清单 + 命令文本 + 技能提示词，**不包含可执行扩展代码**，
因此不需要 `entry` 字段（Step Code 当前也只记录不加载 `entry`）。归档动作由模型使用
宿主的读/写文件工具完成。

**参考实现**：[uos1231234/step-context-archive](https://github.com/uos1231234/step-context-archive)
是一个独立的**代码版扩展**（TypeScript），提供声明式形态无法覆盖的能力：
按 token 阈值自动介入、压缩前自动接管并归档、工具结果的算法去重与有界投影、
stamp 归档的自动写入与 `recall_by_stamp` 工具注册。两者共享同一套 `#STAMP` 索引格式
与三点摘要协议，可分别独立使用。

## 边界与已知限制

- **依赖模型自觉执行**：声明式形态没有代码级强制，归档时机由模型判断；需要"到阈值自动触发"
  的场景请使用参考实现版本；
- **摘要非事实**：摘要仅作导航，引用细节一律走 `/recall`；
- **归档不做压缩**：本插件只做"移出对话 + 索引 + 按需取回"，不改变归档文件内容本身。

## 许可

- **本 PR 提交的声明式内容**（`step.plugin.json` 清单、`commands/*.md` 命令文本、
  `skills/context-archive/SKILL.md` 技能提示词）：随本集合以 [AGPL-3.0-only](../../LICENSE) 分发。
- **参考实现**（TypeScript 代码版）：
  [uos1231234/step-context-archive](https://github.com/uos1231234/step-context-archive)，
  属独立项目，采用其自身许可
  [agent-shell License v1.0](https://github.com/uos1231234/step-context-archive/blob/main/LICENSE)
  —— **并非 MIT**（源自 PolyForm Small Business License 1.0.0，另加商用条款；超出小型企业
  规模的公司商用需单独取得商务许可）。本 PR **不包含**其任何代码或文本。
