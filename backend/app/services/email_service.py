"""
Memora AI - Email Service
==========================
Handles email delivery for user-requested PIN reset codes using Python smtplib.
All SMTP configuration is read from environment variables.
Credentials are NEVER stored in SQLite, logged, or returned in APIs.
"""

import logging
import os
import smtplib
from dotenv import load_dotenv
from email.message import EmailMessage
from typing import Tuple

load_dotenv()

logger = logging.getLogger("memora.email_service")


class EmailService:
    """
    SMTP Email Service abstraction for Memora AI.
    """

    def __init__(self):
        pass

    def _get_smtp_config(self) -> dict:
        return {
            "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
            "port": int(os.getenv("SMTP_PORT", "587")),
            "user": os.getenv("SMTP_USER", ""),
            "password": os.getenv("SMTP_PASS", ""),
            "from_email": os.getenv("SMTP_FROM", ""),
        }

    def send_reset_code(self, to_email: str, reset_code: str) -> Tuple[bool, str]:
        """
        Sends a 6-digit PIN reset code to the user's recovery email.

        Returns (success: bool, error_message: str).
        """
        config = self._get_smtp_config()
        smtp_host = config["host"]
        smtp_port = config["port"]
        smtp_user = config["user"]
        smtp_pass = config["password"]
        from_addr = config["from_email"] or smtp_user

        if not smtp_user or not smtp_pass:
            logger.warning("SMTP credentials not configured in environment (SMTP_USER / SMTP_PASS missing).")
            return (
                False,
                "Email service is not configured. Please set SMTP credentials in the backend environment.",
            )

        msg = EmailMessage()
        msg["Subject"] = "Memora AI - PIN Reset Code"
        msg["From"] = from_addr
        msg["To"] = to_email

        body = (
            f"Your Memora AI PIN reset code is:\n\n"
            f"{reset_code}\n\n"
            f"This code expires in 10 minutes.\n\n"
            f"If you did not request a PIN reset, you can safely ignore this email."
        )
        msg.set_content(body)

        try:
            if smtp_port == 465:
                # SSL connection
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else:
                # STARTTLS connection (standard port 587)
                with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)

            logger.info("PIN reset email successfully delivered to %s", to_email)
            return True, ""
        except Exception as e:
            logger.error("Failed to send PIN reset email via SMTP: %s", str(e))
            # Safe generic error message without exposing credentials or internal stack traces
            return (
                False,
                "Unable to send the reset email right now. Please check your recovery email configuration or network connection.",
            )


email_service = EmailService()
