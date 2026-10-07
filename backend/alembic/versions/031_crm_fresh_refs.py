"""Property CRM starts fresh: properties join the CRM explicitly (in_crm), IDs become
<District><Neighborhood><Type>-NNNN, and a small sample data set is seeded for reference.

Revision ID: 031
Revises: 030
Create Date: 2026-10-07
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op

revision: str = "031"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SAMPLE_NOTE = "Sample data – delete later."


def _letter(name: str | None) -> str:
    for ch in (name or "").upper():
        if "A" <= ch <= "Z":
            return ch
    return "X"


def upgrade() -> None:
    op.add_column("properties", sa.Column("in_crm", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index("ix_properties_in_crm", "properties", ["in_crm"])

    op.execute("ALTER TABLE properties ALTER COLUMN crm_ref DROP DEFAULT")
    op.execute("DROP FUNCTION IF EXISTS crm_next_property_ref()")
    op.alter_column("properties", "crm_ref", existing_type=sa.String(20), nullable=True)
    op.execute("UPDATE properties SET crm_ref = NULL")
    op.execute("ALTER SEQUENCE crm_property_ref_seq RESTART WITH 1")
    op.execute("DELETE FROM crm_activities")

    if context.is_offline_mode():
        return
    _seed_samples(op.get_bind())


def _seed_samples(conn) -> None:
    now = datetime.now(timezone.utc)
    pick = """
        SELECT p.id, p.title, p.price, p.currency, d.name AS district, n.name AS neighborhood, t.name AS ptype
        FROM properties p
        LEFT JOIN districts d ON d.id = p.district_id
        LEFT JOIN neighborhoods n ON n.id = p.neighborhood_id
        LEFT JOIN property_types t ON t.id = p.property_type_id
        WHERE {where}
        ORDER BY {order} DESC NULLS LAST, p.id
        LIMIT :lim
    """
    published = conn.execute(
        sa.text(pick.format(where="upper(p.status::text) = 'PUBLISHED'", order="COALESCE(p.published_at, p.created_at)")),
        {"lim": 5},
    ).all()
    drafts = conn.execute(
        sa.text(pick.format(where="upper(p.status::text) = 'DRAFT'", order="p.created_at")), {"lim": 5}
    ).all()
    if len(drafts) < 5:
        drafts += conn.execute(
            sa.text(pick.format(where="upper(p.status::text) NOT IN ('PUBLISHED', 'DRAFT')", order="p.created_at")),
            {"lim": 5 - len(drafts)},
        ).all()
    props = list(published) + list(drafts)
    if not props:
        return

    admin_id = conn.execute(
        sa.text(
            """SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
               WHERE lower(r.name) IN ('super_admin', 'admin') ORDER BY u.created_at LIMIT 1"""
        )
    ).scalar()

    landlords = [
        ("Jean Bosco Habimana (Sample)", "+250788100201", "WHATSAPP", "ACTIVE", "PERCENTAGE", 10.0, None),
        ("Claudine Uwase (Sample)", "+250788100202", "PHONE", "ACTIVE", "FIXED", 150.0, "USD"),
        ("Eric Mugisha (Sample)", "+250788100203", "WHATSAPP", "PROSPECT", "PERCENTAGE", 8.0, None),
        ("Aline Mukamana (Sample)", "+250788100204", "EMAIL", "ACTIVE", "FIXED", 100000.0, "RWF"),
    ]
    landlord_ids = []
    for i, (name, phone, contact, status, ctype, cval, ccur) in enumerate(landlords):
        lid = uuid.uuid4()
        landlord_ids.append(lid)
        conn.execute(
            sa.text(
                """INSERT INTO crm_landlords (id, name, phone, whatsapp, email, preferred_contact, status, notes,
                       commission_type, commission_value, commission_currency, commission_notes,
                       last_contacted_at, next_follow_up_at, created_by_id, created_at, updated_at)
                   VALUES (:id, :name, :phone, :phone, :email, :contact, :status, :notes, :ctype, :cval, :ccur,
                       :cnotes, :last, :next, :uid, :now, :now)"""
            ),
            {
                "id": lid, "name": name, "phone": phone,
                "email": f"sample.landlord{i + 1}@example.com", "contact": contact, "status": status,
                "notes": SAMPLE_NOTE, "ctype": ctype, "cval": cval, "ccur": ccur,
                "cnotes": "One month's rent equivalent on signed leases." if ctype == "PERCENTAGE" else "Flat fee per signed lease.",
                "last": now - timedelta(days=3 + i * 4), "next": now + timedelta(days=2 + i * 3),
                "uid": admin_id, "now": now - timedelta(days=30 - i),
            },
        )

    availability = ["AVAILABLE", "AVAILABLE", "VERIFY", "AVAILABLE", "RESERVED",
                    "AVAILABLE", "UNAVAILABLE", "AVAILABLE", "RENTED", "VERIFY"]
    prop_ids = []
    for i, p in enumerate(props):
        n = conn.execute(sa.text("SELECT nextval('crm_property_ref_seq')")).scalar()
        ref = f"{_letter(p.district)}{_letter(p.neighborhood)}{_letter(p.ptype)}-{n:04d}"
        status = availability[i % len(availability)]
        checked = now - timedelta(days=(40 if status == "VERIFY" else 2 + i * 2))
        conn.execute(
            sa.text(
                """UPDATE properties SET in_crm = true, crm_ref = :ref, landlord_id = :lid,
                       availability_status = :status, availability_updated_at = :checked,
                       availability_verified_at = :checked, availability_verified_by_id = :uid,
                       crm_notes = :notes
                   WHERE id = :id"""
            ),
            {"ref": ref, "lid": landlord_ids[i % len(landlord_ids)], "status": status, "checked": checked,
             "uid": admin_id, "notes": f"Sample CRM record for reference. {SAMPLE_NOTE}", "id": p.id},
        )
        prop_ids.append((p.id, ref, landlord_ids[i % len(landlord_ids)], p))

    leads = [
        ("Sarah Johnson (Sample)", "+250788200301", 800.0, 1500.0, 3, "WEBSITE", "VIEWING"),
        ("Patrick Niyonzima (Sample)", "+250788200302", 400.0, 700.0, 2, "WHATSAPP", "NEGOTIATING"),
        ("Grace Ingabire (Sample)", "+250788200303", 1200.0, 2500.0, 4, "REFERRAL", "CONVERTED"),
    ]
    lead_ids = []
    for i, (name, phone, bmin, bmax, beds, source, status) in enumerate(leads):
        lid = uuid.uuid4()
        lead_ids.append(lid)
        conn.execute(
            sa.text(
                """INSERT INTO crm_leads (id, name, phone, whatsapp, email, budget_min, budget_max, currency,
                       bedrooms, furnishing, requirements, source, status, notes, assigned_to_id,
                       last_contacted_at, created_by_id, created_at, updated_at)
                   VALUES (:id, :name, :phone, :phone, :email, :bmin, :bmax, 'USD', :beds, 'ANY', :req,
                       :source, :status, :notes, :uid, :last, :uid, :created, :now)"""
            ),
            {
                "id": lid, "name": name, "phone": phone, "email": f"sample.client{i + 1}@example.com",
                "bmin": bmin, "bmax": bmax, "beds": beds, "req": "Parking, secure compound, good road access.",
                "source": source, "status": status, "notes": SAMPLE_NOTE, "uid": admin_id,
                "last": now - timedelta(days=1 + i), "created": now - timedelta(days=14 - i * 3), "now": now,
            },
        )

    def prop(i):
        return prop_ids[i % len(prop_ids)]

    for lead_i, prop_i in ((0, 0), (0, 1), (1, 2), (1, 3), (2, 8)):
        conn.execute(
            sa.text(
                """INSERT INTO crm_lead_properties (lead_id, property_id, note, created_at)
                   VALUES (:lead, :prop, :note, :now) ON CONFLICT DO NOTHING"""
            ),
            {"lead": lead_ids[lead_i], "prop": prop(prop_i)[0], "note": "Shared with client", "now": now},
        )

    viewings = [
        (0, 0, now + timedelta(days=2, hours=3), "SCHEDULED", None, None),
        (1, 2, now - timedelta(days=3), "COMPLETED", "Liked the layout, asked for a small rent discount.", "HIGH"),
    ]
    for lead_i, prop_i, at, status, feedback, interest in viewings:
        p = prop(prop_i)
        conn.execute(
            sa.text(
                """INSERT INTO crm_viewings (id, property_id, lead_id, landlord_id, scheduled_at, status, notes,
                       client_feedback, interest_level, created_by_id, created_at, updated_at)
                   VALUES (:id, :prop, :lead, :ll, :at, :status, :notes, :fb, :interest, :uid, :now, :now)"""
            ),
            {"id": uuid.uuid4(), "prop": p[0], "lead": lead_ids[lead_i], "ll": p[2], "at": at, "status": status,
             "notes": SAMPLE_NOTE, "fb": feedback, "interest": interest, "uid": admin_id, "now": now},
        )

    deal_rows = [
        (1, 2, "NEGOTIATING", None, "EXPECTED", None),
        (2, 8, "COMPLETED", now - timedelta(days=5), "PAID", (now - timedelta(days=2)).date()),
    ]
    deal_ids = []
    for lead_i, prop_i, status, completed, cstatus, paid in deal_rows:
        p = prop(prop_i)
        rent = float(p[3].price or 1000)
        currency = (p[3].currency or "USD").upper()
        did = uuid.uuid4()
        deal_ids.append(did)
        conn.execute(
            sa.text(
                """INSERT INTO crm_deals (id, property_id, landlord_id, lead_id, rent_amount, currency, status,
                       expected_move_in, lease_start, completed_at, commission_type, commission_value,
                       commission_currency, commission_amount, commission_status, commission_due_date,
                       commission_paid_date, notes, created_by_id, created_at, updated_at)
                   VALUES (:id, :prop, :ll, :lead, :rent, :cur, :status, :move, :lease, :completed, 'PERCENTAGE',
                       10, NULL, :camount, :cstatus, :due, :paid, :notes, :uid, :created, :now)"""
            ),
            {
                "id": did, "prop": p[0], "ll": p[2], "lead": lead_ids[lead_i], "rent": rent, "cur": currency,
                "status": status, "move": (now + timedelta(days=20)).date(),
                "lease": (now - timedelta(days=4)).date() if completed else None, "completed": completed,
                "camount": round(rent * 0.10, 2), "cstatus": cstatus, "due": (now + timedelta(days=10)).date(),
                "paid": paid, "notes": SAMPLE_NOTE, "uid": admin_id, "created": now - timedelta(days=8), "now": now,
            },
        )

    follow_ups = [
        ("Call landlord to confirm the property is still available", now + timedelta(days=1), "HIGH", 2, None, 2),
        ("Send client 3 more 3-bedroom options", now - timedelta(days=1), "MEDIUM", None, 0, None),
        ("Collect signed lease copy", now + timedelta(days=4), "LOW", None, 2, 8),
    ]
    for title, due, priority, prop_i, lead_i, deal_prop in follow_ups:
        p = prop(prop_i) if prop_i is not None else None
        conn.execute(
            sa.text(
                """INSERT INTO crm_follow_ups (id, title, due_at, priority, status, notes, landlord_id, lead_id,
                       property_id, deal_id, assigned_to_id, created_by_id, created_at, updated_at)
                   VALUES (:id, :title, :due, :priority, 'PENDING', :notes, :ll, :lead, :prop, :deal, :uid, :uid,
                       :now, :now)"""
            ),
            {
                "id": uuid.uuid4(), "title": title, "due": due, "priority": priority, "notes": SAMPLE_NOTE,
                "ll": p[2] if p else None, "lead": lead_ids[lead_i] if lead_i is not None else None,
                "prop": p[0] if p else None, "deal": deal_ids[1] if deal_prop == 8 else None,
                "uid": admin_id, "now": now,
            },
        )

    activity = [("property_added", f"{ref}: added to CRM (sample)", pid, ll, None) for pid, ref, ll, _ in prop_ids]
    activity += [
        ("lead_created", "Sarah Johnson (Sample): new client", None, None, lead_ids[0]),
        ("viewing_completed", f"{prop(2)[1]}: viewing completed with Patrick Niyonzima (Sample)", prop(2)[0], prop(2)[2], lead_ids[1]),
        ("deal_completed", f"{prop(8)[1]}: lease signed with Grace Ingabire (Sample)", prop(8)[0], prop(8)[2], lead_ids[2]),
        ("commission_paid", f"{prop(8)[1]}: commission paid", prop(8)[0], prop(8)[2], lead_ids[2]),
    ]
    for k, (event, summary, pid, ll, lead) in enumerate(activity):
        conn.execute(
            sa.text(
                """INSERT INTO crm_activities (id, event, summary, user_id, property_id, landlord_id, lead_id, created_at)
                   VALUES (:id, :event, :summary, :uid, :prop, :ll, :lead, :at)"""
            ),
            {"id": uuid.uuid4(), "event": event, "summary": summary[:500], "uid": admin_id, "prop": pid,
             "ll": ll, "lead": lead, "at": now - timedelta(hours=len(activity) - k)},
        )


def downgrade() -> None:
    op.drop_index("ix_properties_in_crm", table_name="properties")
    op.drop_column("properties", "in_crm")
