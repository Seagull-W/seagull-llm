# 来源扩展实测

时间：2026-10-15T07:41:29.771688+00:00

在完整仓库运行真实 collect，使用现有 catalog 去重及 2026-10-15 日期窗口。运行目录为临时目录，未生成公开文章或推送。此结果不代表 Hermes 模型写作、网站构建及发布已通过。

离线测试：16 项通过，已接入 GitHub CI。

| 来源 | 状态 | 读取 | 符合筛选 | 入选 | 拒绝原因 |
| --- | --- | --- | --- | --- | --- |
| arxiv | ok | 30 | 30 | 4 | {"source-cap": 26} |
| huggingface-daily | ok | 150 | 31 | 4 | {"off-topic": 57, "source-cap": 27} |
| hf-blog | ok | 876 | 0 | 0 | {"off-topic": 2, "outside-window": 874} |
| bair-blog | ok | 10 | 0 | 0 | {"outside-window": 10} |
| openai-news | ok | 1293 | 1 | 1 | {"off-topic": 8, "outside-window": 1284} |
| lilian-weng | ok | 53 | 0 | 0 | {"outside-window": 53} |
| verl-releases | ok | 16 | 0 | 0 | {"outside-window": 16} |
| trl-releases | ok | 20 | 1 | 1 | {"outside-window": 19} |
| openrlhf-releases | ok | 20 | 0 | 0 | {"outside-window": 20} |

selection：{"eligible_unique": 58, "selected": 10, "strategy": "group-round-robin", "max_per_source": 4}

partial：False

采集错误：无

来源已连通但无入选材料可能是超出时间窗或与主题无关；不等于来源没有更新。跨源重复合并后，来源计数不可直接相加。单源上限可使实际入选数少于 max_items。

入选材料：

- [Hindsight-Privileged RLVR: Single-Rollout Token Credit Without Group Sampling](https://arxiv.org/abs/2610.20497)；类别 paper；阅读范围 abstract
- [huggingface/trl: v1.15.0](https://github.com/huggingface/trl/releases/tag/v1.15.0)；类别 release；阅读范围 release-notes
- [The EU’s next chapter in AI is agentic](https://openai.com/index/the-eus-next-chapter-in-ai-is-agentic)；类别 research-blog；阅读范围 feed-excerpt
- [BluePixel: Toward Native 4K Agentic Image Editing](https://arxiv.org/abs/2610.19882)；类别 paper；阅读范围 abstract
- [Function-Space Temporal Self-Distillation for Policy Optimization](https://arxiv.org/abs/2610.19687)；类别 paper；阅读范围 abstract
- [VASPO: Self-Distillation with Privileged Value Estimation](https://arxiv.org/abs/2610.20516)；类别 paper；阅读范围 abstract
- [Co-Evolving Acting and Forecasting for Language Agents](https://arxiv.org/abs/2610.20597)；类别 paper；阅读范围 abstract
- [Diagnosing and Correcting Reward Hacking in Verifiable Instruction Following](https://arxiv.org/abs/2610.19525)；类别 paper；阅读范围 abstract
- [ActionOPD: Distilling Decisions, Not Tokens](https://arxiv.org/abs/2610.19820)；类别 paper；阅读范围 abstract
- [APT: Feedback-Driven Agentic Post-Training for Text-to-Image Generation](https://arxiv.org/abs/2610.18097)；类别 paper；阅读范围 abstract

其他检查：git diff --check 通过；网站内容检查未能启动，因为此 clone 尚未安装 esbuild 等 npm 依赖，Node 当前为 22，CI 配置为 24。未进行全站构建。

人工补充入口尚未在本次验证中采集；本次只验收自动来源及筛选。
