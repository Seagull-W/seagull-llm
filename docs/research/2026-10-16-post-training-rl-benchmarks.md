---
title: "后训练基准里的「成功率」，究竟算的是什么？"
description: "在 τ-bench 的零售任务里，使用函数调用的 GPT-4o 单次成功率为 61.2%。把要求改成同一任务独立办理八次、八次都成功，成绩就落到 25% 以下。"
tags: ["每日调研", "后训练", "强化学习", "评测"]
date: "2026-10-16"
---

# 后训练基准里的「成功率」，究竟算的是什么？

<div class="research-article">

<p class="lead">在 τ-bench 的零售任务里，使用函数调用的 GPT-4o 单次成功率为 61.2%。把要求改成同一任务独立办理八次、八次都成功，成绩就落到 25% 以下。读一个后训练分数，要先弄清模型拿到什么、评分器检查什么、几次作答合算一分，再看这份反馈有没有参与训练或挑选答案。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 答错也能拿到训练奖励

<p>
  做一件长袍要用两卷蓝布，白布的用量是蓝布的一半，一共要用几卷布？GSM8K 测试集把题目和参考解答存在同一条记录里。作答时给模型的是题目，参考解答里的两步算式和末行 <code>#### 3</code> 留给评测端。官方示例程序从回答中找出第一个符合标记格式的数值，去掉逗号，再和参考答案抽出的字符串比较。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>
<p>
  假如回答把白布算成两卷，末行却写了 <code>#### 3</code>，程序照样给分。另一份回答写清「白布一卷加蓝布两卷，共三卷」，却会因缺少标记而失分。两份回答的得分都只取决于抽出的答案，中间的算式没有参与判定。<sup id="cite-2b"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>
</p>
<p>
  把数学题用于强化学习，还要决定模型答到什么程度就值得鼓励。ReFT 先让模型学习示范解法，再让它对训练问题反复生成解答，用参考答案计算奖励、更新参数。对全是数值答案的任务，论文把末步奖励分成三档：答对得 1，能抽出数值但答错得 0.1，抽不出得 0。仅仅把原本无法解析的错答改成可解析的错答，训练奖励就能增加，答对的题数仍然相同。<sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup>
</p>
<p>
  论文还记录了这种差别怎样影响学习。在一道 MathQA 选择题里，模型把 18 与 22 乘积的一半算成 172，最后却选中了正确选项 C。这条解答拿到了与完整答对一样的答案奖励，模型得不到关于那一步乘除出错的反馈。若要证明推导也有改善，就需要能辨别中间步骤的证据。<sup id="cite-3b"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup>
</p>

## 同样四次作答，可以算出三种成绩

<p>
  DAPO 用约一万七千道整数答案题训练模型，在 AIME 2024 上把整套评测重复了 32 轮。作者用 <code>avg@32</code> 报告这场考试的成绩，每次答对都计入，每次答错也都留在分母里。论文表 1 从基础 GRPO 配置的 30 分升到完整 DAPO 的 50 分，列的是逐项累加改动后的成绩。可以把这二十分归到整套训练配方上，要算其中某一项的贡献还得看对应的对照。<sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup>
</p>
<p>
  换一个汇总规则，同一批记录就能回答另一种问题。下表固定一道题和同样四次独立作答，假设记录依次为「对、错、对、对」。最后一列是这组示例的实际记分，整套基准还要在题目之间求平均。<sup id="cite-1b"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-4b"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup><sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜同一组四次作答的三种汇总方式
      <span>假设同一道题四次独立作答依次为「对、错、对、对」；整套基准还需在题目之间求平均。</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">汇总规则</th>
        <th scope="col">同一道题怎样计分</th>
        <th scope="col">这四次的得分</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">平均正确率 <code>avg@4</code></th>
        <td>四次作答各计一次</td>
        <td>3/4</td>
      </tr>
      <tr>
        <th scope="row">候选覆盖率 <code>pass@4</code></th>
        <td>至少有一个通过就算成功</td>
        <td>1</td>
      </tr>
      <tr>
        <th scope="row">重复成功率 <code>pass^4</code></th>
        <td>四次全部通过才算成功</td>
        <td>0</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>
  HumanEval 用测试检查生成的函数，<code>pass@k</code> 衡量给定数量的候选里有没有过关的实现。交付给用户时如果只能返回一份代码，系统还得能从候选里挑中它。对客服来说，下一个顾客带着相同要求来，还能不能办成？τ-bench 的每轮试验都从相同任务设定重新开始，模拟用户可以换一种说法，客服也可以走另一条工具调用路径。一次办砸，就足以让这组运行失去「全部成功」的一分。<sup id="cite-1c"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-5b"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup>
