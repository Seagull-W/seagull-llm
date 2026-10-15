---
title: 后训练项目来源与版本定位
description: 按项目与材料类型定位作者报告、配置、看板、Issue 和固定版本。
tags: ["论文与项目随谈","后训练","项目实践"]
---

# 后训练项目来源与版本定位

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

本页先列人类阅读入口。全部已保存 HTTP 来源与状态、大小、hash 见 [来源清单 CSV](/papers/evidence/来源清单.csv)和 [机器可读清单](/papers/evidence/来源清单.json)。引用优先用官方/作者材料；社交平台转载只用于发现线索。

各项目的连续阅读入口见 [项目目录](/papers/projects/coverage)，benchmark/loss 的取得状态见 [指标证据索引](/papers/evidence/project-metrics)。下面按材料类型列来源，不表示项目主次。

## 1. 小米真实运行与反馈

| 来源 | 类型/时间 | 最适合核验什么 |
|---|---|---|
| [MiMo-V2.6 RL 看板](https://mimo.xiaomi.com/rl/) | 官方运行归档，2026-09 | 训练事件、指标和成本口径 |
| [官方发布](https://mimo.mi.com/docs/en-US/news/latest/v2-6) | 团队说明，2026-09-22 | 发布对象与公开运行对应关系 |
| [罗福莉原帖](https://x.com/_LuoFuli/status/2100296686719610932) | 社交入口，访问 403 | 已定位链接，全文未直接核验 |
| [runs.json](https://mimo.xiaomi.com/rl/data.04135c89/runs.json) | 公开数据 | 指标定义和任务/harness 分组 |
| [notices.json](https://mimo.xiaomi.com/rl/data.04135c89/notices.json) | 团队公告 | OOM、网络、回滚、课程变更 |
| [Flash 状态](https://mimo.xiaomi.com/rl/data.04135c89/status-flash.json)、[Pro 状态](https://mimo.xiaomi.com/rl/data.04135c89/status-pro.json) | 原始数据 | 起止、重启计数、末尾事件 |
| [Flash 序列](https://mimo.xiaomi.com/rl/data.04135c89/series-flash.json)、[Pro 序列](https://mimo.xiaomi.com/rl/data.04135c89/series-pro.json) | 原始数据 | 全部公开逐步 loss/reward/系统指标 |
| [benchmarks.json](https://mimo.xiaomi.com/rl/data.04135c89/benchmarks.json) | 原始数据 | 三组评测、协议标签和缺失点 |
| [重复调用诊断](https://mimo.xiaomi.com/blog/mimo-v2-6-tool-call-repetition) | 官方修复复盘，2026-09-27 | 行为定义、局部实验、MOPD 与 API 更新 |
| [Issue #98](https://github.com/XiaomiMiMo/MiMo/issues/98)、[Issue #102](https://github.com/XiaomiMiMo/MiMo/issues/102) | 用户反馈，2026-09 | 循环调用、修复后的可能回归 |

`live` 和 `tags` 文件一并保存，完整 URL 见 [归档 manifest](/papers/projects/mimo-v2-6/evidence/manifest.json)。

## 2. 小米开源复现

| 来源 | 版本定位 | 读什么 |
|---|---|---|
| [verl 复现分支](https://github.com/XiaomiMiMo/verl/tree/mimo-oss) | 本次头 SHA：`a2ad9f6160b03ff2d47e59832bfb6b289f37c917` | 五类任务入口与组件关系 |
| [公开数据集](https://huggingface.co/datasets/XiaomiMiMo/MiMo-V2.6-RL-oss) | 2026-10-11 页面快照 | 任务与元数据字段；不是全部生产轨迹 |
| [9B SFT 起点](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B) | model card 快照 | 起点来源与后续 RL 定位 |
| [Code 启动器](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/train.sh) | 固定 SHA | 9B 训练默认参数 |
| [Code 环境](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/env.example) | 固定 SHA | task Pod、服务与 harness 设置 |
| [Code 主脚本](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/run_train.sh) | 固定 SHA | loss/queue/off-policy/resume/预检 |
| [桥接代码](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/code/mimoagent_runner.py) | 固定 SHA | gateway、轨迹、环境与 reward |
| [General AgentLoop](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/recipes/general/agent_loop.py) | 固定 SHA | infra 分类与 sentinel |
| [mimoagent](https://github.com/XiaomiMiMo/mimoagent/tree/mimo-oss) | `mimo-oss`；页面头 `467f0a19016f0ac4d63b8d17a1f0da9ba07f232c` | 原生/CLI harness、环境、日志格式 |
| [uni-agent](https://github.com/XiaomiMiMo/uni-agent/tree/mimo-oss) | 训练分支；非 main 通用文档 | Code 的模型 gateway 和 capture |

`.gitmodules` 中的 `MiMo-Agent` 旧名在本次 HTTP 访问重定向为 `mimoagent`；不是另一个已证明缺失的依赖。submodule 精确 revision 仍应取父仓库 gitlink，不能直接用子仓库当前头替代。

## 3. MiMo 报告与机制定位

[MiMo-V2.6 技术报告](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL/blob/main/MiMo_V2_6_technical_report.pdf)共 44 页，已提取相关段落并查看架构/实验页。下表页码为 PDF 从 1 开始的页序；用于回到原文，避免把设计说明当成事故日志。

| PDF 页序 | 阅读主题 |
|---|---|
| 21 | 策略更新、精度与 router 相关训练方法 |
| 27–28 | 轨迹层次、mask 与 RL 系统架构图 |
| 29–32 | 任务混合、启动/回放、数据面、推理训练一致性 |
| 34 | 开源小模型 SFT 与训练数据规模表 |
| 35 | 单域 RL 结果，独立 checkpoint 的比较 |
| 36 | 跨 harness 结果 |

[CodeMidas](/papers/projects/codemidas/)另有独立档案，使用其报告全文与训练/评测附录；不将两个项目的数据 manifest 或运行配置合并。

## 4. 各项目运行、报告与 benchmark

| 来源 | 日期/状态 | 用途 |
|---|---|---|
| [DeepSWE benchmark 官方仓库](https://github.com/datacurve-ai/deep-swe) | 当前 main 快照 | v1.1 隔离 verifier、任务与评分输出 |
| [Miles v0.1 工程文章](https://www.lmsys.org/blog/2026-08-18-miles-v0-1/) | 2026-08-18 页面、可能持续更新 | 744B 参考运行与端到端框架 |
| [GLM-5.2 recipe](https://github.com/radixark/miles/tree/main/examples/experimental/openenv/glm52_tbench2) | 当前 main | 实际布局、KV、routing、disk optimizer 与 replay |
| [TITO](https://www.lmsys.org/blog/2026-05-13-no-token-left-behind/) | URL 日期与页面展示日期不完全相同 | token-faithful 多轮轨迹 |
| [P2P 权重传输](https://www.lmsys.org/blog/2026-04-29-p2p-update/) | 2026 工程文章 | 目标分片、传输流程与硬件依赖 |
| [INTELLECT-3 作者博客](https://www.primeintellect.one/blog/intellect-3) | 2025-11-26 | SFT/RL、512 H200 集群与环境生态 |
| [INTELLECT-3 报告入口](https://arxiv.org/abs/2512.16144) | 2025-12-18 | 报告日期与项目机制补充 |
| [INTELLECT-3 全文 v1](https://arxiv.org/html/2512.16144v1) | 已保存正文快照与 hash | 两阶段 SFT、实际 RL 分配、IcePop、loss/评测图与失败尝试 |
| [INTELLECT-3 模型卡](https://huggingface.co/PrimeIntellect/INTELLECT-3) | 已保存 raw README | 最终评测表、权重/服务与工具解析协议 |
| [DeepSWE-Preview 作者文章](https://www.together.ai/blog/deepswe) | 2025-07-02 | 64 H100 训练与多种评测口径 |
| [rLLM SWE 入口](https://github.com/agentica-project/rllm/tree/main/examples/swe) | 当前 main | 数据/代码/W&B/eval archive 链接 |
| [评测复现指南](https://github.com/agentica-project/R2E-Gym/blob/master/reproduction/DEEPSWE_REPRODUCTION.MD) | 当前 master | 模型服务、轨迹转换与官方评测 |
| [CodeMidas 摘要](https://arxiv.org/abs/2609.22068)及[全文 v1](https://arxiv.org/html/2609.22068v1) | 2026-09-18；全文已保存 | 环境生产/过滤、GRPO 配置、benchmark 与行为分析 |

## 5. 框架工程与实际报错

| 来源 | 用途/状态 |
|---|---|
| [verl 数据](https://github.com/verl-project/verl/blob/main/docs/preparation/prepare_data.rst)、[reward](https://github.com/verl-project/verl/blob/main/docs/preparation/reward_function.rst)、[性能](https://verl.readthedocs.io/en/latest/perf/perf_tuning.html) | 数据接口、评分接口、显存与吞吐 |
| [prime-rl docs](https://github.com/PrimeIntellect-ai/prime-rl/tree/main/docs) | SFT/RL、算法、推理、Slurm、配置、评测；当前实现 |
| [slime debug](https://github.com/THUDM/slime/blob/main/docs/en/developer_guide/debug.md)、[QA](https://github.com/THUDM/slime/blob/main/docs/en/get_started/qa.md) | 分离调试、logprob/权重映射、常见失败 |
| [slime trace](https://github.com/THUDM/slime/blob/main/docs/en/developer_guide/trace.md)、[profiling](https://github.com/THUDM/slime/blob/main/docs/en/developer_guide/profiling.md) | rollout/reward/model call 与内核定位 |
| [slime 容错](https://github.com/THUDM/slime/blob/main/docs/en/advanced/fault-tolerance.md) | 保留 serving 与 batch replay；有前提限制 |
| [#2384](https://github.com/THUDM/slime/issues/2384)、[#2385](https://github.com/THUDM/slime/pull/2385) | routing replay 主机内存；候选 PR Open |
| [#1523](https://github.com/THUDM/slime/issues/1523) | entropy 长序列 OOM；未核验合并修复 |
| [#1851](https://github.com/THUDM/slime/issues/1851) | CPU offload 后 RAM 耗尽；Closed 不等于确认修复 |

全部源码只作阅读，没有执行远程训练代码。可读 HTTP 页面也不意味着动态图表/完整日志成功获取，具体状态在机器清单和检索记录中说明。
