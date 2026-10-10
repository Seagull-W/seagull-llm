---
layout: doc
title: 第 1–2 讲：强化学习基本概念与贝尔曼方程
outline: false
aside: false
---

<script setup>
import PdfViewer from '../../.vitepress/components/PdfViewer.vue'
import pdfUrl from './强化学习基本概念与贝尔曼方程.pdf?url'
import page1 from './预览/01.webp'
import page2 from './预览/02.webp'
import page3 from './预览/03.webp'
import page4 from './预览/04.webp'
import page5 from './预览/05.webp'
const previewPages = [page1, page2, page3, page4, page5]
</script>

# 第 1–2 讲：强化学习基本概念与贝尔曼方程

状态、动作、策略、奖励、马尔可夫决策过程，以及状态价值、动作价值和贝尔曼方程。

<PdfViewer :src="pdfUrl" title="强化学习基本概念与贝尔曼方程" :preview-pages="previewPages" :pages="5" />
