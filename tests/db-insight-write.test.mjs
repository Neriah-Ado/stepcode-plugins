// R10:db-insight 受控写入安全回归——多语句走私拒绝、危险关键字、单条放行。
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyWrite, assertReadOnlyQuery } from "../plugins/step-db-insight/server/lib.mjs";

test("classifyWrite:拒绝 INSERT;COPY TO PROGRAM 多语句走私(RCE)", () => {
  const r = classifyWrite("INSERT INTO t VALUES (1); COPY t TO PROGRAM 'calc'");
  assert.equal(r.kind, "reject");
});

test("classifyWrite:拒绝 INSERT;DO 块走私", () => {
  assert.equal(classifyWrite("INSERT INTO t VALUES (1); DO $$ BEGIN END $$;").kind, "reject");
});

test("classifyWrite:拒绝尾随分号后的第二条语句", () => {
  assert.equal(classifyWrite("UPDATE t SET x=1; DELETE FROM t").kind, "reject");
});

test("classifyWrite:单条 INSERT/UPDATE 放行,字面量内分号不误伤", () => {
  assert.equal(classifyWrite("INSERT INTO t VALUES (1)").kind, "insert");
  assert.equal(classifyWrite("UPDATE t SET x=1 WHERE id=2").kind, "update");
  assert.equal(classifyWrite("INSERT INTO t VALUES ('a;b')").kind, "insert");
  assert.equal(classifyWrite("INSERT INTO t VALUES ('a;b');").kind, "insert");
});

test("classifyWrite:危险关键字单条也拒绝", () => {
  for (const sql of ["COPY t TO PROGRAM 'x'", "CREATE TABLE t(a int)", "CALL proc()", "DO $$ BEGIN END $$"]) {
    assert.equal(classifyWrite(sql).kind, "reject", sql);
  }
});

test("classifyWrite:UPDATE SET 子句不被误判(set 不在拒绝集)", () => {
  assert.equal(classifyWrite("UPDATE t SET name='call me' WHERE id=1").kind, "update");
});

test("assertReadOnlyQuery:只读守卫仍拒绝写与多语句", () => {
  assert.equal(assertReadOnlyQuery("SELECT 1").ok, true);
  assert.equal(assertReadOnlyQuery("SELECT 1; DROP TABLE t").ok, false);
  assert.equal(assertReadOnlyQuery("DELETE FROM t").ok, false);
});

test("classifyWrite:双引号标识符内单引号不得掩盖多语句走私(R21 绕过回归)", () => {
  // 攻击向量:"x'" 内的单引号曾被误判为字符串起点,吞掉 ;COPY → RCE
  assert.equal(classifyWrite(`INSERT INTO t SELECT 1 AS "x'"; COPY (SELECT 1) TO PROGRAM 'calc'; --'`).kind, "reject");
  assert.equal(classifyWrite(`INSERT INTO t SELECT 1 AS "x'"; DROP TABLE t; --'`).kind, "reject");
  // 反引号标识符同理
  assert.equal(classifyWrite("INSERT INTO t SELECT 1 AS `x'`; COPY t TO PROGRAM 'c'; --`").kind, "reject");
});

test("classifyWrite:合法引用标识符不误伤", () => {
  assert.equal(classifyWrite(`INSERT INTO "my table" VALUES (1)`).kind, "insert");
  assert.equal(classifyWrite(`UPDATE "drop" SET x=1`).kind, "update");
  assert.equal(classifyWrite("INSERT INTO t VALUES ('a;b')").kind, "insert");
});

test("classifyWrite:拒绝 E-string 反斜杠转义脱同步走私(R22 绕过回归)", () => {
  // E'\'') 中 \' 是转义引号,PG 已出串;剥离器若吞引号会漏掉 ;COPY → RCE
  assert.equal(classifyWrite(`INSERT INTO t VALUES (E'\\''); COPY t TO PROGRAM 'calc'`).kind, "reject");
  assert.equal(classifyWrite(`UPDATE t SET x=E'\\''); DROP TABLE t; --'`).kind, "reject");
  // E 前缀本身即拒绝(fail-closed)
  assert.equal(classifyWrite(`INSERT INTO t VALUES (E'abc')`).kind, "reject");
});

test("classifyWrite:标准字符串反斜杠字面量不误伤多语句判定", () => {
  // 标准串内的反斜杠按转义处理,闭引号正确识别,后续 ;COPY 仍被拒
  assert.equal(classifyWrite(`INSERT INTO t VALUES ('a\\''); COPY t TO PROGRAM 'c'`).kind, "reject");
});