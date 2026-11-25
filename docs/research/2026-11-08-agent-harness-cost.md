---
title: "同一个模型，怎样少办错事、少花钱？"
description: "银行智能体已经办了逾期的撤回申请，却在下一轮告诉客户期限已过，办不了。在模拟银行里，给相同的模型增加执行前复核，违规率从 9.6% 降到 6.4%。"
tags: ["每日调研", "智能体", "模型评估", "推理系统", "AI 安全"]
date: 2026-11-08
---

# 同一个模型，怎样少办错事、少花钱？

<div class="research-article">

<p class="lead">银行智能体已经办了逾期的撤回申请，却在下一轮告诉客户期限已过，办不了。在模拟银行里，给相同的模型增加执行前复核，违规率从 9.6% 降到 6.4%。<sup id="cite-1"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup>在另一组企业任务中，让程序提前整理每次都要查的资料，连同工具一起改造，Haiku 的测试费减少了 72.7%。<sup id="cite-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup>决定先改哪一步，要看工具实际做了什么，以及模型在哪一步反复花钱。</p>

## 已经执行的操作，最后一句拒答救不回来

<p>只要请求送到模拟银行的工具，改变账户状态的操作就会成功。评分器因此核对两轮中实际执行的动作和发给客户的消息。未经允许的操作、违规披露信息都会记为违规。该办的退款没办、该升级的申诉没转交，也会记为过度拒办。一条案例必须同时避开这两类错误才算正确。<sup id="cite-1-2"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>研究者让四个模型分别在五种脚手架（harness）中办理同一批业务。脚手架决定模型看到哪些规则、怎样调用工具，以及谁能拦住拟执行的动作。基础版把整本手册交给模型，让它逐步查账户、作决定。复核版沿用这个流程，但每次更改账户或发消息前，让同一个模型带着手册和对话再查一次。被拦下的请求带着理由退回，此时账户还没有变化。<sup id="cite-1-3"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-1" tabindex="0">
  <table>
    <caption id="tbl-1">
      表 1｜同一批银行案例增加执行前复核的结果
      <span>每列均为四个模型各办 156 例，合计 624 次两轮交互（来源：Huyut 表 1、§4.2）。</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">指标</th>
        <th scope="col" data-num>完整手册＋工具循环</th>
        <th scope="col" data-num>同一循环＋执行前复核</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">正确案例率</th>
        <td data-num>88.8%</td>
        <td data-num>92.1%</td>
      </tr>
      <tr>
        <th scope="row">违规案例率</th>
        <td data-num>9.6%</td>
        <td data-num>6.4%</td>
      </tr>
      <tr>
        <th scope="row">过度拒办案例率</th>
        <td data-num>1.6%</td>
        <td data-num>1.4%</td>
      </tr>
      <tr>
        <th scope="row">输入 token 用量（以基础版为 1）</th>
        <td data-num>1.0 倍</td>
        <td data-num>约 1.8 倍</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>选定一个模型之后，四个模型的平均数就不够用了。固定 qwen3.8-flash-next，拿走上下文里的手册，让模型按关键词检索规则，正确率为 82.1%。给它完整手册时达到 89.7%，再加复核达到 93.6%。两端相差 11.5 个百分点，中间改了两件事。如果手册已经在上下文里，单独增设复核带来的差值是后两组之间的 3.9 个百分点。<sup id="cite-1-4"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>
<p>只看客户收到的答复，会漏掉开头那样的错误。在全部 287 个违规案例中，两位模型裁判一致判定，26.1% 的案例有消息否认已经执行的动作。动作前复核给了系统一次阻止错误的机会，但复核者也可能算错同一道题。在需要判断合同撤回期限的那组案例里，有无复核的正确率都是 66.7%。这类故障值得单独测试日期计算工具。<sup id="cite-1-5"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></p>

## 工具走不通，删短推理也修不好接口

