#!/usr/bin/env node
/**
 * step-test-guard v1.3.0 流程验证（验收：flaky 识别可复现 + bisect 包装可用）。
 *
 * 场景 A（flaky 可复现）：临时项目用计数器模拟 50% 失败率的用例，重跑 10 轮，
 *   按 commands/flaky.md 的判定规则应得到 verdict=flaky（失败率 50%）。
 *   另验证 stable-pass 与 stable-fail 两个边界。
 * 场景 B（bisect）：临时仓库 3 个提交（好 → 无关 → 引入回归），按
 *   commands/bisect.md 生成 run 脚本执行 git bisect run，应报告引入回归的
 *   提交为首个坏提交，且 reset 后工作区干净。
 *
 * 运行：node tests/verify-flaky-bisect-flow.mjs   （GIT_BIN/GIT_BASH 可指定）
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { analyzeFlaky } from './lib/flaky.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath.replaceAll('\\', '/');
const GIT_BIN = process.env.GIT_BIN || 'git';
const GIT_BASH = (process.env.GIT_BASH || GIT_BIN.replace(/cmd[\\/]git\.exe$/, 'bin/bash.exe')).replaceAll('\\', '/');
let failed = 0;
const check = (cond, name, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` :: ${detail}`}`);
  if (!cond) failed += 1;
};

const run = (proj, args = []) =>
  spawnSync(NODE, ['--test', ...args], { cwd: proj, encoding: 'utf8', shell: false });

// ---------- 场景 A：flaky 判定 ----------
const projA = mkdtempSync(join(tmpdir(), 'test-guard-flaky-'));
try {
  writeFileSync(join(projA, 'package.json'), JSON.stringify({ name: 'flaky-demo' }));
  writeFileSync(
    join(projA, 'flaky.test.js'),
    [
      "const fs = require('fs');",
      "const test = require('node:test');",
      "const assert = require('node:assert');",
      "test('counter flaky', () => {",
      "  const n = parseInt(fs.readFileSync('counter.txt', 'utf8') || '0', 10) + 1;",
      "  fs.writeFileSync('counter.txt', String(n));",
      '  assert.ok(n % 2 === 0, `run ${n} fails`);',
      '});',
    ].join('\n'),
  );
  writeFileSync(join(projA, 'counter.txt'), '0');
  const results = [];
  for (let i = 0; i < 10; i += 1) {
    const r = run(projA);
    results.push(r.status === 0);
  }
  const a = analyzeFlaky(results);
  check(a.verdict === 'flaky', 'flaky 用例判定为 flaky', JSON.stringify(a));
  check(a.failRate === 50, 'flaky 失败率 50% 且可复现', String(a.failRate));
  check(analyzeFlaky(Array(10).fill(true)).verdict === 'stable-pass', '全通过判定 stable-pass');
  check(analyzeFlaky(Array(10).fill(false)).verdict === 'stable-fail', '全失败判定 stable-fail（非 flaky）');
  check(analyzeFlaky(Array(31).fill(true)).notes?.length > 0, '轮次超限给出成本提示');
} finally {
  rmSync(projA, { recursive: true, force: true });
}

// ---------- 场景 B：bisect 定位首个坏提交 ----------
const projB = mkdtempSync(join(tmpdir(), 'test-guard-bisect-'));
try {
  const git = (...args) => {
    const r = spawnSync(GIT_BIN, args, { cwd: projB, encoding: 'utf8', shell: false });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr}`);
    return r.stdout.trim();
  };
  git('init');
  git('config', 'user.name', 'verify-bot');
  git('config', 'user.email', 'verify@example.com');
  git('config', 'commit.gpgsign', 'false');

  const writeCalc = (buggy) =>
    writeFileSync(join(projB, 'calc.js'), `const sub = (a, b) => a - b${buggy ? ' + 1' : ''};\nmodule.exports = { sub };\n`);
  writeCalc(false);
  writeFileSync(
    join(projB, 'check.js'),
    `const assert = require('node:assert');\nassert.equal(require('./calc.js').sub(5, 2), 3);\n`,
  );
  git('add', 'calc.js', 'check.js');
  git('commit', '-m', 'feat: calc sub 正确实现');
  const goodHash = git('rev-parse', 'HEAD');
  writeFileSync(join(projB, 'README.md'), '# demo\n');
  git('add', 'README.md');
  git('commit', '-m', 'chore: 无关改动');
  writeCalc(true);
  git('add', 'calc.js');
  git('commit', '-m', 'feat: 引入回归');
  const badHash = git('rev-parse', 'HEAD');

  // run 脚本与日志都放仓库外：bisect 会检出历史提交，且日志不应污染工作区
  const scriptPath = join(projB, '..', `run-bisect-${Date.now()}.sh`);
  const logPath = join(projB, '..', `bisect-last-${Date.now()}.log`).replaceAll('\\', '/');
  writeFileSync(scriptPath, `#!/bin/sh\n"${NODE}" check.js > "${logPath}" 2>&1\nexit $?\n`);
  git('bisect', 'start');
  git('bisect', 'bad', 'HEAD');
  git('bisect', 'good', goodHash);
  const runOut = spawnSync(GIT_BIN, ['bisect', 'run', GIT_BASH, scriptPath.replaceAll('\\', '/')], {
    cwd: projB, encoding: 'utf8', shell: false,
  });
  const out = runOut.stdout + runOut.stderr;
  check(out.includes(`${badHash} is the first 'bad' commit`), 'bisect 定位首个坏提交', out.slice(-400));
  git('bisect', 'reset');
  rmSync(scriptPath, { force: true });
  rmSync(logPath, { force: true });
  check(git('status', '--porcelain') === '', 'bisect reset 后工作区干净');
  const restored = git('log', '-1', '--pretty=%s');
  check(restored === 'feat: 引入回归', 'bisect reset 后回到原 HEAD', restored);
} finally {
  rmSync(projB, { recursive: true, force: true });
}

console.log(failed === 0 ? '\nVERIFY ALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
