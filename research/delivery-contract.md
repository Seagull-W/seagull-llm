# 可选交付格式契约

仅适用于已有 delivery 约定的脚本任务。普通 Markdown 调研无需 cards.json 或 acceptance.json。

内容试读统一依据 [成稿质量与试读](../writing/README.md#成稿质量与试读)，操作者交互执行 [阶段回传与反馈](../hermes/README.md#阶段回传与反馈)。本文件的 `accept` 是绑定具体产物的内部内容验收，不代表操作者已收到初稿或已反馈；定稿与发布仍须完成相应反馈环节。

## 使用交付约定

普通任务默认 narrative，保留灵活的文章结构，并增加成稿试读。多个数据集/benchmark 的介绍与具体数据形式使用 dataset-catalog；一般项目/方案目录可用 object-catalog，并在检索前调整共同介绍项。

```bash
python3 scripts/research-workflow.py plan --question "介绍这些数据集，并展示实际数据形式" --mode custom --slug benchmark-intro --deliverable dataset-catalog --subject gsm8k=GSM8K --subject humaneval=HumanEval
# 细化 task.json：原问题、范围、必答项、读取边界和真正要执行的查询
python3 scripts/research-workflow.py handoff --task .research/tasks/benchmark-intro/task.json
python3 scripts/research-workflow.py discover --task .research/tasks/benchmark-intro/task.json
```

真实调研任务样例见 [examples/benchmark-delivery.json](examples/benchmark-delivery.json)。它是计划，未宣称样例中的所有对象已完成调研。

目录型任务的必答矩阵为“每个对象 × 每项内容”。默认数据集项：是什么、测什么、样本单位、版本、规模与切分、存储格式、模型输入、预期输出、判分、训练/评测用途与局限。检索的知识轴不能替代这个矩阵；全局 data 轴有足够引用，不代表每个数据集都已介绍。

如果还要准则或理论，在任务中增加相应轴和查询，集中解释这些问题。不要在每个数据集末尾机械复制“没有理论保证”代替具体说明。需要的字段和角色由任务决定：数学通常是 input/reference；代码可能还需 scoring；网页任务可要求 input/environment/scoring。先明确这些语义，再让程序核验字段是否存在。

## 先准备对象说明和实际样本

在运行目录写 cards.json 数组。每个对象一张卡，包含 subject_id、facets、schema、specimens；它是写作前的事实底稿，不是任意段落集合。正文逐对象渲染这些说明、字段与样本，保持完整；sections 用于必要的总览或横向解释。

- facets：按 task.delivery.facets 的 ID 填写，每项为 `{"text":"连贯的说明","source_urls":["已读原文 URL"]}`。清单用于防漏，段落应连贯，避免像填写检查日志一样写正文。
- schema：数组，每项有 path（如 `/question`）、type、role、description、source_urls。role 区分 input/reference/scoring/environment/metadata。type 用 string/integer/number/boolean/array/object/null。
- evidence 的 subject_ids 标明资料支持的具体对象。分别记录发现方式、实际阅读范围和支持主张的位置。
- specimens：实际文件中的记录，由脚本读取，不让模型手写一段自称真实的 JSON。

样本配置例子（仅格式演示，不是真实采集记录）：

```json
{
  "id": "gsm8k-example",
  "source_url": "https://example.org/test.jsonl",
  "source_file": "specimens/test.jsonl",
  "source_sha256": "实际保存文件的 SHA256",
  "format": "jsonl",
  "record_index": 1,
  "display_fields": ["question", "answer"],
  "walkthrough": {
    "input": "说明这一条真实记录中，模型具体接收什么。",
    "output": "说明这个问题期待模型生成怎样的结果。",
    "scoring": "用本条记录解释答案提取或评分过程，并与本对象的评分说明一致。"
  }
}
```

source_file 必须在运行目录的 specimens/ 内。format 支持 json、jsonl、jsonl-gzip、python-tasks；后者只读 Task/Action 字面量，绝不执行文件。record_index 从 0 起，JSONL 按非空记录计数。原始 Parquet 等格式用真实解析器读取，保存可追溯的机械解码结果，注明 source_format 与 extraction_note；不把解码后的 JSON 冒称原始载体。转换过程仍需负责人核对。

display_fields 只能选择实际存在的完整字段，不截断字段值。模型写出的 content/record 不能代替源文件。渲染器标注完整记录或字段投影，并列出省略字段。源文件哈希只证明对应的是这份本地文件，不能自动证明下载出处或原文支持；仍需来源审阅。

collect 会先做来源检查，再检查逐对象矩阵与样本。即使全局来源计数满足，缺对象、缺必答项、缺实际输入/目标角色或缺样本说明仍会产生补查任务。--allow-partial 可以生成明确不完整的本地草稿，不能将缺失的必答内容自动转成最终验收通过。

## 写作后先试读，再用程序确认

catalog-article.schema.json 在通用文章上增加 catalog_order，必须包含所有约定对象，顺序固定。事实底稿中的对象卡和原始样本自动插入同一节，避免模型把它们再次拆散。字段表与代码块作为说明工具，不能替代自然语言解释。普通 narrative 仍使用 task-article.schema.json。

report 生成本地报告与 acceptance-prompt.md。实际负责人按[写作总则](../writing/README.md#成稿质量与试读)试读全文；数据集交付另核对输入—输出—评分，并抽查原始材料。通过后写 acceptance.json：

```json
{
  "reviewer": "实际完成审阅的负责人",
  "fingerprints": {"task_sha256":"从 acceptance-brief.json 复制", "bundle_sha256":"对应值", "article_sha256":"对应值", "report_sha256":"对应值"},
  "checks": [
    {"id":"request-fulfillment", "status":"pass", "notes":"具体说明读到了什么，以及为何满足本项要求。", "locations":["report:whole"]}
  ]
}
```

上例只展示一项；实际 required_checks 列在 acceptance-brief.json 中，需逐项填写。合法位置包括 report:whole、section:0（从 0 起）、subject:gsm8k、specimen:gsm8k-example、source:S1 等。必须指向实际存在的位置，对象检查要指向那个对象/样本。不能只写“通过”，不能伪造他人审阅。

```bash
python3 scripts/research-workflow.py accept --task .research/tasks/benchmark-intro/task.json --acceptance .research/runs/日期-benchmark-intro/acceptance.json
```

新任务必须先读成稿并 accept，才能 integrate 或 publish。哈希用于确保验收的是这份文章和这份报告，改文后需重新试读与验收；它不证明文章正确。已接入文章的内容哈希登记在 catalog，CI 能发现验收后直接改写页面的情况。不要用手工 origin=manual 或先写网页再补 JSON 绕开交付约定。

旧任务和历史文章保持兼容，不追认它们已经通过新标准。失败案例与验证范围见 [DELIVERY_VALIDATION.md](DELIVERY_VALIDATION.md)。
