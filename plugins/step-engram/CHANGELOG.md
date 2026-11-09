# Changelog — step-engram

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/mem-save` 记忆条目写入：id/ts/content/tags/evidence 指针，写盘先 diff 后确认、幂等去重（移植自 dsh-engram）
- `/mem-search` 混合检索（关键词+近因+频次）：逐条证据充分性标注，不足不下结论；SM-2 到期复习置顶
- 存储为 `.stepcode/engram/entries.jsonl` 纯 JSONL，零依赖零网络
