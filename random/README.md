# random 站点部署

1. 将 `hlqtcf.com` 的 A/AAAA 记录指向部署主机，并确保公网 80、443 端口能到达这台主机。
2. 在本目录运行 `docker compose up -d`，启动静态站点。

Caddy 首次启动时会为 `hlqtcf.com` 自动申请证书，之后自动续期。证书和私钥保存在 `caddy_data` 卷中；不要删除该卷。这个 Compose 与仓库根目录的五站点 Compose 独立。

## Telegram 管理机器人

页面每次打开都会读取 `data/destinations.json`，从中随机选择一个 HTTPS 地址跳转。初始目标是 `https://qq.com` 和 `https://baidu.com`。机器人更新该文件后，网页无需重建或重启。

1. 从 Telegram 的 BotFather 获取机器人 token，从 `my.telegram.org` 获取 API ID 和 API hash。将 `.env.example` 复制为 `.env`，仅在服务器上填入这三项；不要把 `.env`、token、API hash 或会话文件提交到仓库。`TELEGRAM_OWNER_ID` 已在 Compose 中配置；如果要更换创建者，可在 `.env` 中设置此项覆盖默认值。普通 BotFather token 不能提供创建者 ID。
2. 运行 `docker compose --profile bot up -d --build`，并将机器人加入用于授权的群组。
3. **已配置的机器人创建者**在目标群组回复某个成员的消息发送 `/auth`，机器人会自动读取并绑定该群组，然后授权该成员。之后只有这个群组中的创建者回复命令可以更改授权；回复发送 `/revoke` 可撤销授权。匿名管理员消息无法识别个人身份，不能用于授权。
4. 获授权成员私聊机器人，使用 `/list`、`/add https://example.com`、`/remove 1` 或 `/set https://a.example https://b.example`。至少保留一个目标；只接受 HTTPS 地址。

绑定群组、授权名单和 Telegram 会话保存在 `bot_session` 卷中；站点只读取目标 JSON，不会提供机器人凭据或授权名单。
