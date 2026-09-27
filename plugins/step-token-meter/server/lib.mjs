/**
 * step-token-meter MCP server 核心逻辑（运行时唯一事实源；tests/lib/usage.mjs 转发导出本文件）。
 * 与 commands/usage.md（AGGREGATE/PRICE-RULES）及 docs/storage-format.md 语义一致。
 */
import { readFileSync, existsSync, statSync } from 'node:fs';

export function parseSessionLine(line) {
  if (!line || !line.trim()) return { ok: false, warning: 'empty' };
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return { ok: false, warning: 'bad-json' };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, warning: 'not-object' };
  const num = (...paths) => {
    for (const p of paths) {
      let v = obj;
      for (const k of p.split('.')) {
        v = v?.[k];
        if (v === undefined) break;
      }
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    }
    return 0;
  };
  const str = (...paths) => {
    for (const p of paths) {
      let v = obj;
      for (const k of p.split('.')) {
        v = v?.[k];
        if (v === undefined) break;
      }
      if (typeof v === 'string' && v) return v;
    }
    return null;
  };
  const input = num('message.usage.input_tokens', 'message.usage.inputTokens', 'message.usage.prompt_tokens', 'usage.input_tokens', 'usage.input');
  const output = num('message.usage.output_tokens', 'message.usage.outputTokens', 'message.usage.completion_tokens', 'usage.output_tokens', 'usage.output');
  const cacheRead = num('message.usage.cache_read_input_tokens', 'message.usage.cacheReadInputTokens');
  const cacheWrite = num('message.usage.cache_creation_input_tokens', 'message.usage.cacheCreationInputTokens');
  const model = str('message.model', 'model') ?? 'unknown';
  const timestamp = str('timestamp', 'ts', 'createdAt');
  const project = str('cwd', 'project', 'workspace') ?? 'unknown';
  const warnings = [];
  if (!obj.message?.usage && !obj.usage) warnings.push('missing-usage');
  const u = obj.message?.usage ?? obj.usage;
  if (u && typeof u === 'object') {
    for (const k of ['input_tokens', 'inputTokens', 'input', 'output_tokens', 'outputTokens', 'output']) {
      if (u[k] !== undefined && (typeof u[k] !== 'number' || !Number.isFinite(u[k]) || u[k] < 0)) warnings.push(`non-numeric-${k}`);
    }
  }
  return { ok: true, record: { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite, model, timestamp, project }, warnings };
}

export function parseSessionText(text) {
  const records = [];
  const warnings = [];
  for (const line of text.split(/\r?\n/)) {
    const r = parseSessionVersioned(line);
    if (r.ok) {
      records.push(r.record);
      warnings.push(...(r.warnings ?? []));
    } else if (r.warning !== 'empty') {
      warnings.push(r.warning);
    }
  }
  return { records, warnings };
}

export function dayOf(timestamp) {
  if (!timestamp) return 'unknown';
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10);
}

export function aggregate(records) {
  const byDay = {};
  const byProject = {};
  const byModel = {};
  const blank = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 });
  for (const r of records) {
    for (const [bucket, key] of [[byDay, dayOf(r.timestamp)], [byProject, r.project], [byModel, r.model]]) {
      const b = (bucket[key] ??= blank());
      for (const m of ['input', 'output', 'cacheRead', 'cacheWrite', 'total']) b[m] += r[m];
    }
  }
  const byDaySorted = Object.fromEntries(Object.entries(byDay).sort(([a], [b]) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : a < b ? -1 : 1)));
  const byProjectSorted = Object.fromEntries(Object.entries(byProject).sort(([, x], [, y]) => y.total - x.total));
  const byModelSorted = Object.fromEntries(Object.entries(byModel).sort(([, x], [, y]) => y.total - x.total));
  for (const [k, v] of Object.entries(byDaySorted)) v.day = k;
  for (const [k, v] of Object.entries(byProjectSorted)) v.project = k;
  for (const [k, v] of Object.entries(byModelSorted)) v.model = k;
  return { byDay: byDaySorted, byProject: byProjectSorted, byModel: byModelSorted };
}

export const DEFAULT_PRICES = {
  default: { input: 15, output: 75, cache_read: 1.5, cache_write: 15 },
  models: {
    'glm-4.7': { input: 2, output: 8, cache_read: 0.2, cache_write: 2 },
    'glm-4.6': { input: 2, output: 8, cache_read: 0.2, cache_write: 2 },
    'claude-sonnet': { input: 21, output: 105, cache_read: 2.1, cache_write: 26.25 },
  },
};

export function loadPrices(priceRules, overrides) {
  if (!overrides) return priceRules;
  return {
    default: { ...priceRules.default, ...(overrides.default ?? {}) },
    models: { ...priceRules.models, ...(overrides.models ?? {}) },
    match: priceRules.match,
  };
}

