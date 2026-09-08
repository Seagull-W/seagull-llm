# ADR 0001: 保留 VitePress 做架构层性能重构，而非更换框架

Status: Accepted
Date: 2026-09-02

## Context

seagull-llm 文档站首页及全站交互明显不流畅。用户反馈首屏加载慢、滚动/动画掉帧、交互响应迟滞。代码分析定位根因为：组件全量同步导入主 bundle（含 transformers.js + ONNX Runtime 的 512MB 模型加载链路）、满屏 backdrop-filter 玻璃拟态、Canvas rAF 常驻、body fixed 多层渐变背景、侧边栏拖拽无节流。用户最初要求"从底层重写、不限技术栈"，但补充约束"模型和重组件只在对应页面点击后才加载"。

## Decision

保留 VitePress 作为 SSG 框架，从架构层（组件加载、按需加载、CSS 减负、动画节流）重构以提升流畅度。不更换为 Astro 或其他框架。

## Consequences

- 正面：根因多为"用法"问题而非框架问题，VitePress 本身支持 SSG + 代码分割，架构层重构即可拿到大部分性能收益；内容/组件/部署链路无需迁移，成本远低于换框架。
- 负面/tradeoff：放弃"换框架可能更极致"的潜在收益；VitePress 的 SSR `[object Promise]` 约束要求异步组件配合 ClientOnly，需额外验证构建。
- 后续约束：所有后续组件必须遵循按需加载原则；重组件不得进入首页主 bundle。
