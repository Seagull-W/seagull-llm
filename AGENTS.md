# 仓库工作指导

## 新增、导入或发布 docs 内容

执行前阅读 [新增内容.md](./新增内容.md)，按其中的发布流程完成整套接入；只新增 Markdown 文件不算完成。

- 公开文章必须同步登记 `docs/.vitepress/sidebar.ts` 和对应栏目首页的 `ChapterCards` 卡片，保持标题、摘要和路由一致。用户明确要求展示的文章应补齐入口，不能仅因原先未登记侧边栏就将其当作隐藏内容。
- 每篇文章设置准确的 `title`、`description` 和主题 `tags`。运行 `npm run tags` 自动补充缺失标签后，检查并修正标签；脚本不会覆盖已有标签。
- 标签索引由 `docs/.vitepress/data/tagged-pages.data.mts` 自动生成，公开范围由 `docs/.vitepress/public-content.ts` 根据侧边栏和发布状态判断。不要为了让单篇文章显示而取消公开范围过滤。
- 草稿、隐藏内容和网站维护文档不得进入公开章节卡片或标签索引；为这些页面设置 `search: false`，需要禁止搜索引擎索引时同时设置 robots `noindex`。不要把 `sidebar: false` 当作隐藏内容标记。
- 新增栏目还需登记顶栏导航、侧边栏路径前缀，并补充 `scripts/generate-content-tags.mjs` 的栏目标签映射；详见流程规范。
- 验证目录卡片、侧边栏、文章标签跳转、标签筛选和站内搜索，确认公开内容可找到、内部内容不可找到。运行 `node scripts/test-public-content.mjs` 和 `npm run build`；涉及公式时再运行 `node scripts/test-markdown-math.mjs`。

正文写作遵循对应栏目的规范；LLM 科普书新版内容优先依据 [LLM_BOOK_PLAN.md](./LLM_BOOK_PLAN.md)。
