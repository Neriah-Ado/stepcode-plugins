/**
 * step-token-meter 统计核心（TM-100-2/3/4 的可脚本化部分）。
 * 语义与 commands/usage.md（AGGREGATE-RULES / PRICE-RULES）及 docs/storage-format.md 一致。
 * 容错红线：单行损坏跳过并计警告，未知字段忽略，缺失字段取默认，绝不抛错。
 */
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
    const r = parseSessionLine(line);
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

export function loadPrices(priceRules, overrides) {
  // overrides: { models: {...}, default: {...} } 覆盖内置；浅合并按模型键
  if (!overrides) return priceRules;
  return {
    default: { ...priceRules.default, ...(overrides.default ?? {}) },
    models: { ...priceRules.models, ...(overrides.models ?? {}) },
    match: priceRules.match,
  };
}

export function costOf(record, prices) {
  const price = Object.entries(prices.models ?? {}).find(([prefix]) => record.model.startsWith(prefix))?.[1] ?? prices.default;
  const per = (tokens, rate) => (tokens / 1_000_000) * rate;
  const cost =
    per(record.input, price.input) + per(record.output, price.output) +
    per(record.cacheRead, price.cache_read ?? 0) + per(record.cacheWrite, price.cache_write ?? 0);
  return { cost, usedDefault: !Object.keys(prices.models ?? {}).some((prefix) => record.model.startsWith(prefix)) };
}

export function toCsv(records, prices) {
  const header = 'day,project,model,input,output,cache_read,cache_write,total,cost';
  const rows = records.map((r) => {
    const { cost } = costOf(r, prices);
    return [dayOf(r.timestamp), r.project, r.model, r.input, r.output, r.cacheRead, r.cacheWrite, r.total, cost.toFixed(4)].join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}
