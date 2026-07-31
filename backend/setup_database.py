#!/usr/bin/env python3
"""
Setup Kigalifinders database on Supabase.

Usage:
  set SUPABASE_DB_PASSWORD=your-database-password
  python setup_database.py

Or add SUPABASE_DB_PASSWORD to the root .env file.
"""
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

# Load root .env
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://hmfdvrdorvdjhbkvprij.supabase.co")
REF = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "").strip("/")

POOLER_REGIONS = [
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "us-east-1",
    "us-west-1",
    "ap-southeast-1",
    "ap-northeast-1",
    "sa-east-1",
]


def build_urls(password: str, region: str) -> tuple[str, str]:
    enc = quote_plus(password)
    host = f"aws-0-{region}.pooler.supabase.com"
    async_url = f"postgresql+asyncpg://postgres.{REF}:{enc}@{host}:5432/postgres"
    sync_url = f"postgresql://postgres.{REF}:{enc}@{host}:5432/postgres"
    return async_url, sync_url


async def find_working_region(password: str) -> tuple[str, str] | None:
    import asyncpg

    enc = quote_plus(password)
    for region in POOLER_REGIONS:
        host = f"aws-0-{region}.pooler.supabase.com"
        dsn = f"postgresql://postgres.{REF}:{enc}@{host}:5432/postgres"
        try:
            conn = await asyncpg.connect(dsn, ssl="require", timeout=10)
            await conn.close()
            print(f"Connected via pooler region: {region}")
            return build_urls(password, region)
        except Exception as e:
            print(f"  {region}: {e.__class__.__name__}")
    return None


async def main():
    if not PASSWORD:
        print("ERROR: SUPABASE_DB_PASSWORD is not set.")
        print("Add it to .env:  SUPABASE_DB_PASSWORD=your-database-password")
        print("Find/reset at: Supabase Dashboard > Settings > Database > Database password")
        sys.exit(1)

    print(f"Connecting to Supabase project: {REF}")
    urls = await find_working_region(PASSWORD)
    if not urls:
        print("ERROR: Could not connect to any Supabase pooler region. Check your password.")
        sys.exit(1)

    async_url, sync_url = urls
    os.environ["DATABASE_URL"] = async_url
    os.environ["DATABASE_URL_SYNC"] = sync_url

    # Update .env file
    env_lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    updates = {
        "DATABASE_URL": async_url,
        "DATABASE_URL_SYNC": sync_url,
        "SUPABASE_DB_PASSWORD": PASSWORD,
    }
    new_lines = []
    seen = set()
    for line in env_lines:
        key = line.split("=")[0].strip() if "=" in line and not line.strip().startswith("#") else None
        if key in updates:
            new_lines.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            new_lines.append(line)
    for key, val in updates.items():
        if key not in seen:
            new_lines.append(f"{key}={val}")
    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    print(f"Updated {env_path}")

    # Run seed
    print("\nRunning seed...")
    from seed import seed
    await seed()
    print("\nDone! Restart the backend server to load the new data.")


if __name__ == "__main__":
    asyncio.run(main())
