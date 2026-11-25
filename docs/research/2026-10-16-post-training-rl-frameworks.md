---
title: "一道题怎样更新语言模型？沿训练闭环读懂五个后训练 RL 框架"
description: "同一道数学题，模型答对了，评分器仍可能给零分。即使评分相同，两份写着 GRPO 的配置也可能给长回答不同的权重。"
tags: ["每日调研", "RLHF", "后训练", "GRPO"]
date: "2026-10-16"
---

# 一道题怎样更新语言模型？沿训练闭环读懂五个后训练 RL 框架

<div class="research-article">

<p class="lead">同一道数学题，模型答对了，评分器仍可能给零分。即使评分相同，两份写着 GRPO 的配置也可能给长回答不同的权重。读 TRL、verl、OpenRLHF、slime 和 AReaL，可以沿一条回答追三个问题：它怎样得分，在损失里占多大分量，更新后的权重何时用于下一次作答？</p>

## 一道题怎样产生有方向的更新

<p>在线强化学习让正在训练的语言模型自己生成练习用的回答。题面送给生成侧，对应的标准答案留给评分器。模型按当前策略为同一题抽样生成几份解答，这次采样称为 rollout。评分器逐份比较解答与标准答案，一段判分程序就能提供奖励。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>设一题采出四份回答，两对两错，以答对得 1、答错得 0 计，组内均分为 0.5。GRPO 先从每份奖励中减去同题均分，再按配方决定是否除以标准差。于是两份正确回答得到正优势，两份错误回答得到负优势。如果四份全对，组内均分升到 1，四份回答的相对优势却都变成零。一次训练里，平均得分上升和能提供区分信号的题目减少，可以同时发生。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>这个比较基准决定了训练时要维护哪些模型。PPO 常用价值模型（critic）估计从当前状态继续作答能得到多少回报，再根据实际反馈估算优势。GRPO 借同题的其他回答作参照，省去了单独训练价值模型的工作，代价是要为一道题采出多份回答，而且奖励要能区分它们。<sup id="cite-1b"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>训练器用优势调整生成回答的词元（token）概率。对已经生成的某个词元，给定相同前文，训练器比较更新中的策略与采样策略各自给它的概率。正优势鼓励提高概率，负优势鼓励降低。概率比沿有利方向越过裁剪阈值后，继续调整带来的目标收益受限。采样策略给出了计算概率比的分母。配方若另加 KL 惩罚，还需要一份参考策略，衡量更新中的模型偏离它有多远。<sup id="cite-1c"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<figure class="figure" id="fig-loop">
  <svg class="flow-wide" viewBox="0 0 860 288" role="img" aria-labelledby="fig-loop-wide-title">
    <title id="fig-loop-wide-title">从一道题到下一版策略的训练闭环示意图</title>
    <rect data-role="group" x="12" y="44" width="136" height="172" rx="10" />
    <rect data-role="group" x="176" y="44" width="268" height="92" rx="10" />
    <rect data-role="group" x="472" y="44" width="376" height="92" rx="10" />

    <rect x="28" y="70" width="104" height="46" rx="8" />
    <rect x="28" y="156" width="104" height="46" rx="8" />
    <rect x="192" y="70" width="104" height="46" rx="8" />
    <rect x="324" y="70" width="104" height="46" rx="8" />
    <rect data-tone="highlight" x="488" y="70" width="104" height="46" rx="8" />
    <rect data-tone="training" x="608" y="70" width="104" height="46" rx="8" />
    <rect data-tone="training" x="728" y="70" width="104" height="46" rx="8" />

    <g text-anchor="middle">
      <text data-kind="group-title" x="80" y="62">数据</text>
      <text data-kind="group-title" x="310" y="62">生成与判分</text>
      <text data-kind="group-title" x="660" y="62">训练</text>

      <text x="80" y="99">题面</text>
      <text x="80" y="185">标准答案</text>
      <text x="244" y="99">同题采样</text>
      <text x="376" y="99">逐份评分</text>
      <text x="540" y="99">组内优势</text>
      <text x="660" y="99">策略损失</text>
      <text x="780" y="99">更新权重</text>
    </g>

    <g>
      <path d="M132 93 H190 M183 88 L190 93 L183 98" />
      <path d="M296 93 H322 M315 88 L322 93 L315 98" />
      <path d="M132 179 H376 V118 M371 125 L376 118 L381 125" />
      <path d="M428 93 H486 M479 88 L486 93 L479 98" />
      <path d="M592 93 H606 M599 88 L606 93 L599 98" />
      <path d="M712 93 H726 M719 88 L726 93 L719 98" />
      <path d="M244 70 V20 H660 V68 M655 61 L660 68 L665 61" />
      <path data-tone="feedback" d="M780 116 V256 H244 V118 M239 125 L244 118 L249 125" />
    </g>

    <rect data-role="label-bg" x="372" y="8" width="160" height="24" rx="4" />
    <text data-kind="edge-label" x="452" y="25" text-anchor="middle">回答词元与采样概率</text>

    <rect data-role="label-bg" x="412" y="244" width="200" height="24" rx="4" />
    <text data-kind="edge-label" x="512" y="261" text-anchor="middle">交给生成侧，供后续采样</text>
  </svg>

  <svg class="flow-narrow" viewBox="0 0 340 540" role="img" aria-labelledby="fig-loop-narrow-title">
    <title id="fig-loop-narrow-title">从一道题到下一版策略的训练闭环示意图（窄屏版）</title>
    <rect data-role="group" x="36" y="12" width="292" height="82" rx="10" />
    <rect data-role="group" x="36" y="114" width="292" height="148" rx="10" />
    <rect data-role="group" x="36" y="282" width="292" height="218" rx="10" />

    <rect x="64" y="40" width="112" height="42" rx="8" />
    <rect x="196" y="40" width="112" height="42" rx="8" />
    <rect x="64" y="144" width="112" height="42" rx="8" />
    <rect x="196" y="206" width="112" height="42" rx="8" />
    <rect data-tone="highlight" x="196" y="312" width="112" height="42" rx="8" />
    <rect data-tone="training" x="196" y="376" width="112" height="42" rx="8" />
    <rect data-tone="training" x="196" y="440" width="112" height="42" rx="8" />

    <text data-kind="group-title" x="48" y="31">数据</text>
    <text data-kind="group-title" x="48" y="133">生成与判分</text>
    <text data-kind="group-title" x="48" y="301">训练</text>

    <g text-anchor="middle">
      <text x="120" y="67">题面</text>
      <text x="252" y="67">标准答案</text>
      <text x="120" y="171">同题采样</text>
      <text x="252" y="233">逐份评分</text>
      <text x="252" y="339">组内优势</text>
      <text x="252" y="403">策略损失</text>
      <text x="252" y="467">更新权重</text>
    </g>

    <g>
      <path d="M120 82 V142 M115 135 L120 142 L125 135" />
      <path d="M252 82 V204 M247 197 L252 204 L257 197" />
      <path d="M120 186 V227 H194 M187 222 L194 227 L187 232" />
      <path d="M252 248 V310 M247 303 L252 310 L257 303" />
      <path d="M252 354 V374 M247 367 L252 374 L257 367" />
      <path d="M252 418 V438 M247 431 L252 438 L257 431" />
      <path d="M92 186 V397 H194 M187 392 L194 397 L187 402" />
      <path data-tone="feedback" d="M252 482 V518 H18 V165 H62 M55 160 L62 165 L55 170" />
    </g>

    <rect data-role="label-bg" x="34" y="318" width="144" height="24" rx="4" />
    <text data-kind="edge-label" x="106" y="335" text-anchor="middle">回答词元与采样概率</text>

    <rect data-role="label-bg" x="76" y="506" width="188" height="24" rx="4" />
    <text data-kind="edge-label" x="170" y="523" text-anchor="middle">交给生成侧，供后续采样</text>
  </svg>
  <figcaption><strong>图 1｜从一道题到下一版策略。</strong>虚线框区分数据、生成与判分、训练三段职责；高亮节点「组内优势」把同题得分差转成词元更新方向，加粗回边决定下一批采样使用哪版权重。</figcaption>
