import json
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs

from bot import (
    can_manage_authorizations,
    command_name,
    execute_command,
    find_quoted_sender,
    group_command,
    group_member_is_user,
    load_authorization,
    load_destinations,
    numeric_user_id,
    owner_id_from_env,
    quote_digest,
    quoted_text,
    register_bot_commands,
    remember_group_message,
    save_authorization,
    save_destinations,
    validate_url,
)


class RedirectConfigTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "destinations.json"
        save_destinations(["https://one.example", "https://two.example"], self.path)

    def tearDown(self):
        self.directory.cleanup()

    def test_add_remove_and_replace_persist(self):
        execute_command("/add https://three.example/path", self.path)
        self.assertEqual(len(load_destinations(self.path)), 3)
        execute_command("/remove 2", self.path)
        self.assertEqual(load_destinations(self.path), ["https://one.example", "https://three.example/path"])
        execute_command("/set https://four.example", self.path)
        self.assertEqual(load_destinations(self.path), ["https://four.example"])
        self.assertEqual(json.loads(self.path.read_text())["destinations"], ["https://four.example"])

    def test_invalid_update_leaves_existing_configuration(self):
        for command in (
            "/add javascript:alert(1)",
            "/set https://new.example https://new.example",
            "/set http://new.example",
        ):
            with self.assertRaises(ValueError):
                execute_command(command, self.path)
            self.assertEqual(load_destinations(self.path), ["https://one.example", "https://two.example"])

    def test_cannot_remove_last_destination(self):
        execute_command("/set https://only.example", self.path)
        self.assertIn("至少保留", execute_command("/remove 1", self.path))
        self.assertEqual(load_destinations(self.path), ["https://only.example"])

    def test_owner_and_group_authorization(self):
        self.assertEqual(owner_id_from_env("123"), 123)
        self.assertIsNone(owner_id_from_env(""))
        self.assertTrue(can_manage_authorizations(-100456, 123, None, 123))
        self.assertTrue(can_manage_authorizations(-100456, 123, -100456, 123))
        self.assertFalse(can_manage_authorizations(-100999, 123, -100456, 123))
        self.assertFalse(can_manage_authorizations(-100456, 999, -100456, 123))
        self.assertEqual(command_name("/auth@redirect_bot"), "/auth")

        auth_path = Path(self.directory.name) / "authorized_users.json"
        self.assertEqual(load_authorization(auth_path), (None, set()))
        save_authorization(-100456, {111, 222}, auth_path)
        self.assertEqual(load_authorization(auth_path), (-100456, {111, 222}))
        save_authorization(-100456, {222}, auth_path)
        self.assertEqual(load_authorization(auth_path), (-100456, {222}))
        with self.assertRaises(ValueError):
            save_authorization(-100999, {222}, auth_path)
        with self.assertRaises(ValueError):
            validate_url("https://user:password@example.com")

    def test_group_authorization_target_and_recipient(self):
        self.assertEqual(group_command("/auth@fk_ios_bot 42", "fk_ios_bot"), ("/auth", ["42"]))
        self.assertEqual(group_command("/auth@other_bot 42", "fk_ios_bot"), ("", []))
        self.assertEqual(group_command("/auth", "fk_ios_bot"), ("/auth", []))
        self.assertEqual(numeric_user_id(["42"]), 42)
        for arguments in (["0"], ["@someone"], ["42", "43"], []):
            self.assertIsNone(numeric_user_id(arguments))

    def test_group_member_lookup_rejects_nonmembers_and_bots(self):
        class Response(BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *_):
                self.close()

        for status, is_bot, expected in (
            ("member", False, True),
            ("left", False, False),
            ("member", True, False),
        ):
            result = {"ok": True, "result": {"status": status, "user": {"id": 42, "is_bot": is_bot}}}
            with patch("bot.urlopen", return_value=Response(json.dumps(result).encode())) as urlopen:
                self.assertEqual(group_member_is_user("test-token", -100123, 42), expected)
                self.assertEqual(urlopen.call_args.args[0].data, b"chat_id=-100123&user_id=42")

    def test_command_menu_has_chinese_private_and_group_descriptions(self):
        class Response(BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *_):
                self.close()

        with patch("bot.urlopen", side_effect=lambda *_args, **_kwargs: Response(b'{"ok":true,"result":true}')) as urlopen:
            register_bot_commands("test-token")
        self.assertEqual(urlopen.call_count, 2)
        private, group = [parse_qs(call.args[0].data.decode()) for call in urlopen.call_args_list]
        self.assertEqual(json.loads(private["scope"][0]), {"type": "all_private_chats"})
        self.assertEqual(json.loads(group["scope"][0]), {"type": "all_group_chats"})
        self.assertEqual({item["command"] for item in json.loads(private["commands"][0])},
                         {"start", "list", "add", "remove", "set", "whoami", "help"})
        self.assertEqual({item["command"] for item in json.loads(group["commands"][0])},
                         {"auth", "revoke", "whoami", "groupid"})
        self.assertTrue(all(any("\u4e00" <= char <= "\u9fff" for char in item["description"])
                            for commands in (private, group) for item in json.loads(commands["commands"][0])))

    def test_quote_authorization_requires_unique_original_sender(self):
        index = Path(self.directory.name) / "quotes.json"
        remember_group_message(-1001, 10, 42, "第一行\n第二行", index)
        self.assertEqual(find_quoted_sender(-1001, 20, "第一行 第二行", index), (42, False))
        self.assertEqual(find_quoted_sender(-1002, 20, "第一行 第二行", index), (None, False))
        self.assertEqual(find_quoted_sender(-1001, 10, "第一行 第二行", index), (None, False))
        remember_group_message(-1001, 11, 43, "第一行 第二行", index)
        self.assertEqual(find_quoted_sender(-1001, 20, "第一行 第二行", index), (None, True))
        self.assertNotIn("第一行", index.read_text())
        self.assertEqual(len(quote_digest("第一行 第二行")), 64)

    def test_extract_formatted_quote(self):
        class Message:
            reply_to = None
            raw_text = "成员的原消息\n/auth"

            def get_entities_text(self, _kind):
                return [(object(), "成员的原消息")]

        self.assertEqual(quoted_text(Message()), "成员的原消息")


if __name__ == "__main__":
    unittest.main()
