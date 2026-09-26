# step-test-guard

测试守护循环。纯声明式插件（/test 命令 + test-fix-loop skill），把「跑测 → 归因 → 定点修复 → 重跑」变成 Agent 的标准工作流。

## 命令与技能

| 入口 | 说明 |
| --- | --- |
| `/test` | 检测测试框架（vitest/jest/pytest/node 内置；go/cargo/maven/gradle 输出解析）→ 运行 → 解析为结构化失败清单（用例/文件/期望 vs 实际/初判归因） |
| `/nightly-test` | /cron 可调度的无头夜间全量测试：只跑测与报告，不改代码；产出 `docs/test-report.md`（摘要/失败明细/与上轮对比），退出码 0/1/2 |
| `/bisect` | git bisect 自动化包装：生成 run 脚本定位引入回归的首个坏提交，定位后转人工确认 |
| `/flaky` | 可疑用例多轮重跑统计失败率，识别 flaky（间歇失败）并给出 skip/retry/CI 分组隔离方案 |
| skill `test-fix-loop` | 失败归因三分类（断言失败/环境问题/真实回归）→ 最小改动修复 → 增量重跑失败集 → 全量确认；默认 3 轮上限，超限转人工 |

另支持：istanbul/cobertura 覆盖率产物解读（低于阈值的文件列为未覆盖关键路径提示）；失败用例缓存 `docs/test-guard/failed-cases.json`，下轮先跑失败集加速、全量确认兜底；自动读取仓库 `AGENTS.md` 中的测试约定（如「改动后运行 npm run check」）并优先采用。

## 内置纪律

- 修复遵循**最小改动**：每个被修改文件必须对应失败清单中的用例（零误改核对）；
- 禁止删测试/跳过测试/放宽断言来「修复」，除非用户确认测试本身有误；
- 测试原始输出落盘 `docs/test-guard/last-run.log`，会话中只出现结构化清单（token 经济）；
- 失败集清零后必须全量重跑确认无连带破坏。

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-test-guard
```

## 验证

```bash
node tests/validate.mjs               # 清单/解析模式/检测规则/归因规则校验
node tests/verify-test-guard-flow.mjs # 修复闭环 + 3 轮上限 + 零误改端到端验证
```

## License

MIT