</p>

## 评分器为何会放过违规退货，也会拒绝有效补丁

<p>
  τ-bench 有位顾客想退水瓶，也想把宠物床和办公椅换成最便宜的款式。如果只能办一件，她希望知道两种办法各省多少钱，再办省得更多的那件。完整意图给模拟顾客，客服拿到业务规则和工具接口，要在对话中问清要求。评分器则知道目标订单状态，还会检查客服回复是否包含两笔金额 54.04 和 41.64。这里，问过哪些问题、按什么顺序查价，都可以因人而异。<sup id="cite-1d"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>
<p>
  业务规则还要求客服在办理退货前得到顾客的明确确认。作者指出，客服即使跳过确认，也可能让订单状态和回复金额同时达标。事后查看数据库，两条路径留下的结果可以完全一样。要查出这类错误，还得把对话和操作记录放在一起，核对顾客的确认是否发生在提交退货之前。<sup id="cite-1e"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
</p>

<figure class="figure" id="fig-tau-return">
  <svg class="flow-wide" viewBox="0 0 920 335" role="img" aria-labelledby="fig-tau-title-wide">
    <title id="fig-tau-title-wide">同一笔退货，两条路径都可能得满分</title>

    <text x="220" y="26" text-anchor="middle" data-kind="label">对话与操作</text>
    <text x="636" y="26" text-anchor="middle" data-kind="label">评分器读取</text>
    <text x="828" y="26" text-anchor="middle" data-kind="label">记分</text>

    <!-- 连接线 -->
    <path d="M124 152 H140 V82 H152" />
    <path d="M292 82 H316" />
    <path d="M124 182 H140 V252 H152" />
    <path d="M292 252 H316" />
    <path d="M422 82 H444 V252 H422" />
    <path d="M444 167 H546" />
    <path d="M546 167 V98 H564" />
    <path d="M546 167 V236 H564" />
    <path d="M704 98 H773 V115" />
    <path d="M704 236 H773 V219" />
    <path d="M828 167 H842" />

    <!-- 箭头 -->
    <polygon class="arrow-head" points="156,82 148,77 148,87" />
    <polygon class="arrow-head" points="320,82 312,77 312,87" />
    <polygon class="arrow-head" points="156,252 148,247 148,257" />
    <polygon class="arrow-head" points="320,252 312,247 312,257" />
    <polygon class="arrow-head" points="568,98 560,93 560,103" />
    <polygon class="arrow-head" points="568,236 560,231 560,241" />
    <polygon class="arrow-head" points="773,119 768,111 778,111" />
    <polygon class="arrow-head" points="773,215 768,223 778,223" />
    <polygon class="arrow-head" points="846,167 838,162 838,172" />

    <!-- 节点 -->
    <rect x="16" y="135" width="108" height="64" rx="8" />
    <rect x="156" y="50" width="136" height="64" rx="8" />
    <rect x="320" y="50" width="102" height="64" rx="8" />
    <rect x="156" y="220" width="136" height="64" rx="8" data-tone="caution" />
    <rect x="320" y="220" width="102" height="64" rx="8" />

    <!-- 汇合标注不透明底色遮线 -->
    <rect x="448" y="142" width="94" height="48" rx="4" data-kind="mask" />

    <rect x="568" y="66" width="136" height="64" rx="8" data-tone="training" />
    <rect x="568" y="204" width="136" height="64" rx="8" data-tone="training" />

    <polygon points="773,119 828,167 773,215 718,167" />
    <rect x="846" y="135" width="64" height="64" rx="8" data-tone="score" />

    <!-- 文字 -->
    <g text-anchor="middle">
      <text x="70" y="162">顾客说明</text>
      <text x="70" y="184">诉求</text>

      <text x="224" y="77">列明操作，</text>
      <text x="224" y="99">得到确认</text>
      <text x="371" y="88">提交退货</text>

      <text x="224" y="258">跳过确认</text>
      <text x="224" y="308" data-kind="caution">违反退货政策</text>
      <text x="371" y="258">提交退货</text>

      <text x="495" y="161" data-kind="small">两条路径均可</text>
      <text x="495" y="181" data-kind="small">得到以下结果</text>

      <text x="636" y="93">数据库终态</text>
      <text x="636" y="115">吻合</text>
      <text x="636" y="231">回复含 54.04</text>
      <text x="636" y="253">和 41.64</text>

      <text x="773" y="162">两项均</text>
      <text x="773" y="184">满足</text>

      <text x="878" y="162">本题得</text>
      <text x="878" y="184">1 分</text>
    </g>
  </svg>

  <svg class="flow-narrow" viewBox="0 0 360 708" role="img" aria-labelledby="fig-tau-title-narrow">
    <title id="fig-tau-title-narrow">同一笔退货，两条路径都可能得满分</title>

    <text x="180" y="22" text-anchor="middle" data-kind="label">对话与操作</text>

    <!-- 连接线 -->
    <path d="M180 88 V108 H92 V122" />
    <path d="M180 108 H268 V122" />
    <path d="M92 184 V228" />
    <path d="M268 184 V228" />
    <path d="M92 280 V308 H268 V280" />
    <path d="M180 308 V366" />
    <path d="M180 366 H92 V410" />
    <path d="M180 366 H268 V410" />
    <path d="M92 472 V558 H114" />
    <path d="M268 472 V558 H246" />
    <path d="M180 602 V632" />

    <!-- 箭头 -->
    <polygon class="arrow-head" points="92,126 87,118 97,118" />
    <polygon class="arrow-head" points="268,126 263,118 273,118" />
    <polygon class="arrow-head" points="92,232 87,224 97,224" />
    <polygon class="arrow-head" points="268,232 263,224 273,224" />
    <polygon class="arrow-head" points="92,414 87,406 97,406" />
    <polygon class="arrow-head" points="268,414 263,406 273,406" />
    <polygon class="arrow-head" points="118,558 110,553 110,563" />
    <polygon class="arrow-head" points="242,558 250,553 250,563" />
    <polygon class="arrow-head" points="180,636 175,628 185,628" />

    <!-- 节点 -->
    <rect x="100" y="36" width="160" height="52" rx="8" />
    <rect x="18" y="126" width="148" height="58" rx="8" />
    <rect x="194" y="126" width="148" height="58" rx="8" data-tone="caution" />
    <rect x="28" y="232" width="128" height="48" rx="8" />
    <rect x="204" y="232" width="128" height="48" rx="8" />

    <!-- 穿线文字不透明底色 -->
    <rect x="210" y="194" width="116" height="22" rx="4" data-kind="mask" />
    <rect x="74" y="322" width="212" height="26" rx="4" data-kind="mask" />

    <text x="180" y="396" text-anchor="middle" data-kind="label">评分器读取</text>
    <rect x="18" y="414" width="148" height="58" rx="8" data-tone="training" />
    <rect x="194" y="414" width="148" height="58" rx="8" data-tone="training" />

    <text x="48" y="564" text-anchor="middle" data-kind="label">记分</text>
    <polygon points="180,514 242,558 180,602 118,558" />
    <rect x="108" y="636" width="144" height="52" rx="8" data-tone="score" />

    <!-- 文字 -->
    <g text-anchor="middle">
      <text x="180" y="68">顾客说明诉求</text>

      <text x="92" y="149">列明操作，</text>
      <text x="92" y="171">得到确认</text>
      <text x="268" y="161">跳过确认</text>
      <text x="268" y="210" data-kind="caution">违反退货政策</text>

      <text x="92" y="262">提交退货</text>
      <text x="268" y="262">提交退货</text>

      <text x="180" y="340" data-kind="small">两条路径均可得到以下结果</text>

      <text x="92" y="437">数据库终态</text>
      <text x="92" y="459">吻合</text>
      <text x="268" y="437">回复含 54.04</text>
      <text x="268" y="459">和 41.64</text>

      <text x="180" y="552">两项均</text>
      <text x="180" y="574">满足</text>

      <text x="180" y="668">本题得 1 分</text>
    </g>
  </svg>

  <figcaption>
    <strong>图 1｜同一笔退货，两条路径都可能得满分。</strong>订单记录和两笔金额都能核对。区分这两次服务还需要操作前的确认记录。依据 τ-bench v1 图 2 及 §3 反例。<sup id="cite-1h"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>
  </figcaption>
