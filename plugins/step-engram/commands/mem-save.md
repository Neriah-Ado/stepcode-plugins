---
description: "把会话要点写入本地记忆条目库（带证据指针），写盘先 diff 后确认"
argument-hint: <要点内容> [标签，逗号分隔]
---

# /mem-save — 记忆条目写入

**写盘红线**：entries.jsonl 只做追加与去重，写前先 diff 展示，用户确认后落盘（G3）。条目存要点与证据指针，不整段复制会话原文。

<!-- MEM-SAVE-RULES-START -->
```json
{
  "store": ".stepcode/engram/entries.jsonl，一行一条 JSON：{id, ts, content, tags[], evidence, hits, review}；id 为 12 位时间戳+随机后缀；首次写入初始化 hits:0 与 review:{interval:0, ef:2.5, due:ts}（供 /mem-search 的频次排序与 SM-2 复习使用）",
  "content": "用户确认要记的要点（一句到三句），含结论与适用条件；不复制大段原文",
  "evidence": "指针：归档 stamp 或 文件路径:行号 或 会话轮次引用；无出处时标 source:unverified 并在 diff 中提示用户",
  "dedupe": "与既有条目按内容相似 + 同标签判重：重复时更新 evidence/last_seen 而非新增；diff 中展示合并决定",
  "confirm": "输出新增/更新条目 diff → 用户确认 → 追加写入（先临时文件再原子替换）；拒绝则丢弃草稿"
}
```
<!-- MEM-SAVE-RULES-END -->

## 流程

1. 把要点整理为条目 content，提取标签，定位证据指针。
2. 读既有条目判重，决定新增或更新，生成 diff。
3. 展示 diff 等确认；确认后临时文件原子替换落盘。
4. 输出条目 id 与库规模。

## 输出格式

条目预览（content + tags + evidence）→ diff → 待确认提示；确认后给条目 id 与总条数。
