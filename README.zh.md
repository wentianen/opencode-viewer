# OpenCode Activity Viewer

在浏览器里查看本地 OpenCode 活动。

<!-- README-I18N:START -->

[English](./README.md) | **中文**

<!-- README-I18N:END -->

## 安装与使用

推荐通过 `opencode.json` 加载 npm 插件：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@wentianen/opencode-viewer"]
}
```

把配置写到以下任一位置：

- `~/.config/opencode/opencode.json`
- 项目根目录的 `opencode.json`

OpenCode 启动时会自动安装插件，并将依赖缓存到 `~/.cache/opencode/node_modules/`。
如果你更偏好本地插件文件，也可以放到 `.opencode/plugins/` 或 `~/.config/opencode/plugins/`。

正常启动 OpenCode 即可。插件初始化后会自动探测并尝试拉起本地 Viewer service。

当前已接入的事件：`session.*`、`message.updated`、`message.part.updated`、`message.part.removed`、`tool.execute.before`、`tool.execute.after`、`chat.message`。

## 开发与发布

```bash
npm test
npm run build
```

发布到 npm 前，先确认测试和构建通过，再执行：

```bash
npm publish
```
