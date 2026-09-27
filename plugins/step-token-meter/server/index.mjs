#!/usr/bin/env node
/**
 * step-token-meter MCP server（stdio JSON-RPC，零依赖；协议与 @modelcontextprotocol/sdk 兼容）。
 * TM-110-1/2：工具 get_usage(range)、get_usage_by_model(range)；单价表热加载。
 * 目录解析：环境变量 STEP_TOKEN_METER_DIR（默认 ~/.stepcode/projects）。
 * 单价覆盖：环境变量 STEP_TOKEN_METER_PRICES 或插件目录 config/prices.json（mtime 热加载）。
 */
import { createInterface } from 'node:readline';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseSessionText, aggregate, loadPrices, loadPriceOverride, DEFAULT_PRICES, costOf, dayOf } from './lib.mjs';

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(PLUGIN_DIR, 'step.plugin.json'), 'utf8')).version;

function sessionDir() {
  return process.env.STEP_TOKEN_METER_DIR || join(homedir(), '.stepcode', 'projects');
}

// 只读遍历 *.jsonl；目录不存在/不可读 → 空结果 + 警告，绝不抛错
function collectRecords() {
  const root = sessionDir();
  const records = [];
  const warnings = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      warnings.push(`unreadable-dir: ${dir}`);
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) {
        try {
          const { records: rs, warnings: ws } = parseSessionText(readFileSync(p, 'utf8'));
          records.push(...rs);
          warnings.push(...ws);
        } catch {
          warnings.push(`unreadable-file: ${p}`);
        }
      }
    }
  };
  if (existsSync(root)) walk(root);
  else warnings.push(`no-session-dir: ${root}`);
  return { records, warnings };
}

function inRange(timestamp, range) {
  if (!range || range === 'all') return true;
  const day = dayOf(timestamp);
  const today = new Date().toISOString().slice(0, 10);
  const m = /^(\d+)d$/.exec(String(range));
  if (m) {
    const days = Number(m[1]);
    const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    return day !== 'unknown' && day >= from && day <= today;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(range))) return day === range;
  return true;
}

function currentPrices() {
  const overridePath = process.env.STEP_TOKEN_METER_PRICES || join(PLUGIN_DIR, 'config', 'prices.json');
  return loadPrices(DEFAULT_PRICES, loadPriceOverride(overridePath));
}

function sumRecords(records, keyFn) {
  const buckets = {};
  for (const r of records) {
    const k = keyFn(r);
    const b = (buckets[k] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0, count: 0, records: [] });
    for (const m of ['input', 'output', 'cacheRead', 'cacheWrite', 'total']) b[m] += r[m];
    b.records.push(r);
    b.count += 1;
  }
  return buckets;
}

function toolGetUsage(range) {
  const { records, warnings } = collectRecords();
  const scoped = records.filter((r) => inRange(r.timestamp, range));
  const buckets = sumRecords(scoped, (r) => dayOf(r.timestamp));
  const entries = Object.entries(buckets)
    .sort(([a], [b]) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : a < b ? -1 : 1))
    .map(([day, b]) => ({ day, input: b.input, output: b.output, cacheRead: b.cacheRead, cacheWrite: b.cacheWrite, total: b.total, cost: Math.round(sumCost(b.records) * 1e4) / 1e4 }));
  return { range: range ?? 'all', days: entries, grandTotal: scoped.reduce((s, r) => s + r.total, 0), warnings: warnings.slice(0, 20), note: '成本为按公开单价的粗估，未含套餐折扣' };
}

function toolGetUsageByModel(range) {
  const { records, warnings } = collectRecords();
  const scoped = records.filter((r) => inRange(r.timestamp, range));
  const buckets = sumRecords(scoped, (r) => r.model);
  const entries = Object.entries(buckets)
    .sort(([, x], [, y]) => y.total - x.total)
    .map(([model, b]) => ({ model, input: b.input, output: b.output, cacheRead: b.cacheRead, cacheWrite: b.cacheWrite, total: b.total, cost: Math.round(sumCost(b.records) * 1e4) / 1e4 }));
  return { range: range ?? 'all', models: entries, warnings: warnings.slice(0, 20) };
}

function sumCost(records) {
  const prices = currentPrices();
  return records.reduce((s, r) => s + costOf(r, prices).cost, 0);
}

const TOOLS = [
  {
    name: 'get_usage',
    description: '按日聚合本地 Step Code 会话 token 消耗与成本粗估。参数 range："all"、天数（如 "7d"）或 YYYY-MM-DD。',
    inputSchema: { type: 'object', properties: { range: { type: 'string', description: 'all / Nd / YYYY-MM-DD' } } },
  },
  {
    name: 'get_usage_by_model',
    description: '按模型聚合本地会话 token 消耗与成本粗估。参数同 get_usage。',
    inputSchema: { type: 'object', properties: { range: { type: 'string' } } },
  },
];

function handleCall(name, args) {
  switch (name) {
    case 'get_usage':
      return toolGetUsage(args?.range);
    case 'get_usage_by_model':
      return toolGetUsageByModel(args?.range);
    default:
      return null;
  }
}

const server = {
  protocolVersion: '2024-11-05',
  capabilities: { tools: {} },
  serverInfo: { name: 'step-token-meter', version: VERSION },
};

const rl = createInterface({ input: process.stdin });
const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);

rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  const { id, method, params } = req;
  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: server });
    return;
  }
  if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return;
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }
  if (method === 'tools/call') {
    const result = handleCall(params?.name, params?.arguments);
    if (result === null) {
      send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
      return;
    }
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result } });
    return;
  }
  send({ jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Method not found: ${method}` } });
});
