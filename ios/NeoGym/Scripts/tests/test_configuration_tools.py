from __future__ import annotations

import importlib.util
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]


def load_script(name: str):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


materializer = load_script("materialize-config.py")
validator = load_script("validate-build-config.py")
patcher = load_script("disable-xcode-debug-options.py")


class MaterializerTests(unittest.TestCase):
    def test_escaping_round_trips_hostile_values_without_execution(self) -> None:
        hostile_values = [
            "  spaces stay  ",
            "#hash // slash-comment",
            "'single' and \"double\" quotes",
            r"back\\slashes and bare$dollar",
            "${INTERPOLATION_DISABLED}",
            "$(XCCONFIG_EXPANSION_INERT)",
            "`touch should-not-exist` ; $(touch should-not-exist)",
        ]
        for value in hostile_values:
            encoded = materializer.escape_xcconfig(value)
            self.assertEqual(materializer.unescape_xcconfig(encoded), value)

    def test_dotenv_interpolation_is_disabled_and_shell_text_is_inert(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            marker = root / "executed"
            env = root / ".env.development"
            env.write_text(
                "DEVELOPMENT_TEAM='TEAM # exact'\n"
                "NHOST_SUBDOMAIN='${DO_NOT_INTERPOLATE}'\n"
                f"NHOST_REGION='`touch {marker}`; // exact'\n"
                "ASC_ISSUER_ID=issuer-must-not-enter\n"
                "ASC_KEY_ID=key-id-must-not-enter\n"
                "ASC_KEY_PATH=/private/key-must-not-enter.p8\n"
                "ASC_KEY_CONTENT=private-content-must-not-enter\n",
                encoding="utf-8",
            )
            values = materializer.load_dotenv(env)
            self.assertEqual(values["DEVELOPMENT_TEAM"], "TEAM # exact")
            self.assertEqual(values["NHOST_SUBDOMAIN"], "${DO_NOT_INTERPOLATE}")
            self.assertEqual(values["NHOST_REGION"], f"`touch {marker}`; // exact")
            self.assertFalse(marker.exists())
            rendered = materializer.render_xcconfig(values)
            for forbidden in [
                "ASC_ISSUER_ID",
                "ASC_KEY_ID",
                "ASC_KEY_PATH",
                "ASC_KEY_CONTENT",
                "issuer-must-not-enter",
                "key-id-must-not-enter",
                "key-must-not-enter.p8",
                "private-content-must-not-enter",
            ]:
                self.assertNotIn(forbidden, rendered)

    def test_private_atomic_replacement_and_single_variant_preservation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env_dir = root / "fastlane"
            output_dir = root / "Generated"
            env_dir.mkdir()
            for variant in ("development", "production"):
                (env_dir / f".env.{variant}").write_text(
                    f"DEVELOPMENT_TEAM=TEAM-{variant}\n"
                    f"NHOST_SUBDOMAIN=subdomain-{variant}\n"
                    f"NHOST_REGION=region-{variant}\n",
                    encoding="utf-8",
                )
                materializer.materialize(variant, env_dir, output_dir)

            production = output_dir / "Production.xcconfig"
            production_before = production.read_bytes()
            (env_dir / ".env.development").write_text(
                "DEVELOPMENT_TEAM=REPLACED\nNHOST_SUBDOMAIN=sub\nNHOST_REGION=region\n",
                encoding="utf-8",
            )
            development = materializer.materialize("development", env_dir, output_dir)
            self.assertEqual(stat.S_IMODE(development.stat().st_mode), 0o600)
            self.assertEqual(production.read_bytes(), production_before)
            self.assertEqual(stat.S_IMODE(production.stat().st_mode), 0o600)

    def test_missing_and_empty_errors_name_keys_without_values(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / ".env.production"
            path.write_text(
                "DEVELOPMENT_TEAM=\nNHOST_SUBDOMAIN=secret-value\n", encoding="utf-8"
            )
            with self.assertRaises(materializer.ConfigError) as context:
                materializer.load_dotenv(path)
            message = str(context.exception)
            self.assertIn("DEVELOPMENT_TEAM", message)
            self.assertIn("NHOST_REGION", message)
            self.assertNotIn("secret-value", message)


class PreflightTests(unittest.TestCase):
    def test_placeholder_is_rejected_with_key_only_diagnostic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            generated = Path(temporary)
            content = materializer.render_xcconfig(
                {
                    "DEVELOPMENT_TEAM": "TEAM",
                    "NHOST_SUBDOMAIN": "${UNEXPANDED_SENTINEL}",
                    "NHOST_REGION": "opaque-region",
                }
            )
            (generated / "Development.xcconfig").write_text(content, encoding="utf-8")
            stream = StringIO()
            with redirect_stderr(stream):
                result = validator.main(
                    [
                        "--configuration",
                        "Debug-Development",
                        "--generated-dir",
                        str(generated),
                    ]
                )
            self.assertEqual(result, 1)
            self.assertIn("NEOGYM_NHOST_SUBDOMAIN", stream.getvalue())
            self.assertNotIn("UNEXPANDED_SENTINEL", stream.getvalue())

    def test_build_environment_is_checked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            generated = Path(temporary)
            content = materializer.render_xcconfig(
                {
                    "DEVELOPMENT_TEAM": "TEAM",
                    "NHOST_SUBDOMAIN": "opaque-subdomain",
                    "NHOST_REGION": "opaque-region",
                }
            )
            (generated / "Production.xcconfig").write_text(content, encoding="utf-8")
            old = os.environ.copy()
            try:
                os.environ.update(
                    DEVELOPMENT_TEAM="TEAM",
                    NEOGYM_NHOST_SUBDOMAIN="opaque-subdomain",
                    NEOGYM_NHOST_REGION="opaque-region",
                )
                self.assertEqual(
                    validator.validate("Release-Production", generated, True), []
                )
                os.environ.pop("NEOGYM_NHOST_REGION")
                self.assertEqual(
                    validator.validate("Release-Production", generated, True),
                    ["NEOGYM_NHOST_REGION"],
                )
            finally:
                os.environ.clear()
                os.environ.update(old)


class SchemePatcherTests(unittest.TestCase):
    def test_patcher_is_idempotent(self) -> None:
        source = '<Scheme><LaunchAction buildConfiguration="Debug"/></Scheme>'
        path = Path("NeoGym Dev.xcscheme")
        once = patcher.set_launch_action_attributes(source, path)
        twice = patcher.set_launch_action_attributes(once, path)
        self.assertEqual(once, twice)
        for key, value in patcher.LAUNCH_ACTION_ATTRIBUTES.items():
            self.assertIn(f'{key} = "{value}"', once)


class SafeInspectorTests(unittest.TestCase):
    def test_sentinel_never_reaches_process_output_and_raw_capture_is_removed(
        self,
    ) -> None:
        sentinel = "opaque-NHOST-stdout-secret"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            fake_xcrun = fake_bin / "xcrun"
            fake_xcrun.write_text(
                "#!/bin/sh\n"
                'printf \'%s\\n\' \'[{"target":"NeoGym","buildSettings":{"NEOGYM_NHOST_SUBDOMAIN":"'
                + sentinel
                + "\"}}]'\n"
                "printf '%s\\n' 'stderr-" + sentinel + "' >&2\n",
                encoding="utf-8",
            )
            fake_xcrun.chmod(0o755)
            output = root / "selected.json"
            environment = os.environ.copy()
            environment["NEOGYM_XCRUN"] = str(fake_xcrun)
            environment["TMPDIR"] = str(root)
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "read-build-settings.py"),
                    "--scheme",
                    "NeoGym",
                    "--configuration",
                    "Debug-Production",
                    "--target",
                    "NeoGym",
                    "--field",
                    "NEOGYM_NHOST_SUBDOMAIN",
                    "--output",
                    str(output),
                ],
                cwd=root,
                env=environment,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotIn(sentinel, result.stdout)
            self.assertNotIn(sentinel, result.stderr)
            try:
                selected = json.loads(output.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                self.fail(f"safe inspector did not produce valid JSON: {error}")
            self.assertEqual(selected["NEOGYM_NHOST_SUBDOMAIN"], sentinel)
            self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)
            self.assertEqual(
                [
                    path
                    for path in root.glob("neogym-build-settings-*")
                    if path.exists()
                ],
                [],
            )

    def test_non_allowlisted_field_fails_without_naming_value(self) -> None:
        inspector = load_script("read-build-settings.py")
        with self.assertRaisesRegex(RuntimeError, "not allowlisted"):
            inspector.read_settings(
                Path("project"), "scheme", "config", "target", ["ASC_PRIVATE_KEY"]
            )


if __name__ == "__main__":
    unittest.main()