</figure>

<p>
  自动测试也可能走向另一个极端。SWE-bench 要求模型根据 issue 和修复前的仓库交出补丁，让故障测试转绿，并让指定的回归测试继续通过。一个 pylint 任务要求制图工具在属性默认值为 <code>None</code> 时也能显示类型注解。测试却直接导入参考补丁新增的 <code>get_annotation</code>。工程师完全可以用别的函数名实现同样的显示效果，但测试会在导入时就中止，甚至还没运行到检查图形输出的那一步。<sup id="cite-6"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup>
</p>
<p>
  这类失分影响了多少题，要看复查时怎么抽题。OpenAI 从 Verified 的 500 题里挑出 o3 在 64 次独立运行中未能稳定解决的 138 题。工程师在其中 59.4% 的题上发现测试设计或题面存在实质问题。这个比例描述的是被挑出来复查的难例。若把这两类任务的判分用于训练，未经确认的退货可能得到满分，换个函数名的可行修复却会失去奖励。要纠正两种信号，就得分别检查通过的对话和被拒的补丁。<sup id="cite-1f"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-6b"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup>
</p>

## 78.2% 的数学题是谁做对的？

<p>
  《Let’s Verify Step by Step》给每道评测题生成 1,860 份候选解，再用过程奖励模型逐步打分，按整份解答的得分选出一份，最后才核对它的答案。用论文采用的评分方式，入选解答的答案正确率为 78.2%。生成器要先写出答案正确的解，选择器还要把这样的解排到首位。作者在同一批候选上比较了逐步评分、只为最终结果评分和多数投票。三者之中，逐步评分挑中正确答案的比例最高。<sup id="cite-7"><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup>
