// R16:sec-scan stdio 服务健壮性——坏 JSON/不可读文件不得崩掉服务（DoS 修复回归）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, "..", "plugins", "step-sec-scan", "server", "index.mjs");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sec-scan-robust-"));
const badJson = path.join(tmp, "bad.json");
fs.writeFileSync(badJson, "{ this is not valid json ");

function callTool(name, args) {
  const lines = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }),
    "",
  ];
  const r = spawnSync(process.execPath, [SERVER], { input: lines.join("\n") + "\n", encoding: "utf8", timeout: 15000 });
  return r;
}

test("sbom_generate 坏 JSON 返回结构化错误而非崩溃", () => {
  const r = callTool("sbom_generate", { packageJsonPath: badJson });
  assert.equal(r.status, 0, `服务应正常退出而非崩溃: stderr=${r.stderr}`);
  const msgs = (r.stdout + "\n").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const res = msgs.find((m) => m.id === 2)?.result;
  assert.ok(res?.structuredContent?.error || res?.isError, "应返回结构化错误");
});

test("baseline_diff 坏基线文件返回结构化错误而非崩溃", () => {
  const r = callTool("baseline_diff", { findings: [], baselinePath: badJson });
  assert.equal(r.status, 0, `服务应正常退出: stderr=${r.stderr}`);
  const msgs = (r.stdout + "\n").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const res = msgs.find((m) => m.id === 2)?.result;
  assert.ok(res?.structuredContent?.error || res?.isError, "应返回结构化错误");
});

test("sbom_generate 不存在文件返回 missing-arg", () => {
  const r = callTool("sbom_generate", { packageJsonPath: path.join(tmp, "nope.json") });
  assert.equal(r.status, 0);
  const msgs = (r.stdout + "\n").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const res = msgs.find((m) => m.id === 2)?.result;
  assert.ok(res?.structuredContent?.error, "应返回错误");
});