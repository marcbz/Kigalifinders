"""Update admin login email to admin@kigalirent.com

Revision ID: 016
Revises: 015
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_EMAIL = "admin@kigalifinders.com"
NEW_EMAIL = "admin@kigalirent.com"


def upgrade() -> None:
    conn = op.get_bind()
    # Only rename if the new email is not already taken
    existing = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": NEW_EMAIL},
    ).fetchone()
    if existing:
        return

    conn.execute(
        sa.text("UPDATE users SET email = :new_email WHERE email = :old_email"),
        {"new_email": NEW_EMAIL, "old_email": OLD_EMAIL},
    )


def downgrade() -> None:
    conn = op.get_bind()
    existing = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": OLD_EMAIL},
    ).fetchone()
    if existing:
        return

    conn.execute(
        sa.text("UPDATE users SET email = :old_email WHERE email = :new_email"),
        {"old_email": OLD_EMAIL, "new_email": NEW_EMAIL},
    )
