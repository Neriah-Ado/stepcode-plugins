/**
 * step-db-insight MCP server 核心逻辑。
 * v1.0.0：强制只读（语句白名单解析 + 只读连接双重防线）、EXPLAIN 解读规则、凭据缺失引导（G4/C4）。
 * v1.1.0+：迁移生成 / 慢查询建议 / 写白名单确认 / 多库方言（见后续版本段）。
 * DB 访问：环境变量 DATABASE_URL（C4，不落盘）；执行层经 psql CLI（测试缝 PSQL_FAKE）。
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

export const CREDENTIAL_GUIDANCE = [
  '未检测到 DATABASE_URL 环境变量。请安全配置后重试：',
  '- PowerShell：$env:DATABASE_URL = "postgres://user:pass@host:5432/db"',
  '- Git Bash：export DATABASE_URL="postgres://user:pass@host:5432/db"',
  '安全提示：连接串含密码，仅注入当前会话环境，禁止写入文件或提交到仓库（C4）。',
].join('\n');

const WRITE_RE = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|vacuum|call|do|merge|replace|copy)\b/i;
const ALLOWED_PREFIX = /^\s*(select|explain|show|table|values|with)\b/i;

/**
 * 强制只读解析（DI-100-2 的核心，对抗式设计）：
 * 允许仅 SELECT/EXPLAIN/SHOW/TABLE/VALUES/只读 WITH；任何写关键字、多语句、注释走私一律拒绝。
 */
export function assertReadOnlyQuery(sql) {
  if (typeof sql !== 'string' || !sql.trim()) return { ok: false, reason: '空语句' };
  if (sql.includes(';') && /;\s*\S/.test(sql)) return { ok: false, reason: '禁止多语句（检测到语句分隔符后的内容）' };
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim();
  if (!ALLOWED_PREFIX.test(stripped)) return { ok: false, reason: '仅允许只读语句（SELECT/EXPLAIN/SHOW）' };
  if (WRITE_RE.test(stripped)) {
    // WITH 内允许嵌套 SELECT；其余任何写关键字出现即拒绝（含 EXPLAIN ANALYZE DELETE）
    return { ok: false, reason: `检测到疑似写操作关键字，已拒绝（只读模式）` };
  }
  if (/\binto\b/i.test(stripped)) {
    return { ok: false, reason: 'SELECT INTO 属于写行为，已拒绝' };
  }
  return { ok: true };
}

export function runPsql(sql, { databaseUrl } = {}) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) return { missingCredential: true };
  if (process.env.PSQL_FAKE) {
    const r = spawnSync(process.execPath, [process.env.PSQL_FAKE, sql], { encoding: 'utf8' });
    return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', missing: Boolean(r.error) };
  }
  const bin = process.env.PSQL_BIN || 'psql';
  const r = spawnSync(bin, [url, '-c', sql], { encoding: 'utf8', shell: false });
  if (r.error || r.status === null) return { code: null, stdout: '', stderr: String(r.error?.message ?? 'spawn failed'), missing: true };
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', missing: false };
}

// 只读守卫：先白名单，后执行；拒绝时返回 reason（G3）
export function readOnlyQuery(sql, opts) {
  const guard = assertReadOnlyQuery(sql);
  if (!guard.ok) return { rejected: true, reason: guard.reason };
  const r = runPsql(sql, opts);
  if (r.missingCredential) return { error: 'missing-credential', guidance: CREDENTIAL_GUIDANCE };
  if (r.missing) return { error: 'psql-missing', guidance: '未检测到 psql CLI。请安装 PostgreSQL 客户端工具后重试。' };
  if (r.code !== 0) return { error: 'query-failed', stderr: r.stderr.slice(0, 500) };
  return { output: r.stdout.slice(0, 16 * 1024) };
}

// ---------- v1.1.0 迁移生成与慢查询建议 ----------
const now = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

export function buildMigration(name, changes, dialect = 'postgres') {
  const stamp = now();
  const safeName = String(name).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  const q = dialect === 'mysql' ? '`' : '"';
  const header = `-- migration: ${safeName} (${dialect})\n-- 由 step-db-insight 生成，供人工审查；不自动执行\n`;
  const body = `-- changes:\n${String(changes).split('\n').map((l) => `-- ${l}`).join('\n')}\n`;
  const up = `\n-- +up\n-- 在此写正向迁移（示例骨架，按 changes 调整）\n-- ALTER TABLE ${q}target${q} ADD COLUMN ${q}new_col${q} text;\n`;
  const down = `\n-- +down\n-- 对应回滚\n-- ALTER TABLE ${q}target${q} DROP COLUMN IF EXISTS ${q}new_col${q};\n`;
  return { filename: `${stamp}_${safeName}.sql`, sql: header + body + up + down };
}

