# 性能与安全优化 v1+v2 — 深度加固 / Performance & Security Hardening

> 发布日期 / Date: 2026-11-12
> 范围 / Scope: 全仓 22 轮深度优化（v1 R1–R11 + v2 R12–R22），每轮 5 个子代理交叉验证（共 110 次），覆盖内存 / CPU 调度 / 安全三维度
> 门禁 / Gate: ALL PASS（validate.mjs 含新接入回归 + GUI run-all 3 轮 soak + go test count=5 + usage-monitor 108/108 + theme test-host）
> 标签 / Tags: `optimize-v1`、`optimize-v2`

---

## 中文

对 `stepfun-code-plugins` 全仓（Go 网关、Electron 监视器、tps-monitor 大屏、TS 扩展、6 个 MCP 插件、主题、Web 前端）执行两轮迭代深度优化。方法：每轮由内存/CPU/安全审计员 + 2 名对抗性评审员交叉验证，**驳回凑数优化、只落地经测试验证的真实修复**。55 文件改动，+2226 / −199 行，24 提交。

### 内存性能 / Memory

| 区域 | 修复 |
| --- | --- |
| Go 网关 | 入站 Text/Args/Summary 截断；节点驱逐硬上限（maxNodes=1000 / hardCap=4000）；`node_evicted` 帧修复客户端长会话节点泄漏；会话 400 条 + 32KB 上限 |
| Electron | overlay 外部关闭拦截为隐藏防 collector 泄漏；before-quit 落盘窗口边界；state 全键夹紧；采集 payload 有界（spark≤12） |
| tps-monitor | SSE 背压 writableLength>1MB 断连；连接上限 32；sysCache single-flight；agentStatus 2s 缓存 |
| Web 前端 | chat 400 气泡修剪（含 pending/error）；tree 缓存剪枝；handleEvicted 同步 nodeIndex/nodePositions |

### CPU 调度性能 / CPU & Scheduling

| 区域 | 修复 |
| --- | --- |
| Go 网关 | `emitMu` 解耦 stdin 折叠与快照 marshal（保 seq 顺序）；零拷贝 stdin 解码；publishNode 值拷贝移入锁内固化单写者不变量 |
| Web 前端 | rAF 单队列合并；textContent 写前比较；updateRoot 签名门控；countVisible 每帧预算一次 O(K·N)→O(N) |
| tps-monitor | collectTick 配置每 tick 读一次；CPU 采样 single-flight 去重；snapshot 注入缓存免 REST 双采样 |
| TS 扩展 | 进度防抖加最大等待（防匀速流卡死）；历史预算改 UTF-8 字节（防中文超 4MiB 被丢） |
| 基准 | Go bench harness（Apply/驱逐/扇出/Snapshot/并发）+ 3 轮基线：驱逐稳态仅 +217ns（确证 O(1)）、扇出零分配 |

### 安全性能 / Security

| 区域 | 修复 |
| --- | --- |
| step-db-insight | 受控写入拒绝多语句/危险关键字；**修复双引号标识符内单引号、E-string 反斜杠转义两个 RCE 绕过**（解析器追踪引号/反斜杠 + 拒绝 E 前缀 fail-closed） |
| step-docker-mate | compose 文件参数注入/UNC（`\\` 与 `//`）/首尾空白防护；compose_up 加 confirm dry-run（G3） |
| step-ci-fixer | rerun_workflow 加 confirm dry-run（可能触发部署，G3） |
| step-sec-scan | 文件读取/解析 try-catch + handleCall 兜底防 stdio 崩溃 DoS |
| TS 扩展 | redact 值模式秘密脱敏 + label/summary 绕过修复 + 遥测 allowlist 防误杀 token 计数 |
| Go 网关 | token fail-closed；常量时间比较；renderIndex XSS 转义；目录列表禁用 + 路径包含校验；安全头套件 + 严格 CSP |
| Electron | sandbox 加固；权限请求全拒；导航同源守卫；外链 http(s) 白名单；错误页转义 |
| tps-monitor | renderIndex `</script>`/`$` 模式转义；安全头套件（nosniff/no-referrer/DENY） |

