import os
import json
import logging
import base64
import glob
from typing import Dict, Any, Optional, Tuple

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from dotenv import load_dotenv

# Always load the .env file from the MemoraAI project root,
# regardless of the backend process working directory.

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..",)
)
ENV_FILE = os.path.join(PROJECT_ROOT, ".env")

load_dotenv(ENV_FILE)

logger = logging.getLogger("memora.email_service")


# Required minimal scope for sending email only
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

CREDENTIALS_DIR = os.path.join(os.path.expanduser("~"), ".memora", "credentials")
TOKENS_FILE = os.path.join(CREDENTIALS_DIR, "gmail_tokens.json")


class EmailService:
    """
    Gmail OAuth 2.0 Integration for sending PDFs safely.
    Uses minimum required scope: https://www.googleapis.com/auth/gmail.send
    Stores per-user OAuth tokens locally on each user's machine.
    """

    def __init__(self):
        self._ensure_dir()

    @staticmethod
    def _ensure_dir():
        os.makedirs(CREDENTIALS_DIR, exist_ok=True)

    def _find_client_credentials(self) -> Tuple[Optional[str], Optional[str], Optional[Dict[str, Any]]]:
        """
        Locates Google OAuth Client credentials from environment variables or local credentials.json.
        Returns (client_id, client_secret, client_config_dict).
        """
        # 1. Environment variables
        client_id = os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("GMAIL_CLIENT_ID")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET") or os.environ.get("GMAIL_CLIENT_SECRET")

        if client_id and client_secret:
            config = {
                "installed": {
                    "client_id": client_id.strip(),
                    "client_secret": client_secret.strip(),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:8000/api/pdf/email/oauth-callback", "http://127.0.0.1:8000/api/pdf/email/oauth-callback"]
                }
            }
            return client_id.strip(), client_secret.strip(), config

        # 2. Candidate credentials.json / client_secret*.json locations
        current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        candidate_paths = [
            os.path.join(current_dir, "credentials.json"),
            os.path.join(current_dir, "client_secret.json"),
            os.path.join(CREDENTIALS_DIR, "credentials.json"),
            os.path.join(CREDENTIALS_DIR, "client_secret.json"),
        ]
        candidate_paths.extend(glob.glob(os.path.join(current_dir, "client_secret*.json")))
        candidate_paths.extend(glob.glob(os.path.join(CREDENTIALS_DIR, "client_secret*.json")))

        for path in candidate_paths:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        cs_data = json.load(f)
                    app_data = cs_data.get("installed") or cs_data.get("web")
                    if app_data and app_data.get("client_id") and app_data.get("client_secret"):
                        cid = app_data.get("client_id").strip()
                        csec = app_data.get("client_secret").strip()
                        return cid, csec, cs_data
                except Exception as e:
                    logger.warning(f"Failed to parse credentials file at {path}: {e}")

        return None, None, None

    def is_configured(self) -> bool:
        """
        Checks if OAuth client credentials exist (via ENV or local credentials.json).
        """
        cid, csec, _ = self._find_client_credentials()
        return bool(cid and csec)

    def get_status(self) -> Dict[str, Any]:
        """
        Returns the comprehensive Gmail OAuth state:
        - configured: bool
        - connected: bool
        - email: str | None (authenticated Google account email)
        - status: 'connected' | 'not_connected' | 'reconnect_required' | 'unconfigured'
        - message: str
        """
        if not self.is_configured():
            return {
                "configured": False,
                "connected": False,
                "email": None,
                "status": "unconfigured",
                "message": "Google OAuth client credentials not configured. Please set GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET or place credentials.json in backend/."
            }

        if not os.path.exists(TOKENS_FILE):
            return {
                "configured": True,
                "connected": False,
                "email": None,
                "status": "not_connected",
                "message": "Gmail account not connected. Click 'Connect Gmail Account' to authorize."
            }

        try:
            with open(TOKENS_FILE, "r", encoding="utf-8") as f:
                token_data = json.load(f)
        except Exception as e:
            logger.warning(f"Corrupted token file: {e}")
            return {
                "configured": True,
                "connected": False,
                "email": None,
                "status": "reconnect_required",
                "message": "Token file corrupted. Please reconnect Gmail."
            }

        email = token_data.get("email")
        token = token_data.get("token")
        refresh_token = token_data.get("refresh_token")

        if not token and not refresh_token:
            return {
                "configured": True,
                "connected": False,
                "email": None,
                "status": "not_connected",
                "message": "Gmail not authorized."
            }

        # Check / test credentials refreshability
        try:
            creds = self._get_credentials_object(token_data)
            if creds.expired and creds.refresh_token:
                from google.auth.transport.requests import Request
                try:
                    creds.refresh(Request())
                    self._save_token_data(creds, email=email)
                except Exception as ref_err:
                    logger.warning(f"Failed to refresh Gmail token: {ref_err}")
                    return {
                        "configured": True,
                        "connected": False,
                        "email": email,
                        "status": "reconnect_required",
                        "message": "Gmail authorization expired or was revoked. Please reconnect."
                    }

            return {
                "configured": True,
                "connected": True,
                "email": email,
                "status": "connected",
                "message": f"Gmail connected ({email})" if email else "Gmail connected successfully."
            }
        except Exception as e:
            logger.warning(f"Error checking Gmail token validity: {e}")
            return {
                "configured": True,
                "connected": False,
                "email": email,
                "status": "reconnect_required",
                "message": f"Authorization error: {e}. Please reconnect."
            }

    def is_connected(self) -> bool:
        """
        Backward-compatible boolean check for connection.
        """
        status_info = self.get_status()
        return status_info.get("connected", False)

    def _get_credentials_object(self, token_data: Dict[str, Any]):
        """
        Constructs a google.oauth2.credentials.Credentials instance from stored token data.
        """
        from google.oauth2.credentials import Credentials
        cid, csec, _ = self._find_client_credentials()

        return Credentials(
            token=token_data.get("token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id") or cid,
            client_secret=token_data.get("client_secret") or csec,
            scopes=token_data.get("scopes", GMAIL_SCOPES)
        )

    def _save_token_data(self, credentials, email: Optional[str] = None):
        """
        Persists OAuth tokens to local machine storage.
        """
        self._ensure_dir()
        existing = {}
        if os.path.exists(TOKENS_FILE):
            try:
                with open(TOKENS_FILE, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except Exception:
                pass

        token_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token or existing.get("refresh_token"),
            "token_uri": getattr(credentials, "token_uri", "https://oauth2.googleapis.com/token"),
            "client_id": getattr(credentials, "client_id", None) or existing.get("client_id"),
            "client_secret": getattr(credentials, "client_secret", None) or existing.get("client_secret"),
            "scopes": getattr(credentials, "scopes", GMAIL_SCOPES),
            "email": email or existing.get("email")
        }

        with open(TOKENS_FILE, "w", encoding="utf-8") as f:
            json.dump(token_data, f, indent=2)

    def get_auth_url(self, redirect_uri: str = "http://localhost:8000/api/pdf/email/oauth-callback") -> Dict[str, Any]:
        """
        Generates Google OAuth authorization URL for runtime user consent.
        """
        self._ensure_dir()
        client_id, client_secret, client_config = self._find_client_credentials()

        if not client_id or not client_secret:
            return {
                "configured": False,
                "auth_url": None,
                "message": "Gmail OAuth Client ID not configured. Please set GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET or provide credentials.json."
            }

        try:
            from google_auth_oauthlib.flow import Flow
            flow = Flow.from_client_config(
                client_config,
                scopes=GMAIL_SCOPES,
                redirect_uri=redirect_uri
            )
            auth_url, state = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent"
            )
            return {
                "configured": True,
                "auth_url": auth_url,
                "state": state
            }
        except Exception as e:
            logger.error(f"Error creating Google OAuth flow: {e}")
            return {
                "configured": True,
                "auth_url": None,
                "error": str(e)
            }

    def handle_oauth_callback(self, code: str, redirect_uri: str = "http://localhost:8000/api/pdf/email/oauth-callback") -> Dict[str, Any]:
        """
        Exchanges authorization code for access & refresh tokens, detects authenticated email,
        and saves per-user credentials securely on the local machine.
        """
        self._ensure_dir()
        client_id, client_secret, client_config = self._find_client_credentials()

        if not client_id or not client_secret:
            raise ValueError("Google OAuth client credentials not found.")

        try:
            from google_auth_oauthlib.flow import Flow
            from googleapiclient.discovery import build

            flow = Flow.from_client_config(
                client_config,
                scopes=GMAIL_SCOPES,
                redirect_uri=redirect_uri
            )
            flow.fetch_token(code=code)
            credentials = flow.credentials

            # Detect authenticated Gmail email address using Gmail API profile query
            email_address = None
            try:
                service = build("gmail", "v1", credentials=credentials)
                profile = service.users().getProfile(userId="me").execute()
                email_address = profile.get("emailAddress")
                logger.info(f"Detected authenticated Gmail account: {email_address}")
            except Exception as prof_err:
                logger.warning(f"Could not retrieve Gmail profile: {prof_err}")

            self._save_token_data(credentials, email=email_address)

            return {
                "status": "success",
                "email": email_address,
                "message": f"Gmail successfully connected for {email_address}!" if email_address else "Gmail connected successfully."
            }
        except Exception as e:
            logger.error(f"OAuth token exchange error: {e}", exc_info=True)
            raise ValueError(f"Failed to authenticate with Google: {e}")

    def disconnect(self) -> Dict[str, Any]:
        """
        Revokes the OAuth token with Google and removes local token storage.
        """
        email = None
        if os.path.exists(TOKENS_FILE):
            try:
                with open(TOKENS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    email = data.get("email")
                    token_to_revoke = data.get("token") or data.get("refresh_token")

                if token_to_revoke:
                    import requests
                    try:
                        requests.post("https://oauth2.googleapis.com/revoke", params={"token": token_to_revoke}, timeout=5)
                    except Exception as rev_err:
                        logger.warning(f"Notice on token revocation: {rev_err}")

                os.remove(TOKENS_FILE)
            except Exception as e:
                logger.warning(f"Error removing tokens file: {e}")
                if os.path.exists(TOKENS_FILE):
                    try:
                        os.remove(TOKENS_FILE)
                    except Exception:
                        pass

        return {
            "status": "success",
            "disconnected_email": email,
            "message": f"Disconnected Gmail account ({email})." if email else "Disconnected Gmail account."
        }

    def send_reset_code(self, to_email: str, reset_code: str) -> Tuple[bool, str]:
        """
        Sends a 6-digit PIN reset code to the user's recovery email.

        Returns (success: bool, error_message: str).
        SMTP credentials are read from environment variables and are
        never stored in the database or returned by the API.
        """
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASS", "")
        from_addr = os.getenv("SMTP_FROM", "") or smtp_user

        if not smtp_user or not smtp_pass:
            logger.warning(
                "SMTP credentials not configured in environment "
                "(SMTP_USER / SMTP_PASS missing)."
            )
            return (
                False,
                "Email service is not configured. Please set SMTP credentials in the backend environment.",
            )

        msg = MIMEMultipart()
        msg["Subject"] = "Memora AI - PIN Reset Code"
        msg["From"] = from_addr
        msg["To"] = to_email

        body = (
            f"Your Memora AI PIN reset code is:\n\n"
            f"{reset_code}\n\n"
            f"This code expires in 10 minutes.\n\n"
            f"If you did not request a PIN reset, you can safely ignore this email."
        )
        msg.attach(MIMEText(body, "plain"))

        try:
            import smtplib

            if smtp_port == 465:
                with smtplib.SMTP_SSL(
                    smtp_host, smtp_port, timeout=10
                ) as server:
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(
                    smtp_host, smtp_port, timeout=10
                ) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)

            logger.info(
                "PIN reset email successfully delivered to %s",
                to_email
            )
            return True, ""

        except Exception as e:
            logger.error(
                "Failed to send PIN reset email via SMTP: %s",
                str(e)
            )
            return (
                False,
                "Unable to send the reset email right now. Please check your recovery email configuration or network connection.",
            )

    def send_pdf_email(self, to_email: str, subject: str, message_body: str, pdf_path: str) -> Dict[str, Any]:
        """
        Sends an email with verified PDF attachment via Gmail API using the authenticated user's account.
        """
        if not to_email or "@" not in to_email:
            raise ValueError("A valid recipient email address is required.")

        if not pdf_path or not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file to send not found: '{pdf_path}'")

        file_size = os.path.getsize(pdf_path)
        if file_size <= 0:
            raise ValueError(f"PDF file '{pdf_path}' is empty (0 bytes). Cannot send unverified file.")

        with open(pdf_path, "rb") as f:
            header = f.read(5)
            if header != b"%PDF-":
                raise ValueError(f"File at '{pdf_path}' is not a valid PDF document.")

        status_info = self.get_status()
        if not status_info.get("connected"):
            if status_info.get("status") == "reconnect_required":
                raise RuntimeError("Gmail authorization has expired. Please click 'Reconnect Gmail' in PDF Studio.")
            raise RuntimeError("Gmail is not connected. Please connect your Gmail account via OAuth first.")

        try:
            from google.auth.transport.requests import Request
            from googleapiclient.discovery import build

            with open(TOKENS_FILE, "r", encoding="utf-8") as f:
                token_data = json.load(f)

            credentials = self._get_credentials_object(token_data)
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
                self._save_token_data(credentials, email=token_data.get("email"))

            service = build("gmail", "v1", credentials=credentials)

            # Sender email
            sender_email = token_data.get("email")

            mime_msg = MIMEMultipart()
            mime_msg["to"] = to_email
            mime_msg["subject"] = subject or "Memora AI PDF Document"
            if sender_email:
                mime_msg["from"] = sender_email

            body_text = message_body or "Please find attached the PDF document generated via Memora AI PDF Studio."
            mime_msg.attach(MIMEText(body_text, "plain"))

            filename = os.path.basename(pdf_path)
            with open(pdf_path, "rb") as f:
                part = MIMEApplication(f.read(), Name=filename)
                part['Content-Disposition'] = f'attachment; filename="{filename}"'
                mime_msg.attach(part)

            raw_string = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode()
            sent_msg = service.users().messages().send(userId="me", body={"raw": raw_string}).execute()

            msg_id = sent_msg.get("id")
            logger.info(f"PDF email sent successfully via Gmail. Message ID: {msg_id}")

            return {
                "status": "success",
                "message_id": msg_id,
                "from": sender_email,
                "to": to_email,
                "subject": subject,
                "pdf_file": filename,
                "message": f"Successfully delivered '{filename}' to {to_email} via Gmail API."
            }

        except Exception as e:
            logger.error(f"Failed to send email via Gmail API: {e}", exc_info=True)
            raise RuntimeError(f"Gmail API Delivery Error: {e}")


email_service = EmailService()
