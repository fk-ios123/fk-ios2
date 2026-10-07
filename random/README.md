# 多域名跳转服务部署

1. 每个域名使用独立的 `data/domains/<域名>/destinations.json`。首次使用时可运行 `mkdir -p data/domains/mm.hlqtcf.com && cp data/destinations.json data/domains/mm.hlqtcf.com/destinations.json` 初始化现有域名；升级已有安装时，应将当前环境中的 `data/destinations.json` 原样复制到这个位置。运行中的配置不提交到 Git。
2. 为需要访问的域名添加指向部署主机的 DNS 记录，并确保 ESA 对这个仅监听 HTTP 80 的源站使用 HTTP 80 回源。
3. 在本目录运行 `docker compose up -d`；Podman 主机运行 `podman-compose up -d --force-recreate web`。

一个 Node 服务按请求的 Host 读取对应域名的文件，直接返回 302 跳转，不提供网页，也不在源站申请 TLS 证书。未配置文件的域名返回 404；`/healthz` 用于健康检查。新增域名只需添加对应目录和 JSON 文件，无需重启服务；直接访问服务器 IP 如未配置该 IP 对应的文件也会返回 404。这个 Compose 与仓库根目录的五站点 Compose 独立。

## 运营后台

后台使用 Next.js、TypeScript、Tailwind CSS 和 daisyUI，独立账号密码，监听 `127.0.0.1:3000`。首次启动前在 `random` 目录运行 `node admin/scripts/init-credentials.ts admin.env admin-initial-password.txt`，会生成随机密码和会话密钥；这两个文件均不会提交到 Git。本地运行 `docker compose --profile admin up -d --build` 即可测试；后台与跳转服务共享 `data/domains`，保存后立即生效。

本地访问 `http://127.0.0.1:3000/`，从 `admin-initial-password.txt` 读取初始账号密码。运营人员可以在域名列表中筛选域名，点击“管理地址”进入该域名的独立页面，新增或修改跳转地址；新建域名后也会进入该页面。正式使用新域名时还需配置 DNS / ESA 解析和回源。机器人保持停用，且其代码保留。

## Telegram 管理机器人

每次访问 `/` 都会读取该域名的 `destinations.json`，随机选择一个 HTTP 或 HTTPS 地址并直接返回 HTTP 302。旧版 `data/destinations.json` 可用作首次迁移的来源。配置更新后，服务无需重建或重启。

1. 从 Telegram 的 BotFather 获取机器人 token，从 `my.telegram.org` 获取 API ID 和 API hash。将 `.env.example` 复制为 `.env`，仅在服务器上填入这三项；不要把 `.env`、token、API hash 或会话文件提交到仓库。`TELEGRAM_OWNER_ID` 已在 Compose 中配置；如果要更换创建者，可在 `.env` 中设置此项覆盖默认值。普通 BotFather token 不能提供创建者 ID。
2. 运行 `docker compose --profile bot up -d --build`；Podman 主机使用 `podman-compose --profile bot up -d --build`。然后将机器人加入用于授权的群组。
3. 将机器人设为目标群组管理员。**已配置的机器人创建者**可以回复成员原始消息，或引用机器人入群后收到的完整消息并在最后一行发送 `/auth@机器人用户名`；也可以直接发送 `/auth@机器人用户名 数字用户ID`。文字引用只在本群找到唯一匹配的原发送者时生效；机器人会再次核验其成员身份。首次授权时自动绑定该群。`/revoke` 同样支持这三种方式。匿名管理员消息无法识别个人身份。群命令也兼容不带 `@机器人用户名` 的写法。
4. 获授权成员可在私聊或已绑定的群组使用 `/list`、`/add https://example.com`、`/remove 1` 或 `/set https://a.example https://b.example`；创建者也可在已绑定的群组使用这些命令。群组消息对群成员可见。至少保留一个目标；接受格式正确的 HTTP 或 HTTPS 地址，包括自定义端口。机器人目前已停用，重新启用后只管理 `mm.hlqtcf.com` 的文件。

机器人启动时会注册中文命令菜单：私聊输入 `/` 可看到地址管理命令，群聊输入 `/` 可看到授权、地址管理与查询命令。命令菜单只提供提示，执行时仍按创建者 ID 和授权名单校验权限。

绑定群组、授权名单、最近 500 条群消息的文字摘要和 Telegram 会话保存在 `bot_session` 卷中；摘要保留最多 7 天，不保存消息正文。跳转服务只读取目标 JSON，不会提供机器人凭据、授权名单或 JSON 文件。
