---
title: Benchmark、checkpoint 选择与上线反馈
description: 统一评测协议，关联 checkpoint、行为回归与上线修复记录。
tags: ["论文与项目随谈","后训练","模型评估","MiMo"]
---

# Benchmark、checkpoint 选择与上线反馈

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 一条得分需要哪些信息

以下是建议的评测记录结构：benchmark 名称与 revision、数据 split、checkpoint/hash、harness 与工具版本、thinking 设置、上下文和轮次预算、temperature/top-p、尝试次数、聚合口径、infra 处理、每题结果与统计不确定性。

如果这些不同，排行榜数字不能直接横比。参数固定也不等于没有随机波动；小规模评测尤其要保留每题结果和重复实验。

## 2. 小米公开 archive 的三组结果

| Benchmark | 归档标注协议 | Flash 首点 → 最后公开点 | Pro 首点 → 最后公开点 |
|---|---|---|---|
| DeepSWE v1.1 | mini-swe-agent，avg@3 | step 1: 48.67 → step 30: 65.68 | step 1: 58.41 → step 30: 72.57 |
| In-house Coding Bench | avg@3 | step 1: 53.83 → step 30: 62.87 | step 1: 57.54 → step 29: 65.43 |
| AutomationBench v1.0.6 | avg@3 | step 1: 44.80 → step 30: 52.70 | step 1: 45.20 → step 29: 53.10 |

来源：[benchmarks.json](https://mimo.xiaomi.com/rl/data.04135c89/benchmarks.json)。表中差值属于“第一条已公开训练步结果到最后公开点”，不能直接当成未训练模型到最终模型的收益。保留 `avg@3` 标签，不改写成 `pass@3`。

![三组 benchmark 逐步结果](/papers/projects/mimo-v2-6/evidence/三组benchmark.png)

曲线只连接已有观测，未填写缺失评测。完整数值：[离线评测 CSV](/papers/projects/mimo-v2-6/evidence/离线评测.csv)。

Flash DeepSWE 的最高公开点为 step 28 的 67.86，step 30 为 65.68。只用最后一个 checkpoint 报告结果会忽略早期峰值；只挑最高点也应说明选择流程，避免对测试集反复选择。

## 3. 异步评测的对应关系

### Benchmark 本身也有工程版本

DeepSWE 当前官方仓库公开 113 个原创长程任务，采用 Harbor task 格式：任务元数据、指令、环境、测试和参考解分开。v1.1 使用独立 verifier 环境，把 agent 提交的改动提取为 patch，应用到干净容器中评分；返回 reward、机器可读测试报告和原始输出。[benchmark 官方说明](https://github.com/datacurve-ai/deep-swe)

这提供了评分隔离与错误回溯的重要背景。不过，MiMo archive 只有 v1.1 名称和 harness/avg@3 标签，没有逐次运行的全部依赖版本；不能声称已核验其每次评测与当前 main 完全一致。

小米公告明确提到离线评测结果陆续回填。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json) 评测完成时间不等于权重生成时间。建议每条结果绑定产生它的 checkpoint 和训练步，额外记录 evaluate_start/end 和队列等待。

Miles 文档提供共享推理、独立推理集群和外部评测三种模式。共享推理会暂停部分生成，独立集群增加资源成本，外部服务增加版本交接；框架强调结果与对应 checkpoint 绑定。[Miles 评测说明](https://www.lmsys.org/blog/2026-08-18-miles-v0-1/)

## 4. 泛化评测与行为回归应并行

| 类型 | 要回答的问题 | 示例 |
|---|---|---|
| 固定 benchmark | 是否在未用于更新的任务上变强？ | 公开 DeepSWE、AutomationBench |
| 跨 harness | 是否只适配某个代理模板？ | 更换工具/上下文管理后重复评测 |
| 失败样本回放 | 是否修复已发现问题？ | 重复工具调用、环境错误分类 |
| 正常行为对照 | 修复是否伤害正常能力？ | 正常连续调用多个不同工具 |
| 成本与可靠性 | 能力提升是否伴随代价变化？ | token 长度、时延、infra error、任务成功成本 |

后四项作为整理建议。MiMo 的修复说明与 Issue 反馈显示，仅关注榜单不足以覆盖工具行为质量，见 [MiMo 项目档案](/papers/projects/mimo-v2-6/)。

## 5. 区分两个叫 DeepSWE 的对象

**DeepSWE-Preview** 是 Agentica/Together 于 2025 年发布的 RL 编程模型，公开训练及评测入口；**DeepSWE v1.1** 是 MiMo 2026 看板使用的 benchmark 名称。不能把前者 SWE-Bench Verified 的 Pass@1/Pass@16 当成后者 avg@3 的同一指标。[DeepSWE-Preview 作者文章](https://www.together.ai/blog/deepswe)、[MiMo benchmark 元数据](https://mimo.xiaomi.com/rl/data.04135c89/benchmarks.json)

## 6. 发布记录为什么还需要时间

MiMo 修复后 API 名称保持一致，模型行为版本只能结合更新时点定位。[官方修复记录](https://mimo.xiaomi.com/blog/mimo-v2-6-tool-call-repetition) 建议保存请求时间、provider、模型名、返回元信息、thinking/采样设置，以及部署权重 revision；本地开源模型则保存具体 checkpoint hash。

反馈闭环的建议顺序：收集原请求与工具 schema → 固定 harness 回放 → 比较多个 checkpoint → 设计局部训练/奖励/教师修复 → 检查固定 benchmark 与正常行为对照 → 记录新部署时点。没有受控回放就不要急于给用户反馈贴“模型问题”或“harness 问题”的根因标签。
