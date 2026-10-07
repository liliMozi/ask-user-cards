# 交付验证

验证日期：2026-10-07。

## 已通过

- Hana 原生 `validateRecipeTemplateDirectory`：`assets/ask-user.card.html` 通过（sha256 `4ae89270405bd2a75a31afad21c0064c7ea39895ebb516664f7b4bbcd745afe8`）。
- 官方打包器 `scripts/extension-pack.mjs --kind recipe`：SKILL.md 投影与打包校验通过，条目与内容寻址 ZIP 生成成功。
- JavaScript / jsdom：7 组行为检查通过。覆盖 standalone 首题渲染与圆点导航、单选作答与翻页保持、standalone 提交降级为复制回答、宿主提交 emit `ask-user-answers` 事件契约（含跳过低标记与 track 上报）、「都交给你决定」全权委托、已提交状态的恢复与摘要展示、作答向 card state 的持久化。
- 在 Hana 宿主中按真实铸卡流程渲染过本模板（默认示例 state），渲染成功。
- 全包源码与文档未发现个人绝对路径、私人仓库名、会话 ID 或凭据。

## 已知边界

- 宿主 emit / state / track 能力用受控 mock 验证；未在真实会话里完成一次端到端提交回路。
- standalone 复制降级在 jsdom 中验证；未做自动化浏览器截图验收。
- 卡片的视觉细节（字距、动画、深浅色）以模板内联样式为准，未逐像素核对。

## 重跑

在提供 jsdom 的 Node 24.15.0（或兼容 Node 24）环境中：

```sh
npm ci --ignore-scripts
npm test
```

模板校验（需要 Hana 源码仓库）：

```sh
node -e "import('<hana>/lib/recipes/recipe-template-validation.ts').then(m => console.log(m.validateRecipeTemplateDirectory('.')))"
```