</figure>

## 同一个正确答案，五份示例怎样判分

<p>把标准答案固定为 12，模型只输出 <code>\boxed{12}</code>。verl 的 GSM8K 默认严格评分器只在回答最后 300 个字符里寻找最后一个 <code>#### 数字</code>，因此给零分。OpenRLHF 的 ProRL v2 数学示例恰好提取方框里的答案，再与标签判等。若解答统一换了排版，一整组回答都可能丢分，继而失去组内差异。定位这种现象，可以先拿一条已知正确的输出走通评分函数。<sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-4"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜五份数学示例的评分入口与判分口径
      <span>对应各自指定数学示例与默认评分函数</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">框架与数学入口</th>
        <th scope="col">评分器读取的参考值</th>
        <th scope="col">这份示例如何给分</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">TRL · <code>GRPOTrainer</code></th>
        <td><code>solution</code></td>
        <td>解析回答与参考解并判等；参考解无法解析时，此项返回 <code>None</code></td>
      </tr>
      <tr>
        <th scope="row">verl · Qwen3-4B GRPO</th>
        <td><code>reward_model.ground_truth</code></td>
        <td>从回答末尾提取 <code>####</code> 后的数，与参考值比较</td>
      </tr>
      <tr>
        <th scope="row">OpenRLHF · ProRL v2</th>
        <td><code>label</code></td>
        <td>从回答提取 <code>\boxed{…}</code> 中的答案并判等</td>
      </tr>
      <tr>
        <th scope="row">slime · Qwen3-4B</th>
        <td><code>label</code></td>
        <td>先按 <code>&lt;/think&gt;</code> 或 <code>###Response</code> 取作答部分，再抽答案判等；缺少两种标记时给零分</td>
      </tr>
      <tr>
        <th scope="row">AReaL · GSM8K <code>MathAgent</code></th>
        <td><code>answer</code></td>
        <td>工作流将生成的回答与参考解交给数学解析器判等</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">表格可左右滑动查看完整列。</p>

