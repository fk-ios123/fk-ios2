"""Telegram administrator commands for the random redirect destinations."""

import asyncio
import hashlib
import json
import logging
import os
import tempfile
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

from telethon import TelegramClient, events, types
from telethon.errors import RPCError


CONFIG_PATH = Path(os.environ.get("DESTINATIONS_PATH", "/data/destinations.json"))
SESSION_PATH = os.environ.get("TELEGRAM_SESSION_PATH", "/state/redirect_bot")
AUTH_PATH = Path(os.environ.get("TELEGRAM_AUTH_PATH", "/state/authorized_users.json"))
QUOTE_INDEX_PATH = Path(os.environ.get("TELEGRAM_QUOTE_INDEX_PATH", "/state/quote_index.json"))
MAX_DESTINATIONS = 20
MAX_QUOTE_MESSAGES = 500
QUOTE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
PRIVATE_COMMANDS = [
    {"command": "start", "description": "查看机器人使用说明"},
    {"command": "list", "description": "查看当前跳转地址"},
    {"command": "add", "description": "添加地址：/add https://example.com"},
    {"command": "remove", "description": "按序号删除地址：/remove 1"},
    {"command": "set", "description": "替换全部地址：/set 地址1 地址2"},
    {"command": "whoami", "description": "查看自己的 Telegram 用户 ID"},
    {"command": "help", "description": "查看全部使用说明"},
]
GROUP_COMMANDS = [
    {"command": "auth", "description": "创建者授权：回复成员消息或填写数字 ID"},
    {"command": "revoke", "description": "创建者撤销授权：回复消息或填写数字 ID"},
    {"command": "list", "description": "查看当前跳转地址"},
    {"command": "add", "description": "添加跳转地址：/add HTTP(S)地址"},
    {"command": "remove", "description": "按序号删除跳转地址：/remove 1"},
    {"command": "set", "description": "替换全部地址：/set 地址1 地址2"},
    {"command": "whoami", "description": "查看自己的 Telegram 用户 ID"},
    {"command": "groupid", "description": "查看当前群组 ID"},
]
DESTINATION_COMMANDS = frozenset({"/list", "/add", "/remove", "/set"})

