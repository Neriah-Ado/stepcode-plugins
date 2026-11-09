# Changelog — step-graph-memory

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/mem-graph` 实体-关系-证据边抽取，与既有图幂等合并；写盘先 diff 后确认（移植自 graph-memory）
- `/mem-recall` 主题召回：度中心性 × 时间衰减排序，答案附 evidence 原文摘引，检索不到明说
- 存储为 `.stepcode/graph-memory/graph.json` 纯 JSON，零依赖零网络

## [1.1.0] - 2026-11-10

### 新增

- 写盘后输出审计行：节点/边/冲突计数 + diff 摘要，增量账目可复核

## [1.2.0] - 2026-11-10

### 新增

- 图谱缺失/损坏时给重建指引与 step-engram 条目库互备路线（G4）

## [1.3.0] - 2026-11-10

### 变更

- `/mem-graph --prune`：孤立节点裁剪，先报告清单后确认，绝不静默

## [1.4.0] - 2026-11-10

### 安全

- evidence 指针路径越界检查：仅项目相对路径，拒绝 `..` 与绝对路径

## [1.5.0] - 2026-11-10

### 新增

- 边可引用 step-engram 条目 id 作为 evidence 类型，跨库互链
