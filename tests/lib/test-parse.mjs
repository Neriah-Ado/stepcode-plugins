/**
 * 测试输出解析（TG-100-4 的可脚本化部分）。
 * 语义与 commands/test.md「框架输出解析」一致：模式表由调用方传入
 * （tests/validate.mjs 从 test.md 的 TEST-PATTERNS 块读取，保证单一事实源）。
 * parseTestOutput(stack, text, patterns) → [{ file, case, expect, actual, detail }]
 *
 * 扫描语义：
 *   vitest —— `FAIL <file> > <case>` 行创建/补全条目；`❯ <file> (` 为块级文件归属，
 *             `× <case>` 行继承它；`→` 行为断言明细；同 (file, case) 去重。
 *   jest   —— `FAIL <file>` 切换当前文件；`● <case>` 行创建条目；
 *             `Expected/Received` 附到最近条目。
 *   pytest —— `FAILED <file>::<case> - <msg>` 汇总行创建条目；`E ` 行为断言明细。
 */
export function parseTestOutput(stack, text, patterns) {
  const p = patterns[stack];
  if (!p) return [];
  const entries = [];
  const re = (s) => new RegExp(s);
  let current = null;
  let blockFile = null;
  let pendingGo = null; // go 的失败明细先于 --- FAIL 标记输出，先缓冲

  const push = (file, caseName, detail = null) => {
    const effFile = file ?? current?.file ?? blockFile ?? null;
    const dup = entries.find((e) => e.file === effFile && e.case === caseName);
    if (dup) {
      current = dup;
      return;
    }
    current = { file: effFile, case: caseName, expect: null, actual: null, detail };
    entries.push(current);
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (stack === 'vitest') {
      const bf = p.block_file ? re(p.block_file).exec(line) : null;
      if (bf) {
        blockFile = bf[1];
        continue;
      }
      const f = re(p.fail_file).exec(line);
      if (f) {
        const gt = /[>›]\s*(.+)$/.exec(line.slice(f[0].length));
        if (gt) {
          const caseName = gt[1].trim();
          const hit = entries.find((e) => e.case === caseName && (e.file === null || e.file === f[1]));
          if (hit) {
            hit.file = f[1];
            current = hit;
          } else {
            push(f[1], caseName);
          }
        } else {
          blockFile = f[1];
        }
        continue;
      }
      const c = re(p.fail_case).exec(line);
      if (c) {
        push(null, c[1].trim());
        continue;
      }
      const d = re(p.detail_line).exec(line);
      if (d && current && !current.detail) {
        current.detail = d[1].trim();
        continue;
      }
    }
    if (stack === 'jest') {
      const f = re(p.fail_file).exec(line);
      if (f) {
        current = { ...current, file: f[1] };
        continue;
      }
      const c = re(p.fail_case).exec(line);
      if (c) {
        push(null, c[1].trim());
        continue;
      }
      const e = re(p.expect).exec(line);
      if (e && current) {
        current.expect = e[1].trim();
        continue;
      }
      const r = re(p.received).exec(line);
      if (r && current) {
        current.actual = r[1].trim();
        continue;
      }
    }
    if (stack === 'pytest') {
      const s = re(p.summary_line).exec(line);
      if (s) {
        push(s[1], s[2], s[3]?.trim() ?? null);
        continue;
      }
      const d = re(p.detail_line).exec(line);
      if (d && current && !current.detail) {
        current.detail = d[1].trim();
        continue;
      }
    }
    if (stack === 'go') {
      const c = re(p.fail_case).exec(line);
      if (c) {
        push(null, c[1].trim());
        if (pendingGo && current) {
          current.file = current.file ?? pendingGo.file;
          current.detail = current.detail ?? pendingGo.detail;
        }
        pendingGo = null;
        continue;
      }
      const d = re(p.detail_line).exec(line);
      if (d) {
        if (current && !current.detail) {
          current.file = current.file ?? d[1];
          current.detail = d[2].trim();
        } else {
          pendingGo = { file: d[1], detail: d[2].trim() };
        }
        continue;
      }
    }
    if (stack === 'cargo') {
      const c = re(p.fail_case).exec(line);
      if (c) {
        push(null, c[1].trim());
        continue;
      }
      const pf = re(p.panic_file).exec(line);
      if (pf && current) {
        current.file = current.file ?? pf[1];
        continue;
      }
      const l = re(p.assert_left).exec(line);
      if (l && current) {
        current.expect = l[1].trim();
        continue;
      }
      const r = re(p.assert_right).exec(line);
      if (r && current) {
        current.actual = r[1].trim();
        continue;
      }
    }
    if (stack === 'gradle') {
      const c = re(p.fail_case).exec(line);
      if (c) {
        push(c[1], c[2]);
        continue;
      }
    }
    if (stack === 'maven') {
      const c = re(p.fail_case).exec(line);
      if (c) {
        push(c[1], c[2], c[3]?.trim() ?? null);
        continue;
      }
    }
  }
  return entries;
}
