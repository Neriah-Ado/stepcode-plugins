# step-fact-check — 事实核查

纯声明式插件：把主张拆成原子事实点，交叉检索验证并逐句溯源。移植自 dsh 生态 [dsh-fact-check](https://github.com/7starsseeker/dsh-fact-check)（★5）。

## 它解决什么

模型复述的「事实」常带着自信的错误。核查要拆到原子粒度、正反两向找证据、每个结论挂来源——而不是整段复述后标注「已核实」。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/claim-split <主张或文档>` | 拆分为可独立核查的原子事实点清单（编号 + 原文定位 + 核查要点） |
| `/fact-check <主张或清单>` | 逐点多引擎交叉验证 + 对抗性再搜索；结论先行、逐句溯源、矛盾标注 |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-fact-check
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 检索经 step-websearch 的多引擎聚合完成（声明式形态边界，上游为独立技能内置检索生态）。
- 无法核实的点明确判「无法核实」，不默认为真；置信度如实标注（高/中/低）；检索全失效时逐点判 unverifiable 不出结论。
- 核查规模有界：每点来源 ≤10、核查点 ≤50（超出分批）；来源链接解析后 scheme 必须为 http/https；结论可经确认沉淀到 step-engram 记忆条目。
- 免费引擎质量有限，关键结论建议人工复核来源原文。

## 许可证

[AGPL-3.0-only](../../LICENSE)
