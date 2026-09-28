# step-cron-recipes

定时任务模板库（纯声明式）。6 个开箱模板 + init 向导 + 变量系统 + 社区贡献规范。

## 模板

| 模板 | 目标 | 频率建议 |
| --- | --- | --- |
| deps-check | 依赖更新检查（只报告不升级） | 每日 09:00 |
| nightly-test | 夜间全量测试（联动 step-test-guard） | 每日 03:00 |
| log-patrol | 日志巡检错误聚合日报 | 每日 08:30 |
| git-backup-check | git 备份校验 | 每日 22:00 |
| page-monitor | 页面监控（playwright 截图 diff） | 每日 10:00 |
| site-alive | 静态站存活检查 | 每 6 小时 |

每个模板 = 触发频率建议 + 无头任务 prompt + 输出落盘路径 + 依赖声明与降级路径。

## 安装与验证

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-cron-recipes
node tests/validate.mjs
```

## License

[AGPL-3.0-only](../../LICENSE)
