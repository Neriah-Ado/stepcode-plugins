---
name: docker-ops
description: Docker/Compose 容器运维方法论：起停编排、日志解读、崩溃定位、镜像瘦身。涉及容器状态查询或故障处理时使用。
---

# docker-ops — 容器运维方法论

工具：MCP server `step-docker-mate`（docker_ps/inspect/logs/compose_up/compose_down/compose_ls/image_layers）。

## 危险操作确认（G3 红线）

<!-- DANGEROUS-OPS-START -->
```json
{
  "dangerous": ["compose_down", "docker rm", "docker system prune", "docker volume rm", "docker rmi"],
  "rule": "先 dry-run/列出将受影响的资源 → 用户明确确认 → 执行；绝不静默执行，绝不在循环里批量确认",
  "context": "远程主机（DOCKER_MATE_CONTEXT）上执行危险操作前必须再次确认目标主机名"
}
```
<!-- DANGEROUS-OPS-END -->

## 标准流程（起—查日志—定位崩溃—重启）

1. `docker_ps` 总览；异常容器（exited/restarting）用 `docker_inspect` 看 `State.ExitCode`、`OOMKilled`、`RestartCount`。
2. `docker_logs` 取尾部日志（默认 200 行，勿全量拉取）；结合退出码与日志末段归因（崩溃模式库见下）。
3. 处置：先 `compose_up` 恢复；反复崩溃的容器先定位根因再重启，避免无限 restart 掩盖问题。
4. 汇报：容器状态表 + 归因 + 已采取措施；危险操作列出待确认清单。

## 崩溃模式库（v1.1.0）

| 症状 | 归因 | 处置 |
| --- | --- | --- |
| ExitCode 137 / OOMKilled=true / 日志 "heap out of memory" | OOM：内存不足或泄漏 | 降内存占用或提高 mem_limit；排查泄漏点；勿盲目重启 |
| 日志 "port is already allocated" / "address already in use" | 端口冲突 | 找到占用方（宿主进程或另一容器），调整端口映射 |
| 反复重启 + 日志 "dependency failed to start" / 连接被拒 | 依赖未就绪 | 加 healthcheck 与 depends_on.condition；重试退避 |
| 日志 "permission denied" 指向挂载路径 | 卷权限 | 检查宿主目录属主与容器 UID；Windows 下检查盘符共享 |
| ExitCode 1 + 应用栈回溯 | 应用自身异常 | 转入 test-fix-loop / 按日志定位代码 |

`docker_events` 巡检（v1.1.0）：`docker events --since <ts> --until <now> --format json` 过滤 `die/oom/kill` 事件，按容器聚合输出时间线；巡检是只读操作。

## 镜像瘦身（v1.2.0）

`image_layers` 取最大层 → 按层指令归类建议：COPY node_modules → 多阶段构建/仅拷贝产物；apt 安装 → `--no-install-recommends` + 清理缓存合并 RUN；通用 → .dockerignore、选 alpine/distroless 基础镜像、合并 RUN 减层。给出**可执行**的 Dockerfile 修改建议并预估减重量，改写前征得用户同意。

## 多 compose 项目（v1.2.0）

`compose_ls` 列出全部项目 → 按项目分组汇报状态；跨项目操作逐项目确认，禁止一把梭。

## 远程与日报（v1.3.0）

- 远程主机：`DOCKER_MATE_CONTEXT` 环境变量指定 docker context（`docker context ls` 查看）；凭据走环境注入（C4），**禁止**把远程凭据写进仓库文件；工具结果中标注当前 context。
- 健康日报：见 /docker-health 命令（/cron 无头接入）。
