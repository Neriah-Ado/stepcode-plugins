# dsh 移植插件迭代 v1.1.0 → v1.5.0 — 10 插件批量迭代 / DSH Ports Iteration: v1.1.0–v1.5.0

发布日期 / Released: 2026-11-10

## 中文

本批次对 10 个 dsh 移植插件（step-cache-lens / graph-memory / plan-quota / engram / roundtable / prompt-polish / websearch / notify / gungnir / fact-check）执行 5 个 minor 版本的批量迭代，每版本一个主题，遵循 AGENTS.md §4 版本门禁（G1–G6）：

| 版本 | 主题 | 要点 |
| --- | --- | --- |
| v1.1.0 | 证据与审计 | 各插件输出审计统计/快照/审计行，报告可独立复核（如 websearch 引擎健康遥测、notify 发送审计 jsonl、gungnir 状态流转 history[]） |
| v1.2.0 | 降级路径补全（G4） | 依赖缺失/损坏逐插件给针对性指引：字段缺失两态、库文件损坏隔离、roles.json/goal.json 损坏回退、检索全失效归因 |
| v1.3.0 | 性能与 Token 经济（C5） | 扫描量全部有界：cache-audit 默认 50 轮、engram >5000 条只扫近 1000 条、websearch 整体超时预算 30s、notify payload ≤4KB、gungnir 判据分组批量对据（history 100 条滚动见 v1.1.0）、fact-check 核查点 ≤50 |
| v1.4.0 | 安全加固（G3/C4） | URL scheme 白名单（http/https）、evidence 指针路径越界检查（拒绝 .. 与绝对路径）、重跑命令拒绝组合形式、default-deny、输出路径脱敏、模板 example 占位化 |
| v1.5.0 | 生态联动 | 跨插件互链（graph-memory ↔ engram、gungnir → notify、roundtable/fact-check → mem-save、cache-lens → prompt-polish）与 /cron 退出码约定（0/1/2） |

兼容回归（G6）：全部 v1.0.0 功能保留，迭代均为增量约束与可观测性增强，无能力回退；既有确认链（G3）在联动中全量复用，联动动作一律「需确认」。

### English

This release iterates the 10 DSH-ported plugins through five minor versions with themed passes: evidence & audit trails (v1.1.0), degraded-path completion per AGENTS.md G4 (v1.2.0), performance & token-economy bounds — every scan/payload/history capped (v1.3.0), security hardening — URL scheme allow-lists, path-traversal checks on evidence pointers, compound-command rejection, default-deny (v1.4.0), and cross-plugin integration with /cron exit-code conventions (v1.5.0). G6 regression holds: all v1.0.0 capabilities are preserved; every integration reuses existing confirmation chains.

### 升级 / Upgrade

```bash
/plugin marketplace update
/plugin install <插件名>
```