<p>这些入口把任务交给框架的位置也不同。TRL 的 Python 示例把数据集和奖励函数一起传给 Trainer。verl 在预处理中拆出题面和真值，启动 <code>main_ppo</code> 时再显式选用 <code>grpo</code> 优势估计。OpenRLHF 同样从带 <code>ppo</code> 的入口启动，选的却是 <code>reinforce_baseline</code>，并开启动态过滤。确认模型怎样学习，要读启动时生效的优势配置。<sup id="cite-2b"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup><sup id="cite-3b"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup><sup id="cite-4b"><a href="#ref-4" aria-label="参考文献 4">[4]</a></sup></p>
<p>AReaL 把生成调用和判分写在同一个工作流里。表中的单轮示例作答一次就返回分数。同一源文件还给出一个多轮版本：答错时，把上次回答和要求重试的反馈放回对话，让模型接着作答，直到答对或用尽轮次。每轮分数都记在对应的回答编号下。一道题即使共用同一个评分器，也能由工作流组织成一次判分或一串带反馈的尝试。<sup id="cite-6"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></p>

## 哪些题进入更新，长短回答各占多少

<p>从回答到参数更新，中间有两次选择。第一次选题。DAPO 的动态采样以同题的一组回答为单位。在二元正确性奖励下，全对组和全错组都缺少对照，整组移出，再采样补齐有对有错的题组。这样留下的是模型有时能做对的题目，进入训练的题目分布随之改变。被筛掉的回答已经花过生成时间。因此，比较两次训练的开销，除了数送进优化器的题组，还要数生成侧为凑足这些题组一共写了多少词元。<sup id="cite-1d"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>第二次选择发生在已经留下的回答内部。TRL v1.16.0 的 <code>GRPOTrainer</code> 默认用 <code>loss_type="dapo"</code>。显式选 <code>grpo</code> 时，先在每条回答内平均，再对回答平均；选 <code>dapo</code> 时，按全局累积批次中的有效词元总数取平均。假设整个批次只有一短一长两份回答，下表把各自词元的系数加总，就能看出同一批数据会怎样被使用。<sup id="cite-2c"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-2" tabindex="0">
  <table>
    <caption id="tbl-2">
      表 2｜同一批次内不同长度回答的损失权重
      <span>按 TRL 源码分母推算；设整批仅含 10 与 30 个有效词元的两份回答</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">损失汇总方式（同一批次）</th>
        <th scope="col">短回答 · 10 个有效词元</th>
        <th scope="col">长回答 · 30 个有效词元</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row"><code>grpo</code>，每条回答等权</th>
        <td>1/2</td>
        <td>1/2</td>
      </tr>
      <tr>
        <th scope="row"><code>dapo</code>，每个有效词元等权</th>
        <td>10/40 = 1/4</td>
        <td>30/40 = 3/4</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">表格可左右滑动查看完整列。</p>

