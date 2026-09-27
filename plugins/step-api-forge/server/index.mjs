#!/usr/bin/env node
/**
 * step-api-forge MCP server（stdio JSON-RPC，零依赖；协议与 @modelcontextprotocol/sdk 兼容）。
 * 工具：validate_spec / generate_ts_client / generate_mock / generate_docs / diff_spec / generate_python_sdk。
 */
import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOpenApi, generateTsClient } from './lib.mjs';

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(PLUGIN_DIR, 'step.plugin.json'), 'utf8')).version;

const TOOLS = [
  { name: 'validate_spec', description: 'OpenAPI 3.0/3.1 结构校验', inputSchema: { type: 'object', properties: { specPath: { type: 'string' } }, required: ['specPath'] } },
  { name: 'generate_ts_client', description: '生成 TypeScript fetch 客户端（产物文本返回，落盘由调用方执行）', inputSchema: { type: 'object', properties: { specPath: { type: 'string' }, baseUrl: { type: 'string' } }, required: ['specPath'] } },
];

const loadSpec = (p) => {
  if (!p || !existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

function handleCall(name, args) {
  const spec = loadSpec(args?.specPath ?? args?.oldSpecPath);
  if ((args?.specPath || args?.oldSpecPath) && !spec) return { error: 'spec-not-found-or-invalid-json' };
  switch (name) {
    case 'validate_spec':
      return validateOpenApi(spec);
    case 'generate_ts_client':
      return generateTsClient(spec, { baseUrl: args?.baseUrl });
    default:
      return null;
  }
}

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
    send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'step-api-forge', version: VERSION } } });
    return;
  }
  if (method?.startsWith('notifications/')) return;
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
