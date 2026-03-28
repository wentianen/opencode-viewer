# OpenCode Activity Viewer

本地浏览器版 OpenCode 活动查看器。

## 使用方式

OpenCode 官方文档支持两种插件加载方式：

- 从 `opencode.json` 加载 npm 插件
- 从 `.opencode/plugins/` 或 `~/.config/opencode/plugins/` 加载本地插件文件

### 推荐方式：通过 OpenCode 配置加载 npm 插件

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@wentianen/opencode-viewer"]
}
```

你可以把这段写到：

- `~/.config/opencode/opencode.json`
- 或项目根的 `opencode.json`

按官方文档，npm 插件会在启动时由 OpenCode 自动安装，依赖会缓存到 `~/.cache/opencode/node_modules/`


### 启动方式

安装到 OpenCode 后，正常启动 OpenCode 即可。插件初始化时会自动探测并尝试拉起本地 Viewer service。

### 发布到 npm

如果你准备把这个插件作为 npm 包给其他人使用，建议按下面的顺序：

```bash
npm test
npm run build
npm publish
```

## 当前状态

当前已接入的事件包括：

- `session.*`
- `message.updated`
- `message.part.updated`
- `message.part.removed`
- `tool.execute.before`
- `tool.execute.after`
- `chat.message`

## 本地开发

```bash
npm test
npm run build
```

`npm run build` 的产物结构如下：

- `dist/index.js`
- `dist/web/index.html`
- `dist/web/assets/*`

其中 `index.js` 是主产物，`web/` 是供插件内嵌 service 托管的附属静态资源。
