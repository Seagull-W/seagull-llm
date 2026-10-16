# 仓库工作指导

## 信息检索与调研

使用 [seagull-research skill](.agents/skills/seagull-research/SKILL.md)：先分清文献整理、领域知识汇报、概念解释、比较/选型、对象介绍与近期动态，再按交付目的检索和归纳。默认直接交付 Markdown，脚本流水线按需使用；机械检查不代替实际读成稿。

使用新增学术技能前，读 [Hermes/Codex 共用约定](hermes/README.md) 中的“技能与分工”和“本项目对上游规则的适配”。这些项目约定同样适用于 Codex 独立执行：scholar-deep-research 用于多文献检索，scientific-writing 用于有证据的学术写作，unslop-academic-writing 用于初稿修订；不强制三者串行、不恢复以代码评分验收内容的流程。

## 知乎 CLI

官方 `zhihu` skill 安装在用户级 `~/.codex/skills/zhihu/`。当前环境的系统凭证库不可用，使用 `python3 scripts/zhihu-cli.py <命令与参数>` 调用已安装的官方 CLI；该入口仅从仓库已有 `.env` 向 CLI 子进程注入 `ZHIHU_ACCESS_SECRET`，不另存密钥、不修改 PATH。已有非空进程环境变量优先。不要输出 `.env` 或凭证。开始使用时先阅读官方 skill，按其能力边界选择命令。

## 新增、导入或发布 docs 内容

执行前阅读 [新增内容.md](./新增内容.md)，按其中的发布流程完成整套接入；只新增 Markdown 文件不算完成。

- 每日调研继续使用 Markdown；其他读者页面使用相邻 `.html` 作为正文主文件，`.md` 仅保留元数据和 HTML include。格式遵循 [HTML_FORMATS.md](./HTML_FORMATS.md)，禁止用 iframe 或运行时 HTML 注入包装文章。栏目卡片在 `index.html` 维护。

- 公开文章必须同步登记 `docs/.vitepress/sidebar.ts` 和对应栏目首页的 `ChapterCards` 卡片，保持标题、摘要和路由一致。用户明确要求展示的文章应补齐入口，不能仅因原先未登记侧边栏就将其当作隐藏内容。
- 每篇文章设置准确的 `title`、`description` 和主题 `tags`。运行 `npm run tags` 自动补充缺失标签后，检查并修正标签；脚本不会覆盖已有标签。
- 标签索引由 `docs/.vitepress/data/tagged-pages.data.mts` 自动生成，公开范围由 `docs/.vitepress/public-content.ts` 根据侧边栏和发布状态判断。不要为了让单篇文章显示而取消公开范围过滤。
- 草稿、隐藏内容和网站维护文档不得进入公开章节卡片或标签索引；为这些页面设置 `search: false`，需要禁止搜索引擎索引时同时设置 robots `noindex`。不要把 `sidebar: false` 当作隐藏内容标记。
- 新增栏目还需登记顶栏导航、侧边栏路径前缀，并补充 `scripts/generate-content-tags.mjs` 的栏目标签映射；详见流程规范。
- 验证目录卡片、侧边栏、文章标签跳转、标签筛选和站内搜索，确认公开内容可找到、内部内容不可找到。运行 `node scripts/test-public-content.mjs` 和 `npm run build`；涉及公式时再运行 `node scripts/test-markdown-math.mjs`。

正文写作遵循对应栏目的规范；LLM 科普书新版内容优先依据 [LLM_BOOK_PLAN.md](./LLM_BOOK_PLAN.md)。

## 工作目录与 Hermes

当前目录就是完整 Git 仓库，命令在此执行。Hermes 入口见 [hermes/README.md](hermes/README.md)。`archive/` 保存历史快照与运行资料，不作为当前源码或指令入口。
