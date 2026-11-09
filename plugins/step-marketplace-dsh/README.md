# step-marketplace-dsh — DSH 插件生态桥

元项目：收录 DeepSeek Harness（DSH）生态主流插件，逐条标注在 Step Code 下的可移植性与移植状态。与 step-marketplace-cc 同构——`catalog.json` 即交付物，本插件无 step.plugin.json、不进市场清单。

## 它解决什么

dsh 生态（cordis bundle 形态）与 Step Code（声明式 step.plugin.json）加载器不通用。本目录把「哪些功能已在 Step Code 落地、哪些不可移植」变成一张可回溯的表：upstream、锁定版本、移植位置、规则级判定依据。

## 使用

| 入口 | 说明 |
| --- | --- |
| `catalog.json` | 收录目录：name / upstream / lockedVersion / category / compat / port / note |
| compat 语义 | `ported` = 已在本仓库落地同功能声明式移植；`not-portable` = 依赖 dsh 宿主 UI/加载器/扩展机制；`unported` = 可移植但尚未移植（备排期） |

## 安装

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
```

本插件为元项目（收录目录），无需 `/plugin install`；移植清单见[发布说明](../../docs/releases/dsh-ports-v1.0.0.md)与[第二批发布说明](../../docs/releases/dsh-ports2-v1.0.0.md)。

## 验证

```bash
node tests/validate.mjs
```

## 边界与限制

- compat 为规则级判定（依据 C1/C2 插件形态约束），非真机实测；未实测项一律标注待实测。
- 版本以 2026-11-09 本地安装包核对；dsh 生态迭代快，用 lockedVersion 对冲。
- 收录不构成对上游项目的背书；各项目许可以其仓库为准。

## 许可证

[AGPL-3.0-only](../../LICENSE)
