"""
Memora AI - Safe Local Recovery Email Restoration Script
==========================================================
1. Creates a verified full backup of backend/data/memora.db using SQLite's backup API.
2. Validates that security_settings contains exactly one row with id = 1.
3. Prompts the user securely for their recovery email address at runtime (does not print or log it).
4. Executes a single parameterized SQL statement:
       UPDATE security_settings SET recovery_email = ? WHERE id = 1
5. Verifies that exactly one row was updated, commits only on success, and rolls back on any error.
6. Asserts that pin_hash, pin_salt, pin_iterations, lock_enabled, and reset code fields are 100% untouched.
7. Displays only a masked confirmation (e.g. u***@domain.com).
"""

import os
import sys
import sqlite3
from datetime import datetime

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "memora.db")


def main():
    print("=" * 65)
    print("MEMORA AI - SAFE RECOVERY EMAIL RESTORATION")
    print("=" * 65)

    if not os.path.isfile(DB_PATH):
        print(f"[ERROR] Database file not found at: {DB_PATH}")
        sys.exit(1)

    print(f"Target Database: {DB_PATH}")
    db_size = os.path.getsize(DB_PATH)
    print(f"Database Size:   {db_size:,} bytes")

    # Step 1: Pre-validation of security_settings table
    src_conn = sqlite3.connect(DB_PATH)
    try:
        cur = src_conn.cursor()

        # Check total rows
        cur.execute("SELECT COUNT(*) FROM security_settings;")
        total_rows = cur.fetchone()[0]
        if total_rows != 1:
            print(f"[ERROR] Expected exactly 1 row in security_settings, found {total_rows}. Aborting.")
            sys.exit(1)

        # Check row with id = 1
        cur.execute(
            "SELECT id, recovery_email, pin_hash, pin_salt, pin_iterations, "
            "lock_enabled, reset_code_hash, reset_code_expires_at, reset_code_attempts "
            "FROM security_settings WHERE id = 1;"
        )
        pre_row = cur.fetchone()
        if not pre_row:
            print("[ERROR] Row with id = 1 not found in security_settings. Aborting.")
            sys.exit(1)

        print("[OK] Verified: security_settings contains exactly one row (id = 1).")
    finally:
        src_conn.close()

    # Step 2: SQLite Backup API Backup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{DB_PATH}.sqlite_backup_{timestamp}.bak"
    print(f"\nCreating verified backup via SQLite backup API...")
    print(f"Backup destination: {backup_path}")

    src_conn = sqlite3.connect(DB_PATH)
    dst_conn = sqlite3.connect(backup_path)
    try:
        with dst_conn:
            src_conn.backup(dst_conn, pages=100)
    finally:
        dst_conn.close()
        src_conn.close()

    # Verify backup integrity
    if not os.path.isfile(backup_path) or os.path.getsize(backup_path) == 0:
        print("[ERROR] Backup creation failed or produced an empty file. Aborting.")
        sys.exit(1)

    chk_conn = sqlite3.connect(backup_path)
    try:
        chk_res = chk_conn.execute("PRAGMA integrity_check;").fetchone()
        if not chk_res or chk_res[0] != "ok":
            print(f"[ERROR] Backup integrity check failed: {chk_res}. Aborting.")
            sys.exit(1)
    finally:
        chk_conn.close()

    print(f"[OK] Backup successfully created and verified ({os.path.getsize(backup_path):,} bytes).")

    # Step 3: Prompt for recovery email (not hardcoded, not printed in full)
    print("\n" + "-" * 65)
    recovery_email = input("Enter your recovery email address: ").strip()
    if not recovery_email or "@" not in recovery_email or "." not in recovery_email:
        print("[ERROR] Invalid email address format. Aborting without making changes.")
        sys.exit(1)

    # Step 4: Parameterized execution with rollback protection
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        sql = "UPDATE security_settings SET recovery_email = ? WHERE id = 1"
        cur.execute(sql, (recovery_email,))

        if cur.rowcount != 1:
            raise RuntimeError(f"Expected 1 row updated, got {cur.rowcount}.")

        # Step 5: Read back WITHIN the uncommitted transaction
        cur.execute(
            "SELECT id, recovery_email, pin_hash, pin_salt, pin_iterations, "
            "lock_enabled, reset_code_hash, reset_code_expires_at, reset_code_attempts "
            "FROM security_settings WHERE id = 1;"
        )
        post_row = cur.fetchone()
        if not post_row:
            raise RuntimeError("Failed to read back updated security_settings row.")

        # Verify email matches input value exactly
        if post_row[1] != recovery_email:
            raise RuntimeError("Updated recovery_email does not match input value.")

        # Assert untouched security fields within the transaction
        if post_row[0] != pre_row[0]:
            raise RuntimeError("Row ID mismatch!")
        if post_row[2] != pre_row[2]:
            raise RuntimeError("Critical: pin_hash was altered!")
        if post_row[3] != pre_row[3]:
            raise RuntimeError("Critical: pin_salt was altered!")
        if post_row[4] != pre_row[4]:
            raise RuntimeError("Critical: pin_iterations was altered!")
        if post_row[5] != pre_row[5]:
            raise RuntimeError("Critical: lock_enabled was altered!")
        if post_row[6] != pre_row[6]:
            raise RuntimeError("Critical: reset_code_hash was altered!")
        if post_row[7] != pre_row[7]:
            raise RuntimeError("Critical: reset_code_expires_at was altered!")
        if post_row[8] != pre_row[8]:
            raise RuntimeError("Critical: reset_code_attempts was altered!")

        # Commit ONLY AFTER every verification passes
        conn.commit()
        print("[OK] All security integrity verifications passed. Transaction committed successfully.")

        # Masked confirmation
        parts = post_row[1].split("@")
        user_p, domain_p = parts[0], parts[1]
        masked = (user_p[0] + "***@" + domain_p) if len(user_p) > 1 else ("*@" + domain_p)

        print("\n" + "=" * 65)
        print("RESTORATION COMPLETE")
        print("=" * 65)
        print(f"Recovery Email:   {masked}")
        print(f"PIN Hash:         Intact (PBKDF2-HMAC-SHA256)")
        print(f"Iterations:       {post_row[4]} (Intact)")
        print(f"Lock Enabled:     {bool(post_row[5])} (Intact)")
        print(f"Other Fields:     All preserved exactly")
        print("=" * 65)

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Database update aborted: {e}. Transaction rolled back.")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
