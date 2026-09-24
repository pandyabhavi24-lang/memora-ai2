import os
import re
import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger("memora.whatsapp_service")


class WhatsAppService:
    """
    Official WhatsApp Business Cloud API integration for sending PDFs.
    Uses backend environment variables only:
    - WHATSAPP_ACCESS_TOKEN
    - WHATSAPP_PHONE_NUMBER_ID
    - WHATSAPP_BUSINESS_ACCOUNT_ID
    """

    def is_configured(self) -> bool:
        token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
        phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
        return bool(token and phone_id)

    def get_status(self) -> Dict[str, Any]:
        configured = self.is_configured()
        return {
            "configured": configured,
            "phone_number_id": os.environ.get("WHATSAPP_PHONE_NUMBER_ID", ""),
            "message": "WhatsApp Business API is connected and ready." if configured else "WhatsApp is not connected. Configure WhatsApp Business API in .env."
        }

    @staticmethod
    def validate_phone_number(phone_number: str) -> str:
        if not phone_number or not isinstance(phone_number, str):
            raise ValueError("Phone number is required.")

        clean_num = re.sub(r"[^\d+]", "", phone_number.strip())

        if clean_num.startswith("+"):
            clean_num = clean_num[1:]

        if not clean_num.isdigit() or len(clean_num) < 10 or len(clean_num) > 15:
            raise ValueError(f"Invalid phone number format: '{phone_number}'. Must include country code (e.g. +919876543210).")

        return clean_num

    def send_pdf_document(self, phone_number: str, pdf_path: str, caption: Optional[str] = None) -> Dict[str, Any]:
        """
        Uploads PDF to WhatsApp Cloud API and sends document message to user.
        Never sends an unverified PDF.
        """
        if not self.is_configured():
            return {
                "status": "unconfigured",
                "configured": False,
                "message": "WhatsApp is not connected. Configure WhatsApp Business API."
            }

        clean_phone = self.validate_phone_number(phone_number)

        if not pdf_path or not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file to send not found: '{pdf_path}'")

        file_size = os.path.getsize(pdf_path)
        if file_size <= 0:
            raise ValueError(f"PDF file '{pdf_path}' is empty (0 bytes). Cannot send unverified file.")

        with open(pdf_path, "rb") as f:
            header = f.read(5)
            if header != b"%PDF-":
                raise ValueError(f"File at '{pdf_path}' is not a valid PDF document.")

        access_token = os.environ.get("WHATSAPP_ACCESS_TOKEN")
        phone_number_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")

        filename = os.path.basename(pdf_path)

        # Step 1: Upload Media to WhatsApp Cloud API
        media_upload_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/media"
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        try:
            with open(pdf_path, "rb") as pdf_f:
                files = {
                    "file": (filename, pdf_f, "application/pdf"),
                    "messaging_product": (None, "whatsapp"),
                    "type": (None, "application/pdf")
                }
                upload_res = requests.post(media_upload_url, headers=headers, files=files, timeout=30)

            if upload_res.status_code != 200:
                logger.error(f"WhatsApp media upload error ({upload_res.status_code}): {upload_res.text}")
                raise RuntimeError(f"WhatsApp Media Upload Failed: {upload_res.text}")

            media_data = upload_res.json()
            media_id = media_data.get("id")
            if not media_id:
                raise RuntimeError(f"WhatsApp Media Upload response missing media_id: {media_data}")

            # Step 2: Send Document Message via Media ID
            message_url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
            msg_payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_phone,
                "type": "document",
                "document": {
                    "id": media_id,
                    "filename": filename,
                    "caption": caption or f"Document: {filename} (sent via Memora AI)"
                }
            }

            msg_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            send_res = requests.post(message_url, headers=msg_headers, json=msg_payload, timeout=30)
            if send_res.status_code not in (200, 201):
                logger.error(f"WhatsApp message send error ({send_res.status_code}): {send_res.text}")
                raise RuntimeError(f"WhatsApp Message Delivery Failed: {send_res.text}")

            res_data = send_res.json()
            msg_id = res_data.get("messages", [{}])[0].get("id")

            return {
                "status": "success",
                "message_id": msg_id,
                "phone_number": clean_phone,
                "pdf_file": filename,
                "media_id": media_id,
                "message": f"Successfully sent '{filename}' to +{clean_phone} via WhatsApp Cloud API."
            }

        except Exception as e:
            logger.error(f"WhatsApp Cloud API Error: {e}", exc_info=True)
            raise RuntimeError(f"WhatsApp Service Error: {e}")


whatsapp_service = WhatsAppService()
