# 站主批注

HTML 和 PDF 阅读器共用一份站主笔记库。访客可以阅读标记为公开的原文批注。整篇笔记、书签和新建批注默认私有。站主可在批注卡片菜单公开或撤回单条批注。首次登录后，当前文档中的旧本机记录可按需导入为私有笔记；原备份仍保留。

## 登录和部署

1. 在 Cloudflare One 的 Access 控制中为生产主机 `seagull-llm.pages.dev` 的路径 `/api/notes/owner` 建立自托管应用。选择 One-time PIN 登录，添加 Allow 策略，Emails 精确匹配站主批准的邮箱。文章路径和 `/api/notes/public` 保持公开。如果从 Pages 创建 Access 策略，检查应用主机和路径，区分生产主机和预览主机。[Pages 主机设置](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain) · [邮箱验证码](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
2. 将团队域名（如 `team.cloudflareaccess.com`，省略协议）、应用 Audience 值和逗号分隔的站主邮箱分别保存到 Pages 生产环境的 `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`、`NOTES_OWNER_EMAILS`。可用 `npx wrangler pages secret put <变量名> --project-name seagull-llm --env production` 交互写入。邮箱允许列表在服务端复核，所有列入的邮箱共用同一份笔记库。
3. `wrangler.toml` 中的 `NOTES_DB` 指向生产 D1。部署新版本前运行 `npx wrangler d1 migrations apply seagull-notes --remote`。预览环境使用独立数据库，启用预览笔记时单独填写其数据库 ID 与登录配置。
4. 在仓库根目录运行 `npm run build`。使用项目已有 Git 部署流程，或在确认本次发布内容后执行 `npx wrangler pages deploy docs/.vitepress/dist --project-name seagull-llm --branch main`。Functions 位于仓库根目录的 `functions/`。站主在阅读器点击「作者登录」，输入首选邮箱和收到的验证码，验证成功后回到原文。

## 验证

- 本地运行 `npm run test:notes` 验证记录格式、签发方与应用受众、邮箱权限、发布与撤回、乐观并发控制和删除传播。运行 `npx wrangler d1 migrations apply seagull-notes --local` 与 `npx wrangler pages dev docs/.vitepress/dist` 可使用本地 D1 检查公开接口。本地开发使用被 Git 忽略的 `.dev.vars`。
- 线上用两个独立浏览器会话验收。在作者会话建立私有批注，确认访客看不到，然后公开并刷新访客页面。第二台设备用允许的邮箱登录并修改同一条批注，刷新第一台设备确认同步。撤回公开后刷新访客视图，批注应消失。
- 登录后的未上传修改进入 IndexedDB。重开阅读器并登录后继续同步。若两台设备以同一旧版本写入，面板提供保留云端记录并把本机编辑另存为私有副本的操作。
