---
description: "本地记忆条目混合检索：关键词+近因+频次排序，逐条证据充分性标注，到期复习置顶"
argument-hint: <query> [--tags 标签] [--n 条数]
---

# /mem-search — 记忆检索与复习

**证据门**：每条命中必须标注证据充分性——充分（有出处指针且语义直接支撑）/ 不足（仅相似或出处缺失）；证据不足时明说，禁止据此下结论。

<!-- MEM-SEARCH-RULES-START -->
```json
{
  "retrieve": "线性扫描 entries.jsonl：关键词命中（含标签）为主，近因（ts 衰减）与频次（命中次数）为辅排序；--tags 过滤；--n 默认 5 上限 20",
  "evidence_gate": "每条命中输出：content 摘要 + 充分性标注（充分/不足）+ evidence 指针；指针可解析时附一句原文摘引（读归档/文件，不存于条目）",
  "review": "条目带 review 元数据（SM-2：interval/ef/due）；到期（due ≤ 今天）条目置顶并提示复习；复习后按回忆质量更新 interval（照 dsh-engram 间隔复习语义）",
  "on_missing": "零命中 → 明说「记忆库中未记录」，建议 /mem-save 沉淀；禁止编造"
}
```
<!-- MEM-SEARCH-RULES-END -->

## 流程

1. 读 entries.jsonl（不存在则给沉淀指引，不报错）。
2. 混合检索排序，逐条解析 evidence 指针取原文摘引。
3. 应用证据门标注；到期复习条目置顶并更新 SM-2 元数据（写回需 diff 确认）。
4. 输出命中清单与未命中说明。

## 输出格式

命中清单（摘要 + 充分性 + 指针）→ 到期复习提示 → 零命中/建议说明。
