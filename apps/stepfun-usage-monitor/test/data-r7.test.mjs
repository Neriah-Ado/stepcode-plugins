// R7:数据/配置层回归——原子写、历史窗口契约、JSONL 读取器收缩安全。
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(HERE, "..", "plugins", "zcode-tps-monitor");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tps-r7-"));
process.env.HOME = tmp;
process.env.USERPROFILE = tmp;

const { writeConfig, readConfig, CONFIG_FILE } = await import(
  pathToFileURL(path.join(PLUGIN, "scripts", "lib", "config.mjs")).href
);
const { buildRateView, createJsonlReader } = await import(
  pathToFileURL(path.join(PLUGIN, "scripts", "lib", "providers", "common.mjs")).href
);

test("writeConfig:原子写后无 tmp 残留且内容可读回", () => {
  writeConfig({ appearance: { theme: "light" }, providers: ["zcode"] });
  assert.deepEqual(readConfig().appearance, { theme: "light" });
  const dir = path.dirname(CONFIG_FILE);
  const residue = fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"));
  assert.deepEqual(residue, [], "不得留下临时文件");
});

test("buildRateView:历史窗口契约保持 min(hist,window)", () => {
  // records 约定新→旧:completedAt 递减
  const records = Array.from({ length: 20 }, (_, i) => ({
    outputTokens: 100,
    reasoningTokens: 0,
    tokPerSec: 50 + i,
    completedAt: 1019 - i,
    turnKey: "t1",
  }));
  const view = buildRateView(records, { sessionId: "s1" });
  // 默认 window=5:历史仍为 5 点(契约不变),但不再过度读取/双重 slice
  assert.equal(view.history.length, 5);
  assert.equal(view.session.samples, 5);
  // history 反转为旧→新:末条是最新样本
  assert.equal(view.history[view.history.length - 1].completedAt, 1019);
});

test("createJsonlReader:文件收缩后从头重解析,不读未初始化尾段", () => {
  const file = path.join(tmp, "shrinking.jsonl");
  const parseLine = (obj) => (obj && obj.id != null ? { id: obj.id, completedAt: obj.at } : null);
  const reader = createJsonlReader(parseLine);
  fs.writeFileSync(file, JSON.stringify({ id: 1, at: 1 }) + "\n" + JSON.stringify({ id: 2, at: 2 }) + "\n");
  const first = reader.read(file);
  assert.equal(first.records.length, 2);
  // 收缩为更短内容:读取器应重置,结果只含新文件的记录,无垃圾尾段
  fs.writeFileSync(file, JSON.stringify({ id: 9, at: 9 }) + "\n");
  const second = reader.read(file);
  assert.equal(second.records.length, 1);
  assert.equal(second.records[0].id, 9);
});