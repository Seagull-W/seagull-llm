<p align="center">
  <a href="https://seagull-llm.pages.dev/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/public/images/home/closing/paper-tide-night.webp">
      <img src="docs/public/images/home/closing/paper-tide-day.webp" width="900" alt="纸海鸥飞过灯塔与海浪，浪间摊开一本书">
    </picture>
  </a>
</p>

<h1 align="center">Seagull 的学习主页</h1>

<p align="center">我在这里记录大模型与强化学习的课程实验、读论文时留下的批注，以及值得单独追下去的问题。</p>
<p align="center">
  <strong><a href="https://seagull-llm.pages.dev/">进入网站</a></strong> ·
  <a href="https://seagull-llm.pages.dev/tags">按主题浏览</a> ·
  <a href="https://seagull-llm.pages.dev/research/">阅读每日调研</a>
</p>

## 网站是怎么建的

### 把批注留在原文旁

读网页文章或 PDF 时，我可以选中一句话，也可以框出图表的一部分，写下当时的疑问。公开后，读者点原文里的标记就能展开批注，也能从批注卡片跳回对应段落或图表。网页用选文和上下文定位文字，PDF 用页码和区域坐标定位。批注由 Cloudflare Pages Functions 读写，保存在 D1 数据库中。[批注组件](docs/.vitepress/components/AnnotationNotebook.vue) · [存储与访问接口](server/notes-api.ts)

### 从订阅源到一篇调研

自动调研脚本从 arXiv、Hugging Face Papers、研究博客和开源项目的发布记录中收集新材料，按主题和时间窗口筛选、去重。Codex 根据资料生成带出处的初稿，我读过并反馈后再定稿。脚本可以把定稿加入「每日调研」目录，构建网站并检查发布后的页面。[订阅配置](research/workflow.json) · [调研流程](research/daily.md)

### 把笔记编成网站

VitePress 将 Markdown 和 HTML 正文构建为静态页面，Vue 组件提供 PDF 阅读器和批注面板。想沿着一门课读，可以跟随栏目侧栏；想找同一主题下的课程笔记、论文和调研，可以从标签页进入。网站部署在 Cloudflare Pages。[站点配置](docs/.vitepress/config.mts) · [阅读组件](docs/.vitepress/components/)

## 从哪里开始读

| 感兴趣的方向 | 阅读入口 |
| --- | --- |
| 从零实现大模型，跟着讲义做作业和 GPU 实验 | [Stanford CS336 学习笔记](https://seagull-llm.pages.dev/cs336/) |
| 学习强化学习的数学推导、奖励建模与训练实践 | [西湖强化学习](https://seagull-llm.pages.dev/westlake-rl/) · [强化学习笔记](https://seagull-llm.pages.dev/rl-book/) |
| 对照 R1-Zero 和 R1 的训练过程，读懂奖励设计 | [DeepSeek-R1 阅读笔记](https://seagull-llm.pages.dev/papers/deepseek-r1/) · [更多论文与项目](https://seagull-llm.pages.dev/papers/) |
| 理解一次 rollout 的算力花在哪里 | [一条训练样本值多少 token](https://seagull-llm.pages.dev/research/2026-10-28-rollout-compute-economics) |
| 从代码理解并发，从操作系统理解隔离 | [Rust 笔记](https://seagull-llm.pages.dev/rust-notes/) · [Linux 笔记](https://seagull-llm.pages.dev/linux-notes/) |
