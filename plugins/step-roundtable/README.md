# step-roundtable — 多专家圆桌评审

纯声明式插件：组建专家团对议题做独立评审，首轮意见互相隔离防锚定，汇聚后把分歧交用户拍板。移植自 dsh 生态 [dsh-plugin-roundtable](https://github.com/9931666/dsh-plugin-roundtable)（★15）。

## 它解决什么

单一视角的方案评审容易自我确认。圆桌让不同立场（安全/性能/维护性/用户）先独立表态再对撞，把分歧显式化交给决策者，而不是让模型替用户和稀泥。

## 使用

| 命令 | 说明 |
| --- | --- |
| `/roundtable <议题> [--roles 3]` | 专家独立评审 → 汇聚共识/分歧 → 分歧清单交用户拍板 |
| `/rt-roles [--edit]` | 查看/维护角色模板（`.stepcode/roundtable/roles.json`，写盘先 diff） |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-roundtable
```

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- dsh 版的持久子代理/跨厂商续聊降级为**单会话多视角推演**（声明式形态边界，如实声明）：独立性弱于真子代理，重要决策建议开多个会话交叉验证。
- 拓扑可视化不移植。
- 首轮意见互不可见；分歧必须交用户拍板，插件不自动合并结论；角色 ≤6、专家意见 ≤8 行硬上限，输出末尾附审计节；拍板结论可经确认沉淀到 step-engram 记忆条目（未安装则跳过并说明）。
- 角色模板写盘先 diff 后确认（G3）。

## 许可证

[AGPL-3.0-only](../../LICENSE)
