# random 站点部署

1. 将 `hlqtcf.com` 的 A/AAAA 记录指向部署主机，并确保公网 80、443 端口能到达这台主机。
2. 在本目录运行 `docker compose up -d`。

Caddy 首次启动时会为 `hlqtcf.com` 自动申请证书，之后自动续期。证书和私钥保存在 `caddy_data` 卷中；不要删除该卷。这个 Compose 只部署本目录的 `index.html`，与仓库根目录的五站点 Compose 独立。