</p>
<p>
  连「评测题」的含义也取决于训练时的选择。作者把原 MATH 测试集中的 4,500 题并入训练，只对随机留下的 500 题报告上述成绩。如果拿同一套模型重跑原测试集，分母中就混进了明确用于训练的问题。即便没有主动改过切分，公开题目也可能进入训练语料。SWE-bench 复查发现，受测模型能复现部分任务的人工补丁或题面细节。遇到限制函数名的测试，见过补丁的模型可能恰好掌握了解题者从题面无从获知的信息。<sup id="cite-6c"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup><sup id="cite-7b"><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup>
</p>
<p>
  引用这个 78.2% 时，「在留出的 500 题上，每题从 1,860 份候选里选一份」是成绩的一部分。它说明一套生成器和选择器配合起来，多大概率能交回正确答案。若进一步主张把同一个评分器接入强化学习也能取得相同收益，还要观察生成器在反复追求这份奖励、开始写出不同解答之后，独立判分的正确率怎样变化。<sup id="cite-7c"><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup>
</p>

<details class="supplement">
  <summary>补充口径｜重复运行与留出集</summary>
  <p>
    τ-bench 数字取自 v1 的零售域与函数调用配置。若一道题每次成功的概率固定为 <i>p</i>，且各次独立，则至少成功一次的概率为 <code>1 − (1 − p)^k</code>，全部成功为 <code>p^k</code>。不同题各有自己的 <i>p</i>，应先逐题计算再求平均。MATH 的 500 题相对于该研究的训练切分留出，论文 §6.3 另行讨论了预训练语料可能含有题目改写的情况。<sup id="cite-1g"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup><sup id="cite-7d"><a href="#ref-7" aria-label="参考文献 7">[7]</a></sup>
  </p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Yao 等，<cite>τ-bench</cite> v1。§3 图 2 及 Reward、Pass^k 两段给出退货实例、判分与重复试验定义，§5.1 的表 2 和图 4 给出零售结果。
    <a href="https://arxiv.org/html/2406.12045v1#S3.F2" target="_blank" rel="noopener">任务与奖励</a> ·
    <a href="https://arxiv.org/html/2406.12045v1#S5.T2" target="_blank" rel="noopener">单次成绩</a> ·
    <a href="https://arxiv.org/html/2406.12045v1#S5.F4" target="_blank" rel="noopener">重复成功曲线</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用 1">↩</a>
  </li>
  <li id="ref-2">
    OpenAI，<cite>GSM8K</cite>。测试集第 2 条为长袍用料题，评分程序见 <code>ANS_RE</code>、<code>extract_answer</code>、<code>is_correct</code>。
    <a href="https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/test.jsonl" target="_blank" rel="noopener">原始测试记录</a> ·
    <a href="https://github.com/openai/grade-school-math/blob/master/grade_school_math/dataset.py" target="_blank" rel="noopener">评分源码</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用 2">↩</a>
  </li>
  <li id="ref-3">
    Luong 等，<cite>ReFT</cite> v3。§3.1 的 Warm-up 和 Reinforcement Learning 给出训练流程与末步奖励，§4.4 图 3 展示 MathQA 错算后选中 C 的实录。
    <a href="https://arxiv.org/html/2401.08967v3#S3.SS1" target="_blank" rel="noopener">训练方法</a> ·
    <a href="https://arxiv.org/html/2401.08967v3#S4.F3" target="_blank" rel="noopener">原始案例</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用 3">↩</a>
  </li>
  <li id="ref-4">
    Yu 等，<cite>DAPO</cite> v2。§3.5 给出整数答案训练集，§4.1 末段定义 <code>avg@32</code>，§4.2 表 1 按累积改动报告成绩。
    <a href="https://arxiv.org/html/2503.14476v2#S3.SS5" target="_blank" rel="noopener">训练题</a> ·
    <a href="https://arxiv.org/html/2503.14476v2#S4.SS1" target="_blank" rel="noopener">评测协议</a> ·
    <a href="https://arxiv.org/html/2503.14476v2#S4.T1" target="_blank" rel="noopener">表 1</a>
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用 4">↩</a>
  </li>
  <li id="ref-5">
    OpenAI，<cite>HumanEval</cite>。固定提交 <code>6d43fb9</code> 中，<code>evaluate_functional_correctness</code> 检查候选代码，<code>estimate_pass_at_k</code> 逐题估算至少一次通过的概率。
    <a href="https://github.com/openai/human-eval/blob/6d43fb980f9fee3c892a914eda09951f772ad10d/human_eval/evaluation.py" target="_blank" rel="noopener">评测实现</a>
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用 5">↩</a>
  </li>
  <li id="ref-6">
    OpenAI，2026 年 2 月 23 日 <cite>SWE-bench Verified 复查</cite>。Background 说明仓库与两类测试，Too narrow and too wide tests 给出抽样范围、缺陷比例及 pylint 实例，Contamination 列出复现证据。
    <a href="https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/" target="_blank" rel="noopener">复查原文</a>
    <a class="reference-backlink" href="#cite-6" aria-label="返回正文引用 6">↩</a>
  </li>
  <li id="ref-7">
    Lightman 等，<cite>Let’s Verify Step by Step</cite> v1。§3 图 3 比较固定候选上的选择方法，附录 C 说明留出集，附录 F.2 表 4 给出 78.2%，§6.3 讨论训练暴露。
    <a href="https://arxiv.org/html/2305.20050v1#S3.F3" target="_blank" rel="noopener">候选选择</a> ·
    <a href="https://arxiv.org/html/2305.20050v1#A3" target="_blank" rel="noopener">切分</a> ·
    <a href="https://arxiv.org/html/2305.20050v1#A6.T4" target="_blank" rel="noopener">计分结果</a> ·
    <a href="https://arxiv.org/html/2305.20050v1#S6.SS3" target="_blank" rel="noopener">语料重叠</a>
    <a class="reference-backlink" href="#cite-7" aria-label="返回正文引用 7">↩</a>
  </li>
</ol>

</div>
