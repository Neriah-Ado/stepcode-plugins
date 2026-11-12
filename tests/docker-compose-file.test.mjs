// R21:docker compose 文件参数校验回归——UNC/参数注入绕过修复。
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeUp, composeDown } from "../plugins/step-docker-mate/server/lib.mjs";

test("composeUp:拒绝反斜杠与正斜杠 UNC（防 NTLM 泄露）", () => {
  for (const file of ["\\\\attacker\\share\\dc.yml", "//attacker/share/dc.yml", "\\\\?\\C:\\x.yml"]) {
    const r = composeUp(file, { confirm: true });
    assert.equal(r.error, "invalid-argument", file);
  }
});

test("composeUp:拒绝首字符 - 与换行（防参数注入）", () => {
  assert.equal(composeUp("--privileged", { confirm: true }).error, "invalid-argument");
  assert.equal(composeUp("a\nb.yml", { confirm: true }).error, "invalid-argument");
  assert.equal(composeUp("", { confirm: true }).error, "invalid-argument");
});

test("composeDown:同样拒绝 UNC", () => {
  assert.equal(composeDown("//attacker/share/dc.yml", { confirm: true }).error, "invalid-argument");
});

test("composeUp:默认 dry-run（合法相对路径不触达 docker）", () => {
  const r = composeUp("compose.yaml");
  assert.equal(r.dryRun, true);
});

test("composeUp:拒绝首尾空白绕过 UNC 检查（R22）", () => {
  assert.equal(composeUp("  //attacker/share/dc.yml", { confirm: true }).error, "invalid-argument");
  assert.equal(composeUp("\t\\\\attacker\\share\\dc.yml", { confirm: true }).error, "invalid-argument");
});