---
description: "查看或维护圆桌角色模板（.stepcode/roundtable/roles.json），写盘先 diff 后确认"
argument-hint: [--edit | --reset]
---

# /rt-roles — 角色模板维护

**写盘红线**：roles.json 修改前先 diff 展示，用户确认后落盘（G3）；--reset 恢复默认角色同样需确认。

<!-- RT-ROLES-RULES-START -->
```json
{
  "schema": ".stepcode/roundtable/roles.json：[{name, stance, checklist[]}]；默认四角色：安全（攻击面/凭据/权限）、性能（复杂度/热路径/容量）、维护性（可读性/耦合/测试）、用户价值（场景/体验/成本）",
  "edit": "--edit 接受用户口述新增/修改角色，整理成 schema 合法 JSON，先 diff 再确认；字段缺失时补默认值并标注",
  "reset": "--reset 展示将恢复的默认四角色 diff，确认后覆盖",
  "read_only_default": "不带参数时只读展示当前角色与检查清单，不写盘"
}
```
<!-- RT-ROLES-RULES-END -->

## 流程

1. 读当前 roles.json（不存在则展示默认四角色）。
2. `--edit`/`--reset`：生成目标内容 diff，等用户确认后落盘。
3. 默认只读展示。

## 输出格式

角色清单（名称/立场/检查清单）→ diff（仅编辑时）→ 待确认提示。