### 交叉验证驳回项（诚实记录，未落地）

- N+1 聚合重构：zcode 会话累计独立 SUM 口径漂移 + followed 会话作用域不匹配，边际收益 → 驳回。
- 心跳 seq 协议改造：ticker/channel select 竞态反造丢帧 + 触发窗口极窄 → 驳回（改用纯前端 visibilitychange resync）。
- 整卡签名门控：漏更新风险现有测试不可见 → 暂缓（需真机 profiling）。
- 会话正文脱敏：面板是宿主终端镜像，无新增暴露面 + 可用性代价 → 暂缓。
- tps nonce-CSP / token-argv 缓解：成本收益失衡 → 暂缓（记录残余风险）。

### 工程项与验证边界

- 终审（R21/R22）连续捕获并修复 v2 自身引入的 3 个安全绕过，均回归锁定并接入 validate 门禁（CI 同入口覆盖）。
- **本机无 C 编译器，Go `-race` 不可用**：并发正确性以 vet + 多轮 soak + seq/驱逐一致性回归 + 锁序分析覆盖。
- **Electron 接线与 Web 前端 DOM 无 node 运行时单测**：经语法检查 + 子代理评审 + e2e（mock-feed）验证；sandbox/权限/导航守卫/tree 签名门控**待真机冒烟**——不虚构结论。
- 残余低风险有界项：单节点 Agents 未截断（受 stdin 4MB 限）、chat pendings 缓慢累积、token 经 opener argv 的本地多用户嗅探面（fragment 不入 Referer/日志）。

## English

Two iterative deep-optimization passes over the whole `stepfun-code-plugins` repo (Go gateway, Electron monitor, tps-monitor dashboard, TS extensions, 6 MCP plugins, theme, web frontend). Method: each round cross-validated by memory/CPU/security auditors plus 2 adversarial reviewers — **quota-filling optimizations rejected; only test-verified real fixes landed**. 55 files changed, +2226 / −199 lines, 24 commits.

Memory: inbound payload caps + node-eviction hard ceiling + `node_evicted` client leak fix; Electron collector-leak fix; SSE backpressure disconnect + connection cap; frontend chat/tree bounded caches.

CPU & scheduling: gateway `emitMu` decouples stdin from snapshot marshal (seq-order preserved) + zero-copy decode; frontend rAF coalescing + write-before-compare + root signature gate + O(K·N)→O(N) count; dashboard single-flight CPU sampling; extension debounce max-wait + UTF-8 byte budget. Go benchmark harness with 3-round baseline (eviction +217ns steady-state confirms O(1); fan-out zero-alloc).

Security: db-insight multi-statement/keyword rejection plus **two RCE-bypass fixes (double-quoted identifier, E-string backslash desync)**; docker compose argument-injection/UNC/whitespace guards + compose_up confirm; ci-fixer rerun confirm; sec-scan stdio crash DoS guard; redaction value-pattern + bypass fix; gateway token fail-closed + XSS escaping + CSP + security headers; Electron sandbox/permission/navigation hardening.

Rejected by cross-validation (honestly recorded, not landed): N+1 aggregation refactor (caliber drift), heartbeat-seq protocol (race creates new drops), whole-card signature gate (untestable stale-update risk), conversation-body redaction (terminal mirror, no new exposure), tps nonce-CSP / token-argv (cost/benefit).

Verification boundaries (no fabricated conclusions): no C compiler so Go `-race` unavailable (covered by vet + soak + consistency regressions + lock-order analysis); Electron wiring and web DOM lack node runtime tests (syntax + review + e2e verified; sandbox/permission/navigation/tree-gate **pending real-machine smoke**). Residual low-risk bounded items recorded in the version notes.

---

*标签 / Tags: `optimize-v1`（R1–R11）、`optimize-v2`（R12–R22）*
*定版记录 / Version notes: `docs/releases/optimization-v1.md`、`docs/releases/optimization-v2.md`*