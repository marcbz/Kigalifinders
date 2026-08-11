"""Update admin password for admin@kigalirent.com

Revision ID: 017
Revises: 016
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ADMIN_EMAIL = "admin@kigalirent.com"
# bcrypt hash for PassWrd12!@$
NEW_PASSWORD_HASH = "$2b$12$952rwhwsE/L99p5zC3DxwetyTHjQ2FzhxmEC/H6tto268TkNo0ZGC"


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE users SET hashed_password = :password_hash "
            "WHERE email = :email"
        ),
        {"password_hash": NEW_PASSWORD_HASH, "email": ADMIN_EMAIL},
    )


def downgrade() -> None:
    # Intentionally empty: do not restore the previous password from source control.
    pass