export function slowQueryAdvice(planText) {
  const { findings } = interpretExplain(planText);
  const advice = findings.map((f) => ({ finding: f, suggestion: /顺序扫描|Seq Scan/i.test(f) ? '为 WHERE/JOIN 列建 B-tree 索引' : /Nested Loop/i.test(f) ? '改写为 Hash Join 或补充连接索引' : '调整 work_mem 或改写查询' }));
  return { advice };
}

// ---------- v1.2.0 受控写入 ----------
export function classifyWrite(sql) {
  const s = String(sql).trim();
  if (/\b(delete|drop|truncate|alter|grant|revoke|vacuum)\b/i.test(s)) {
    return { kind: 'reject', reason: 'DELETE/DDL 类操作默认永久拒绝（只读兜底之外的最高红线）' };
  }
  if (/^\s*insert\b/i.test(s)) return { kind: 'insert' };
  if (/^\s*update\b/i.test(s)) return { kind: 'update' };
  if (/^\s*merge\b/i.test(s)) return { kind: 'insert' };
  return { kind: 'reject', reason: '仅支持受控 INSERT/UPDATE' };
}

export function buildWriteConfirmation(sql, cls, { confirm = false } = {}) {
  if (!confirm) {
    return {
      requiresConfirmation: true,
      kind: cls.kind,
      sql,
      warning: '受控写入：请核对语句后以 confirm=true 逐条执行；建议包在事务里（见 TXN-RULES）',
      transactionHint: 'BEGIN; <本语句>; 核对影响行数; COMMIT;（异常时 ROLLBACK）',
    };
  }
  const r = runPsql(sql);
  if (r.missingCredential) return { error: 'missing-credential', guidance: CREDENTIAL_GUIDANCE };
  if (r.missing) return { error: 'psql-missing', guidance: '未检测到 psql CLI。请安装 PostgreSQL 客户端工具后重试。' };
  if (r.code !== 0) return { error: 'write-failed', stderr: r.stderr.slice(0, 300) };
  return { executed: true, output: r.stdout.slice(0, 2000) };
}

// ---------- v1.3.0 多库方言与 schema 时间线 ----------
export function dialectInfo(dialect = 'postgres') {
  const table = {
    postgres: { quote: '"', listTables: "SELECT tablename FROM pg_tables WHERE schemaname='public'", client: 'psql' },
    mysql: { quote: '`', listTables: 'SHOW TABLES', client: 'mysql' },
    sqlite: { quote: '"', listTables: "SELECT name FROM sqlite_master WHERE type='table'", client: 'sqlite3' },
  };
  return { dialect, ...(table[dialect] ?? table.postgres) };
}

export function schemaTimeline(migrationsDir) {
  let files = [];
  try {
    files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    return { error: 'dir-unreadable', migrationsDir };
  }
  const entries = files.map((f, i) => {
    const m = /^(\d{8,14})[_-](.+)\.sql$/.exec(f);
    return { order: i + 1, timestamp: m?.[1] ?? null, name: m?.[2] ?? f.replace(/\.sql$/, '') };
  });
  const mermaid = ['timeline', ...entries.map((e) => `    ${e.order} : ${e.name}`)].join('\n');
  return { count: entries.length, entries, mermaid };
}

// ---------- EXPLAIN 解读规则（DI-100-3，与 skills/sql-review 的 EXPLAIN-RULES 一致） ----------
export function interpretExplain(planText) {
  const lines = String(planText).split(/\r?\n/).filter(Boolean);
  const findings = [];
  let seqScans = 0;
  for (const line of lines) {
    if (/Seq Scan on (\w+)/i.test(line)) {
      seqScans += 1;
      const table = /Seq Scan on (\w+)/i.exec(line)[1];
      const rows = /rows=(\d+)/i.exec(line);
      if (!rows || Number(rows[1]) > 1000) {
        findings.push(`对表 ${table} 顺序扫描${rows ? `（约 ${rows[1]} 行）` : ''}：若有 WHERE 过滤条件，考虑建索引`);
      }
    }
    if (/Nested Loop/i.test(line) && /rows=\d{4,}/i.test(line)) {
      findings.push('大规模 Nested Loop：检查连接条件是否缺索引或可改写为 Hash Join');
    }
    if (/sort method:[^"]*external merge/i.test(line.toLowerCase())) {
      findings.push('排序溢出到磁盘（external merge）：考虑增大 work_mem 或减少排序数据量');
    }
  }
  return { findings, planLines: lines.length };
}
