from __future__ import annotations

import importlib.util
import stat
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
PROJECT_ROOT = SCRIPTS.parent


def load_script(name: str):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


materializer = load_script("materialize-config.py")
patcher = load_script("disable-xcode-debug-options.py")


class MaterializerTests(unittest.TestCase):
    maxDiff = None

    @staticmethod
    def write_env(
        directory: Path,
        variant: str,
        *,
        team: str = "AB12CD34EF",
        base: str | None = None,
        subdomain: str | None = None,
        region: str = "eu-test-1",
    ) -> Path:
        if base is None:
            base = f"com.example.neogym.{variant}"
        if subdomain is None:
            subdomain = f"fixture-{variant}7"
        path = directory / f".env.{variant}"
        path.write_text(
            "".join(
                [
                    f"DEVELOPMENT_TEAM={team}\n",
                    f"BUNDLE_IDENTIFIER_BASE={base}\n",
                    f"NHOST_SUBDOMAIN={subdomain}\n",
                    f"NHOST_REGION={region}\n",
                ]
            ),
            encoding="utf-8",
        )
        path.chmod(0o600)
        return path

    def test_valid_real_shapes_and_derivations(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = self.write_env(
                root,
                "development",
                base="com.example.team2.neo-gym.dev",
                subdomain="project7-alpha",
                region="us-test-2",
            )
            config = materializer.parse_dotenv(path)
            self.assertEqual(
                config.derived_settings(),
                {
                    "DEVELOPMENT_TEAM": "AB12CD34EF",
                    "NEOGYM_APP_BUNDLE_IDENTIFIER": "com.example.team2.neo-gym.dev",
                    "NEOGYM_WIDGET_BUNDLE_IDENTIFIER": "com.example.team2.neo-gym.dev.widgets",
                    "NEOGYM_APP_GROUP_IDENTIFIER": "group.com.example.team2.neo-gym.dev",
                    "NEOGYM_KEYCHAIN_ACCESS_GROUP_SUFFIX": "com.example.team2.neo-gym.dev.shared",
                    "NEOGYM_NHOST_SUBDOMAIN": "project7-alpha",
                    "NEOGYM_NHOST_REGION": "us-test-2",
                },
            )

            local = self.write_env(
                root,
                "production",
                base="org.example.neogym",
                subdomain="local",
                region="local",
            )
            self.assertEqual(materializer.parse_dotenv(local).nhost_region, "local")

    def test_examples_have_exact_keys_and_empty_values(self) -> None:
        expected = [f"{key}=" for key in materializer.REQUIRED_KEYS]
        for variant in materializer.VARIANTS:
            path = PROJECT_ROOT / f".env.{variant}.example"
            self.assertEqual(path.read_text(encoding="utf-8").splitlines(), expected)

    def test_rejects_missing_empty_unknown_duplicate_and_non_private_mode(self) -> None:
        cases = {
            "missing": "DEVELOPMENT_TEAM=AB12CD34EF\nBUNDLE_IDENTIFIER_BASE=com.example.app\nNHOST_SUBDOMAIN=local\n",
            "empty": "DEVELOPMENT_TEAM=\nBUNDLE_IDENTIFIER_BASE=com.example.app\nNHOST_SUBDOMAIN=local\nNHOST_REGION=local\n",
            "unknown": "DEVELOPMENT_TEAM=AB12CD34EF\nBUNDLE_IDENTIFIER_BASE=com.example.app\nNHOST_SUBDOMAIN=local\nNHOST_REGION=local\nPRIVATE_TOKEN=do-not-print\n",
            "duplicate": "DEVELOPMENT_TEAM=AB12CD34EF\nDEVELOPMENT_TEAM=ZX98YU76TR\nBUNDLE_IDENTIFIER_BASE=com.example.app\nNHOST_SUBDOMAIN=local\nNHOST_REGION=local\n",
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name, content in cases.items():
                with self.subTest(name=name):
                    path = root / f".{name}"
                    path.write_text(content, encoding="utf-8")
                    path.chmod(0o600)
                    with self.assertRaises(materializer.ConfigError) as context:
                        materializer.parse_dotenv(path)
                    self.assertNotIn("PRIVATE_TOKEN", str(context.exception))
                    self.assertNotIn("do-not-print", str(context.exception))
                    self.assertNotIn("ZX98YU76TR", str(context.exception))
            mode_path = self.write_env(root, "development")
            mode_path.chmod(0o644)
            with self.assertRaisesRegex(materializer.ConfigError, "mode 0600"):
                materializer.parse_dotenv(mode_path)

    def test_rejects_comments_quotes_whitespace_continuations_and_hostile_tokens(self) -> None:
        invalid_lines = [
            "# comment",
            "export DEVELOPMENT_TEAM=AB12CD34EF",
            " DEVELOPMENT_TEAM=AB12CD34EF",
            "DEVELOPMENT_TEAM =AB12CD34EF",
            "DEVELOPMENT_TEAM=AB12CD34EF ",
            'DEVELOPMENT_TEAM="AB12CD34EF"',
            "DEVELOPMENT_TEAM='AB12CD34EF'",
            "DEVELOPMENT_TEAM=AB12CD34EF\\",
            "DEVELOPMENT_TEAM=$AB12CD34EF",
            "DEVELOPMENT_TEAM=$(AB12CD34EF)",
            "DEVELOPMENT_TEAM=AB12CD34EF;touch-marker",
            "DEVELOPMENT_TEAM=AB12CD34EF#comment",
            "DEVELOPMENT_TEAM=AB12CD34EF=extra",
            "   ",
        ]
        hostile_marker = "touch-marker"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index, invalid in enumerate(invalid_lines):
                with self.subTest(line=invalid):
                    path = root / f".env-{index}"
                    remaining = [
                        "BUNDLE_IDENTIFIER_BASE=com.example.app",
                        "NHOST_SUBDOMAIN=local",
                        "NHOST_REGION=local",
                    ]
                    path.write_text("\n".join([invalid, *remaining]) + "\n", encoding="utf-8")
                    path.chmod(0o600)
                    with self.assertRaises(materializer.ConfigError) as context:
                        materializer.parse_dotenv(path)
                    self.assertNotIn(hostile_marker, str(context.exception))
            self.assertFalse((root / "marker").exists())

    def test_malformed_shapes_are_key_safe(self) -> None:
        cases = {
            "DEVELOPMENT_TEAM": "too-short",
            "BUNDLE_IDENTIFIER_BASE": "singlelabel",
            "NHOST_SUBDOMAIN": "UPPERCASE",
            "NHOST_REGION": "region/unsafe",
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for key, bad_value in cases.items():
                with self.subTest(key=key):
                    path = self.write_env(root, "development")
                    content = path.read_text(encoding="utf-8")
                    content = content.replace(
                        next(line for line in content.splitlines() if line.startswith(f"{key}=")),
                        f"{key}={bad_value}",
                    )
                    path.write_text(content, encoding="utf-8")
                    with self.assertRaises(materializer.ConfigError) as context:
                        materializer.parse_dotenv(path)
                    self.assertIn(key, str(context.exception))
                    self.assertNotIn(bad_value, str(context.exception))

    def test_counterpart_validation_and_separation_preserve_existing_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "Generated"
            development = self.write_env(root, "development")
            production = self.write_env(root, "production")
            existing = output / "Development.xcconfig"
            output.mkdir()
            existing.write_text("preserve-me\n", encoding="utf-8")
            existing.chmod(0o600)

            production.write_text("NHOST_REGION=local\n", encoding="utf-8")
            with self.assertRaises(materializer.ConfigError):
                materializer.materialize("development", root, output)
            self.assertEqual(existing.read_text(encoding="utf-8"), "preserve-me\n")

            self.write_env(root, "production", base="com.example.neogym.development")
            with self.assertRaisesRegex(materializer.ConfigError, "bundle bases must differ"):
                materializer.materialize("development", root, output)
            self.assertEqual(existing.read_text(encoding="utf-8"), "preserve-me\n")
            self.assertTrue(development.is_file())

    def test_private_atomic_replacement_and_single_environment_preservation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "Generated"
            self.write_env(root, "development")
            self.write_env(root, "production")
            materializer.materialize("all", root, output)

            production = output / "Production.xcconfig"
            production_before = production.read_bytes()
            self.write_env(root, "development", subdomain="replacement7")
            (development,) = materializer.materialize("development", root, output)
            self.assertEqual(stat.S_IMODE(development.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(production.stat().st_mode), 0o600)
            self.assertEqual(production.read_bytes(), production_before)
            self.assertIn("NEOGYM_APP_GROUP_IDENTIFIER", development.read_text(encoding="utf-8"))
            self.assertEqual(list(output.glob(".*.xcconfig.*")), [])

    def test_diagnostics_do_not_disclose_supplied_values(self) -> None:
        private_sentinel = "PRIVATE-SENTINEL-DO-NOT-PRINT"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = self.write_env(root, "development")
            path.write_text(
                path.read_text(encoding="utf-8").replace(
                    "NHOST_REGION=eu-test-1", f"NHOST_REGION={private_sentinel}"
                ),
                encoding="utf-8",
            )
            stream = StringIO()
            with redirect_stderr(stream):
                result = materializer.main(
                    [
                        "development",
                        "--env-dir",
                        str(root),
                        "--output-dir",
                        str(root / "Generated"),
                    ]
                )
            self.assertEqual(result, 1)
            self.assertNotIn(private_sentinel, stream.getvalue())

    def test_tracked_value_audit_is_key_safe(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
            tracked = repo / "README.md"
            tracked.write_text("private fixture-project7 value\n", encoding="utf-8")
            subprocess.run(["git", "add", "README.md"], cwd=repo, check=True)
            config = materializer.PrivateConfig(
                "AB12CD34EF", "com.example.private", "fixture-project7", "eu-test-1"
            )
            with self.assertRaises(materializer.ConfigError) as context:
                materializer.audit_tracked_values({"development": config}, repo)
            message = str(context.exception)
            self.assertIn("NHOST_SUBDOMAIN", message)
            self.assertIn("README.md", message)
            self.assertNotIn("fixture-project7", message)


class WorkflowContractTests(unittest.TestCase):
    def test_one_shell_entry_point_owns_the_supported_workflow(self) -> None:
        makefile = (PROJECT_ROOT / "Makefile").read_text(encoding="utf-8")
        workflow = (SCRIPTS / "ios.sh").read_text(encoding="utf-8")
        project = (PROJECT_ROOT / "project.yml").read_text(encoding="utf-8")

        for target in ("check", "deploy-device", "upload-testflight"):
            self.assertIn(f"Scripts/ios.sh {target}", makefile)
        self.assertIn("Scripts/materialize-config.py development", workflow)
        self.assertIn("Scripts/materialize-config.py production", workflow)
        self.assertIn("xcodegen generate", workflow)
        self.assertNotIn("preBuildScripts:", project)

class SchemePatcherTests(unittest.TestCase):
    def test_patcher_is_idempotent(self) -> None:
        source = '<Scheme><LaunchAction buildConfiguration="Debug"/></Scheme>'
        path = Path("NeoGym Dev.xcscheme")
        once = patcher.set_launch_action_attributes(source, path)
        twice = patcher.set_launch_action_attributes(once, path)
        self.assertEqual(once, twice)
        for key, value in patcher.LAUNCH_ACTION_ATTRIBUTES.items():
            self.assertIn(f'{key} = "{value}"', once)




if __name__ == "__main__":
    unittest.main()
