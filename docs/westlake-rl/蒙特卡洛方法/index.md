---
layout: doc
title: 第 5 讲：蒙特卡洛方法
outline: false
aside: false
---

<script setup>
import PdfViewer from '../../.vitepress/components/PdfViewer.vue'
import pdfUrl from './蒙特卡洛方法.pdf?url'
import page1 from './预览/01.webp'
import page2 from './预览/02.webp'
import page3 from './预览/03.webp'
import page4 from './预览/04.webp'
import page5 from './预览/05.webp'
import page6 from './预览/06.webp'
import page7 from './预览/07.webp'
import page8 from './预览/08.webp'
import page9 from './预览/09.webp'
import page10 from './预览/10.webp'
import page11 from './预览/11.webp'
const previewPages = [page1, page2, page3, page4, page5, page6, page7, page8, page9, page10, page11]
</script>

# 第 5 讲：蒙特卡洛方法

均值估计、MC Basic、探索起点与 ε-Greedy，从交互经验中学习。

<PdfViewer :src="pdfUrl" title="蒙特卡洛方法" :preview-pages="previewPages" :pages="11" />
