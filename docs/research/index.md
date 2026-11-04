---
layout: doc
title: 每日调研
description: 按主题筛选公开论文与社区进展，保留来源和阅读范围。
pageClass: chapter-index
aside: false
tags: ["每日调研"]
---

<script setup>
import { researchCards } from '../.vitepress/research-sidebar'
</script>

<DirectoryIntro>

# 每日调研

按主题整理论文与社区进展。文章保留检索窗口、来源链接与阅读范围，区分研究者的主张和编辑分析。

</DirectoryIntro>

## 调研记录

<ChapterCards :items="researchCards" />
