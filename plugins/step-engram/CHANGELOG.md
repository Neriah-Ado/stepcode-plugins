# Changelog — step-engram

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/mem-save` 记忆条目写入：id/ts/content/tags/evidence 指针，写盘先 diff 后确认、幂等去重（移植自 dsh-engram）
- `/mem-search` 混合检索（关键词+近因+频次）：逐条证据充分性标注，不足不下结论；SM-2 到期复习置顶
- 存储为 `.stepcode/engram/entries.jsonl` 纯 JSONL，零依赖零网络

## [1.1.0] - 2026-11-10

### 新增

- `/mem-search` 输出检索统计：扫描条数/命中数/排序档位，检索成本可观测

## [1.2.0] - 2026-11-10

### 新增

- 库文件损坏行隔离（跳过并计数，不阻塞检索）与 step-graph-memory 互备指引（G4）

## [1.3.0] - 2026-11-10

### 变更

- 分库与扫描窗口：>5000 条默认只扫最近 1000 条，`--full` 显式全量；`--tags` 先过滤后扫描

## [1.4.0] - 2026-11-10

### 安全

- evidence 指针路径越界检查：仅项目相对路径，拒绝 `..` 与绝对路径

## [1.5.0] - 2026-11-10

### 新增

- 条目 id 格式稳定化（12 位时间戳 + 随机后缀），可被 step-graph-memory 边以 `en:` 前缀引用
