# dsh 移植批次 v1.0.0 — 4 个新插件 + 生态映射 / DSH Ecosystem Ports: 4 New Plugins

发布日期 / Released: 2026-11-09

## 中文

本批次参照 DeepSeek Harness（DSH）插件生态，把 4 项功能按本仓库声明式规范移植为 Step Code 插件，全部**纯声明式、零第三方依赖**（step-plan-quota 的额度查询为用户主动发起的只读网络请求，凭据走环境变量）：

| dsh 上游 | 本仓库移植 | 说明 |
| --- | --- | --- |
| [dsh-cache-miss](https://github.com/wefio/dsh-cache-miss)（wefio） | [step-cache-lens](../../plugins/step-cache-lens) `/cache-audit` | 宿主内联缓存重建告警 → 命令报告：逐轮 hit/rebuild 判定 + 嫌疑前缀变更 |
| [dsh-cache-stabilizer](https://github.com/dongsheng123132/dsh-cache-stabilizer) | step-cache-lens `/cache-stabilize` | 前缀稳定化：命中率/重发率/波动归因三指标 + diff 草稿（待确认） |
| [graph-memory](https://github.com/adoresever/graph-memory)（adoresever） | [step-graph-memory](../../plugins/step-graph-memory) | 知识图谱记忆：sqlite/向量检索降级为 JSON 存储 + 度中心性（声明式形态边界，诚实标注） |
| [dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter) | [step-plan-quota](../../plugins/step-plan-quota) | 差异化子集（订阅额度查询 + 峰谷提醒）；用量统计已由 step-token-meter 覆盖，不重复建设 |
| [dsh-plugin-hub](https://github.com/dshplugin/dsh-plugin-hub) | [step-marketplace-dsh](../../plugins/step-marketplace-dsh) | 市场桥 → 收录目录形态（与 step-marketplace-cc 同构，catalog.json 即交付物） |
| [dsh-whale-widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) | 不移植 | 余额挂件依赖 dsh 宿主 Web UI；Step Code 插件形态无 UI 扩展点（C1/C2） |

安全边界延续仓库既有约定：写图谱先 diff 后确认（G3）；额度查询凭据只走环境变量（C4）、令牌与响应不落盘；收录目录诚实标注规则级判定与待实测状态。

### English

This release ports 4 capabilities from the DeepSeek Harness (DSH) plugin ecosystem into Step Code declarative plugins: prompt-cache miss detection and prefix stabilization (step-cache-lens, from dsh-cache-miss / dsh-cache-stabilizer), cross-session knowledge-graph memory with evidence edges (step-graph-memory, from graph-memory, honestly downgraded to JSON storage + degree centrality), subscription plan quota (read-only, env-only credentials) with peak/off-peak pricing windows (step-plan-quota, the differentiated subset of dsh-cost-meter — usage stats remain covered by step-token-meter), and a dsh ecosystem catalog bridge (step-marketplace-dsh, mirroring step-marketplace-cc). dsh-whale-widget is documented as not portable (host Web-UI dependency; C1/C2). Graph writes show a diff and require confirmation first; quota credentials come only from environment variables and responses are never written to disk; catalog entries are rule-level verdicts honestly marked as untested.

### 升级 / Upgrade

```bash
/plugin marketplace update
/plugin install <插件名>
```
