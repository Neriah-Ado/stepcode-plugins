/**
 * step-api-forge MCP server 核心逻辑。
 * v1.0.0：OpenAPI 3.0/3.1 结构校验（零依赖实现；@readme/openapi-parser 为可选增强，网络可用时切换）+ TypeScript fetch 客户端生成。
 * v1.1.0+：mock server / 文档页 / diff / Python SDK（见后续版本段）。
 */
export function validateOpenApi(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return { valid: false, errors: ['spec 必须是 JSON 对象'] };
  const version = String(spec.openapi ?? '');
  if (!/^3\.\d+\.\d+$/.test(version)) errors.push(`openapi 字段缺失或非 3.x：${version || '(空)'}`);
  if (!spec.info?.title) errors.push('info.title 缺失');
  if (!spec.info?.version) errors.push('info.version 缺失');
  const paths = spec.paths ?? {};
  if (Object.keys(paths).length === 0) errors.push('paths 为空');
  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
  const operations = [];
  for (const [path, item] of Object.entries(paths)) {
    if (!path.startsWith('/')) errors.push(`path 未以 / 开头：${path}`);
    for (const method of HTTP_METHODS) {
      const op = item?.[method];
      if (!op) continue;
      operations.push({ path, method, op });
      if (!op.responses || Object.keys(op.responses).length === 0) errors.push(`${method.toUpperCase()} ${path} 缺少 responses`);
    }
  }
  return { valid: errors.length === 0, errors, openapiVersion: version || null, operationCount: operations.length, operations };
}

const pascal = (s) => s.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (m) => m.toUpperCase());
const methodName = (path, method) => {
  const segs = path.replace(/[{}]/g, '').split('/').filter(Boolean);
  return method + segs.map((s) => pascal(s)).join('');
};

// 生成 TypeScript fetch 客户端（基础实现：每操作一个方法）
export function generateTsClient(spec, { baseUrl = '' } = {}) {
  const check = validateOpenApi(spec);
  if (!check.valid) return { error: 'spec-invalid', errors: check.errors };
  const lines = [
    `// 由 step-api-forge 生成（OpenAPI ${check.openapiVersion}）：${spec.info.title} ${spec.info.version}`,
    `const BASE_URL = ${JSON.stringify(baseUrl || '{{BASE_URL}}')};`,
    '',
    'export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {',
    '  return fetch(`${BASE_URL}${path}`, init);',
    '}',
    '',
    'export const client = {',
  ];
  for (const { path, method, op } of check.operations) {
    const params = (op.parameters ?? []).filter((p) => p.in === 'path').map((p) => `${p.name.replace(/-/g, '_')}: string | number`);
    const hasBody = Boolean(op.requestBody);
    const args = [...params.map((p) => `${p}: string`), ...(hasBody ? ['body: unknown'] : [])];
    const realPath = params.length ? path.replace(/\{(\w+)\}/g, (_, n) => `$\{${n.replace(/-/g, '_')}}`) : `'${path}'`;
    lines.push(`  /** ${op.summary ?? `${method.toUpperCase()} ${path}`} */`);
    lines.push(`  ${methodName(path, method)}(${args.join(', ')}): Promise<Response> {`);
    lines.push(`    return apiFetch(\`${realPath}\`, { method: '${method.toUpperCase()}',${hasBody ? " body: JSON.stringify(body as any)," : ''} headers: { 'Content-Type': 'application/json' } });`);
    lines.push('  },');
  }
  lines.push('};', '');
  return { code: lines.join('\n'), operationCount: check.operations.length };
}

// ---------- v1.1.0 mock server 与文档页 ----------
export function generateMockServer(spec, { style = 'express' } = {}) {
  const check = validateOpenApi(spec);
  if (!check.valid) return { error: 'spec-invalid', errors: check.errors };
  const routes = check.operations.map(({ path, method, op }) => {
    const real = path.replace(/\{(\w+)\}/g, ':$1');
    const code = Object.keys(op.responses ?? {})[0] ?? '200';
    if (style === 'msw') {
      return `http.${method}('${real}', async () => {\n  return HttpResponse.json({ mock: true }, { status: ${code} });\n}),`;
    }
    return `app.${method}('${real}', (_req, res) => res.status(${code}).json({ mock: true }));`;
  });
  if (style === 'msw') {
    return { style, code: `// 由 step-api-forge 生成（MSW handlers，供 playwright E2E）\nimport { http, HttpResponse } from 'msw';\n\nexport const handlers = [\n${routes.join('\n')}\n];\n` };
  }
  return { style, code: `// 由 step-api-forge 生成（express mock server）\nimport express from 'express';\nconst app = express();\napp.use(express.json());\n\n${routes.join('\n')}\n\napp.listen(process.env.MOCK_PORT ?? 4010, () => console.log('mock server ready'));\n` };
}

