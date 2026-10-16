#!/usr/bin/env python3
"""Launch the official Zhihu CLI with this project's existing credential."""

import os
import sys
from pathlib import Path


def main() -> None:
    env = os.environ.copy()
    if not env.get("ZHIHU_ACCESS_SECRET", "").strip():
        env_path = Path(__file__).resolve().parents[1] / ".env"
        if env_path.is_file():
            for line in env_path.read_text(encoding="utf-8-sig").splitlines():
                line = line.strip()
                if line.startswith("export "):
                    line = line[7:].lstrip()
                key, separator, value = line.partition("=")
                if separator and key.strip() == "ZHIHU_ACCESS_SECRET":
                    value = value.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                        value = value[1:-1]
                    if value:
                        env["ZHIHU_ACCESS_SECRET"] = value
                    break

    data_home = Path(env.get("XDG_DATA_HOME", str(Path.home() / ".local/share")))
    cli_home = Path(env.get("ZHIHU_CLI_HOME", str(data_home / "zhihu-cli")))
    if not cli_home.is_absolute():
        raise SystemExit("ZHIHU_CLI_HOME / XDG_DATA_HOME must be absolute")
    binary = cli_home / "current/zhihu-cli"
    if not binary.is_file() or not os.access(binary, os.X_OK):
        raise SystemExit("Official Zhihu CLI is not installed at the configured user directory")
    os.execve(str(binary), [str(binary), *sys.argv[1:]], env)


if __name__ == "__main__":
    main()
