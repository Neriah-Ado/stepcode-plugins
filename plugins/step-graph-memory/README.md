# step-graph-memory — 跨会话图谱记忆

纯声明式插件：把已完成任务与决策沉淀成实体-关系图谱（纯 JSON 存储），跨会话按主题召回并附原文证据。移植自 dsh 生态 [graph-memory](https://github.com/adoresever/graph-memory)。

## 它解决什么

跨会话记忆靠人脑回忆或翻旧会话都不可靠。本插件把「谁依赖谁、谁决策了什么、什么阻塞了什么」落成带证据边的图谱，召回时给结论也给出处。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/mem-graph [范围]` | 抽取实体/关系/证据边，与既有图合并；写盘先 diff，确认后落盘 |
| `/mem-recall <主题> [--depth N]` | 度中心性 × 时间衰减排序召回，基于 evidence 原文回答，只读 |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-graph-memory
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 存储为 `.stepcode/graph-memory/graph.json` 纯 JSON：无 sqlite、无向量检索、无社区发现；PageRank 简化为度中心性（声明式形态边界，需完整版用原项目）。
- 每条边必须带 evidence（归档行或会话摘引）；召回检索不到就明说，禁止编造。
- 写图先 diff 后确认（G3）；图谱文件属项目数据，不夹带机密凭据内容。
- 大图谱（>2000 节点）建议分域建图。

## 许可证

[AGPL-3.0-only](../../LICENSE)
