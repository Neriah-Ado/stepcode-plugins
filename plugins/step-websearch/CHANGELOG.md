# Changelog — step-websearch

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/websearch` 多引擎并发聚合：零 key 引擎开箱即用、key 后端环境变量自动激活、URL 去重、失败显式标注（移植自 dsh-websearch）
- `/search-brief` 搜索结果归纳：结论先行、矛盾标注、逐句带来源链接
- 结果截断与只取摘要的 Token 经济约定（C5）
