# 独立调研 CLI

本目录保存固定订阅与结构化任务的配置、文章 JSON 契约、运行示例和历史实测记录。撰写独立论文调研稿从[仓库入口](../AGENTS.md#论文调研)开始。人工向网站添加「每日调研」文章，按[网站发布流程](../writing/publishing.md#新增每日调研)登记正文和目录。

## 运行与恢复

- 使用固定来源和时间窗生成订阅简报，见[日报命令](daily.md)。
- 按已有 `task.json` 采集、写作、生成本地 Markdown 报告或恢复任务，见[结构化任务契约](task-pipeline.md)。含 `delivery` 的任务另见[交付验收](delivery-contract.md)。
- 系统服务与定时器示例位于 `systemd/`。配置中的用户、工作目录与发布授权取决于部署环境。

## 脚本生成的稿件接入网站

带 `--task` 的任务可以停在本地报告，按[阶段回传与反馈](../hermes/README.md#阶段回传与反馈)交付初稿。固定订阅模式的 `run` 会继续接入和构建，需要等候反馈时使用[分步命令](daily.md#固定订阅流水线)。有 `delivery` 约定时，读完成稿后运行 `accept`。修稿后重新生成并验收。

`integrate` 按路由写 Markdown 并更新 [catalog.json](../docs/research/catalog.json)，同一路由再次接入会替换正文，并保留原记录的 `label`、`sidebarTitle` 和 `children`。执行前核对路由及同日手工稿。[主程序](../scripts/research-workflow.py)负责接入与发布，[任务模块](../scripts/research_tasks.py)负责本地报告。

按[发布前验证](../writing/publishing.md#发布前验证)检查。自动发布范围仅含目录文件和目录登记的顶层 Markdown。专题子章、字体或站点代码一并变更时，按实际范围审阅、提交并核验线上路由。
