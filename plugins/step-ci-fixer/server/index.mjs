#!/usr/bin/env node
/**
 * step-ci-fixer MCP server（stdio JSON-RPC，零依赖；协议与 @modelcontextprotocol/sdk 兼容）。
 * 工具：list_failed_runs / list_workflows / fetch_run_log / rerun_workflow / run_status / fetch_pr_comments / classify_failure / check_gh。
 */
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGh, listFailedRuns, listWorkflows, fetchRunLog, rerunWorkflow, runStatus, fetchPrComments, classifyFailure, GH_MISSING_GUIDANCE, GH_AUTH_GUIDANCE } from './lib.mjs';

const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(join(PLUGIN_DIR, 'step.plugin.json'), 'utf8')).version;

const TOOLS = [
  { name: 'check_gh', description: '检查 gh 可用性与认证状态（不可用时返回安装/登录指引）', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_failed_runs', description: '列出失败的 workflow run', inputSchema: { type: 'object', properties: { workflow: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'list_workflows', description: '列出近期 workflow 及其运行次数（多 workflow 选择器）', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'fetch_run_log', description: '抓取 run 日志的错误段（只取尾部，C5）', inputSchema: { type: 'object', properties: { runId: { type: 'number' }, maxBytes: { type: 'number' } }, required: ['runId'] } },
  { name: 'classify_failure', description: '失败分类：lint/test/build/deploy/unknown', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'rerun_workflow', description: '触发 run 重跑', inputSchema: { type: 'object', properties: { runId: { type: 'number' } }, required: ['runId'] } },
  { name: 'run_status', description: '查询 run 状态与结论', inputSchema: { type: 'object', properties: { runId: { type: 'number' } }, required: ['runId'] } },
  { name: 'fetch_pr_comments', description: '读取 PR 评论（截断，C5）', inputSchema: { type: 'object', properties: { prNumber: { type: 'number' } }, required: ['prNumber'] } },
];

function handleCall(name, args) {
  switch (name) {
    case 'check_gh':
      return checkGh();
    case 'list_failed_runs':
      return listFailedRuns({ workflow: args?.workflow, limit: args?.limit });
    case 'list_workflows':
      return listWorkflows({ limit: args?.limit });
    case 'fetch_run_log':
      return args?.runId ? fetchRunLog(args.runId, { maxBytes: args.maxBytes }) : { error: 'missing-arg: runId' };
    case 'classify_failure':
      return args?.text ? { kind: classifyFailure(args.text) } : { error: 'missing-arg: text' };
    case 'rerun_workflow':
      return args?.runId ? rerunWorkflow(args.runId) : { error: 'missing-arg: runId' };
    case 'run_status':
      return args?.runId ? runStatus(args.runId) : { error: 'missing-arg: runId' };
    case 'fetch_pr_comments':
      return args?.prNumber ? fetchPrComments(args.prNumber) : { error: 'missing-arg: prNumber' };
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
    send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'step-ci-fixer', version: VERSION } } });
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
    if (result?.error === 'gh-missing') {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: GH_MISSING_GUIDANCE }], isError: true } });
      return;
    }
    if (result?.kind === 'not-logged-in') {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: GH_AUTH_GUIDANCE }], isError: true } });
      return;
    }
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result } });
    return;
  }
  send({ jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Method not found: ${method}` } });
});
