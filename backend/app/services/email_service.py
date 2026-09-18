import os
import json
import logging
import base64
from typing import Dict, Any, Optional
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

logger = logging.getLogger("memora.email_service")

# Required minimal scope for sending email only
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

CREDENTIALS_DIR = os.path.join(os.path.expanduser("~"), ".memora", "credentials")
TOKENS_FILE = os.path.join(CREDENTIALS_DIR, "gmail_tokens.json")
CLIENT_SECRET_FILE = os.path.join(CREDENTIALS_DIR, "client_secret.json")


class EmailService:
    """
    Gmail OAuth 2.0 Integration for sending PDFs safely.
    Uses minimum required scope: gmail.send
    Keeps credentials and tokens securely on backend server.
    """

    @staticmethod
    def _ensure_dir():
        os.makedirs(CREDENTIALS_DIR, exist_ok=True)

    def is_configured(self) -> bool:
        """
        Checks if OAuth client credentials (client_secret.json or ENV) exist.
        """
        if os.environ.get("GMAIL_CLIENT_ID") and os.environ.get("GMAIL_CLIENT_SECRET"):
            return True
        return os.path.exists(CLIENT_SECRET_FILE)

    def is_connected(self) -> bool:
        """
        Checks if valid user OAuth tokens are available.
        """
        if not os.path.exists(TOKENS_FILE):
            return False
        try:
            with open(TOKENS_FILE, "r") as f:
                data = json.load(f)
                return bool(data.get("token") or data.get("refresh_token"))
        except Exception as e:
            logger.warning(f"Error reading Gmail token file: {e}")
            return False

    def get_auth_url(self, redirect_uri: str = "http://localhost:8000/api/pdf/email/oauth-callback") -> Dict[str, Any]:
        """
        Generates Google OAuth authorization URL for user consent screen.
        """
        self._ensure_dir()
        client_id = os.environ.get("GMAIL_CLIENT_ID")
        client_secret = os.environ.get("GMAIL_CLIENT_SECRET")

        if not client_id and os.path.exists(CLIENT_SECRET_FILE):
            try:
                with open(CLIENT_SECRET_FILE, "r") as f:
                    cs_data = json.load(f)
                    web = cs_data.get("web") or cs_data.get("installed") or {}
                    client_id = web.get("client_id")
                    client_secret = web.get("client_secret")
            except Exception as e:
                logger.error(f"Failed to parse client_secret.json: {e}")

        if not client_id:
            return {
                "configured": False,
                "auth_url": None,
                "message": "Gmail OAuth Client ID not configured. Please set GMAIL_CLIENT_ID & GMAIL_CLIENT_SECRET in environment or place client_secret.json in ~/.memora/credentials/."
            }

        try:
            from google_auth_oauthlib.flow import Flow
            client_config = {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token"
                }
            }
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
            logger.error(f"Error creating OAuth flow: {e}")
            return {
                "configured": True,
                "auth_url": None,
                "error": str(e)
            }

    def handle_oauth_callback(self, code: str, redirect_uri: str = "http://localhost:8000/api/pdf/email/oauth-callback") -> Dict[str, Any]:
        """
        Exchanges OAuth code for access & refresh tokens and saves securely.
        """
        self._ensure_dir()
        client_id = os.environ.get("GMAIL_CLIENT_ID")
        client_secret = os.environ.get("GMAIL_CLIENT_SECRET")

        if not client_id and os.path.exists(CLIENT_SECRET_FILE):
            with open(CLIENT_SECRET_FILE, "r") as f:
                cs_data = json.load(f)
                web = cs_data.get("web") or cs_data.get("installed") or {}
                client_id = web.get("client_id")
                client_secret = web.get("client_secret")

        try:
            from google_auth_oauthlib.flow import Flow
            client_config = {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token"
                }
            }
            flow = Flow.from_client_config(
                client_config,
                scopes=GMAIL_SCOPES,
                redirect_uri=redirect_uri
            )
            flow.fetch_token(code=code)
            credentials = flow.credentials

            token_data = {
                "token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes
            }

            with open(TOKENS_FILE, "w") as f:
                json.dump(token_data, f, indent=2)

            return {"status": "success", "message": "Gmail OAuth connected successfully."}
        except Exception as e:
            logger.error(f"OAuth token exchange error: {e}")
            raise ValueError(f"Failed to authenticate with Google: {e}")

    def send_pdf_email(self, to_email: str, subject: str, message_body: str, pdf_path: str) -> Dict[str, Any]:
        """
        Sends an email with attached PDF using Gmail API.
        Verifies PDF existence & integrity first.
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

        if not self.is_connected():
            raise RuntimeError("Gmail OAuth is not connected. Connect Gmail first via OAuth.")

        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            with open(TOKENS_FILE, "r") as f:
                token_data = json.load(f)

            credentials = Credentials(
                token=token_data.get("token"),
                refresh_token=token_data.get("refresh_token"),
                token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=token_data.get("client_id"),
                client_secret=token_data.get("client_secret"),
                scopes=token_data.get("scopes", GMAIL_SCOPES)
            )

            service = build("gmail", "v1", credentials=credentials)

            mime_msg = MIMEMultipart()
            mime_msg["to"] = to_email
            mime_msg["subject"] = subject or "Memora AI PDF Document"

            body_text = message_body or "Please find the attached PDF document generated with Memora AI PDF Studio."
            mime_msg.attach(MIMEText(body_text, "plain"))

            filename = os.path.basename(pdf_path)
            with open(pdf_path, "rb") as f:
                part = MIMEApplication(f.read(), Name=filename)
                part['Content-Disposition'] = f'attachment; filename="{filename}"'
                mime_msg.attach(part)

            raw_string = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode()
            sent_msg = service.users().messages().send(userId="me", body={"raw": raw_string}).execute()

            logger.info(f"Email sent successfully to {to_email}. Message ID: {sent_msg.get('id')}")
            return {
                "status": "success",
                "message_id": sent_msg.get("id"),
                "to": to_email,
                "subject": subject,
                "pdf_file": filename,
                "message": f"Successfully sent '{filename}' to {to_email} via Gmail API."
            }

        except Exception as e:
            logger.error(f"Failed to send email via Gmail API: {e}", exc_info=True)
            raise RuntimeError(f"Gmail API Email Sending Error: {e}")


email_service = EmailService()
