# Changelog — step-graph-memory

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/mem-graph` 实体-关系-证据边抽取，与既有图幂等合并；写盘先 diff 后确认（移植自 graph-memory）
- `/mem-recall` 主题召回：度中心性 × 时间衰减排序，答案附 evidence 原文摘引，检索不到明说
- 存储为 `.stepcode/graph-memory/graph.json` 纯 JSON，零依赖零网络
