# 文献检索工具

批量发现文献、去重或追踪引文时，可按需使用 `scholar-deep-research`。可恢复的检索任务可采用其状态流水线，检索范围和材料是否充分由问题与证据缺口决定。

## 来源与环境

2026-10-16 在既有部署机安装过 [SkillHub 分发的 0.5.0 版本](https://skillhub.cn/skills/scholar-deep-research)，并通过其 29 项离线测试。来源与校验值见[安装记录](skills-installation.json)。使用前检查当前 checkout 的 `.agents/skills/scholar-deep-research/SKILL.md` 是否存在。

Hermes 可通过 `skills.external_dirs` 读取当前 checkout 的 `.agents/skills/`。依赖可装入独立的 Python 3.11+ 虚拟环境。部署机使用 `.research/tools/academic-venv/`，其中 httpx 版本为 0.28.1，pypdf 为 6.21.0。需要固定版本时可设置 `SCHOLAR_SKIP_UPDATE_CHECK=1`。
