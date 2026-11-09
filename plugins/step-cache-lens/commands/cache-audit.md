---
description: "定位会话中每轮首个请求的提示词缓存重建（cache miss），输出逐轮判定表与嫌疑前缀变更"
argument-hint: [会话文件或目录] [--last N 轮]
---

# /cache-audit — 缓存重建检测

**判定口径**：本轮首个请求的 cache_write 明显大于上一轮（前缀整体失效），或 cache_read 为 0 且输入 tokens 超阈值，视为一次缓存重建。只读本地记录，零网络。

<!-- CACHE-AUDIT-RULES-START -->
```json
{
  "source": "~/.stepcode/projects 会话记录（*.jsonl，容错解析：损坏行跳过并计数）；字段缺失区分两态：未导出（给采集指引）/已迁移（给新格式迁移提示），声明局限",
  "scope": "默认只扫最近 50 轮（--last 可调）；全量需显式 --all，防无界扫描",
  "detect": {
    "rebuild": "本轮 cache_write > 上一轮 cache_write × 3，或 cache_read == 0 且本轮输入 tokens > 4000",
    "suspect": "重建点前后对比 system/工具 schema/AGENTS.md/历史开头的差异，列出最可疑的前缀变更（新增删改工具、换模型或供应商、改写历史开头）"
  },
  "notice_style": "对齐 dsh-cache-miss 的单行告警语义：每轮一行「轮次 | 状态(hit/rebuild) | cache_read/write | 嫌疑变更」，重建轮标注 !",
  "output": "逐轮单行表 + 重建点摘要 + 嫌疑变更清单；超过 200 轮只输出统计摘要，明细落盘 docs/cache-lens/cache-audit-<日期>-<HHmm>.md 后给路径（文件名带时分，同日重跑不覆盖旧报告；C5）；落盘报告头部附统计摘要（总轮数/命中/重建/嫌疑数）与内容校验和，可独立复核；输出中的本机用户目录路径一律脱敏（如 ~/）",
  "cron": "接入 /cron 无头巡检：退出码 0=正常、1=发现缓存重建、2=依赖缺失；无头模式零写配置"
}
```
<!-- CACHE-AUDIT-RULES-END -->

## 流程

1. 读取会话记录（参数指定文件/目录，缺省取最近会话）；字段缺失时声明降级口径。
2. 逐轮提取 cache_read/cache_write，按 CACHE-AUDIT-RULES 判定 hit/rebuild。
3. 对重建轮做前后前缀对比，产出嫌疑变更清单；对比不出差异就写「未见结构性变更」，不猜。
4. 小会话直接输出表格；大会话明细落盘后给路径。

## 输出格式

逐轮单行表（hit/rebuild）→ 重建点摘要 → 嫌疑前缀变更清单 → 数据口径与降级说明。
