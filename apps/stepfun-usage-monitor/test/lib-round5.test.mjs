// R5:Electron lib 纯函数回归(采集循环 / 载荷 / 状态存储)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOverlayCollector } from "../electron/lib/collect-loop.mjs";
import { buildOverlayPayload, collectOverlayPayload } from "../electron/lib/overlay-payload.mjs";
import { mergeBounds, isRectVisible, DEFAULTS } from "../electron/lib/state-store.mjs";

test("spark 取最近 12 条(旧→新)并过滤无效值", () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ tokPerSec: i }));
  history[5] = { tokPerSec: NaN };
  history[10] = null;
  const p = buildOverlayPayload({ latest: null, session: null, history });
  assert.equal(p.spark.length, 12);
  assert.equal(p.spark[p.spark.length - 1], 19, "应取到最新样本");
  assert.ok(p.spark.every((v) => Number.isFinite(v)));
});

test("spark 默认窗口(≤12)全保留", () => {
  const history = [1, 2, 3, 4, 5].map((v) => ({ tokPerSec: v }));
  assert.deepEqual(buildOverlayPayload({ history }).spark, [1, 2, 3, 4, 5]);
});

test("agentScoped 与 provider 映射", () => {
  assert.equal(buildOverlayPayload({ sources: [{ id: "zcode" }], provider: "zcode" }).agentScoped, true);
  assert.equal(buildOverlayPayload({ sources: [{ id: "a" }, { id: "b" }] }).agentScoped, false);
  assert.equal(buildOverlayPayload({ provider: "codex" }).provider, "codex");
  assert.equal(buildOverlayPayload({}).agentScoped, false);
});

test("collectOverlayPayload 无 message 错误回退 reason=error", async () => {
  const p = await collectOverlayPayload(() => { throw new Error(); }, null);
  assert.equal(p.ok, false);
  assert.equal(p.reason, "error");
});

test("stop 抑制在途查询的推送", async () => {
  let resolveQuery;
  const queryFn = () => new Promise((r) => { resolveQuery = r; });
  let calls = 0;
  const c = createOverlayCollector({ queryFn, onData: () => calls++ });
  c.start(); // 立即 tick,查询挂起
  c.stop();
  resolveQuery({ latest: null, session: null, history: [] });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(calls, 0, "stop 后在途结果不得推送");
});

test("mergeBounds 缺省 x/y 保留记忆,显式 null 清除", () => {
  const s = { overlay: { width: 232, height: 64, x: 100, y: 200 } };
  const kept = mergeBounds(s, "overlay", { width: 232, height: 64 });
  assert.equal(kept.overlay.x, 100);
  assert.equal(kept.overlay.y, 200);
  const cleared = mergeBounds(s, "overlay", { x: null, y: null });
  assert.equal(cleared.overlay.x, null);
  assert.equal(cleared.overlay.y, null);
});

test("isRectVisible 屏内/屏外/无坐标/多屏", () => {
  const single = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  assert.equal(isRectVisible({ x: 100, y: 100, width: 232, height: 64 }, single), true);
  assert.equal(isRectVisible({ x: 5000, y: 5000, width: 232, height: 64 }, single), false);
  assert.equal(isRectVisible({ x: null, y: null, width: 232, height: 64 }, single), true);
  const dual = [...single, { x: 1920, y: 0, width: 1920, height: 1080 }];
  assert.equal(isRectVisible({ x: 2000, y: 100, width: 232, height: 64 }, dual), true);
  assert.equal(isRectVisible({ x: 2000, y: 100, width: 232, height: 64 }, single), false);
});

test("mergeBounds 越界夹紧后 saveState 读回一致", () => {
  const merged = mergeBounds({ main: { ...DEFAULTS.main } }, "main", { width: 5, height: 5, x: 0, y: 0 });
  assert.ok(merged.main.width >= 120);
  assert.ok(merged.main.height >= 40);
});