---
layout: doc
title: 图与动画的来源及范围
status: draft
search: false
prev: false
next: false
head:
  - - meta
    - name: robots
      content: noindex
---

# 图与动画的来源及范围

核验日期：2026-10-09。每项资源说明其教学作用、数据身份与采用方式；具体图旁也提供简短署名。

## 已引入的网络图

### Distill：按注意力权重读取向量

- 作者：Chris Olah、Shan Carter。
- 文章：[Attention and Augmented Recurrent Neural Networks](https://distill.pub/2016/augmented-rnns/)，2016。
- 原图：[rnn_read.svg](https://distill.pub/2016/augmented-rnns/assets/rnn_read.svg)。本地副本：`figures/distill-attention-read.svg`。
- 许可：采用文章页面标注的 [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)，原图未修改。[文章的署名与复用说明](https://distill.pub/2016/augmented-rnns/#citation)、[Distill FAQ](https://distill.pub/faq/)。
- 教学作用：观察多个向量怎样按权重汇总。它来自神经图灵机的读取解释，既不是 Transformer 的完整架构图，也不是本书使用某个模型测得的注意力。

这项记录针对原站图示的复用；不将该文章的许可扩展到其引用的其他论文图，也不自动沿用其交互代码。

## 网络交互与图解入口

| 资源 | 适合看什么 | 本次采用方式与范围 |
|---|---|---|
| [Transformer Explainer](https://poloclub.github.io/transformer-explainer/) | 用自己的输入观察 GPT-2 的组件与候选分布 | 延伸交互入口，英文、需加载模型；[作者仓库](https://github.com/poloclub/transformer-explainer)的软件为 MIT，整套代码暂未引入 |
| [3Blue1Brown：Transformers, the tech behind LLMs](https://www.3blue1brown.com/lessons/gpt/) | 从全景进入表示、注意力与输出 | 官方阅读入口；样章引用解释思路，未转载视频、截图或代码 |
| [Jay Alammar：The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) | 组件与局部计算怎样对应整体结构 | 官方阅读入口；讲原始编码器—解码器，阅读时注意与样章所讲生成模型的区别，未转载原图 |

## 本书自绘图与动画

| 文件 | 身份与用途 | 简化与边界 |
|---|---|---|
| `figures/system-map.svg` | 原创系统关系图 | 模型内部计算合并为一块，工具调用的格式和多轮执行未展开 |
| `figures/generation-static.svg` | 原创生成阶段静态图，也是动画的无脚本替代 | 只示意切分、表示、处理和分布；不对应特定分词器和模型 |
| `figures/evidence-static.svg` | 原创证据流程静态图，也是动画的无脚本替代 | 展示工作流的核验位置；真实性仍需任务相关的检查 |
| `GenerationWalkthrough.vue` | 原创 HTML/SVG 分步动画 | 切分、向量、权重和概率均为预设示意；候选只是虚构词表的一部分，没有运行 LLM |
| `EvidenceWalkthrough.vue` | 原创 HTML/SVG 资料核查动画 | 资料、草稿和检查结果均为虚构教学例子；脚本不是通用的事实核验器 |

动画参考专业资料中的机制说明，以中文读者的观察任务独立编排，没有复制第三方动画实现。正文列出事实来源，图旁说明示意性质。

## 后续资源选择

后续每个主题先寻找合适的作者原图与交互，再决定本地复用、外部链接、改编或自绘。记录作者、原链接、许可、日期、修改、数据来源、适用范围和使用章节；优先选择能帮助解释一个具体问题、并能在移动端阅读的素材。
