/**
 * commitlint 配置的静态规则提取（SC-110-3 的可脚本化部分）。
 * 语义与 commands/commit.md「commitlint 规则联动」章节保持一致：
 *   - JSON 类配置（commitlint.config.json / .commitlintrc / .commitlintrc.json / package.json#commitlint）
 *     直接解析，归一化出 type-enum / header-max-length / scope-enum；
 *   - JS/TS 动态配置标记 dynamic: true（运行期由模型读取其字面量规则）；
 *   - 无配置返回 null。
 * 规则值取 commitlint 标准形态 [severity, 'always'|'never', value]；severity 为 0 或 'off' 时忽略。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const normalize = (rules) => {
  if (!rules) return null;
  const out = {};
  const pick = (key, key2) => {
    const r = rules[key] ?? rules[key2];
    if (!Array.isArray(r) || r.length < 3) return undefined;
    const [severity, , value] = r;
    if (severity === 0 || severity === 'off') return undefined;
    return value;
  };
  const typeEnum = pick('type-enum');
  const headerMaxLength = pick('header-max-length');
  const scopeEnum = pick('scope-enum');
  if (typeEnum !== undefined) out.typeEnum = typeEnum;
  if (headerMaxLength !== undefined) out.headerMaxLength = headerMaxLength;
  if (scopeEnum !== undefined) out.scopeEnum = scopeEnum;
  return Object.keys(out).length > 0 ? out : null;
};

export function extractCommitlintRules(rootDir) {
  const jsonCandidates = [
    join(rootDir, 'commitlint.config.json'),
    join(rootDir, '.commitlintrc.json'),
    join(rootDir, '.commitlintrc'),
  ];
  for (const path of jsonCandidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      return { dynamic: false, rules: normalize(parsed.rules ?? parsed) };
    } catch {
      // JSON 损坏视为无规则，继续回退
    }
  }

  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.commitlint) return { dynamic: false, rules: normalize(pkg.commitlint.rules ?? pkg.commitlint) };
    } catch {
      // 忽略损坏的 package.json
    }
  }

  const dynamicNames = [
    'commitlint.config.ts',
    'commitlint.config.mjs',
    'commitlint.config.cjs',
    'commitlint.config.js',
  ];
  for (const name of dynamicNames) {
    if (existsSync(join(rootDir, name))) {
      return {
        dynamic: true,
        reason: `${name} 为动态配置，静态解析需执行代码；运行期按命令文本约定读取其字面量规则`,
      };
    }
  }

  return { dynamic: false, rules: null };
}
