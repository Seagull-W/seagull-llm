# Context

## Glossary

| Term | Meaning | Notes |
|---|---|---|
| 真实模型推理 | 在浏览器内加载 Qwen2.5-0.5B-Instruct (ONNX) 并用 WebGPU/WASM 推理 | 对应 useModelManager；约 512MB；须严格按需加载 |
| n-gram 模拟 | 基于统计语言模型的下一个词预测，NextTokenViz 的默认 fallback | 不依赖外部模型，纯本地 |
| 按需加载 | 重组件/模型仅在对应页面且用户交互后才加载 | 全站性能约束原则 |
| 玻璃拟态 | backdrop-filter: blur + saturate 实现的毛玻璃视觉效果 | 全站导航栏/侧边栏/卡片/弹窗均用，性能成本高 |
| 海鸥透镜 (SeagullLens) | 首页 hero 的 Canvas 放大镜交互 | rAF 常驻，需优化 |
| ModelScope 代理 | 经服务端代理 ModelScope 拉取模型权重，解决 CORS/网络 | dev 用 Vite 中间件，生产用 Cloudflare Worker |