HELP = (
    "跳转目标管理：\n"
    "/list 查看当前目标\n"
    "/add https://example.com 添加目标\n"
    "/remove 1 按序号删除目标\n"
    "/set https://a.example https://b.example 替换全部目标\n"
    "/help 查看命令\n"
    "授权由机器人创建者在群中回复或引用成员消息发送 /auth，也可发送 /auth 数字用户ID。"
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


def group_command(message: str, bot_username: str) -> tuple[str, list[str]]:
    parts = message.strip().split()
    if not parts:
        return "", []
    raw = parts[0]
    command, separator, recipient = raw.partition("@")
    if separator and recipient.lower() != bot_username.lower():
        return "", []
    return command.lower(), parts[1:]


def numeric_user_id(arguments: list[str]) -> int | None:
    if len(arguments) != 1 or not arguments[0].isdecimal():
        return None
    user_id = int(arguments[0])
    return user_id if user_id > 0 else None


def quoted_text(message) -> str | None:
    reply_header = getattr(message, "reply_to", None)
    reply_quote = getattr(reply_header, "quote_text", None)
    if isinstance(reply_quote, str) and reply_quote.strip():
        return reply_quote.strip()
    quotes = message.get_entities_text(types.MessageEntityBlockquote)
    if len(quotes) == 1 and quotes[0][1].strip():
        return quotes[0][1].strip()
    lines = (message.raw_text or "").strip().splitlines()
    if len(lines) > 1 and lines[-1].strip().startswith(("/auth", "/revoke")):
        return "\n".join(lines[:-1]).strip() or None
    return None


def quote_digest(value: str) -> str:
    normalized = " ".join(value.split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def load_quote_index(path: Path = QUOTE_INDEX_PATH) -> list[dict]:
    if not path.exists():
        return []
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError("引用索引格式无效")
    return value


def remember_group_message(chat_id: int, message_id: int, sender_id: int, text: str,
                           path: Path = QUOTE_INDEX_PATH) -> None:
    if not text.strip() or sender_id <= 0:
        return
    now = int(time.time())
    entries = [item for item in load_quote_index(path)
               if isinstance(item, dict) and isinstance(item.get("seen_at"), int)
               and item["seen_at"] >= now - QUOTE_MAX_AGE_SECONDS]
    entries.append({"chat_id": chat_id, "message_id": message_id, "sender_id": sender_id,
                    "digest": quote_digest(text), "seen_at": now})
    write_json_atomic(entries[-MAX_QUOTE_MESSAGES:], path, 0o600)


def find_quoted_sender(chat_id: int, before_message_id: int, quote: str,
                       path: Path = QUOTE_INDEX_PATH) -> tuple[int | None, bool]:
    digest = quote_digest(quote)
    cutoff = int(time.time()) - QUOTE_MAX_AGE_SECONDS
    senders = {item["sender_id"] for item in load_quote_index(path)
               if isinstance(item, dict) and item.get("chat_id") == chat_id
               and isinstance(item.get("message_id"), int) and item["message_id"] < before_message_id
               and isinstance(item.get("seen_at"), int) and item["seen_at"] >= cutoff
               and item.get("digest") == digest and isinstance(item.get("sender_id"), int)}
    return (next(iter(senders)), False) if len(senders) == 1 else (None, len(senders) > 1)


def telegram_bot_api(bot_token: str, method: str, parameters: dict) -> object:
    payload = urlencode(parameters).encode("utf-8")
    request = Request(f"https://api.telegram.org/bot{bot_token}/{method}", data=payload)
    with urlopen(request, timeout=10) as response:
        result = json.load(response)
    if not isinstance(result, dict) or result.get("ok") is not True:
        raise ValueError(f"Telegram {method} failed")
    return result.get("result")


def register_bot_commands(bot_token: str) -> None:
    for scope, commands in (
        ("all_private_chats", PRIVATE_COMMANDS),
        ("all_group_chats", GROUP_COMMANDS),
    ):
        success = telegram_bot_api(bot_token, "setMyCommands", {
            "commands": json.dumps(commands, ensure_ascii=False),
            "scope": json.dumps({"type": scope}),
        })
        if success is not True:
            raise ValueError(f"Telegram setMyCommands failed for {scope}")


def group_member_is_user(bot_token: str, chat_id: int, user_id: int) -> bool:
    member = telegram_bot_api(bot_token, "getChatMember", {"chat_id": chat_id, "user_id": user_id})
    if not isinstance(member, dict) or not isinstance(member.get("user"), dict):
        raise ValueError("Telegram member lookup failed")
    user = member["user"]
    if user.get("id") != user_id or user.get("is_bot") is True:
        return False
    status = member.get("status")
    return status in ("creator", "administrator", "member") or (
        status == "restricted" and member.get("is_member") is True
    )


def can_manage_authorizations(
    chat_id: int | None, sender_id: int | None, bound_group_id: int | None, owner_id: int | None
) -> bool:
    return (
        chat_id is not None
        and owner_id is not None
        and sender_id == owner_id
        and (bound_group_id is None or chat_id == bound_group_id)
    )


def can_manage_destinations(
    chat_id: int | None, sender_id: int | None, bound_group_id: int | None,
    authorized: set[int], owner_id: int | None,
) -> bool:
    return (
        chat_id is not None and chat_id == bound_group_id
        and sender_id is not None and sender_id > 0
        and ((owner_id is not None and sender_id == owner_id) or sender_id in authorized)
    )


def validate_url(value: str) -> str:
    if not isinstance(value, str) or not value or any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("请输入不含空格或控制字符的 HTTP 或 HTTPS 地址")
    try:
        parsed = urlsplit(value)
        parsed.port
    except ValueError as error:
        raise ValueError("地址格式无效") from error
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("请输入完整的 HTTP 或 HTTPS 地址")
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

    bot_username = ""

    @client.on(events.NewMessage(incoming=True))
    async def on_message(event) -> None:
        command = command_name(event.raw_text or "")
        if command == "/whoami" and isinstance(await event.get_sender(), types.User):
            await event.reply(f"你的 Telegram 用户 ID：{event.sender_id}", parse_mode=None)
            return
        if event.is_group:
            command_line = (event.raw_text or "").strip().splitlines()[-1] if (event.raw_text or "").strip() else ""
            command, arguments = group_command(command_line, bot_username)
            if not command.startswith("/") and not event.message.fwd_from and event.sender_id is not None:
                try:
                    remember_group_message(event.chat_id, event.id, event.sender_id, event.raw_text or "")
                except (OSError, ValueError, json.JSONDecodeError):
                    logging.exception("Could not index group message for quote authorization")
            if command == "/groupid":
                await event.reply(f"本群 ID：{event.chat_id}", parse_mode=None)
                return
            if command in DESTINATION_COMMANDS:
                try:
                    async with write_lock:
                        bound_group_id, authorized = load_authorization()
                        if not can_manage_destinations(
                            event.chat_id, event.sender_id, bound_group_id, authorized, owner_id
                        ):
                            return
                        reply = execute_command(command_line)
                except ValueError as error:
                    reply = f"配置未修改：{error}"
                except (OSError, json.JSONDecodeError):
                    logging.exception("Could not manage group redirect configuration")
                    reply = "配置读写失败，请查看机器人日志。"
                await event.reply(reply, parse_mode=None)
                return
            if command not in ("/auth", "/revoke"):
                return
            if owner_id is None:
                await event.reply("请先配置 TELEGRAM_OWNER_ID。", parse_mode=None)
                return
            if event.sender_id != owner_id:
                return
            if len(arguments) > 1 or (arguments and numeric_user_id(arguments) is None):
                await event.reply(f"用法：回复成员消息发送 {command}，或发送 {command} 数字用户ID。", parse_mode=None)
                return
            quote = quoted_text(event.message)
            if arguments and (event.is_reply or quote):
                await event.reply("请只使用回复、文字引用或数字用户 ID 中的一种方式指定成员。", parse_mode=None)
                return
            if not arguments and not event.is_reply and not quote:
                await event.reply(f"请回复或引用成员消息发送 {command}，也可发送 {command} 数字用户ID。", parse_mode=None)
                return
            try:
                if arguments:
                    target_id = numeric_user_id(arguments)
                elif event.is_reply:
                    target_message = await event.get_reply_message()
                    if target_message is not None and target_message.fwd_from:
                        await event.reply("请回复成员本人发送的原始消息，不要回复转发消息。", parse_mode=None)
                        return
                    target_id = target_message.sender_id if target_message is not None else None
                    if target_id is None and event.message.reply_to_sender is not None:
                        target_id = event.message.reply_to_sender.id
                else:
                    target_id, ambiguous = find_quoted_sender(event.chat_id, event.id, quote)
                    if ambiguous:
                        await event.reply("引用内容与多位成员的消息相同，请改用回复或数字用户 ID。", parse_mode=None)
                        return
            except (RPCError, OSError, ValueError, json.JSONDecodeError):
                logging.exception("Could not resolve authorization target")
                target_id = None
            if target_id is None or target_id <= 0:
                await event.reply("无法识别引用的原发送者。请引用机器人入群后收到的完整消息，或改用回复、数字用户 ID。", parse_mode=None)
                return
            try:
                is_member = await asyncio.to_thread(group_member_is_user, bot_token, event.chat_id, target_id)
            except (OSError, ValueError, json.JSONDecodeError):
                logging.warning("Could not verify target membership in group %s", event.chat_id)
                await event.reply("无法核验成员身份；请确认机器人是本群管理员后重试。", parse_mode=None)
                return
            if not is_member:
                await event.reply("只能授权本群真实成员账号。", parse_mode=None)
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
                            authorized.add(target_id)
                            action = "已授权"
                        else:
                            authorized.discard(target_id)
                            action = "已撤销"
                        save_authorization(group_id, authorized)
                        reply = f"{action}用户 {target_id}。"
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
    me = await client.get_me()
    if not isinstance(me, types.User) or not me.bot or not me.username:
        raise ValueError("Cannot verify bot username")
    bot_username = me.username
    await asyncio.to_thread(register_bot_commands, bot_token)
    logging.info("Redirect configuration bot started")
    await client.run_until_disconnected()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    asyncio.run(main())
