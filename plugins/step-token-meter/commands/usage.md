---
description: 解析本地会话记录，按日/项目/模型聚合 token 消耗与成本估算，支持 CSV 导出（纯本地零网络）
argument-hint: [范围或导出路径，可选；如 "7d" 或 "--csv usage.csv"]
---

# /usage — 本地 Token 用量统计

读取 `~/.stepcode/` 本地会话记录，聚合展示。**全程零网络请求**（隐私红线），只读不写存储目录。

## 流程

1. **定位存储**：`~/.stepcode/projects/**/*.jsonl`（格式见插件 docs/storage-format.md）；目录不存在时提示「未找到 Step Code 会话数据」并停止，不猜测其他路径。
2. **容错解析**：逐行解析，规则与 tests/lib/usage-parse.mjs 一致——未知字段忽略、缺失字段取默认、损坏行跳过并计数；汇报中列出「解析警告 N 条」。
3. **聚合输出**（终端表格，三个维度）：

<!-- AGGREGATE-RULES-START -->
```json
{
  "dimensions": ["byDay", "byProject", "byModel"],
  "metrics": ["input", "output", "cache_read", "cache_write", "total", "cost"],
  "cost": "total_cost = Σ (tokens / 1_000_000 × 单价)；单价来自 PRICE-RULES，未知模型成本计 0 并在警告中列出",
  "sort": "byDay 按日期升序；byProject/byModel 按总消耗降序，只取前 20 条"
}
```
<!-- AGGREGATE-RULES-END -->

4. **成本估算**（内置默认单价表，单位：元/百万 tokens）：

<!-- PRICE-RULES-START -->
```json
{
  "default": { "input": 15, "output": 75, "cache_read": 1.5, "cache_write": 15 },
  "models": {
    "glm-4.7": { "input": 2, "output": 8, "cache_read": 0.2, "cache_write": 2 },
    "glm-4.6": { "input": 2, "output": 8, "cache_read": 0.2, "cache_write": 2 },
    "claude-sonnet": { "input": 21, "output": 105, "cache_read": 2.1, "cache_write": 26.25 }
  },
  "match": "按模型名前缀匹配 models 表；未命中用 default 并警告"
}
```
<!-- PRICE-RULES-END -->

   汇报中**必须**注明：成本为按公开单价的粗估，与实际账单可能有偏差（口径：tokens 数 × 单价，未含套餐折扣）。

5. **CSV 导出**（参数含 `--csv <路径>` 或用户要求导出时）：列 = `day,project,model,input,output,cache_read,cache_write,total,cost`；默认路径 `.stepcode/usage-export.csv`（项目内，不入库时建议 gitignore）；导出后给绝对路径，不内联全文（C5）。

6. **HTML 报告**（参数含 `--html <路径>` 时）：生成**本地** HTML 报告到 `docs/usage-report/usage.html`（或指定路径），规则与 tests/lib/report-html.mjs 一致：

<!-- HTML-RULES-START -->
```json
{
  "theme": "暗色（背景 #0d1117），4K/投影环境可读",
  "charts": "按日/按项目/按模型三组内联 SVG 条形图，宽度按 total 占比",
  "no_external": "零外部资源：无 CDN/字体/图片链接，样式与图表全部内联",
  "c5": "生成后只给文件绝对路径与一句话摘要，不内联 HTML"
}
```
<!-- HTML-RULES-END -->

## 周报（/cron 接入，v1.2.0）

<!-- WEEKLY-RULES-START -->
```json
{
  "headless": "step -p \"按 plugins/step-token-meter/commands/usage.md 执行周报\"",
  "cadence": "建议 /cron 每周一 08:00，创建前向用户确认",
  "range": "近 7 天（7d）",
  "outputs": {
    "html": "docs/usage-report/usage-weekly.html",
    "csv": "docs/usage-report/usage-weekly.csv"
  },
  "rules": "无头模式零网络、只读存储目录；生成后只落盘，不外发；报告含生成时间与口径说明"
}
```
<!-- WEEKLY-RULES-END -->

## 输出格式

先表格后警告：三个维度的表格（日 / 项目 / 模型，含成本列）→ 解析警告统计 → 成本口径说明 → 导出路径（如有）。范围参数（如 `7d`）在解析后按时间过滤。
