import sys
import os
import sqlite3

# Add backend to pythonpath
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.database import engine, Base
import app.models.user
import app.models.case
import app.models.evidence
import app.models.entity
import app.models.hypothesis
import app.models.action
import app.models.audit
import app.models.structured
import app.models.events

def migrate():
    print("[*] Running comprehensive database schema migration...")
    
    # 1. Create any missing tables
    Base.metadata.create_all(bind=engine)
    print("  [+] Base metadata create_all executed (all tables verified/created).")

    # 2. If SQLite, safely add missing columns if they don't exist
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check columns in users
        cursor.execute("PRAGMA table_info(users)")
        user_cols = [row[1] for row in cursor.fetchall()]

        if "phone_number" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(20)")
            print("  [+] Added column users.phone_number")

        if "badge_number" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN badge_number VARCHAR(50)")
            print("  [+] Added column users.badge_number")

        if "station" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN station VARCHAR(255)")
            print("  [+] Added column users.station")

        if "has_completed_tour" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN has_completed_tour BOOLEAN DEFAULT 0")
            print("  [+] Added column users.has_completed_tour")

        if "is_verified" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 1")
            print("  [+] Added column users.is_verified (default 1 for backward compatibility)")

        # Check columns in password_reset_tokens
        cursor.execute("PRAGMA table_info(password_reset_tokens)")
        prt_cols = [row[1] for row in cursor.fetchall()]

        if "token_hash" not in prt_cols:
            cursor.execute("ALTER TABLE password_reset_tokens ADD COLUMN token_hash VARCHAR(64)")
            print("  [+] Added column password_reset_tokens.token_hash")

        if "ip_address" not in prt_cols:
            cursor.execute("ALTER TABLE password_reset_tokens ADD COLUMN ip_address VARCHAR(50)")
            print("  [+] Added column password_reset_tokens.ip_address")

        # Check columns in evidence
        cursor.execute("PRAGMA table_info(evidence)")
        ev_cols = [row[1] for row in cursor.fetchall()]

        if "sha256_hash" not in ev_cols:
            cursor.execute("ALTER TABLE evidence ADD COLUMN sha256_hash VARCHAR(64) DEFAULT ''")
            print("  [+] Added column evidence.sha256_hash")

        if "integrity_status" not in ev_cols:
            cursor.execute("ALTER TABLE evidence ADD COLUMN integrity_status VARCHAR(32) DEFAULT 'VERIFIED'")
            print("  [+] Added column evidence.integrity_status")

        # Check columns in evidence_quality_scores
        cursor.execute("PRAGMA table_info(evidence_quality_scores)")
        qs_cols = [row[1] for row in cursor.fetchall()]

        if "integrity_score" not in qs_cols:
            cursor.execute("ALTER TABLE evidence_quality_scores ADD COLUMN integrity_score FLOAT DEFAULT 1.0")
            print("  [+] Added column evidence_quality_scores.integrity_score")

        cursor.execute("UPDATE users SET is_verified = 1 WHERE is_verified IS NULL")
        cursor.execute("UPDATE evidence SET integrity_status = 'VERIFIED' WHERE integrity_status = 'verified' OR integrity_status IS NULL")

        conn.commit()
        conn.close()
        print("  [+] SQLite column migrations completed.")

    print("[SUCCESS] Database migration completed successfully.")

if __name__ == "__main__":
    migrate()
