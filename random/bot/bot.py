"""Telegram administrator commands for the random redirect destinations."""

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from telethon import TelegramClient, events, types
from telethon.errors import RPCError


CONFIG_PATH = Path(os.environ.get("DESTINATIONS_PATH", "/data/destinations.json"))
SESSION_PATH = os.environ.get("TELEGRAM_SESSION_PATH", "/state/redirect_bot")
AUTH_PATH = Path(os.environ.get("TELEGRAM_AUTH_PATH", "/state/authorized_users.json"))
MAX_DESTINATIONS = 20
MAX_URL_LENGTH = 180

HELP = (
    "跳转目标管理：\n"
    "/list 查看当前目标\n"
    "/add https://example.com 添加目标\n"
    "/remove 1 按序号删除目标\n"
    "/set https://a.example https://b.example 替换全部目标\n"
    "/help 查看命令\n"
    "授权由机器人创建者在指定群组回复成员消息后发送 /auth。"
)


def owner_id_from_env(value: str) -> int | None:
    if not value.strip():
        return None
    owner_id = int(value)
    if owner_id <= 0:
        raise ValueError("TELEGRAM_OWNER_ID must be a positive user ID")
    return owner_id


def command_name(message: str) -> str:
    return message.strip().partition(" ")[0].split("@", 1)[0].lower()


def can_manage_authorizations(
    chat_id: int | None, sender_id: int | None, bound_group_id: int | None, owner_id: int | None
) -> bool:
    return (
        chat_id is not None
        and owner_id is not None
        and sender_id == owner_id
        and (bound_group_id is None or chat_id == bound_group_id)
    )


def validate_url(value: str) -> str:
    if not isinstance(value, str) or not value or len(value) > MAX_URL_LENGTH or any(char.isspace() for char in value):
        raise ValueError("地址不能为空、含空格，或超过 180 个字符")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as error:
        raise ValueError("地址格式无效") from error
    if (
        parsed.scheme.lower() != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or (port is not None and port != 443)
    ):
        raise ValueError("仅允许不含账号信息的 HTTPS 地址")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("地址包含控制字符")
    return value


def load_destinations(path: Path = CONFIG_PATH) -> list[str]:
    document = json.loads(path.read_text(encoding="utf-8"))
    values = document.get("destinations")
    if not isinstance(values, list) or not values or len(values) > MAX_DESTINATIONS:
        raise ValueError("destinations 必须包含 1 到 20 个地址")
    destinations = [validate_url(value) for value in values]
    if len(set(destinations)) != len(destinations):
        raise ValueError("destinations 中有重复地址")
    return destinations


def write_json_atomic(document: dict, path: Path, mode: int) -> None:
    payload = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, prefix=".destinations-", delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.chmod(temporary_path, mode)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def save_destinations(destinations: list[str], path: Path = CONFIG_PATH) -> None:
    if not 1 <= len(destinations) <= MAX_DESTINATIONS:
        raise ValueError("必须保留 1 到 20 个跳转目标")
    destinations = [validate_url(value) for value in destinations]
    if len(set(destinations)) != len(destinations):
        raise ValueError("不能添加重复地址")
    write_json_atomic({"destinations": destinations}, path, 0o644)


def load_authorization(path: Path = AUTH_PATH) -> tuple[int | None, set[int]]:
    if not path.exists():
        return None, set()
    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("授权名单格式无效")
    group_id = document.get("group_id")
    ids = document.get("user_ids")
    if type(group_id) is not int or group_id == 0:
        raise ValueError("授权群组格式无效")
    if not isinstance(ids, list) or any(type(item) is not int or item <= 0 for item in ids):
        raise ValueError("授权名单格式无效")
    return group_id, set(ids)


def save_authorization(group_id: int, ids: set[int], path: Path = AUTH_PATH) -> None:
    if type(group_id) is not int or group_id == 0:
        raise ValueError("授权群组 ID 无效")
    if any(type(item) is not int or item <= 0 for item in ids):
        raise ValueError("授权用户 ID 无效")
    if path.exists() and load_authorization(path)[0] != group_id:
        raise ValueError("授权群组已绑定，不能改为其他群组")
    write_json_atomic({"group_id": group_id, "user_ids": sorted(ids)}, path, 0o600)


def format_destinations(destinations: list[str]) -> str:
    return "当前跳转目标：\n" + "\n".join(
        f"{index}. {url}" for index, url in enumerate(destinations, start=1)
    )


