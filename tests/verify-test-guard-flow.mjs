#!/usr/bin/env node
/**
 * step-test-guard v1.0.0 流程验证（验收：修复闭环 + 零误改）。
 *
 * 场景 A（可修复）：临时项目 node --test 三用例，其中 sub 实现带 bug。
 *   按 skills/test-fix-loop/SKILL.md 流程：全量跑 → 解析失败 → 最小修复（只改 calc.js）
 *   → 增量重跑失败集 → 全量确认 → 全绿。断言：轮次 ≤3、测试文件零改动。
 * 场景 B（不可修复）：用例断言恒假且不允许改测试。断言：3 轮后停止转人工、
 *   未删除/未改测试文件。
 *
 * 说明：真实栈的输出解析由 validate.mjs 按 test.md 的 TEST-PATTERNS 校验；
 * 本脚本用零依赖的 node --test 驱动闭环机制本身。
 * 运行：node tests/verify-test-guard-flow.mjs
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

let failed = 0;
const check = (cond, name, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` :: ${detail}`}`);
  if (!cond) failed += 1;
};

const NODE = process.execPath;
const run = (proj, args = []) =>
  spawnSync(NODE, ['--test', ...args], { cwd: proj, encoding: 'utf8', shell: false });
const parseFailures = (out) =>
  out.split(/\r?\n/).filter((l) => /^not ok\s/.test(l.trim())).map((l) => l.replace(/^.*?not ok\s*\d*\s*-?\s*/, '').trim());
const MAX_ROUNDS = 3; // 与 SKILL.md LOOP-RULES.max_rounds 一致

// ---------- 场景 A：可修复 ----------
const projA = mkdtempSync(join(tmpdir(), 'test-guard-a-'));
try {
  writeFileSync(join(projA, 'package.json'), JSON.stringify({ name: 'a', scripts: { test: 'node --test' } }));
  const calcPath = join(projA, 'calc.js');
  writeFileSync(calcPath, 'const add = (a, b) => a + b;\nconst sub = (a, b) => a - b + 1; // bug\nmodule.exports = { add, sub };\n');
  const testPath = join(projA, 'calc.test.js');
  const testSrc = "const { add, sub } = require('./calc');\nconst test = require('node:test');\nconst assert = require('node:assert');\ntest('add', () => assert.equal(add(1, 2), 3));\ntest('sub', () => assert.equal(sub(5, 2), 3));\ntest('add zero', () => assert.equal(add(0, 0), 0));\n";
  writeFileSync(testPath, testSrc);

  let rounds = 0;
  let green = false;
  let lastFailures = [];
  while (rounds < MAX_ROUNDS) {
    const r = run(projA);
    lastFailures = r.status === 0 ? [] : parseFailures(r.stdout + r.stderr);
    if (lastFailures.length === 0) {
      green = true;
      break;
    }
    rounds += 1;
    // 归因：断言失败 → 最小修复，只改 calc.js（对应用例 sub）
    writeFileSync(calcPath, 'const add = (a, b) => a + b;\nconst sub = (a, b) => a - b;\nmodule.exports = { add, sub };\n');
    // 增量重跑失败集（node --test 按 name 过滤），再全量确认由下一轮循环完成
    const rerun = run(projA, ['--test-name-pattern', 'sub']);
    if (parseFailures(rerun.stdout + rerun.stderr).length > 0) break;
  }
  const final = run(projA);
  check(green && final.status === 0, '场景 A：修复闭环全绿', `rounds=${rounds}`);
  check(rounds >= 1 && rounds <= MAX_ROUNDS, `场景 A：轮次 ≤${MAX_ROUNDS}`, String(rounds));
  check(readFileSync(testPath, 'utf8') === testSrc, '场景 A：零误改（测试文件未动）');
} finally {
  rmSync(projA, { recursive: true, force: true });
}

// ---------- 场景 B：不可修复 → 3 轮转人工 ----------
const projB = mkdtempSync(join(tmpdir(), 'test-guard-b-'));
try {
  writeFileSync(join(projB, 'package.json'), JSON.stringify({ name: 'b', scripts: { test: 'node --test' } }));
  writeFileSync(join(projB, 'calc.js'), 'const one = () => 1;\nmodule.exports = { one };\n');
  const testPath = join(projB, 'impossible.test.js');
  const testSrc = "const test = require('node:test');\nconst assert = require('node:assert');\ntest('impossible', () => assert.equal(require('./calc').one(), 2));\n";
  writeFileSync(testPath, testSrc);

  let rounds = 0;
  let unresolved = [];
  while (rounds < MAX_ROUNDS) {
    const r = run(projB);
    unresolved = parseFailures(r.stdout + r.stderr);
    if (unresolved.length === 0) break;
    rounds += 1;
    // 修复尝试：业务代码无错（断言期望值错误且未经用户确认）→ 合规动作是不改代码
  }
  check(rounds === MAX_ROUNDS && unresolved.length > 0, '场景 B：3 轮后停止并转人工', `rounds=${rounds}, unresolved=${unresolved.length}`);
  check(readFileSync(testPath, 'utf8') === testSrc, '场景 B：未通过删改测试来「修复」');
} finally {
  rmSync(projB, { recursive: true, force: true });
}

console.log(failed === 0 ? '\nVERIFY ALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
