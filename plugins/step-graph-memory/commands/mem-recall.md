---
description: "按主题跨会话查询知识图谱：度中心性 + 时间衰减排序，基于存储原文回答"
argument-hint: <主题或实体名> [--depth N]
---

# /mem-recall — 图谱召回

**只读召回**：本命令绝不写任何文件；答案必须基于图谱 evidence 与关联原文，检索不到就明说，禁止编造。

<!-- MEM-RECALL-RULES-START -->
```json
{
  "query": "实体名精确匹配优先，其次模糊子串；--depth 控制沿边扩展层数（默认 2，上限 4）",
  "rank": "排序分 = 度中心性（邻居数）× 时间衰减（last_seen 越近权重越高）；不做向量检索（声明式形态不内置 embedding，见插件边界）",
  "answer": "先给结论要点，再列证据：节点卡片（name/type/desc）+ 相关边（relation + evidence 指针 + 按指针从归档取回的原文摘引）",
  "on_missing": "图谱无命中 → 明说「图谱中未记录」，建议先 /mem-graph 构建或 /archive 归档；禁止编造"
}
```
<!-- MEM-RECALL-RULES-END -->

## 流程

1. 读取 graph.json（不存在则给构建指引，不报错）。
2. 匹配实体，沿边扩展 --depth 层，按 rank 排序。
3. 汇总节点卡片与证据边，输出要点式回答。
4. 命中不足时给出补充归档建议。

## 输出格式

结论要点 → 节点卡片 → 证据边（含原文摘引）→ 未命中/建议说明。
