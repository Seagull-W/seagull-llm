---
title: 数据、环境与可验证任务
description: 检查任务来源、数据切分、执行环境与 verifier 的可靠性。
tags: ["论文与项目随谈","后训练","训练数据","代码智能体"]
---

# 数据、环境与可验证任务

> 资料快照：本组后训练项目资料整理截至 2026-10-11；文中的运行状态、访问结果和未核验项均以该次归档为准。

## 1. 可执行任务的最小结构

下面是整理建议的逻辑结构，不是某项目的数据 schema：

```text
task_id + source_revision + split
prompt / behavioral specification
starter files / working directory / image digest
harness version + tool schema + context and stopping rules
hidden tests or rubric + grader version
expected valid outcomes + infra error categories
```

MiMo Code 数据预览可见 prompt、reward_model、extra_info 等字段，环境信息藏在 instance 元数据内。[公开数据集](https://huggingface.co/datasets/XiaomiMiMo/MiMo-V2.6-RL-oss)；verl 通用数据准备文档说明如何把不同来源的数据整理为带 source 与 reward 元信息的 Parquet。[verl 数据格式](https://github.com/verl-project/verl/blob/main/docs/preparation/prepare_data.rst)

建议保存原始内容、清洗后内容和执行产物三层，避免只留下最后 prompt 而无法回溯测试、镜像或评分变更。

## 2. 任务怎么生成与验证

CodeMidas 提供了一个相关的数据构建路线：从实现了功能的源码出发，探索行为、形成规格、构建测试，再通过原实现执行检查与多次求解筛选任务。公开摘要报告 5,545 题、3,185 个仓库、23 种语言、15 个领域。[CodeMidas 原文摘要](https://arxiv.org/abs/2609.22068)

CodeMidas 已作为独立项目整理，全文还给出 MiMo-V2.5 RL 配置与 benchmark，见 [项目档案](/papers/projects/codemidas/)。不能因为标题或第三方项目使用 CodeMidas 名称，就认定那个仓库是小米原始数据管线。当前整理未定位到足以核验完整原始生成代码的官方入口。

执行任务构建时可检验四件事，属于整理建议：原始正确实现通过；空实现/错误实现失败；评分产物不直接暴露给 learner；题目具有实际求解空间而非靠固定字符串过关。对污染风险，应按仓库/任务来源和近似内容做切分，不仅按最终 prompt 行号随机切分。

## 3. 五类 MiMo 开源任务如何落地

| 领域 | 任务与 verifier | 入口 | 需要重点复核 |
|---|---|---|---|
| Code | 软件工程、可执行测试 | [train.sh](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/train.sh) | 镜像、测试、gateway、轨迹捕获、Pod 配额 |
| Cyber | 漏洞复现、规则检查 | [arvo.sh](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/arvo/arvo.sh) | 数据与执行规则、环境权限、无效执行分类 |
| General | 知识工作、rubric judging | [general.sh](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/general/general.sh) | judge endpoint、模板、评分失败与基础设施错误 |
| Visual | 网页开发、视觉 grader | [webdev.sh](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/webdev.sh) | 训练/评测模式所需服务不同、group 相对评分 |
| Music | 符号音乐、规则评分 | [music.env.example](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/music.env.example) | `abc2midi` 依赖、CPU scorer、绝对评分 |

这些属于 9B 开源复现路径。实际 Pro/Flash 生产混合里出现的匿名 dataset ID，不能逐个映射到上述公开文件，除非获得映射表。

### 两个能影响训练信号的具体差异

Visual 启动器区分 `WEBDEV_MODE=train/eval`。训练需要 design grader，评测需要另一组 judge 设置；启用 `DROP_INFRA_FROM_GROUP`，意味着除了错误标记还要查看 group 后处理。各领域的环境变量并非通用参数，可见同名设置在不同 arm 的含义与默认值不同。[Visual 启动器](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/webdev.sh)

Music 的 `abc2midi` 缺失会导致样本被跳过而报告 0 分，整次运行可能“看起来正常”但没有学习信号。环境示例明确指出启动脚本会在 worker 上探测依赖，避免静默零奖励。[Music 环境说明](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/design/music.env.example)

## 4. 环境本身就是资源集群

mimoagent 的训练相关分支是 `mimo-oss`，不要仅下载上游继承的 `main` README。其框架将 agent、model protocol、environment、dataset/grader 分层组合；每实例可保存 `instance.log`、`traj.json`、消息及 `reward_extra_info.json`，适合连接失败样本与评分。[mimoagent 训练分支](https://github.com/XiaomiMiMo/mimoagent/tree/mimo-oss)

该分支说明了 native 与 black-box CLI harness，以及 Docker/Kubernetes 等后端。black-box 初始化需要安装固定版本的 CLI，离线/镜像环境可预构建 harness payload；长会话用 detached 执行避免 exec websocket 生命周期限制。这些是具体启动依赖，应该先在实际 task 镜像验证。[训练分支 README](https://github.com/XiaomiMiMo/mimoagent/blob/mimo-oss/README.md)

MiMo Code 环境说明指出一次 session 对应 Pod，最大 session 数受集群 Pod 配额约束；它不是简单由 GPU 卡数决定。[Code 环境参数](https://github.com/XiaomiMiMo/verl/blob/a2ad9f6160b03ff2d47e59832bfb6b289f37c917/scripts/code/env.example)

DeepSWE 工程需要大量 Docker 镜像与并发容器；作者的复现入口说明至少 64 GPU、512 个并行容器，K8 节点还需大 CPU 和磁盘资源。可以据此理解为什么 agent RL 的成本包含 CPU、镜像存储与控制面压力。[rLLM SWE 入口](https://github.com/agentica-project/rllm/tree/main/examples/swe)

建议每次小规模验证同时测量镜像获取、环境创建、工具执行、grader 排队和删除耗时。若只看生成 token/s，环境慢会被误认为模型推理慢。

## 5. 数据课程变化怎样记录

小米公开公告包含“移除 cyber”和“筛去简单任务”，这使训练目标随时间变化。[公告](https://mimo.xiaomi.com/rl/data.04135c89/notices.json) 建议每次变更保存：生效 step、数据 manifest、权重/配额、筛选规则版本、样本数量及原统计口径。固定 held-out benchmark 可以帮助区分任务变容易与模型变强。

继续阅读：[奖励与算法](/papers/engineering/rewards-and-algorithms)、[分布式调度](/papers/engineering/distributed-performance)。
