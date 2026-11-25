---
title: "谁来批准，何时停手？Claude Code 团队的七层代码审查"
description: "一次命令行工具改动让两个智能体忙了一夜：一个挑问题，一个改代码，来回五十多轮，直到作者叫停。Claude Code 团队给自动审查定了两条边界：由改动的风险决定谁来批准，由后续提交改了什么决定还要审什么。"
tags: ["每日调研", "Agent", "代码审查", "工程实践"]
date: "2026-10-26"
---

# 谁来批准，何时停手？Claude Code 团队的七层代码审查

<div class="research-article">

<p class="lead">一次命令行工具改动让两个智能体忙了一夜：一个挑问题，一个改代码，来回五十多轮，直到作者叫停。Claude Code 团队给自动审查定了两条边界：由改动的风险决定谁来批准，由后续提交改了什么决定还要审什么。调整复审规则后，内部合并请求（PR）经过一轮审查和修复就通过的比例从 65% 升到 78%。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 让每一层回答它能验证的问题

<p>假如一行配置把请求送错了地方，类型检查可以通过，构建也可以成功。熟悉这个模块的人却知道，请求被送到哪里才是要紧的事。团队把这类知识写进审查规则：项目通用约定放在简短的 <code>CLAUDE.md</code>，模块负责人在 <code>REVIEW.md</code> 写清什么算失败，并要求审查者指出对应的文件和行号。同一种错误反复被评论时，能用程序判定的就补成自动检查，依赖业务意图的就补进规则，让下一次改动也用得上。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>七层中的第一层发生在 PR 出现之前。作者让 Claude 运行测试或构建，界面改动可以拿截图对照设计稿。作者能看到实际输出，再让一个带着全新上下文的智能体单独读一遍改动。到了 PR 上，第二层才是逐项找错：多个智能体对照改动目的和相关代码找问题，另一组逐条复核，得到足够票数的问题才会变成对应代码行上的评论。把早已存在的缺陷标出来，作者也能分清哪些问题是这次改动引入的。<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>第三层单独做安全审查，第四层由持续集成（CI）运行类型检查、跨平台测试和构建。公开的 Code Review 服务靠读代码形成判断，构建能否成功、测试能否通过，仍要由实际运行给出答案。在团队自己的仓库里，普通审查和安全审查留下的每条发现都要有处置结果：修掉问题，或说明理由并关闭讨论。只要还有一条悬而未决，改动就要等。<sup id="cite-1-4"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

## 把批准绑定到改动，把责任落到人

<p>文档勘误和自动更新器改动，即使出自同一名工程师，也会走不同的审批路径。第五层先由分类器读改动定风险，再由第二个分类器判断这一次是否需要额外一人。按风险可走零人、一人或两人批准的路径，减免人工批准的路径只向仓库信任名单内的作者开放。名单外的作者需要第二个人批准，负责人列出的敏感路径和所有 CI 工作流文件始终要有人看。<sup id="cite-1-5"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>人要判断这件事值不值得做，也要辨认哪些设计会被后续代码照搬。对于智能体写的 PR，发起改动的人承担作者责任，可以计入所需的人工名额。批准只覆盖看过的那次提交。若批准之后智能体又推送了修改，或有人手工解决了合并冲突，系统无法为新内容背书，就要重新取得批准。这样，签字的人能说清自己认可的是哪一版代码、依据的是哪份测试结果。<sup id="cite-1-6"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>第六层处理一个单看 PR 很难回答的问题：两份改动各自通过测试，合在最新主干上还能通过吗？合并队列把待合入的改动叠到主干上重跑检查。新行为通常由功能开关控制，先给员工使用，再依次进入对外的 latest、stable 渠道。第七层处理已经漏过的故障：作者和值班工程师观察异常，可以直接关掉开关，无须等下一次部署。小改动、分批放量和快速撤回，让减少逐行人工阅读有了具体前提。<sup id="cite-1-7"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<figure class="figure" id="fig-lifecycle">
  <picture>
<source media="(max-width: 720px)" srcset="/research/agent-code-review-layers/fig-lifecycle-narrow.svg">
<img loading="lazy" decoding="async" src="/research/agent-code-review-layers/fig-lifecycle-wide.svg" alt="一份改动从本地验证到故障撤回的七层流程示意图（宽屏版）">
</picture>
<figcaption><strong>图 1｜一份改动从本地验证到故障撤回。</strong>三项 PR 检查按职责并列，实线表示从检查到放行的路径，虚线表示合并后的异常观察与撤回触发；依据原文图 A 与图 B 整理。<sup id="cite-1-8"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></figcaption>
</figure>

## 给复审一个停下来的条件

