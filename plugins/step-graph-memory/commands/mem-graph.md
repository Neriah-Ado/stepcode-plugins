---
description: "把本会话/指定归档中的已完成任务与决策抽取为知识图谱（实体-关系-边），写入 .stepcode/graph-memory/graph.json"
argument-hint: [范围：本会话 | docs/context-archive | 指定文件]
---

# /mem-graph — 知识图谱构建

**写盘红线**：graph.json 写入前先 diff 展示，用户确认后落盘；绝不覆盖既有边，只做合并（G3）。对标 graph-memory 的跨会话记忆能力，落地为声明式 JSON 存储。

<!-- MEM-GRAPH-RULES-START -->
```json
{
  "store": ".stepcode/graph-memory/graph.json：nodes=[{id,type,name,desc,last_seen}]，edges=[{from,relation,to,evidence,stamp}]；纯 JSON 零依赖，不用 sqlite/向量库",
  "extract": "实体 = 模块/文件/组件/外部服务/关键决策；关系 = 依赖/修改/决策了/阻塞/替代；每条边必须带 evidence 指针（归档 stamp、文件路径:行号，或 step-engram 条目 id 前缀 en:）——图谱不存会话原文摘引，原文留在归档，召回时按指针取回；路径型指针仅接受项目相对路径，拒绝 .. 上跳与绝对路径（越界即拒绝并提示修正）",
  "merge": "同 id 实体合并属性并更新 last_seen；重复边去重；与现有图冲突时保留双方并标 conflict，不静默取舍",
  "prune": "--prune 列出孤立节点（零边）清单，先报告后确认才移除；绝不静默删节点",
  "confirm": "输出新增/更新/冲突统计 + 完整 diff，用户确认后才写盘（先写临时文件再原子替换）；拒绝时丢弃草稿不落盘（含临时文件）；写盘后输出审计行：新增/更新/冲突/孤立节点计数与 diff 摘要",
  "on_broken": "graph.json 缺失或损坏：给重建指引（从归档重建）与 step-engram 条目库互备路线，不裸报错"
}
```
<!-- MEM-GRAPH-RULES-END -->

## 流程

1. 读取范围（本会话摘要、`docs/context-archive/` 归档块或指定文件），抽取实体与关系。
2. 与既有 graph.json 幂等合并（去重、冲突标注），生成 diff。
3. 展示统计与 diff，等用户确认；确认后临时文件原子替换落盘。
4. 输出节点/边计数与新增内容摘要。

## 输出格式

抽取统计（实体 N / 边 M）→ diff → 待确认提示；确认后给落盘路径与最终规模。