<p>表里算的是平均时的权重。长回答中的错误步骤也会按相同规则计入，最终梯度还取决于优势和每个词元的概率比。损失分母与动态采样可以分别改变。DAPO 论文的逐项实验中，采用词元级损失的 Qwen2.5-32B 配方在 AIME 2024 得 42 分，在此前改动上再加动态采样后得 50 分。这组结果衡量的是同一条配方演进路线上的答题表现。<sup id="cite-1e"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 下一批回答用的是哪一版模型

<p>更新训练侧参数以后，生成引擎还持有自己的模型权重。slime 的 Qwen3-4B 示例用 Megatron 训练、SGLang 生成，两者共用设备。在它的训练循环里，可以看到控制器暂停接收新的采样请求，把训练权重交给生成侧，再为下一轮恢复接收请求。即使权重放在同一组设备上，这一步交接仍然存在。首次把模型转成 Megatron 分片是加载准备；循环里的交接则决定下一批回答来自哪版策略。<sup id="cite-5"><a href="#ref-5" aria-label="参考文献 5">[5]</a></sup></p>
<p>同步执行要等一批回答收齐才更新。某条解答特别长、某次工具调用迟迟没有返回时，其他已完成的轨迹也得等。异步执行让训练侧先消费队列中的轨迹，同时生成侧继续采样。省下等待的同时，训练策略可能已比队列里的回答领先几次更新。如果允许分段生成，一条回答甚至可以先用旧权重写出开头，权重交接后再写完结尾。<sup id="cite-6b"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></p>
<p>AReaL 的 GSM8K 配置把 <code>max_head_offpolicyness</code> 设为 2，在接纳生成请求时约束版本落后的程度，设为 0 就回到同步模式。这份配置还让训练侧对既有词元重算对数概率，并使用解耦损失。重算回答的是“这版模型给当时写下的词元多少概率”。回答本身仍来自当时的采样，训练器需要保留采样侧的概率，才能在更新时处理两者的差异。<sup id="cite-6c"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></p>
<p>读这类配置，设备布局和调度顺序值得分开核对。前者告诉你训练与生成各占哪些设备，后者决定一道题能不能在上一次更新完成之前就开始作答。如果改变并发度，还应观察回答进入训练时已落后几版。只有把版本差和等待时间放在一起，才能判断这项改动给当前任务换来了什么。<sup id="cite-6d"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></p>

