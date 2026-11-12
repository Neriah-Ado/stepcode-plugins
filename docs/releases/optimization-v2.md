# 性能与安全优化 · v2

`stepfun-code-plugins` 第二轮深度优化版本，在 v1 基础上做深度审计、跨切面加固与终审绕过修复。共 11 轮（R12–R22），每轮启动 5 个子代理交叉验证，合计 55 次子代理运行（v1+v2 共 22 轮、110 次）。所有改动经基线测试与多轮 soak 验证。

## 轮次清单

| 轮 | 区域 | 关键修复 | 维度 |
|---|---|---|---|
| R12 | tps-monitor 聚合 | agentStatus 探测 2s 缓存防重连风暴；snapshot 注入缓存 system 免 REST 双采样。**N+1 聚合重构经交叉验证驳回**（zcode 会话累计独立 SUM 口径漂移 + followed 会话作用域不匹配，边际收益） | CPU |
| R13 | TS 扩展脱敏 | tool_call label/summary 补脱敏防绕过 redactArgs；progress 文本/agent summary 值模式脱敏；导出 scrubValue。**会话正文脱敏暂缓**（终端镜像无新增暴露面 + 可用性代价） | 安全 |
| R14 | GUI SSE 自愈 | visibilitychange 可见补 resync + 脏标记重试堵冷却漏洞；SnapshotFrame seq 先读。**心跳 seq 协议改造驳回**（select 竞态反造丢帧 + 边际触发） | 内存·CPU |
| R15 | GUI tree 渲染 | textContent 写前比较；updateRoot 签名门控防每脏节点重建根卡；countVisible 每帧预算一次 O(K·N)→O(N)。**整卡签名门控暂缓**（漏更新风险测试不可见） | CPU |
| R16 | MCP 插件安全 | sec-scan 文件读取/解析 try-catch + handleCall 兜底防 stdio 崩溃 DoS；compose_up/rerun_workflow 加 confirm dry-run（G3）；compose 文件参数注入/UNC 防护 | 安全 |
| R17 | Go 并发 | publishNode 值拷贝移入 s.mu 固化单写者不变量；**修正 R14 引入的 SnapshotFrame seq 后移错误**（须先读，后读会锚定构建期帧为已覆盖却缺失致静默漂移） | CPU·正确性 |
| R18 | Electron 生命周期 | overlay 外部关闭拦截为隐藏防 collector 泄漏；before-quit 落盘最新窗口边界；showMainWindow 退出竞态 dash 守卫；usage-db 仅静音 ExperimentalWarning | 内存 |
| R19 | 跨切面安全头 | 两面板 nosniff/no-referrer/X-Frame-Options；GUI 严格 CSP（全外链零回归）。**tps nonce-CSP 与 token-argv 暂缓**（成本收益失衡） | 安全 |
| R20 | 性能基准 | Go bench harness（Apply/驱逐/扇出/Snapshot/并发）+ 3 轮基线。驱逐稳态仅 +217ns 确证 O(1)；扇出零分配 | CPU |
| R21 | 终审绕过修复 | **db-insight 双引号标识符内单引号掩盖多语句 RCE 绕过**；docker 正斜杠 UNC 漏网；回归测试接入 validate 门禁；文档同步 | 安全 |
| R22 | 终审绕过修复 | **db-insight E-string 反斜杠转义脱同步 RCE 绕过**（解析器追踪反斜杠 + 拒绝 E 前缀 fail-closed）；docker 首尾空白绕过 UNC；多轮 soak | 安全 |

## 行为变更（需用户知晓）

- `compose_up` / `rerun_workflow` 默认 **dry-run**，须 `confirm:true` 才执行（G3 合规；docker-ops SKILL/README、ci-fixer README 已同步）。
- db-insight 受控写入拒绝多语句、危险关键字、E'…' 转义字符串（防走私 RCE；合法单条 INSERT/UPDATE 不受影响）。
- usage-db 仅静音 ExperimentalWarning，其余诊断警告恢复输出。
- 其余为透明加固，无需用户动作。

## v1 推迟项闭环

- compose_up/rerun confirm 语义 → **v2 R16 已实现**。
- N+1 聚合重构 → **v2 R12 评审驳回**（口径漂移 + 作用域不匹配，边际收益）。
- 会话正文脱敏 → **v2 R13 评审暂缓**（终端镜像，无新增暴露面）。
- tps nonce-CSP / token-argv → **v2 R19 评审暂缓**（成本收益失衡，记录残余风险）。
- 整卡签名门控 → **v2 R15 暂缓**（漏更新风险测试不可见，需真机 profiling）。

## 验证结果（v2 定版）

- `tests/validate.mjs`：ALL PASS（含新接入的 db-insight-write / sec-scan-robust / docker-compose-file 回归，CI 同入口覆盖）。
- `apps/stepfun-code-gui` run-all-tests：**PASS（3 轮 soak）**，go test -count=5 稳定。
- `apps/stepfun-usage-monitor`：108/108。
- `themes/dsh-resident-theme` test-host：全过。
- Go 基准：驱逐稳态 ~3.1µs/op（+217ns）、扇出 0 分配、Snapshot@1000 ~56µs。

## 验证边界与盲区（如实说明）

- 本机无 C 编译器，Go `-race` 不可用；并发正确性以 vet + 多轮 soak + seq/驱逐一致性回归 + 锁序分析覆盖。
- Electron `main.mjs` 接线与 Web 前端 DOM 无 node 运行时单测；改动经语法检查 + 子代理评审 + e2e（mock-feed）验证，**sandbox/权限/导航守卫/ tree 签名门控建议真机冒烟**。
- app 级安全测试（dashboard-r6 安全头、test-redact）在各 app 自测内，未进根 validate 门禁（门禁边界已标注）。
- 终审（R21/R22）连续捕获并修复了 v2 自身引入的 3 个安全绕过（双引号标识符、E-string、UNC 空白），均已回归锁定——体现迭代交叉验证的价值。

## 残余低风险项（有界，非无界）

- 网关单节点 Agents 整组赋值未截断（受 stdin 4MB 限）；chat.js pendings 数组随用户发送缓慢累积（宿主不回显时）。
- token 经 opener argv 的本地多用户嗅探面（需同机多用户 + 时机窗口，fragment 不入 Referer/日志）。