<p>在软件修复任务中，研究者固定 Kimi-K3 和推理强度，更换脚手架后追查重复调用的起点。有的脚手架把命令送进错误的 Python 环境，模型几次重试都卡在导入模块这一步。另一个接口向模型提供了运行时会拒绝的超时参数，模型只好再调一次。遇到这种轨迹，先拿失败的调用核对解释器和参数约定，就有了可以直接修的地方。<sup id="cite-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>另有一种绕路，在不同脚手架上出现得几乎一样频繁。模型先凭记忆写出它以为项目当初采用的修复，随后又放弃。换到另一组工具任务，这种行为却几乎消失。两种绕路都会拉长轨迹，但查错时有了区分的依据。导入失败可以沿着工具调用复现，凭记忆猜解法则要看模型遇到了什么任务。<sup id="cite-2-2"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>断网对照说明了为什么还要看任务能否推进。网络关闭后，智能体反复安装依赖、寻找其他访问路径，输出变长，裁判标出的浪费比例反而下降。在当时的上下文里，试另一条路仍有理由，裁判便把许多重试留了下来。如果任务依赖网络，脚手架可以把断网状态交给模型，并在可用路径耗尽时结束运行。<sup id="cite-2-3"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>
<p>即使确实找到了可删的文本，账也得另算。在线实验逐轮生成推理，让裁判挑出复述和铺垫，再用删短的推理重新生成回复和工具调用。在 SWE-bench Verified 上删去 41% 的推理文本，成功率从 89.0% 到 89.5%。在 MCP-Atlas 工具任务上删去 46%，成功率从 65.0% 降至 62.3%。两个删减比例的分母都是推理文本。要换算成净节费，还得计入已经生成的文本、裁判调用和重新生成动作的费用。<sup id="cite-2-4"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup></p>

## 让程序整理记录，让模型处理业务

<p>企业客服的麻烦往往出在读取资料上。EnvOpt 的附录给出一个有 11 条客服对话的任务环境。按原来的走法，智能体先查哪个接口能列出对话，再调用它，最后从嵌套记录里找工单编号和客户原话。改造后，一个程序在任务开始时通过原接口读取当次记录，每条排成一行，并附上写内部备注的接口。换一批客户记录，程序就重新生成清单，实际写备注仍由智能体发起。<sup id="cite-3-2"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

<figure class="figure" id="fig-envopt-paths">
  

  
  <picture>
<source media="(max-width: 720px)" srcset="/research/agent-harness-cost/fig-envopt-paths-narrow.svg">
<img loading="lazy" decoding="async" src="/research/agent-harness-cost/fig-envopt-paths-wide.svg" alt="同一条客服记录的两条读取路径（宽屏版）">
</picture>
<figcaption><strong>图 1｜同一条客服记录，两条读取路径。</strong>两条路径访问当次任务的同一批记录，预读只整理信息，写入由智能体执行（依据 EnvOpt 附录 B.3）。</figcaption>
</figure>

<p>这段程序是另一个智能体根据目标模型的调用记录改出来的。它能在训练任务上比较不同读法花多少钱，但看不到标准答案。每一步改完，都要用带评分器的验证任务检查。费用上升，或通过率降幅超出容忍范围，就退回前一版。对测试任务拆账，输入端省得最多的是工具返回给模型的内容，尤其是查询接口产生的结果。程序仍要读取资料，省下的是模型一轮轮找接口、阅读返回记录的工作。<sup id="cite-3-3"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

<div class="table-scroll" role="region" aria-labelledby="tbl-2" tabindex="0">
  <table>
    <caption id="tbl-2">
      表 2｜同一批 AutomationBench 任务上，只换工具与完整改造的差别
      <span>测试集为 200 题，费用是跑完整套任务的美元数，结果取三次运行的均值（来源：EnvOpt 表 2、附录表 4）。</span>
    </caption>
    <thead>
      <tr>
        <th scope="col">固定模型</th>
        <th scope="col">资料与工具</th>
        <th scope="col" data-num>通过率</th>
        <th scope="col" data-num>测试费用（美元）</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">Haiku 4.5</th>
        <td>原环境</td>
        <td data-num>2.33%</td>
        <td data-num>42.36</td>
      </tr>
      <tr>
        <th scope="row">Haiku 4.5</th>
        <td>原环境＋优化后的工具</td>
        <td data-num>6.33%</td>
        <td data-num>15.75</td>
      </tr>
      <tr>
        <th scope="row">Haiku 4.5</th>
        <td>工具与资料一并优化</td>
        <td data-num>16.67%</td>
        <td data-num>11.55</td>
      </tr>
      <tr>
        <th scope="row">Opus 5</th>
        <td>原环境</td>
        <td data-num>33.83%</td>
        <td data-num>236.18</td>
      </tr>
      <tr>
        <th scope="row">Opus 5</th>
        <td>原环境＋优化后的工具</td>
        <td data-num>35.17%</td>
        <td data-num>100.37</td>
      </tr>
      <tr>
        <th scope="row">Opus 5</th>
        <td>工具与资料一并优化</td>
        <td data-num>35.17%</td>
        <td data-num>75.26</td>
      </tr>
    </tbody>
  </table>
