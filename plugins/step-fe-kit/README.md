# step-fe-kit

前端开发套件（纯声明式）：dev server 管理、视觉验证、一键发布。编排**内置** playwright/steppage 插件，零自有后端。

## 命令

| 命令 | 说明 |
| --- | --- |
| `/dev` | 框架检测（vite/next/webpack）→ 后台启动 → 就绪确认 → 端口占用处理 → 热重载确认 → 停止 |
| `/publish` | 构建 + 调内置 steppage 发布，预览链接回贴终端；未安装时给出 /plugin install 指引 |

## 视觉验证（skill `fe-visual`，v1.1.0+）

改版前后截图对比、浏览器控制台错误采集、指定 selector 组件级截图、375/768/1440 多视口批量检查。

## 安装与验证

```bash
/plugin marketplace add Neriah-Ado/stepcode-plugins
/plugin install step-fe-kit
node tests/validate.mjs
```

## License

MIT
