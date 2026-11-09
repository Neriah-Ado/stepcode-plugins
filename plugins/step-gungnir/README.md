# step-gungnir — 证据导引型目标锁定

纯声明式插件：把目标翻译成可判定的证据判据，无证据禁止宣称完成。移植自 dsh 生态 [dsh-gungnir](https://github.com/Jonah-Wu23/dsh-gungnir)（★6）。

## 它解决什么

「应该差不多了」式的虚假完成是长任务最大的坑。本插件在动工前锁定判据清单（用户确认），收尾时逐条对据——完成与否由证据说话，不由感觉说话。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/ultragoal <目标>` | 锁定目标 → 产出证据判据清单（命令退出码/产物存在且正确/测试通过）→ 用户确认后作为唯一完成口径 |
| `/goal-audit [判据文件]` | 逐条审计证据链：已满足/未满足/无法判定；缺证据判「未完成」，不模糊 |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-gungnir
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- 判据必须可判定（命令可跑、文件可查）；开放性目标只做部分判定并明示覆盖范围。
- 判据文件落盘 `.stepcode/gungnir/goal.json`，写盘先 diff 后确认（G3）。
- 自适应循环降级为与 `/cron`、step-test-guard 的组合使用（声明式形态边界，上游内置循环驱动）。

## 许可证

[AGPL-3.0-only](../../LICENSE)
