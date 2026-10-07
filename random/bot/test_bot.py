import json
import tempfile
import unittest
from pathlib import Path

from bot import (
    can_manage_authorizations,
    command_name,
    execute_command,
    load_authorization,
    load_destinations,
    owner_id_from_env,
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


if __name__ == "__main__":
    unittest.main()