def execute_command(message: str, path: Path = CONFIG_PATH) -> str:
    command, _, argument = message.strip().partition(" ")
    command = command_name(command)
    argument = argument.strip()

    if command in ("/start", "/help"):
        return HELP
    if command == "/list":
        return format_destinations(load_destinations(path))
    if command == "/add":
        if not argument:
            return "用法：/add https://example.com"
        url = validate_url(argument)
        destinations = load_destinations(path)
        if url in destinations:
            return "该地址已存在。\n" + format_destinations(destinations)
        save_destinations([*destinations, url], path)
        return "已添加。\n" + format_destinations([*destinations, url])
    if command == "/remove":
        if not argument.isdecimal():
            return "用法：/remove 序号"
        destinations = load_destinations(path)
        index = int(argument) - 1
        if not 0 <= index < len(destinations):
            return "序号不存在。"
        if len(destinations) == 1:
            return "至少保留一个跳转目标。"
        removed = destinations.pop(index)
        save_destinations(destinations, path)
        return f"已删除 {removed}\n" + format_destinations(destinations)
    if command == "/set":
        urls = argument.split()
        if not urls:
            return "用法：/set https://a.example https://b.example"
        save_destinations(urls, path)
        return "已更新。\n" + format_destinations(urls)
    return HELP


async def main() -> None:
    required = ("TELEGRAM_API_ID", "TELEGRAM_API_HASH", "TELEGRAM_BOT_TOKEN")
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    if missing:
        raise ValueError("Missing Telegram configuration: " + ", ".join(missing))
    api_id = int(os.environ["TELEGRAM_API_ID"])
    if api_id <= 0:
        raise ValueError("TELEGRAM_API_ID must be positive")
    api_hash = os.environ["TELEGRAM_API_HASH"]
    bot_token = os.environ["TELEGRAM_BOT_TOKEN"]
    owner_id = owner_id_from_env(os.environ.get("TELEGRAM_OWNER_ID", ""))
    load_destinations()

    client = TelegramClient(SESSION_PATH, api_id, api_hash)
    write_lock = asyncio.Lock()

    @client.on(events.NewMessage(incoming=True))
    async def on_message(event) -> None:
        command = command_name(event.raw_text or "")
        if command == "/whoami" and isinstance(await event.get_sender(), types.User):
            await event.reply(f"你的 Telegram 用户 ID：{event.sender_id}", parse_mode=None)
            return
        if event.is_group:
            if command == "/groupid":
                await event.reply(f"本群 ID：{event.chat_id}", parse_mode=None)
                return
            if command not in ("/auth", "/revoke"):
                return
            if owner_id is None:
                await event.reply("请先配置 TELEGRAM_OWNER_ID。", parse_mode=None)
                return
            if event.sender_id != owner_id:
                return
            if not event.is_reply:
                await event.reply(f"请回复目标成员的消息发送 {command}。", parse_mode=None)
                return
            try:
                target_message = await event.get_reply_message()
                target = await target_message.get_sender() if target_message is not None else None
            except RPCError:
                logging.exception("Could not resolve replied-to message")
                target = None
            if target is None:
                await event.reply("无法读取被回复的消息，请重新回复该成员的消息。", parse_mode=None)
                return
            if not isinstance(target, types.User) or target.bot:
                await event.reply("只能授权或撤销真实用户账号。", parse_mode=None)
                return
            try:
                async with write_lock:
                    bound_group_id, authorized = load_authorization()
                    if not can_manage_authorizations(event.chat_id, event.sender_id, bound_group_id, owner_id):
                        return
                    if bound_group_id is None and command == "/revoke":
                        reply = "尚未绑定群组；请先在目标群组回复成员消息发送 /auth。"
                    else:
                        group_id = bound_group_id if bound_group_id is not None else event.chat_id
                        if command == "/auth":
                            authorized.add(target.id)
                            action = "已授权"
                        else:
                            authorized.discard(target.id)
                            action = "已撤销"
                        save_authorization(group_id, authorized)
                        reply = f"{action}用户 {target.id}。"
                await event.reply(reply, parse_mode=None)
            except (OSError, ValueError, json.JSONDecodeError):
                logging.exception("Could not update authorized users")
                await event.reply("授权名单读写失败，请查看机器人日志。", parse_mode=None)
            return
        if not event.is_private or not command.startswith("/"):
            return
        if owner_id is None:
            if command in ("/start", "/help"):
                await event.reply("机器人尚未配置创建者 ID。可发送 /whoami 查询用户 ID。", parse_mode=None)
            return
        try:
            async with write_lock:
                bound_group_id, authorized = load_authorization()
                if event.sender_id not in authorized:
                    if command in ("/start", "/help"):
                        reply = "尚未授权，请机器人创建者在绑定群组回复你的消息发送 /auth。"
                    else:
                        return
                else:
                    reply = execute_command(event.raw_text or "")
        except ValueError as error:
            reply = f"配置未修改：{error}"
        except (OSError, json.JSONDecodeError):
            logging.exception("Could not read or write redirect configuration")
            reply = "配置读写失败，请查看机器人日志。"
        await event.reply(reply, parse_mode=None)

    await client.start(bot_token=bot_token)
    logging.info("Redirect configuration bot started")
    await client.run_until_disconnected()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    asyncio.run(main())