export function generateDocsPage(spec) {
  const check = validateOpenApi(spec);
  if (!check.valid) return { error: 'spec-invalid', errors: check.errors };
  const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const rows = check.operations
    .map(({ path, method, op }) => `<tr><td><code>${esc(method.toUpperCase())}</code></td><td>${esc(path)}</td><td>${esc(op.summary ?? '')}</td></tr>`)
    .join('\n');
  return { html: ['<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>body{font-family:system-ui;background:#0d1117;color:#c9d1d9}table{border-collapse:collapse}td,th{border:1px solid #30363d;padding:6px 12px}</style></head><body>', `<h1>${esc(spec.info.title)} <small>${esc(spec.info.version)}</small></h1>`, '<table><tr><th>Method</th><th>Path</th><th>Summary</th></tr>', rows, '</table></body></html>'].join('\n') };
}

// ---------- v1.2.0 API diff 与兼容性 ----------
export function diffOpenApi(oldSpec, newSpec) {
  const oldPaths = oldSpec?.paths ?? {};
  const newPaths = newSpec?.paths ?? {};
  const breaking = [];
  const compatible = [];
  const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
  for (const path of Object.keys(oldPaths)) {
    if (!newPaths[path]) {
      breaking.push(`路径被删除：${path}`);
      continue;
    }
    for (const m of METHODS) {
      if (oldPaths[path]?.[m] && !newPaths[path]?.[m]) breaking.push(`方法被删除：${m.toUpperCase()} ${path}`);
    }
    for (const m of METHODS) {
      const oldOp = oldPaths[path]?.[m];
      const newOp = newPaths[path]?.[m];
      if (!oldOp || !newOp) continue;
      for (const p of oldOp.parameters ?? []) {
        if (p.required && !(newOp.parameters ?? []).some((np) => np.name === p.name && np.in === p.in)) {
          breaking.push(`必填参数被删除：${m.toUpperCase()} ${path}（${p.name}）`);
        }
      }
      for (const p of newOp.parameters ?? []) {
        const oldP = (oldOp.parameters ?? []).find((np) => np.name === p.name && np.in === p.in);
        if (p.required && !oldP?.required) breaking.push(`新增必填参数：${m.toUpperCase()} ${path}（${p.name}）`);
      }
      const newCodes = new Set(Object.keys(newOp.responses ?? {}));
      for (const code of Object.keys(oldOp.responses ?? {})) {
        if (code !== 'default' && !newCodes.has(code)) breaking.push(`响应码被移除：${m.toUpperCase()} ${path}（${code}）`);
      }
    }
  }
  for (const path of Object.keys(newPaths)) {
    if (!oldPaths[path]) compatible.push(`新增路径：${path}`);
    else {
      for (const m of METHODS) {
        if (newPaths[path]?.[m] && !oldPaths[path]?.[m]) compatible.push(`新增方法：${m.toUpperCase()} ${path}`);
      }
    }
  }
  return { breaking, compatible, hasBreaking: breaking.length > 0 };
}

// ---------- v1.3.0 Python SDK ----------
export function generatePythonSdk(spec) {
  const check = validateOpenApi(spec);
  if (!check.valid) return { error: 'spec-invalid', errors: check.errors };
  const pyName = (p) => p.replace(/[{}]/g, '').split('/').filter(Boolean).map((s) => s.replace(/-/g, '_')).join('_');
  const seen = new Set();
  const lines = [
    '"""由 step-api-forge 生成（requests SDK）"""',
    'import requests',
    '',
    `BASE_URL = "${spec.servers?.[0]?.url ?? 'http://localhost'}"`,
    '',
    'class ApiClient:',
    '    def __init__(self, base_url: str = BASE_URL, token: str | None = None):',
    '        self.base = base_url.rstrip("/")',
    '        self.headers = {"Authorization": f"Bearer {token}"} if token else {}',
    '',
  ];
  for (const { path, method, op } of check.operations) {
    const name = pyName(path) + '_' + method;
    if (seen.has(name)) continue;
    seen.add(name);
    const hasBody = Boolean(op.requestBody);
    lines.push(`    def ${name}(self${hasBody ? ', body: dict' : ''}):`);
    lines.push(`        return requests.${method}(f"{self.base}{'${path}'}", json=${hasBody ? 'body' : 'None'}, headers=self.headers)`);
    lines.push('');
  }
  return { code: lines.join('\n') };
}
