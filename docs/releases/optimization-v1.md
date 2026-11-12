# 性能与安全优化 · v1

对 `stepfun-code-plugins` 全仓执行的第一轮深度优化版本。聚焦**内存性能、CPU 调度性能、安全性能**三个维度，共 11 轮，每轮启动 5 个子代理交叉验证（内存/CPU/安全审计 + 2 名对抗性评审），合计 55 次子代理运行。所有改动经基线测试套件验证，候选发现由对抗评审驳回凑数项后仅保留真实缺陷。

## 基线修复（优化前置）

- `tests/validate.mjs`：Conventional Commits 类型集对齐仓库真实历史（`merge:`/`release:`/插件发布前缀），10 项预置失败 → 全绿。
- `dashboard/server-core.mjs`：415 JSON 门禁误劫持 GET-only 路由的 405 语义，修复为仅作用于消费 JSON 体的 `/api/config`（RFC 9110：405 先于 415）。

## 轮次清单

| 轮 | 区域 | 关键修复 | 维度 |
|---|---|---|---|
| R1 | Go 网关 hub/state | emit 序列化+广播移入专用锁修复 seq 乱序（误判 gap 重同步风暴）；retainLocked 先写 map 防 order/map 分叉；重放 tool_call 不重置终态；超限洪泛硬上限；入站 Text/Args/Summary/消息截断 | 内存·CPU·安全 |
| R2 | Go 网关 main | stdin 零拷贝解码；token/requestId fail-closed；HTTP 读头/空闲超时；SSE 订阅上限+写超时防停滞泄漏+retry 提示；静态目录列表禁用与路径包含校验 | CPU·安全 |
| R3 | Go 网关 profiles | 凭据数量/字段上限与 BaseURL scheme 校验；persist 失败回滚防幻影配置；免钥编辑保留 BaseURL；损坏文件备份防凭据丢失 | 内存·安全 |
| R4 | Electron main/preload | 外链协议白名单防 openExternal 命令执行；sandbox 加固；权限请求全拒；主窗口导航同源守卫；错误页转义；overlay 移动只持久化位置防展开高度污染 | 安全·内存 |
| R5 | Electron lib | spark 取最新端修复窗口>12 曲线冻结；采集间隔上界防溢出疯转；mergeBounds 缺省保留记忆位置；建窗屏外校验防副屏拔出后窗口不可见 | CPU·内存 |
| R6 | tps-monitor 大屏 | renderIndex 转义 `</script>` 与 `$` 模式防存储型 XSS；SSE 背压超 1MB 断连防缓冲无界；SSE 连接上限 32；采集 tick 配置读一次复用；CPU 采样 single-flight 去重 | 安全·内存·CPU |
| R7 | 数据/配置层 | readRange 按实际读取字节截断防未初始化内存入解析；writeConfig 原子写防崩溃损坏；usage-db/buildRateView 按 min(hist,window) 读取消除 12× 过度读取 | 内存·CPU·安全 |
| R8 | GUI Web 前端 | glass.js IIFE 补 global 形参修复指针特效 ReferenceError；网关发 node_evicted 帧+客户端移除修复长会话节点泄漏；resync 加冷却防快照风暴 | 内存·CPU |
| R9 | TS 扩展 | redact 遥测 allowlist 防误杀 token 计数+值模式秘密脱敏+privateKey 等键；进度防抖加最大等待防匀速卡死；历史预算改 UTF-8 字节防中文超 4MiB 被丢；bridge pending/stdout 有界；tracked 孤儿清理 | 安全·CPU·内存 |
| R10 | MCP 插件服务器 | db-insight 受控写入剥离字面量后拒绝多语句走私防 `COPY TO PROGRAM` RCE+危险关键字；psql/scanner 超时兜底；ci-fixer/sec-scan maxBuffer 防 ENOBUFS 误报；token-meter 逐条 push 防大文件 spread 静默丢记录 | 安全·CPU·内存 |
| R11 | 主题/启动器 | visibilitychange 监听器入 ctx.effect 防重复激活累积；splash replay 先销毁旧实例防定时器叠加；reduced-motion 降级类生效；test-host document stub 补全修复预置崩溃 | 内存·CPU |

## 验证结果（v1 定版）

- `tests/validate.mjs`：全绿（839+ 项）。
- `apps/stepfun-code-gui` run-all-tests：PASS（go vet / go test / 网关构建 / 扩展加载 / redact 26 项 / 分层 / 启动器 / token / e2e）。
- `apps/stepfun-usage-monitor`：107/107（含新增 security/lib-round5/dashboard-r6/data-r7 回归）。
- `themes/dsh-resident-theme` test-host：全过。
- `tests/db-insight-write.test.mjs`：7/7。

## 验证边界（如实说明）

- 本机无 C 编译器，Go `-race` 不可用；并发正确性以 `go vet` + 多轮 `go test` + 专用并发回归（seq 顺序/驱逐帧）+ 锁序分析覆盖。
- Electron `main.mjs` 与 Web 前端 DOM 行为无 node 单测运行时覆盖；改动经语法检查 + 子代理评审 + e2e（mock-feed 驱动真实面板）验证，sandbox/权限/导航守卫建议真机冒烟。
- 主题真实渲染需 dsh 宿主 + 浏览器，超出本机边界；逻辑经 test-host mock 验证。

## 推迟到 v2 的项

- tps-monitor N+1 sqlite 重复读取（聚合层重构，需契约级交叉验证）。
- 会话正文/progress 文本的值模式脱敏（R9 仅覆盖 tool_call.args 边界）。
- splash CSS 动画 transform 化（逐帧布局→合成，仅 splash 期边际收益）。
- 启动器 token 经 opener argv 的本地多用户嗅探面（需 HttpOnly Cookie 架构改动）。
- db-insight 多库方言接线、compose_up 确认语义。