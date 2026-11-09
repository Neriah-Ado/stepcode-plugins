# Changelog — step-fact-check

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格，版本号遵循 semver。

## [1.0.0] - 2026-11-09

### 新增

- `/claim-split` 主张拆解：原子事实点清单（编号/原文定位/核查要点）（移植自 dsh-fact-check）
- `/fact-check` 交叉验证：多引擎检索 + 对抗性再搜索（主动找反例），结论先行、逐句溯源、矛盾标注、无法核实明说
- 与 step-websearch 联动的引擎与凭据约定（零 key 兜底）
