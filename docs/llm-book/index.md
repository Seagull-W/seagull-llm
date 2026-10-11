---
tags: ["大语言模型","Token 化","生成机制","可靠性"]
layout: doc
title: 所有人都能看懂的大语言模型科普及实践书
pageClass: chapter-index
aside: false
---

# 所有人都能看懂的大语言模型科普及实践书

面向零基础读者的大语言模型工作原理与实践指南。从"预测下一个词"出发，建立直觉、理解边界、走向实践。

## 新版重构试读

新版围绕“解释基本机制、判断输出可靠性、设计可验证的简单工作流”重新安排内容。先看[学习地图与两章样章](./rebuild/)，体验分步 SVG 动画、资料核查和有来源说明的网络图解。

样章目前用于试读，后续会按学习效果调整结构与内容。

## 已发布章节

<ChapterCards :items="[
  { label: '第 0 章', title: '大模型全景', link: '/llm-book/ch00-overview', description: '先建立整体地图，认识大语言模型的机制、能力与实践方向。' },
  { label: '第 1 章', title: '从一次对话说起', link: '/llm-book/ch01-what-is-lm', description: '从熟悉的对话体验出发，理解语言模型在做什么。' },
  { label: '第 2 章', title: 'Token 化', link: '/llm-book/ch02-tokenization', description: '理解文本如何变成模型能够处理的 Token。' }
]" />

第 3–18 章仍在写作中，当前不纳入正式目录和站内搜索。后续将继续补充模型架构、训练、能力边界与实践主题。
