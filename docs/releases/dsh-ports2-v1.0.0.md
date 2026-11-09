# 第二批 dsh 移植 v1.0.0 — 7 个新插件 + 收录扩容 / DSH Ports II: 7 New Plugins

发布日期 / Released: 2026-11-09

## 中文

本批次基于 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 清单研究（★23996），按 Star 择优把 7 项 dsh 插件功能移植为 Step Code 声明式插件，全部**纯声明式、零第三方依赖**：

| dsh 上游（Star） | 本仓库移植 | 说明 |
| --- | --- | --- |
| [dsh-engram](https://github.com/kenz1117/dsh-engram)（★66） | [step-engram](../../plugins/step-engram) | 记忆条目库：FTS5+向量检索降级为「关键词+近因+频次」文件检索，证据门与 SM-2 复习保留 |
| [dsh-plugin-roundtable](https://github.com/9931666/dsh-plugin-roundtable)（★15） | [step-roundtable](../../plugins/step-roundtable) | 多专家圆桌：首轮隔离防锚定、分歧交用户拍板；持久子代理降级为会话内推演（如实声明） |
| [dsh-prompt-polish](https://github.com/benrong2048-boop/dsh-prompt-polish)（★11） | [step-prompt-polish](../../plugins/step-prompt-polish) | 提示词润色：结构化任务简报、澄清不编造；版本链降级为 git 历史 |
| [dsh-websearch](https://github.com/240xu/dsh-websearch)（★9） | [step-websearch](../../plugins/step-websearch) | 多引擎聚合：零 key 引擎开箱即用、key 后端环境变量激活、失败显式标注 |
| [chicheng-push](https://github.com/534119219/chicheng-push)（★7） | [step-notify](../../plugins/step-notify) | 多渠道推送：八渠道、默认 dry-run、外发先确认（G3 附加红线） |
| [dsh-gungnir](https://github.com/Jonah-Wu23/dsh-gungnir)（★6） | [step-gungnir](../../plugins/step-gungnir) | 证据导引目标锁定：判据动工前确认、证据链审计防虚假完成 |
| [dsh-fact-check](https://github.com/7starsseeker/dsh-fact-check)（★5） | [step-fact-check](../../plugins/step-fact-check) | 事实核查：原子拆分、交叉验证+对抗性再搜索、逐句溯源 |

不可移植与暂缓项收录进 [step-marketplace-dsh](../../plugins/step-marketplace-dsh) v1.1.0（compat 三态）：dsh-browser-control（★62，需 Chrome 扩展+loopback 桥，not-portable）、dsh-proactive（★15，宿主 session-resume 依赖，not-portable）、dsh-find-plugin（★229，绑定 dsh 生态，not-portable）；dsh-hdc-bridge（★22）、dsh-desktop-sidecar（★3）、dsh-math-olympiad（★3）、dsh-verify（★2）标 unported 备排期。

安全边界延续仓库既有约定：记忆条目只存证据指针不存原文；搜索/推送凭据只走环境变量（C4）；外发消息默认 dry-run、真实发送先确认（G3）；收录目录诚实标注三态与待实测。

### English

This second DSH-ports release adds 7 declarative plugins selected by upstream stars from the awesome-dsh-plugin list: evidence-pointer memory entries with hybrid retrieval, evidence gate and SM-2 review (step-engram, from dsh-engram), multi-expert roundtable with first-round isolation and user arbitration (step-roundtable), prompt polishing into structured briefs without fabrication (step-prompt-polish), multi-engine aggregated search with zero-key fallback (step-websearch), eight-channel push notifications defaulting to dry-run with confirmation before sending (step-notify), evidence-based goal locking against false completion claims (step-gungnir), and claim-splitting fact-checking with adversarial re-search (step-fact-check). Non-portable and deferred items are catalogued in step-marketplace-dsh v1.1.0 with three-state compat semantics (ported / not-portable / unported), honestly marked.

### 升级 / Upgrade

```bash
/plugin marketplace update
/plugin install <插件名>
```
