# random 站点部署

1. 将 `hlqtcf.com` 的 A/AAAA 记录指向部署主机，并确保公网 80、443 端口能到达这台主机。
2. 在本目录运行 `docker compose up -d`，启动静态站点。

Caddy 首次启动时会为 `hlqtcf.com` 自动申请证书，之后自动续期。证书和私钥保存在 `caddy_data` 卷中；不要删除该卷。这个 Compose 与仓库根目录的五站点 Compose 独立。

## Telegram 管理机器人

页面每次打开都会读取 `data/destinations.json`，从中随机选择一个 HTTPS 地址跳转。初始目标是 `https://qq.com` 和 `https://baidu.com`。机器人更新该文件后，网页无需重建或重启。

1. 从 Telegram 的 BotFather 获取机器人 token，从 `my.telegram.org` 获取 API ID 和 API hash。将 `.env.example` 复制为 `.env`，仅在服务器上填入这三项；不要把 `.env`、token、API hash 或会话文件提交到仓库。`TELEGRAM_OWNER_ID` 已在 Compose 中配置；如果要更换创建者，可在 `.env` 中设置此项覆盖默认值。普通 BotFather token 不能提供创建者 ID。
2. 运行 `docker compose --profile bot up -d --build`；Podman 主机使用 `podman-compose --profile bot up -d --build`。然后将机器人加入用于授权的群组。
3. 将机器人设为目标群组管理员。**已配置的机器人创建者**可以回复成员原始消息，或引用机器人入群后收到的完整消息并在最后一行发送 `/auth@机器人用户名`；也可以直接发送 `/auth@机器人用户名 数字用户ID`。文字引用只在本群找到唯一匹配的原发送者时生效；机器人会再次核验其成员身份。首次授权时自动绑定该群。`/revoke` 同样支持这三种方式。匿名管理员消息无法识别个人身份。群命令也兼容不带 `@机器人用户名` 的写法。
4. 获授权成员可在私聊或已绑定的群组使用 `/list`、`/add https://example.com`、`/remove 1` 或 `/set https://a.example https://b.example`；创建者也可在已绑定的群组使用这些命令。群组消息对群成员可见。至少保留一个目标；只接受 HTTPS 地址。

机器人启动时会注册中文命令菜单：私聊输入 `/` 可看到地址管理命令，群聊输入 `/` 可看到授权、地址管理与查询命令。命令菜单只提供提示，执行时仍按创建者 ID 和授权名单校验权限。

绑定群组、授权名单、最近 500 条群消息的文字摘要和 Telegram 会话保存在 `bot_session` 卷中；摘要保留最多 7 天，不保存消息正文。站点只读取目标 JSON，不会提供机器人凭据或授权名单。