// 热加载：按 mtime 缓存，文件变动即重读
const priceCache = new Map();
export function loadPriceOverride(path) {
  if (!path || !existsSync(path)) return null;
  const mtime = statSync(path).mtimeMs;
  const hit = priceCache.get(path);
  if (hit && hit.mtime === mtime) return hit.data;
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    priceCache.set(path, { mtime, data });
    return data;
  } catch {
    return hit?.data ?? null;
  }
}

export function costOf(record, prices) {
  const price = Object.entries(prices.models ?? {}).find(([prefix]) => record.model.startsWith(prefix))?.[1] ?? prices.default;
  const per = (tokens, rate) => (tokens / 1_000_000) * rate;
  const cost =
    per(record.input, price.input) + per(record.output, price.output) +
    per(record.cacheRead, price.cache_read ?? 0) + per(record.cacheWrite, price.cache_write ?? 0);
  return { cost, usedDefault: !Object.keys(prices.models ?? {}).some((prefix) => record.model.startsWith(prefix)) };
}

// ---------- schema migration（TM-130-3）：版本号 → 解析器映射，新格式只需加映射 ----------
export const SCHEMA_VERSION = 1;

export function parseV2SessionLine(line) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return { ok: false, warning: 'bad-json' };
  }
  const t = obj?.tokens ?? {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    ok: true,
    warnings: [],
    record: {
      input: num(t.in),
      output: num(t.out),
      cacheRead: num(t.cacheR),
      cacheWrite: num(t.cacheW),
      total: num(t.in) + num(t.out) + num(t.cacheR) + num(t.cacheW),
      model: typeof obj.model === 'string' && obj.model ? obj.model : 'unknown',
      timestamp: typeof obj.ts === 'string' ? obj.ts : null,
      project: typeof obj.proj === 'string' && obj.proj ? obj.proj : 'unknown',
    },
  };
}

const SCHEMA_PARSERS = {
  1: (line) => parseSessionLine(line),
  2: (line) => parseV2SessionLine(line),
};

export function parseSessionVersioned(line) {
  if (!line || !line.trim()) return { ok: false, warning: 'empty' };
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return { ok: false, warning: 'bad-json' };
  }
  const version = obj?.schemaVersion ?? obj?.v ?? 1;
  const parser = SCHEMA_PARSERS[version];
  if (!parser) {
    const r = SCHEMA_PARSERS[SCHEMA_VERSION](line);
    return { ...r, warnings: [...(r.warnings ?? []), `unknown-schema:${version}`] };
  }
  return parser(line);
}

// ---------- 预算阈值（TM-130-1） ----------
export function checkBudget(monthCost, budget) {
  if (!budget || typeof budget.monthly_cost !== 'number' || budget.monthly_cost <= 0) {
    return { status: 'unset', ratio: null, note: '未配置预算（config/budget.json 或 STEP_TOKEN_METER_BUDGET）' };
  }
  const warnAt = typeof budget.warn_at === 'number' ? budget.warn_at : 0.8;
  const ratio = Math.round((monthCost / budget.monthly_cost) * 1000) / 1000;
  const status = monthCost >= budget.monthly_cost ? 'exceed' : monthCost >= budget.monthly_cost * warnAt ? 'warn' : 'ok';
  return { status, ratio, monthly_cost: budget.monthly_cost, monthCost: Math.round(monthCost * 1e4) / 1e4 };
}

// ---------- 多机数据合并（TM-130-2）：标准格式为 v1.0.0 CSV，按 day,project,model 求和，成本按本机单价重算 ----------
export function mergeCsvs(texts, prices) {
  const buckets = new Map();
  for (const text of texts ?? []) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      if (cols.length !== 9) continue;
      const [day, project, model, input, output, cacheRead, cacheWrite] = cols;
      const key = `${day}\u0000${project}\u0000${model}`;
      const b = buckets.get(key) ?? { day, project, model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0 };
      for (const [k, v] of [['input', input], ['output', output], ['cacheRead', cacheRead], ['cacheWrite', cacheWrite]]) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) b[k] += n;
      }
      b.total = b.input + b.output + b.cacheRead + b.cacheWrite;
      b.cost = costOf({ model, input: b.input, output: b.output, cacheRead: b.cacheRead, cacheWrite: b.cacheWrite }, prices).cost;
      buckets.set(key, b);
    }
  }
  const rows = [...buckets.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const header = 'day,project,model,input,output,cache_read,cache_write,total,cost';
  const body = rows.map((r) => [r.day, r.project, r.model, r.input, r.output, r.cacheRead, r.cacheWrite, r.total, r.cost.toFixed(4)].join(','));
  return `${[header, ...body].join('\n')}\n`;
}

export function toCsv(records, prices) {
  const header = 'day,project,model,input,output,cache_read,cache_write,total,cost';
  const rows = records.map((r) => {
    const { cost } = costOf(r, prices);
    return [dayOf(r.timestamp), r.project, r.model, r.input, r.output, r.cacheRead, r.cacheWrite, r.total, cost.toFixed(4)].join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}
