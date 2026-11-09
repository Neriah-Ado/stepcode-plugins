---
description: "审计提示词前缀稳定性（稳定在前、易变在后），输出证据化缓存指标与稳定化 diff 草稿"
argument-hint: [会话文件或 AGENTS.md 路径]
---

# /cache-stabilize — 前缀稳定化审计

**审计对象**：system 提示、工具 schema、AGENTS.md、历史开头——缓存前缀的四个组成段。只输出诊断与 diff 草稿，不直接改用户配置。

<!-- CACHE-STABILIZE-RULES-START -->
```json
{
  "metrics": "命中率 = Σcache_read / (Σcache_read + Σcache_write)；重发率 = cache_write > 0 的轮次占比；波动按段归因（system / tools / instructions / history）",
  "order_rule": "稳定内容在前、易变内容在后：工具集与会话内不得改动的说明靠前，新增临时信息并入当前消息，不重写已有历史轮次",
  "advice": {
    "工具集漂移": "固定工具清单，条件性工具改为按需加载；新增工具集中到清单尾部",
    "指令漂移": "把临时约定移出 AGENTS.md，改为会话内消息",
    "历史改写": "修正用追加消息，不改写既有轮次",
    "路径漂移": "把 cwd 等易变环境信息移出系统前缀（对齐 dsh-cache-stabilizer 同款手法）"
  },
  "output": "指标表（证据与 /cache-audit 同源）→ 逐段排布诊断 → diff 草稿（逐条标「需确认后人工应用」与预期收益）；指标快照可落盘 docs/cache-lens/metrics-<日期>-<HHmm>.json 供跨轮对比（落盘前确认，G3）；绝不直接写入用户配置（G3）"
}
```
<!-- CACHE-STABILIZE-RULES-END -->

## 流程

1. 复用 /cache-audit 的会话数据计算三项指标；无数据时改做静态审计（读 AGENTS.md 与工具清单）。
2. 按「稳定在前、易变在后」规则逐段诊断排布，归因波动来源。
3. 产出最小 diff 草稿，逐条标注预期收益（估计可省的重复 cache_write）。
4. 输出报告；改动一律待用户确认，插件不落盘改配置。

## 输出格式

指标表 → 逐段诊断 → diff 草稿（标注「需确认」）→ 局限说明。