</div>
<p class="table-hint">左右滑动查看完整表格</p>

<p>只把新工具搬回原环境，Haiku 就已经省下大半费用。把资料也整理好，同样的模型才能在这批题上达到 16.67% 的通过率。改造好的环境随后直接给 Opus 使用。它的两种优化方案通过率同为 35.17%，重排资料的增益体现在更低的运行费上。同一份改造在两个模型上值多少钱，可以从各自的对照行直接读出。<sup id="cite-3-4"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>

## 部署前，把一次性投入也放回账里

<p>Haiku 的测试费从 42.36 美元降至 11.55 美元，降幅为 72.7%。这笔节省来自后续运行。为得到可复用的环境，研究团队在 AutomationBench 上另花了 150.10 美元和 6.6 小时，费用包含研究智能体试跑目标模型的调用。按表中金额推算，若未来每 200 题仍能省 30.81 美元，约五批同类任务才覆盖这笔优化费。任务构成、模型价格或维护开销改变，回本所需的任务量也会跟着变。<sup id="cite-3-5"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></p>
<p>据此比较自己的部署，可以用同一批留出任务和相同的交互上限跑两种配置，逐题并排记录应办动作、实际动作、任务是否通过和所有调用费用，失败与重试也入账。复核多读一遍手册，要看额外输入换回多少次真正避免的违规。资料重排省下查询，要看有多少任务还能正确办完。如果规则已到手、日期也算对、工具可以执行，错误仍集中在业务判断上，此时固定脚手架和资料版本，再比较模型，才知道换模型解决了什么。</p>

<details class="supplement">
  <summary>口径与版本（按需展开）</summary>
  <ul>
    <li>银行实验的 156 例来自 39 个基础变体、两种措辞和两档压力。Qwen 的五种脚手架组内差异检验为 p &lt; 0.001，模型与脚手架的交互检验为 p = 0.07。否认已执行动作的占比来自探索性判读，固定的第二轮客户话术可能影响该比例。<sup id="cite-1-6"><a href="#ref-1" aria-label="参考文献 1">[1]</a></sup></li>
    <li>剪枝实验使用可读取完整推理的 Kimi-K3，后续回合会保留此前的推理。<sup id="cite-2-5"><a href="#ref-2" aria-label="参考文献 2">[2]</a></sup>EnvOpt 的 AutomationBench 执行端在正文 §3 写作 Claude Code，表 1 和图 7 标作官方脚手架。本文按原表报告费用与通过率。三篇均据 v1 全文核对。<sup id="cite-3-6"><a href="#ref-3" aria-label="参考文献 3">[3]</a></sup></li>
  </ul>
</details>

## 来源与阅读范围

<ol class="reference-list">
  <li id="ref-1">
    Mehmet Murat Huyut，<cite>The Harness Is the Model: Agent Scaffolding Changes a Fixed LLM’s Compliance with Banking Conduct Rules, Unevenly Across Models</cite>，§3.1–3.5 交代执行与评分，§4.1–4.4 及表 1、3 给出对照与案例。
    <a href="https://arxiv.org/html/2611.06116v1#Sx3" target="_blank" rel="noopener">arXiv:2611.06116v1</a>
    <a class="reference-backlink" href="#cite-1" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-2">
    Huimin Zeng 等，<cite>How Do AI Agents Waste Your Money?</cite>，§2.2 区分可删冗余与事后才显多余的探索，§4.1、§4.4 和表 3 给出在线删减实验，§7.2–7.3 和图 19、21 定位接口与断网故障。
    <a href="https://arxiv.org/html/2611.07238v1#S7.SS2" target="_blank" rel="noopener">arXiv:2611.07238v1</a>
    <a class="reference-backlink" href="#cite-2" aria-label="返回正文引用">↩</a>
  </li>
  <li id="ref-3">
    Mingxuan Li 等，<cite>EnvOpt: Automated Optimization for Agent Environments</cite>，算法 1、表 1–3、图 5、附录 B.1 和 B.3 对应验证、测试费用、工具消融、离线投入与转换程序。
    <a href="https://arxiv.org/pdf/2611.07372v1#page=7" target="_blank" rel="noopener">arXiv:2611.07372v1</a>
    <a class="reference-backlink" href="#cite-3" aria-label="返回正文引用">↩</a>
  </li>
</ol>

</div>
