---
name: sec-audit
description: 安全审计方法论：secret 模式识别、误报降噪、依赖漏洞处置、基线与 SBOM、pre-commit 集成。安全审查相关任务使用。
---

# sec-audit — 安全审计方法论

## 误报降噪规则（SS-100-3）

<!-- SEC-NOISE-START -->
```json
{
  "noise_paths": ["tests/", "test/", "__tests__/", "spec/", "examples/", "fixtures/", "docs/", "mocks/"],
  "noise_values": ["xxx*", "your-*", "changeme", "${...} 模板", "{{...}} 模板", "<占位>", "example*"],
  "rule": "命中以上路径或占位值的 secret 样式串降级为忽略；其余全部保留",
  "dev_deps": "devDependencies 中的 low 级漏洞默认降噪，high 及以上保留"
}
```
<!-- SEC-NOISE-END -->

## pre-commit hook 集成模式（SS-110-2）

```sh
# .git/hooks/pre-commit（或 lint-staged 配置）
step -p "调用 step-sec-scan 的 scan_secrets 工具扫描当前 staged diff；发现 critical/high 时以退出码 1 阻止提交并输出建议"
```

约定：hook 模式**只扫 staged 增量**，超时 30s，失败不阻塞提交除非用户开启 fail_on 配置。

## 处置优先级

1. 已泄漏的 secret：轮换凭据 > 清理历史 > 报告；
2. 依赖漏洞：critical/high 先修（可自动修复的优先），medium 评估影响面，low 记录基线；
3. 基线模式用于「先冻结存量、只拦新增」的渐进治理。
