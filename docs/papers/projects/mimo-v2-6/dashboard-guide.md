---
title: 小米公开看板：指标字典与数据阅读指南
description: 说明 MiMo 原始 JSON、指标字典、CSV、缺失值和图表的统计口径。
tags: ["论文与项目随谈","MiMo","训练实验","模型评估"]
---

# 小米公开看板：指标字典与数据阅读指南

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 文件与统计总体

看板地址：[mimo.xiaomi.com/rl](https://mimo.xiaomi.com/rl/)。读取页面公开 script 引用后，定位到版本化静态数据目录 `data.04135c89/`，按公开文件链接保存。现在两次运行状态均为 ended；没有读取私有接口或登录数据。

| 文件 | 内容 | 范围限制 |
|---|---|---|
| `runs.json` | 标签、描述、默认 pin、任务族/harness 元数据 | 有描述的指标较少，不定义全部内部 tag |
| `notices.json` | 六条团队公告 | 公告时间不等于故障开始时间 |
| `status-{run}.json` | 运行时段、计数、最后一步、末尾事件窗口 | 不包含全部历史重启事件 |
| `series-{run}.json` | 最终保留 step 1–30 的逐步指标 | 已替换尝试不在这份序列中 |
| `tags-{run}.json` | 可用 tag 索引 | 指标名不保证每步非空 |
| `live-{run}.json` | 最后采样状态及有限进度窗口 | 不是从开始到结束的完整日志 |
| `benchmarks.json` | 三组离线评测 | 缺失步数保留缺失 |

原始文件、来源 URL、大小与 SHA-256 见 [manifest](/papers/projects/mimo-v2-6/evidence/manifest.json)。原始 `t/wall/start/end` 是 Unix 时间，派生 CSV 用 UTC+8 转换，没有改写原始 JSON。

## 2. 先看这几个指标

| 指标 | 看板描述或可确认口径 | 不能自动推出 |
|---|---|---|
| `dynsam/avg@n` | 每题 n 次尝试的成功比例，再对题目平均 | pass@n、固定任务的能力提升 |
| `critic/rewards/mean` | 已训练轨迹的平均数值 reward | 原始测试 pass rate、critic 模型存在 |
| `actor/pg_loss` | policy gradient loss 记录值 | 值小必然能力强、与另一模型可直接比较 |
| `actor/entropy_loss` | 看板解释为平均 token entropy | 已使用 entropy 正则，或更高一定更好 |
| `actor/grad_norm` | clipping 前全局梯度范数 | 所有 rank 均衡、没有局部异常 |
| `train_infer_diff/new_infer/kl` | 相同 token 上 inference/trainer logprob 差异 | 所有差异都来自路由、等于 reference KL |
| `ctx_total_length/mean` | prompt+response 总上下文长度 | 仅模型输出长度 |
| `ctx_response_length/mean` | 轨迹响应长度统计 | 全部都是被训练的 loss token |
| `perf/total_num_tokens` | 本步训练 token 总量 | 全部生成 token、累计生成成本 |
| `timing_s/step` | 本步整体时间 | 有效 GPU 利用率 |
| `timing_s/outer_gen` | rollout 时间 | 纯 GPU decode 时间 |
| `timing_s/trainer_ops` | trainer 操作用时 | 可与其他阶段简单相加为端到端时间 |
| `partial/avg_staleness` | 采样到训练的平均策略版本差 | p95/max 也小、所有任务族一致 |
| `dynsam/infra_error/seq_rate` | sequence 级 infra error 统计 | 所有 infra 错误都已正确识别 |
| `dynsam/passrate/zero`、`one` | group 全失败/全成功相关统计 | 单次 trajectory 成功率 |
| `dynsam/num_measurable` | 可测量 pass rate 的 prompt 量 | 全部已请求 prompt 数 |

描述依据：[runs.json](https://mimo.xiaomi.com/rl/data.04135c89/runs.json)。`one/zero` 等字段需结合原配置才能确定过滤前后阶段；未公开的细节没有补写。

## 3. 全量指标按 namespace 找

| Namespace | Flash tag 数 | Pro tag 数 | 阅读用途 |
|---|---:|---:|---|
| `actor` | 256 | 257 | loss、entropy、clip、LR、梯度、更新状态及任务子统计 |
| `critic` | 324 | 324 | reward、score、advantage、return 与分组统计 |
| `ctx_prompt_length` | 81 | 81 | prompt 长度 |
| `ctx_response_length` | 81 | 81 | response 长度 |
| `ctx_total_length` | 108 | 108 | 总上下文长度 |
| `dynsam` | 83 | 83 | 动态采样、成功率、infra 与可测量任务数 |
| `env` | 15 | 15 | 环境计数与活动状态 |
| `partial` | 385 | 337 | partial/staleness 与任务/harness 分布 |
| `penalty` | 521 | 535 | 行为/符号惩罚、stage credit group 等内部统计 |
| `perf` | 1 | 1 | 本步训练 token 总量 |
| `timing_s` | 3 | 3 | 时间分解 |
| `train` | 191 | 191 | 优势与惩罚前后统计 |
| `train_infer_diff` | 11 | 11 | 训练推理差异 |
| `training` | 2 | 2 | global step 与 optimizer step |
| 合计 | **2,062** | **2,029** | 每模型各 30 步 |

这里是按 tag 前缀归类的观测索引，阅读用途并非对所有内部计算公式的验证。匿名 `dataset-xxxx` 和 `harness-A/B/...` 不应随意映射成公开任务名称。

## 4. 派生 CSV 怎么用

- [关键指标逐步.csv](/papers/projects/mimo-v2-6/evidence/关键指标逐步.csv)：60 行，模型/步数/时间 + 43 个核心指标，适合 Excel 和初步分析。
- [全量指标长表.csv](/papers/projects/mimo-v2-6/evidence/全量指标长表.csv)：122,730 个槽位，列为 `run, step, wall_time_Asia_Shanghai, metric, value`；value 为空表示原 JSON 为 null，不是 0。
- [指标索引.csv](/papers/projects/mimo-v2-6/evidence/指标索引.csv)：4,091 个“模型-tag”组合，包含前缀与非空步数，先筛想读的 task/harness/namespace。
- [离线评测.csv](/papers/projects/mimo-v2-6/evidence/离线评测.csv)：只展开原文件存在的评测点。
- [团队公告原文.csv](/papers/projects/mimo-v2-6/evidence/团队公告原文.csv)：保留原文与转换时间；人类阅读优先看案例中的归纳表。
- [末尾事件窗口.csv](/papers/projects/mimo-v2-6/evidence/末尾事件窗口.csv)：原事件 JSON，包含可见的 redo；不冒充完整重启日志。
- [derived-summary.json](/papers/projects/mimo-v2-6/evidence/derived-summary.json)：关键指标首末/min/max、模型状态与 namespace 计数。

导出程序：[export_dashboard.py 源码快照](/papers/evidence/scripts/export_dashboard.py.txt)。它只处理保存的公开数据，没有训练或推理操作。图表程序使用 ReportLab LinePlot、MuPDF 渲染：[chart_dashboard.py 源码快照](/papers/evidence/scripts/chart_dashboard.py.txt)。两份源码以文本提供，保留原资料目录约定；在其他目录运行时需调整输入、输出路径。

## 5. 配套图

![运行概览](/papers/projects/mimo-v2-6/evidence/训练与评测.png)

更细的 [训练损失分析](/papers/projects/mimo-v2-6/loss-and-metrics)含六个面板；[benchmark 章节](/papers/engineering/evaluation-and-feedback)含三组评测曲线。图表没有把缺失值替换成 0，也没有为未公开点插值。

## 6. 统计核验

原归档核验中，每模型 step 均为 1–30；每个 tag 对应 30 个位置。最终保留序列的 token 求和与各自 status 中 `tokens_cum` 一致。末尾 trained trajectories 为 25,088，30 步累计 752,640；六条公告时间按 UTC+8 排序。
