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
  "plugin": ["opencode-activity-viewer"]
}
```

你可以把这段写到：

- `~/.config/opencode/opencode.json`
- 或项目根的 `opencode.json`

按官方文档，npm 插件会在启动时由 OpenCode 自动安装，依赖会缓存到 `~/.cache/opencode/node_modules/`

### 本地文件方式：开发态直接引用当前源码

如果你当前是在本地开发、还没有发布 npm 包，可以直接写一个本地插件文件指向当前源码：

```ts
// ~/.config/opencode/plugins/opencode-activity-viewer.ts
export { ActivityViewerPlugin } from "file:///Users/jingjingchang/Documents/workspace/my/opencode-viewer/src/plugin/index.ts"
```

### 启动方式

安装到 OpenCode 后，正常启动 OpenCode 即可。插件初始化时会自动探测并尝试拉起本地 Viewer service。

### 发布到 npm

如果你准备把这个插件作为 npm 包给其他人使用，建议按下面的顺序：

```bash
npm test
npm run build
npm publish
```

发布时真正对外消费的入口是：

- `dist/index.js`

其中：

- OpenCode 通过 `plugin: ["opencode-activity-viewer"]` 加载的主入口是插件产物
- Viewer service 启动逻辑已经内嵌进 `ActivityViewerPlugin`
- `dist/web/` 是随包一起分发的附属静态资源，供本地 service 托管

## 当前状态

当前仓库已经实现以下能力：

- 共享数据契约、脱敏和 token 归一化
- OpenCode 插件映射与本地 `jsonl` 安全落盘
- session tree 聚合、subtree token/cost 汇总
- 本地 service 提供 `overview`、`sessions`、`records`、`stream` API
- 本地 service 托管浏览器 Viewer 静态页面
- 浏览器端三栏 UI，支持 overview、session tree、timeline、detail
- 插件初始化时自动探测并拉起本地 service

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
