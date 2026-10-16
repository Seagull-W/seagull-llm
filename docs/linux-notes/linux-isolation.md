---
title: Linux 隔离机制：Namespace、cgroups 与 seccomp
description: 从进程、内核与系统调用出发，理解容器和沙箱的资源视图、资源限制与系统调用过滤。
tags: ["Linux", "Namespace", "cgroups", "seccomp"]
aside: false
pageClass: linux-html-note
---

<script setup>
import { withBase } from 'vitepress'
</script>

# Linux 隔离机制：Namespace、cgroups 与 seccomp

从进程、内核与系统调用出发，理解容器和沙箱的资源视图、资源限制与系统调用过滤。

<iframe
  :src="withBase('/linux-notes/linux_isolation_notes.html')"
  title="Linux 隔离机制笔记 HTML 原文"
  style="display: block; width: 100%; height: 80vh; min-height: 520px; margin-top: 20px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: #f6f8fc;"
></iframe>
