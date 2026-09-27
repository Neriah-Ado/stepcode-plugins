#!/usr/bin/env node
/**
 * step-sec-scan MCP server（stdio JSON-RPC，零依赖；协议与 @modelcontextprotocol/sdk 兼容）。
 * 工具：scan_secrets / npm_audit / report / baseline_diff / baseline_save / sbom_generate / upgrade_plan / ci_gate。
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanSecretsInText, parseNpmAudit, renderSecurityReport, diffBaseline, buildCycloneDX,
  buildUpgradePlan, ciGateVerdict, runScanner,
} from './lib.mjs';

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(PLUGIN_DIR, 'step.plugin.json'), 'utf8')).version;

const TOOLS = [
  { name: 'scan_secrets', description: '对 staged diff（或给定文本）做 secret 模式扫描（内置降噪规则）', inputSchema: { type: 'object', properties: { diffText: { type: 'string' } }, required: ['diffText'] } },
  { name: 'npm_audit', description: '运行 npm audit --json 并解析（缺失时给安装指引）', inputSchema: { type: 'object', properties: {} } },
  { name: 'report', description: '渲染结构化安全报告（Markdown，落盘用）', inputSchema: { type: 'object', properties: { findings: { type: 'array' }, date: { type: 'string' } }, required: ['findings'] } },
  { name: 'baseline_diff', description: '基线对比：区分新引入与存量问题', inputSchema: { type: 'object', properties: { findings: { type: 'array' }, baselinePath: { type: 'string' } }, required: ['findings'] } },
  { name: 'sbom_generate', description: '从 package.json 生成 CycloneDX SBOM', inputSchema: { type: 'object', properties: { packageJsonPath: { type: 'string' } }, required: ['packageJsonPath'] } },
  { name: 'upgrade_plan', description: '可自动修复的依赖升级清单', inputSchema: { type: 'object', properties: { findings: { type: 'array' } }, required: ['findings'] } },
  { name: 'ci_gate', description: 'CI 卡点判定（默认 critical/high 阻断）', inputSchema: { type: 'object', properties: { findings: { type: 'array' }, fail_on: { type: 'array' } }, required: ['findings'] } },
];

function handleCall(name, args) {
  switch (name) {
    case 'scan_secrets':
      return args?.diffText !== undefined ? { findings: scanSecretsInText(args.diffText) } : { error: 'missing-arg: diffText' };
    case 'npm_audit': {
      const r = runScanner('npm', ['audit', '--json']);
      if (r.missing) return { error: 'scanner-missing', guidance: '未检测到 npm。请安装 Node.js/npm（https://nodejs.org）后重试。' };
      if (r.code !== 0 && !r.stdout) return { error: 'scanner-failed', stderr: r.stderr.slice(0, 300) };
      return parseNpmAudit(r.stdout);
    }
    case 'report':
      return args?.findings ? { markdown: renderSecurityReport({ date: args.date ?? new Date().toISOString().slice(0, 10), findings: args.findings }) } : { error: 'missing-arg: findings' };
    case 'baseline_diff': {
      if (!args?.findings) return { error: 'missing-arg: findings' };
      const bp = args.baselinePath ?? join(process.cwd(), '.stepcode', 'sec-baseline.json');
      const baseline = existsSync(bp) ? JSON.parse(readFileSync(bp, 'utf8')) : [];
      return diffBaseline(args.findings, baseline);
    }
    case 'sbom_generate': {
      const p = args?.packageJsonPath;
      if (!p || !existsSync(p)) return { error: 'missing-arg: packageJsonPath（文件不存在）' };
      return buildCycloneDX(JSON.parse(readFileSync(p, 'utf8')));
    }
    case 'upgrade_plan':
      return args?.findings ? { plan: buildUpgradePlan(args.findings) } : { error: 'missing-arg: findings' };
    case 'ci_gate':
      return args?.findings ? ciGateVerdict(args.findings, { fail_on: args.fail_on ?? ['critical', 'high'] }) : { error: 'missing-arg: findings' };
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
    send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'step-sec-scan', version: VERSION } } });
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
    if (result?.error === 'scanner-missing') {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: result.guidance }], isError: true } });
      return;
    }
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result } });
    return;
  }
  send({ jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Method not found: ${method}` } });
});
