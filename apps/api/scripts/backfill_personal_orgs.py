"""One-off: crea Organization personal + Membership owner para users que no la tengan.

Uso: `.venv/Scripts/python.exe scripts/backfill_personal_orgs.py` desde apps/api/.
Idempotente — se puede correr múltiples veces sin duplicar.
"""

import asyncio

from sqlalchemy import select

from civilcode_api.auth.membership import provision_personal_org
from civilcode_api.db import SessionLocal
from civilcode_api.models.organization import Membership
from civilcode_api.models.user import User


async def main() -> None:
    async with SessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        for user in users:
            has_any = (
                await db.execute(select(Membership).where(Membership.user_id == user.id))
            ).scalar_one_or_none()
            if has_any is not None:
                print(f"[skip] {user.email} ya tiene membership")
                continue
            org = await provision_personal_org(db, user)
            await db.commit()
            print(f"[ok]   {user.email} -> org '{org.slug}' (id={org.id})")


if __name__ == "__main__":
    asyncio.run(main())