<p>那次五十多轮的 PR 暴露了一个成本差异。人看到无关紧要的意见，几秒钟就能决定略过。写代码的智能体往往会动手修，于是多了一次提交，又触发一轮审查。团队用 <code>git blame</code> 追查反复被指出的代码，约 59% 在首轮审查时就已存在。这个比例描述的是代码何时出现；如果一条意见到第四轮才提出，不能据此认定第三轮的修复制造了一个缺陷。<sup id="cite-1-9"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>团队缩小了复审的任务。头几轮之后只看新增的差异；如果同类错误出现在几处，审查者说清错误的种类，作者一次修完；已经发过的发现不再重复张贴。完成三轮后，审查者会请作者重新考虑整套做法。存量代码另有夜间扫描，旧问题仍有机会被发现，不必等到某个碰巧经过该文件的 PR 才处理。<sup id="cite-1-10"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-convergence" tabindex="0">
  <table class="compact-table">
    <caption id="tbl-convergence">
      表 1｜内部 PR 调整复审规则前后对比
      <span>数据取自原文图 D；该图未列出同期召回率</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">指标</th>
        <th scope="col" class="num">调整前</th>
        <th scope="col" class="num">调整后</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">一轮审查并修复后通过的 PR 占比</th>
        <td class="num">65%</td>
        <td class="num">78%</td>
      </tr>
      <tr>
        <th scope="row">需要至少五轮的 PR 占比</th>
        <td class="num">8.9%</td>
        <td class="num">1.5%</td>
      </tr>
      <tr>
        <th scope="row">每个 PR 通过所需的平均审查轮数</th>
        <td class="num">2.08</td>
        <td class="num">1.32</td>
      </tr>
    </tbody>
  </table>
</div>

<p>平均轮数下降的同时，反复拉锯的 PR 也少了。调整后仍有 PR 走到第五轮，可见第三轮是重新判断方案的时点，并非自动放行。图 D 没有列出同期召回率，把复审变短是否会漏掉真实缺陷，还需要另一组证据。<sup id="cite-1-11"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 用漏过的事故检验下一版审查者

<p>团队留下引发事故的 PR，连同后来为修复故障而追加的提交或回滚，请熟悉代码的工程师确认缺陷及其位置。这些案例每天都让审查者重做一遍。换提示词、工具或模型时，新版本要在整套案例上重新打分。这样，一次事故除了提醒当事人，也留下了一个可以反复检验的问题：如果再遇到当时的改动，新审查者能指出故障所在吗？<sup id="cite-1-12"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>如果评测集里每个案例都有缺陷，审查者多报几条就有机会得高分，误报的代价却看不出来。团队还让审查者读已知干净的 PR，记录哪些建议一旦照做反而会造成损害；线上评论则按人的处置区分为已修复、判断错误、行为符合原意和影响可忽略。后两类即便说中了代码的行为，也可能白白消耗作者一轮工夫。因此团队把真实缺陷的召回放在首位，再看通过要几轮。<sup id="cite-1-13"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>人工时间也要算两笔账。合并前，团队记录每个 PR 要几人批准、等人多久。合并后，再用回滚率和事故率观察省下的时间会不会花在抢修上。九月，Claude Code 仓库合入的 PR 数超过六月的两倍，其中被回滚的比例相对下降超过四成。这是整个仓库同一时期的变化，各项审查措施分别贡献了多少，文中没有拆分。<sup id="cite-1-14"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<div class="callout" data-tone="caution">
  <h3>关键边界</h3>
  <p>同样影响人工名额的，还有风险分错档的代价。原文列出了哪些情况必须有人看，却没有给出高风险改动被错分到低档的频率。到文章发表时，回滚或事故指标恶化也不会自动收紧审批，发现异常仍靠作者和值班工程师。另一个团队若想放宽审批，需要用自己仓库中漏过的缺陷来判断哪些路径还得留人。<sup id="cite-1-15"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
</div>

<details class="supplement">
  <summary>统计口径与产品版本（按需展开）</summary>
  <p>图 D 的比较对象是内部 PR，未披露样本量及前后时间窗。六月至九月的回滚比例以同期 Claude Code 仓库已合并 PR 为分母，单凭相对降幅无法还原回滚次数。每日逾三万次合入统计的是 Anthropic 的 monorepo，与独立的 Claude Code 仓库分开计数。工程文章记述的是 2026 年 10 月的内部流程。11 月 25 日查阅的产品文档说明，Code Review 本身提交审查结果，仓库可另用 Claude Approvals 策略决定是否将结果计入批准。<sup id="cite-1-16"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-2-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Addy Osmani、Morgan Westlee Lunt、Qing Wang，2026-10-15。<cite>How the Claude Code team does code review</cite>（<a href="https://claude.dev/blog/solving-code-review-at-anthropic/" target="_blank" rel="noopener">原文链接</a>）。导言及 <a href="https://claude.dev/blog/solving-code-review-at-anthropic/#the-scarce-resource-human-time-and-attention" target="_blank" rel="noopener">The scarce resource</a> 给出仓库指标；<a href="https://claude.dev/blog/solving-code-review-at-anthropic/#the-life-of-a-change" target="_blank" rel="noopener">图 A</a> 与 <a href="https://claude.dev/blog/solving-code-review-at-anthropic/#layer-by-layer" target="_blank" rel="noopener">Layer by layer</a> 第 1–7 层说明检查与批准；<a href="https://claude.dev/blog/solving-code-review-at-anthropic/#how-we-make-the-reviewer-better" target="_blank" rel="noopener">How we make the reviewer better</a> 的图 C、D 分别给出事故评测及复审前后对照。
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Claude Code 官方文档，<cite>Code Review</cite>（<a href="https://code.claude.com/docs/en/code-review" target="_blank" rel="noopener">官方文档</a>）。页首说明审查结果与批准策略的关系，<a href="https://code.claude.com/docs/en/code-review#how-reviews-work" target="_blank" rel="noopener">How reviews work</a> 与其下的 What a review can access 说明静态审查的步骤与访问边界。
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
