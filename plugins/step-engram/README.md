# step-engram — 本地长期记忆条目库

纯声明式插件：把会话要点沉淀为带证据指针的记忆条目，跨会话混合检索并做间隔复习。移植自 dsh 生态 [dsh-engram](https://github.com/kenz1117/dsh-engram)（★66）。

## 它解决什么

跨会话的「事实与结论」（接口约定、环境 quirks、踩坑记录）靠翻旧会话找不回。本插件把要点存成带证据指针的条目，检索时逐条给证据充分性标注——结论必须可溯源。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/mem-save <内容> [标签]` | 写入条目（id/ts/content/tags/evidence 指针），写盘先 diff，确认后追加落盘 |
| `/mem-search <query>` | 关键词+近因+频次混合检索；逐条标注证据充分性；SM-2 到期条目置顶复习 |

## 与 step-graph-memory 的边界

图谱（step-graph-memory）存**实体与关系**（谁依赖谁）；本插件存**证据条目**（约定/结论/事实点及其出处）。两者可并用：图谱给结构，条目给出处。

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-engram
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 存储为 `.stepcode/engram/entries.jsonl` 纯 JSONL：无 SQLite FTS5、无向量检索（声明式形态边界，需完整版用原项目）；检索降级为关键词+近因+频次线性扫描。
- 上游证据门为代码强制三条件判定，本插件降级为模型自标注的充分/不足判断（无代码强制层）；SM-2 复习采用先回忆后揭示（先遮住内容凭线索回忆，再揭示并请用户评分）。
- 条目内容为要点与证据指针，不整段复制会话原文；原文留在会话/归档，避免机密进版本库。
- 证据门：检索命中必须标注充分/不足，不足时明说，禁止编造。
- 大条目库（>5000 条）建议分库。

## 许可证

[AGPL-3.0-only](../../LICENSE)
