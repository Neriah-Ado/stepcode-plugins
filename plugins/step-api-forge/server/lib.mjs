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
