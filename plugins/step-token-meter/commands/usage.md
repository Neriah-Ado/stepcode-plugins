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

## 预算阈值告警（v1.3.0）

<!-- BUDGET-RULES-START -->
```json
{
  "config": "config/budget.json 或环境变量 STEP_TOKEN_METER_BUDGET：{ \"monthly_cost\": 100, \"warn_at\": 0.8 }",
  "rule": "本月成本 ≥ monthly_cost → exceed；≥ warn_at 比例 → warn；未配置 → 静默跳过",
  "action": "会话内显著提示（无头模式写入报告摘要）；只提示，不阻断工作"
}
```
<!-- BUDGET-RULES-END -->

聚合完成后按本月（当月 1 日起）成本检查预算并在汇报头部给出状态行（ok / warn / exceed + 比例）。

## 多机数据合并（v1.3.0）

<!-- MERGE-RULES-START -->
```json
{
  "standard": "v1.0.0 的 CSV 格式（day,project,model,input,output,cache_read,cache_write,total,cost）",
  "flow": "每台机器各自 /usage --csv 导出 → 收集到同一目录 → --merge <目录> 聚合；不做网络同步",
  "rule": "按 day,project,model 求和 token 列；成本以本机单价表重算（口径一致性优先于各机导出值）",
  "output": "合并后的 CSV 给绝对路径（C5），损坏行跳过并计警告"
}
```
<!-- MERGE-RULES-END -->

## 存储格式版本适配（v1.3.0）

解析层按 `schemaVersion`（或 `v`）字段分发到对应解析器（映射表见 tests/lib/usage.mjs 与 server/lib.mjs 的 SCHEMA_PARSERS）：缺失视为 1；未知版本回退当前解析器并警告 `unknown-schema:N`。Step Code 升级导致格式变动时，**只需新增解析器映射，不改命令与统计逻辑**。

## 输出格式

先表格后警告：三个维度的表格（日 / 项目 / 模型，含成本列）→ 解析警告统计 → 成本口径说明 → 导出路径（如有）。范围参数（如 `7d`）在解析后按时间过滤。
