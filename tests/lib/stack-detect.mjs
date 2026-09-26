/**
 * 测试框架检测（commands/test.md TEST-DETECT 块的可执行镜像）。
 * detectStack(projectDir, detectors) → { stack, run, evidence } | null
 * 规则：detectors 顺序匹配，命中即止；文件模式支持 {a,b} 花括号展开与
 * 特殊键 package.json:scripts.test、pyproject.toml[tool.pytest.ini_options]。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const expandBraces = (pattern) => {
  const m = /\{([^}]+)\}/.exec(pattern);
  if (!m) return [pattern];
  return m[1].split(',').flatMap((alt) => expandBraces(pattern.replace(m[0], alt)));
};

const matchesFile = (projectDir, fileSpec) => {
  if (fileSpec === 'package.json:scripts.test') {
    const p = join(projectDir, 'package.json');
    if (!existsSync(p)) return false;
    try {
      return Boolean(JSON.parse(readFileSync(p, 'utf8'))?.scripts?.test);
    } catch {
      return false;
    }
  }
  if (fileSpec.startsWith('pyproject.toml[')) {
    const p = join(projectDir, 'pyproject.toml');
    return existsSync(p) && readFileSync(p, 'utf8').includes('[tool.pytest');
  }
  for (const f of expandBraces(fileSpec)) {
    if (existsSync(join(projectDir, f))) return true;
  }
  return false;
};

export function detectStack(projectDir, detectors) {
  for (const d of detectors ?? []) {
    if (matchesFile(projectDir, d.file)) {
      return { stack: d.stack, run: d.run, evidence: d.file };
    }
  }
  return null;
}
