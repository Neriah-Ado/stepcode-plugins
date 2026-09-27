---
description: 容器健康日报（/cron 无头接入）：汇总容器状态与异常事件，落盘 docs/docker-health.md，不改任何容器
argument-hint: [context 名或频率提示，可选；远程主机用环境变量 DOCKER_MATE_CONTEXT 注入]
---

# /docker-health — 容器健康日报

无头只读巡检：不启动/停止/删除任何容器，不外发数据。

<!-- HEALTH-RULES-START -->
```json
{
  "headless": "step -p \"按 plugins/step-docker-mate/commands/docker-health.md 执行健康巡检\"",
  "cadence": "建议 /cron 每日 09:00，创建前向用户确认",
  "report": "docs/docker-health.md",
  "context": "远程主机用环境变量 DOCKER_MATE_CONTEXT（docker context）；凭据仅环境注入（C4），禁止写入文件",
  "exit_semantics": { "healthy": "0", "has_abnormal": "1", "docker_unavailable": "2" },
  "readonly": "只调用 ps/inspect/events 类只读工具；危险操作（down/rm/prune）在日报模式一律禁止"
}
```
<!-- HEALTH-RULES-END -->

## 流程

1. `docker_ps` 汇总：运行/退出/重启中容器计数，非 running 的逐个列出。
2. 对异常容器跑 `diagnose`（崩溃模式库归因）；`docker_events`（近 24h）过滤 die/oom/kill 事件。
3. 写 `docs/docker-health.md`：日期与 context、状态汇总表、异常容器归因与建议、事件时间线（最多 50 条，C5）；会话输出只给报告路径 + 一句话结论。
4. 退出码按上表；docker 不可用时报错不写报告（退出码 2）。