<details class="supplement">
  <summary>版本、评测与续训口径（按需展开）</summary>
  <p>表 1 取 TRL v1.16.0、verl v0.9.1、OpenRLHF 提交 <code>dc2a7ad</code>、slime v0.4.0、AReaL v2.1.0 的指定数学示例。表 2 按源码分母推算。DAPO 表 1 的 AIME 2024 指标是 avg@32，即每题重复作答 32 次后取平均正确率。<sup id="cite-1f"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
  <p>模型导出和中断续训各有保存入口。以 AReaL 为例，Saver 导出的 Hugging Face 模型只带模型权重及配套文件。恢复处理器另存训练步、数据读取位置，并可保存优化器状态。该 GSM8K 示例将 <code>recover.mode</code> 设为 <code>disabled</code>。<sup id="cite-6e"><a href="#ref-6" aria-label="参考文献 6">[6]</a></sup></p>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Yu 等，<cite>DAPO: An Open-Source LLM Reinforcement Learning System at Scale</cite>，v2。
    <a href="https://arxiv.org/html/2503.14476v2#S2.SS1" target="_blank" rel="noopener">§2.1 价值基线</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S2.SS2" target="_blank" rel="noopener">§2.2 组内优势与概率比</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S3.SS2" target="_blank" rel="noopener">§3.2 动态采样</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S3.SS3" target="_blank" rel="noopener">§3.3 词元级损失</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S4.SS1" target="_blank" rel="noopener">§4.1 评测设置</a>、
    <a href="https://arxiv.org/html/2503.14476v2#S4.T1" target="_blank" rel="noopener">§4.2 表 1 最后两行</a>。
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Hugging Face TRL v1.16.0。
    <a href="https://github.com/huggingface/trl/blob/v1.16.0/docs/source/grpo_trainer.md#L26-L41" target="_blank" rel="noopener">DeepMath 训练入口</a>、
    <a href="https://github.com/huggingface/trl/blob/v1.16.0/docs/source/grpo_trainer.md#L56-L76" target="_blank" rel="noopener">采样与优势计算</a>、
    <a href="https://github.com/huggingface/trl/blob/v1.16.0/trl/rewards/accuracy_rewards.py#L83-L105" target="_blank" rel="noopener">数学奖励返回值</a>、
    <a href="https://github.com/huggingface/trl/blob/v1.16.0/trl/trainer/grpo_config.py#L237-L249" target="_blank" rel="noopener">损失默认项</a>、
    <a href="https://github.com/huggingface/trl/blob/v1.16.0/trl/trainer/grpo_trainer.py#L3153-L3173" target="_blank" rel="noopener">两种分母的实现</a>。
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    verl v0.9.1。
    <a href="https://github.com/verl-project/verl/blob/v0.9.1/examples/data_preprocess/gsm8k.py#L57-L78" target="_blank" rel="noopener">GSM8K 题面与真值</a>、
    <a href="https://github.com/verl-project/verl/blob/v0.9.1/verl/utils/reward_score/gsm8k.py#L17-L72" target="_blank" rel="noopener">严格解析与赋分</a>、
    <a href="https://github.com/verl-project/verl/blob/v0.9.1/examples/grpo_trainer/run_qwen3_4b_fsdp.sh#L59-L138" target="_blank" rel="noopener">Qwen3-4B 启动脚本</a>。
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-4">
    OpenRLHF，提交 <code>dc2a7ad</code>。
    <a href="https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/examples/scripts/train_prorlv2_math_hybrid_engine.sh#L21-L47" target="_blank" rel="noopener">ProRL v2 入口与优势估计</a>、
    <a href="https://github.com/OpenRLHF/OpenRLHF/blob/dc2a7ad326f619fc5a47737ea47d1920ce2c0b53/examples/python/math_reward_func.py#L26-L48" target="_blank" rel="noopener">方框答案提取与判等</a>。
    <a class="reference-backlink" href="#cite-4" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-5">
    slime v0.4.0。
    <a href="https://github.com/THUDM/slime/blob/v0.4.0/scripts/run-qwen3-4B.sh#L39-L58" target="_blank" rel="noopener">Qwen3-4B 数据列与评分器</a>、
    <a href="https://github.com/THUDM/slime/blob/v0.4.0/slime/rollout/rm_hub/deepscaler.py#L4-L42" target="_blank" rel="noopener">DeepScaler 判分</a>、
    <a href="https://github.com/THUDM/slime/blob/v0.4.0/docs/en/get_started/quick_start.md#L66-L99" target="_blank" rel="noopener">Megatron 权重转换</a>、
    <a href="https://github.com/THUDM/slime/blob/v0.4.0/scripts/run-qwen3-4B.sh#L145-L154" target="_blank" rel="noopener">共置开关</a>、
    <a href="https://github.com/THUDM/slime/blob/v0.4.0/train.py#L86-L97" target="_blank" rel="noopener">更新与恢复接收请求</a>。
    <a class="reference-backlink" href="#cite-5" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-6">
    AReaL v2.1.0。
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/areal/workflow/openai/math_agent.py#L21-L54" target="_blank" rel="noopener">MathAgent 采样与判分</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/areal/workflow/openai/math_agent.py#L81-L103" target="_blank" rel="noopener">MultiTurnMathAgent 循环</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/examples/math/gsm8k_grpo.yaml#L21-L86" target="_blank" rel="noopener">GSM8K 生成和训练配置</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/docs/en/algorithms/async.md#L5-L41" target="_blank" rel="noopener">异步与分段生成</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/areal/api/cli_args.py#L2502-L2508" target="_blank" rel="noopener">请求版本约束</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/areal/trainer/ppo/actor.py#L548-L625" target="_blank" rel="noopener">损失的概率输入</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/areal/utils/saver.py#L143-L158" target="_blank" rel="noopener">Saver</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/areal/utils/recover.py#L302-L309" target="_blank" rel="noopener">RecoverHandler 训练进度</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/areal/utils/recover.py#L430-L440" target="_blank" rel="noopener">优化器状态</a>、
    <a href="https://github.com/areal-project/AReaL/blob/v2.1.0/examples/math/gsm8k_grpo.yaml#L149-L165" target="_blank" rel="noopener">恢复开关</a>。
    <a class="reference-backlink" href="#cite-6" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
