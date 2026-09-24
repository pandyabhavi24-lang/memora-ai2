import re
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from ..models import File, FileExpiry
from .extractor import text_extractor

logger = logging.getLogger("memora.expiry_service")

# Document Type Classification Rules & Keywords
DOCUMENT_TYPE_KEYWORDS = {
    "Insurance": ["insurance", "policy", "premium", "coverage", "insurer", "underwriter", "vehicular insurance", "health insurance", "car insurance", "auto insurance", "life insurance"],
    "Passport": ["passport", "republic of", "nationality", "passport no", "passport number", "given names", "surname"],
    "Visa": ["visa", "entry permit", "immigration", "visa type", "stay until", "embassy", "consulate"],
    "Driving Licence": ["driving licence", "driver licence", "driving license", "dl no", "transport department", "motor vehicle", "licence no"],
    "Certificate": ["certificate", "certification", "completed", "certified", "course certificate", "degree", "diploma", "award", "achievement"],
    "Subscription": ["subscription", "membership", "recurring", "annual plan", "monthly plan", "invoice", "receipt", "billing", "renew"],
    "Warranty": ["warranty", "guarantee", "warranty period", "repair coverage", "limited warranty"],
    "Contract": ["contract", "agreement", "lease", "tenancy", "mou", "nda", "service agreement", "deed"],
    "Government ID": ["identity card", "id card", "aadhaar", "ssn", "tax id", "pan card", "voter", "national id"]
}

# Date Type Context Trigger Patterns
DATE_TYPE_PATTERNS = [
    ("DOB", [
        r"\bdate\s+of\s+birth\b", r"\bdob\b", r"\bbirth\s+date\b", r"\bborn\s+on\b", r"\bborn\b"
    ]),
    ("Issue", [
        r"\bissued\s+on\b", r"\bissue\s+date\b", r"\bdate\s+of\s+issue\b", r"\bpolicy\s+issued\b", r"\bdate\s+issued\b", r"\bissued\b",
        r"\bpolicy\s+start\b", r"\beffective\s+date\b", r"\bcommencement\b"
    ]),
    ("Expiry", [
        r"\bvalid\s+until\b", r"\bvalid\s+till\b", r"\bvalid\s+thru\b", r"\bvalid\s+through\b", r"\bexpires\s+on\b",
        r"\bexpiry\s+date\b", r"\bexpiration\s+date\b", r"\bexpires\b", r"\bexpiry\b", r"\bvalid\s+upto\b", r"\bvalid\s+up\s+to\b",
        r"\bvalid\s+to\b", r"\bend\s+date\b", r"\bpolicy\s+till\b", r"\bvalidity\b", r"\bexp\s+date\b"
    ]),
    ("Renewal", [
        r"\brenewal\s+date\b", r"\brenewal\s+due\b", r"\brenews\s+on\b", r"\bnext\s+billing\b",
        r"\brenewal\b", r"\brenews\b", r"\bsubscription\s+end\b", r"\brenew\s+by\b"
    ]),
    ("Due", [
        r"\bdue\s+date\b", r"\bpayment\s+due\b", r"\bdue\s+on\b", r"\bpayable\s+by\b", r"\bdue\b"
    ]),
    ("Start", [
        r"\bstart\s+date\b", r"\beffective\s+from\b", r"\bfrom\s+date\b", r"\bpolicy\s+start\b"
    ])
]

# Pre-compile and validate all DATE_TYPE_PATTERNS
COMPILED_DATE_TYPE_PATTERNS = []
for d_type, patterns in DATE_TYPE_PATTERNS:
    compiled_list = []
    for pat in patterns:
        try:
            compiled_list.append(re.compile(pat, re.IGNORECASE))
        except re.error as err:
            logger.error(f"Invalid regex pattern in DATE_TYPE_PATTERNS for category '{d_type}': '{pat}' -> {err}")
            raise err
    COMPILED_DATE_TYPE_PATTERNS.append((d_type, compiled_list))

# Month Name Mapping
MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9, "sept": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12
}

class ExpiryService:
    """
    Service for intelligent date detection, context classification,
    expiry tracking, and reminder scheduling.
    Integrates local Ollama AI date understanding with rule-based fallback.
    """

    def __init__(self):
        import os
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        self.ollama_model = os.getenv("OLLAMA_VISION_MODEL", "qwen2.5vl:3b")
        try:
            self.ollama_timeout = float(os.getenv("OLLAMA_TIMEOUT", "60"))
        except ValueError:
            self.ollama_timeout = 60.0

    def is_ollama_available(self) -> Tuple[bool, str]:
        """
        Checks if local Ollama server is responsive and returns detected active model.
        """
        import json
        import urllib.request
        try:
            req = urllib.request.Request(f"{self.ollama_base_url}/api/tags")
            with urllib.request.urlopen(req, timeout=min(5.0, self.ollama_timeout)) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = data.get("models", [])
                if not models:
                    return False, ""

                model_names = [m.get("name", "") for m in models if isinstance(m, dict)]
                for name in model_names:
                    if self.ollama_model in name:
                        return True, name
                return True, model_names[0] if model_names else self.ollama_model
        except Exception as e:
            logger.debug(f"Ollama connection check failed: {e}")
            return False, ""

    def _parse_json(self, raw_content: str) -> Any:
        import json
        if not raw_content:
            return None
        clean = raw_content.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()
        try:
            return json.loads(clean)
        except Exception:
            s_idx = clean.find("{")
            e_idx = clean.rfind("}")
            if s_idx != -1 and e_idx != -1 and e_idx > s_idx:
                try:
                    return json.loads(clean[s_idx:e_idx+1])
                except Exception:
                    pass
            return None

    def extract_dates_with_ollama(self, text: str, filename: str) -> Optional[Dict[str, Any]]:
        """
        Uses local Ollama AI model to analyze extracted document text and understand
        the context and date types of all dates in the file.
        Returns structured dictionary if successful, or None on failure/fallback.
        """
        if not text or not text.strip():
            return None

        is_avail, active_model = self.is_ollama_available()
        if not is_avail:
            logger.info(f"Ollama unavailable at {self.ollama_base_url}. Using rule_based fallback.")
            return None

        import json
        import urllib.request
        import urllib.error

        clean_text = text.strip()[:3000]

        prompt = (
            "You are the Document Date & Validity Analyzer for Memora AI.\n"
            f"Analyze the document text below from file '{filename}' and identify all dates and their precise meanings.\n\n"
            "DOCUMENT TEXT:\n"
            "---\n"
            f"{clean_text}\n"
            "---\n\n"
            "CLASSIFICATION RULES:\n"
            "1. Document Type MUST be one of: 'Insurance', 'Passport', 'Visa', 'Driving Licence', 'Certificate', 'Subscription', 'Contract', 'Warranty', 'Government ID', 'Other'.\n"
            "2. Identify all dates in the text.\n"
            "3. For each date, classify date_type strictly as one of:\n"
            "   - 'expiry': Expiry date, valid until, valid through, expiration date, policy end\n"
            "   - 'renewal': Renewal date, next billing date, renew by date\n"
            "   - 'due': Payment due date, bill payment deadline, due on date\n"
            "   - 'issue': Issue date, policy start date, effective date, registration date\n"
            "   - 'start': Start date, commencement date\n"
            "   - 'dob': Date of birth, birth date\n"
            "   - 'unrelated': Invoice date, printed date, application date, purchase date, or non-validity date\n"
            "4. Format every date strictly as YYYY-MM-DD. Reconstruct full 4-digit year.\n"
            "5. Evidence MUST be an exact short quote from the document text surrounding the date.\n\n"
            "Return ONLY valid JSON matching this schema:\n"
            "{\n"
            '  "document_type": "Driving Licence",\n'
            '  "dates": [\n'
            '    {\n'
            '      "date": "2027-03-15",\n'
            '      "date_type": "expiry",\n'
            '      "confidence": 0.95,\n'
            '      "evidence": "Valid Till: 15/03/2027",\n'
            '      "reason": "The date is explicitly associated with the document validity period."\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        payload = {
            "model": active_model,
            "messages": [{"role": "user", "content": prompt}],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 400}
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            http_req = urllib.request.Request(
                f"{self.ollama_base_url}/api/chat",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(http_req, timeout=self.ollama_timeout) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                raw_content = resp_data.get("message", {}).get("content", "")

            if not raw_content:
                logger.warning(f"Ollama returned empty response for '{filename}'.")
                return None

            parsed_json = self._parse_json(raw_content)
            if not isinstance(parsed_json, dict):
                logger.warning(f"Ollama response for '{filename}' did not parse into dict.")
                return None

            doc_type = str(parsed_json.get("document_type", "Other")).strip()
            if doc_type not in DOCUMENT_TYPE_KEYWORDS and doc_type != "Other":
                doc_type = self.classify_document_type(filename, text)

            raw_dates = parsed_json.get("dates", [])
            if not isinstance(raw_dates, list):
                return None

            valid_candidates = []
            date_type_map = {
                "expiry": "Expiry",
                "renewal": "Renewal",
                "due": "Due",
                "payment_deadline": "Due",
                "issue": "Issue",
                "start": "Start",
                "dob": "DOB",
                "unrelated": "Unrelated"
            }

            for item in raw_dates:
                if not isinstance(item, dict):
                    continue

                d_str = str(item.get("date", "")).strip()
                d_type_raw = str(item.get("date_type", "")).strip().lower()
                conf = float(item.get("confidence", 0.90))
                evidence = str(item.get("evidence", "")).strip() or d_str
                reason = str(item.get("reason", "")).strip() or f"AI classified date as {d_type_raw}."

                parsed_dt = self.parse_date_string(d_str)
                if not parsed_dt:
                    continue

                # Bounds check: 1990 <= year <= 2060
                if parsed_dt.year < 1990 or parsed_dt.year > 2060:
                    logger.info(f"Ollama extracted out-of-bounds year {parsed_dt.year} for {filename}, rejecting.")
                    continue

                mapped_d_type = date_type_map.get(d_type_raw, "Other")

                # Exclude DOB or Unrelated dates from being classified as Expiry
                if mapped_d_type in ["DOB", "Unrelated"]:
                    logger.info(f"Ollama classified date {d_str} in {filename} as {mapped_d_type}. Excluding from Expiry tracking.")
                    continue

                valid_candidates.append({
                    "date_str": d_str,
                    "parsed_date": parsed_dt,
                    "date_type": mapped_d_type,
                    "document_type": doc_type,
                    "original_text": evidence,
                    "confidence": conf,
                    "extraction_method": "ollama",
                    "reason": reason
                })

            if valid_candidates:
                return {
                    "document_type": doc_type,
                    "candidates": valid_candidates,
                    "extraction_method": "ollama"
                }

            return None

        except (TimeoutError, urllib.error.URLError) as e:
            err_msg = str(e)
            if "timed out" in err_msg.lower() or isinstance(e, TimeoutError):
                logger.warning(
                    f"Ollama date extraction timed out for '{filename}' after {self.ollama_timeout}s. "
                    "Falling back to rule-based extraction."
                )
            else:
                logger.warning(f"Ollama connection error for '{filename}': {e}. Falling back to rule-based extraction.")
            return None
        except Exception as e:
            logger.warning(f"Ollama date extraction error for '{filename}': {e}. Falling back to rule-based extraction.")
            return None

    def _ensure_schema_compatibility(self, db: Session):
        """
        Safely updates SQLite schema to ensure file_expiries supports multiple date records per file
        and contains the reason column for AI context analysis.
        """
        from sqlalchemy import text, inspect
        try:
            db.execute(text("DROP INDEX IF EXISTS ix_file_expiries_file_id"))
            db.execute(text("CREATE INDEX IF EXISTS ix_file_expiries_file_id ON file_expiries(file_id)"))
            db.commit()
        except Exception as e:
            logger.debug(f"Schema compatibility index check: {e}")

        try:
            inspector = inspect(db.bind)
            columns = [c["name"] for c in inspector.get_columns("file_expiries")]
            if "reason" not in columns:
                db.execute(text("ALTER TABLE file_expiries ADD COLUMN reason TEXT"))
                db.commit()
                logger.info("Added 'reason' column to file_expiries table.")
        except Exception as e:
            logger.debug(f"Schema column check: {e}")

    def parse_date_string(self, date_str: str) -> Optional[datetime]:
        """
        Parses various date format strings into Python datetime objects.
        Supports:
        - YYYY-MM-DD, YYYY/MM/DD
        - DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, DD.MM.YYYY
        - 15 March 2027, March 15 2027, 15-Mar-2027, 15.Mar.2027
        """
        if not date_str or not isinstance(date_str, str):
            return None

        clean_str = date_str.strip().replace(",", " ")
        clean_str = re.sub(r"\s+", " ", clean_str)

        # 1. ISO format: 2027-03-15 or 2027/03/15
        m = re.match(r"^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$", clean_str)
        if m:
            try:
                y, m_val, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                return datetime(y, m_val, d)
            except ValueError:
                pass

        # 2. Textual month format: 15 March 2027 or 15-Mar-2027 or March 15 2027
        m = re.match(r"^(\d{1,2})[\s\/\.\-]?([a-zA-Z]{3,9})[\s\/\.\-]?(\d{4})$", clean_str)
        if m:
            d, mon_str, y = int(m.group(1)), m.group(2).lower(), int(m.group(3))
            if mon_str in MONTH_MAP:
                try:
                    return datetime(y, MONTH_MAP[mon_str], d)
                except ValueError:
                    pass

        m = re.match(r"^([a-zA-Z]{3,9})[\s\/\.\-]?(\d{1,2})[\s\/\.\-]?(\d{4})$", clean_str)
        if m:
            mon_str, d, y = m.group(1).lower(), int(m.group(2)), int(m.group(3))
            if mon_str in MONTH_MAP:
                try:
                    return datetime(y, MONTH_MAP[mon_str], d)
                except ValueError:
                    pass

        # 3. Numeric format: DD/MM/YYYY or MM/DD/YYYY
        m = re.match(r"^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$", clean_str)
        if m:
            p1, p2, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            # Try DD/MM/YYYY first if p1 <= 31 and p2 <= 12
            if p2 <= 12 and p1 <= 31:
                try:
                    return datetime(y, p2, p1)
                except ValueError:
                    pass
            # Try MM/DD/YYYY if p1 <= 12 and p2 <= 31
            if p1 <= 12 and p2 <= 31:
                try:
                    return datetime(y, p1, p2)
                except ValueError:
                    pass

        return None

    def classify_document_type(self, filename: str, text: str) -> str:
        """
        Determines the document type based on filename and extracted text context.
        """
        combined = f"{filename} {text}".lower()

        scores: Dict[str, float] = {}
        for doc_type, keywords in DOCUMENT_TYPE_KEYWORDS.items():
            score = 0.0
            for kw in keywords:
                if kw in combined:
                    # Give higher weight if found in filename
                    if kw in filename.lower():
                        score += 3.0
                    else:
                        score += 1.0
            if score > 0:
                scores[doc_type] = score

        if scores:
            return max(scores.keys(), key=lambda k: scores[k])
        return "Other"

    def extract_dates_from_text(self, text: str, filename: str) -> List[Dict[str, Any]]:
        """
        Scans text for dates, extracts surrounding context, determines date type,
        and scores confidence.
        """
        if not text or not text.strip():
            return []

        candidates: List[Dict[str, Any]] = []
        doc_type = self.classify_document_type(filename, text)

        # Regex patterns to find dates in text
        # Format A: DD Month YYYY or Month DD, YYYY or DD-MMM-YYYY
        pattern_textual = r"\b(\d{1,2}[\s\/\.\-](?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Sept|Oct|October|Nov|November|Dec|December)[\s\/\.\-]\d{4})\b"
        pattern_textual_rev = r"\b((?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Sept|Oct|October|Nov|November|Dec|December)[\s\/\.\-]\d{1,2}[\s\/\.\-,\s]+\d{4})\b"

        # Format B: YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY
        pattern_numeric = r"\b(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})\b"
        pattern_numeric_slash = r"\b(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})\b"

        combined_regex = f"{pattern_textual}|{pattern_textual_rev}|{pattern_numeric}|{pattern_numeric_slash}"

        matches = list(re.finditer(combined_regex, text, re.IGNORECASE))

        now = datetime.utcnow()

        for match in matches:
            date_str = match.group(0).strip()
            parsed_dt = self.parse_date_string(date_str)
            if not parsed_dt:
                continue

            # Reject unreasonable years (e.g. < 1990 or > 2060)
            if parsed_dt.year < 1990 or parsed_dt.year > 2060:
                continue

            start_pos = max(0, match.start() - 80)
            end_pos = min(len(text), match.end() + 80)
            context_snippet = text[start_pos:end_pos].replace("\n", " ").strip()

            preceding_raw = text[max(0, match.start() - 40):match.start()]
            if "." in preceding_raw:
                preceding_raw = preceding_raw.split(".")[-1]
            if "\n" in preceding_raw:
                preceding_raw = preceding_raw.split("\n")[-1]

            following_raw = text[match.end():min(len(text), match.end() + 20)]
            if "." in following_raw:
                following_raw = following_raw.split(".")[0]
            if "\n" in following_raw:
                following_raw = following_raw.split("\n")[0]

            local_context = f"{preceding_raw} {date_str} {following_raw}".lower()

            # Determine Date Type from local surrounding context
            date_type = "Other"
            matched_confidence = 0.65

            for d_type, compiled_pats in COMPILED_DATE_TYPE_PATTERNS:
                for compiled_pat in compiled_pats:
                    if compiled_pat.search(local_context):
                        date_type = d_type
                        matched_confidence = 0.90 if d_type in ["Expiry", "Renewal", "Due"] else 0.80
                        break
                if date_type != "Other":
                    break

            # If document type is clearly Insurance/Passport/Visa/Licence and date is in future, boost Expiry likelihood
            if date_type == "Other" and parsed_dt > now:
                if doc_type in ["Insurance", "Passport", "Visa", "Driving Licence", "Subscription", "Warranty"]:
                    date_type = "Expiry"
                    matched_confidence = 0.75

            candidates.append({
                "date_str": date_str,
                "parsed_date": parsed_dt,
                "date_type": date_type,
                "document_type": doc_type,
                "original_text": context_snippet,
                "confidence": matched_confidence
            })

        return candidates

    def calculate_status(
        self,
        extracted_date: datetime,
        reminder_days_before: int = 30,
        reminder_enabled: bool = True,
        user_confirmed: bool = False,
        confidence: float = 0.85
    ) -> str:
        """
        Dynamically calculates the current document status relative to local current time.
        """
        now = datetime.utcnow()
        today = datetime(now.year, now.month, now.day)
        target_date = datetime(extracted_date.year, extracted_date.month, extracted_date.day)

        if not user_confirmed and confidence < 0.75:
            return "needs_review"

        if target_date < today:
            return "expired"

        reminder_cutoff = today + timedelta(days=reminder_days_before)
        if target_date <= reminder_cutoff:
            return "due_soon"
        else:
            return "upcoming"

    def analyze_file(self, db: Session, file_id: int, reanalyze: bool = False) -> Optional[FileExpiry]:
        """
        Analyzes a single File record for date intelligence using Ollama AI
        (with rule-based fallback) and updates/creates FileExpiry records.
        Supports multiple date records per document.
        """
        self._ensure_schema_compatibility(db)

        file_rec = db.query(File).filter(File.id == file_id).first()
        if not file_rec:
            return None

        existing_records = db.query(FileExpiry).filter(FileExpiry.file_id == file_id).all()
        
        # If user already manually confirmed any record and reanalyze is False, recalculate status only
        if existing_records and not reanalyze and any(r.user_confirmed for r in existing_records):
            for rec in existing_records:
                rec.status = self.calculate_status(
                    extracted_date=rec.extracted_date,
                    reminder_days_before=rec.reminder_days_before,
                    reminder_enabled=rec.reminder_enabled,
                    user_confirmed=rec.user_confirmed,
                    confidence=rec.confidence
                )
            db.commit()
            return existing_records[0]

        # Get or extract text
        text_content = file_rec.extracted_text or ""
        if not text_content or len(text_content.strip()) < 10:
            text_content, st = text_extractor.extract(file_rec.path, file_rec.extension)
            if text_content:
                file_rec.extracted_text = text_content
                file_rec.extraction_status = st
                db.commit()

        # Try Ollama AI Date Extraction First
        ollama_res = self.extract_dates_with_ollama(text_content or "", file_rec.name)
        extraction_method = "ollama" if ollama_res else "rule_based"

        if ollama_res and ollama_res.get("candidates"):
            candidates = ollama_res["candidates"]
        else:
            candidates = self.extract_dates_from_text(text_content or "", file_rec.name)
            for c in candidates:
                c["extraction_method"] = "rule_based"

        if not candidates:
            if existing_records:
                logger.info(f"No new date candidates found for '{file_rec.name}'. Preserving {len(existing_records)} existing valid expiry record(s).")
                for rec in existing_records:
                    rec.status = self.calculate_status(
                        extracted_date=rec.extracted_date,
                        reminder_days_before=rec.reminder_days_before,
                        reminder_enabled=rec.reminder_enabled,
                        user_confirmed=rec.user_confirmed,
                        confidence=rec.confidence
                    )
                db.commit()
                return existing_records[0]
            return None

        now = datetime.utcnow()
        today = datetime(now.year, now.month, now.day)

        # Sort candidates:
        # 1. Prioritize Expiry/Renewal/Due in FUTURE (rank 0) over Expiry/Renewal/Due in PAST (rank 1) over Issue/Start/Other (rank 2)
        # 2. Higher confidence score
        # 3. For future dates: earlier future date first. For past dates: latest past date first.
        def candidate_sort_key(c):
            is_expiry_type = c["date_type"] in ["Expiry", "Renewal", "Due"]
            is_future = c["parsed_date"] >= today
            if is_expiry_type and is_future:
                type_rank = 0
            elif is_expiry_type:
                type_rank = 1
            else:
                type_rank = 2
            
            date_rank = c["parsed_date"].timestamp() if is_future else -c["parsed_date"].timestamp()
            return (type_rank, -c["confidence"], date_rank)

        candidates.sort(key=candidate_sort_key)

        primary_cand = candidates[0]
        issue_date_val = None
        for c in candidates:
            if c["date_type"] in ["Issue", "Start"]:
                issue_date_val = c["parsed_date"]
                break
        
        if not issue_date_val:
            for c in candidates[1:]:
                if c["parsed_date"] < today and c["parsed_date"] < primary_cand["parsed_date"]:
                    issue_date_val = c["parsed_date"]
                    break

        # Process valid Expiry/Renewal/Due candidates (supporting multiple date records per document)
        primary_records = [c for c in candidates if c["date_type"] in ["Expiry", "Renewal", "Due"]]
        if not primary_records:
            primary_records = [primary_cand]

        created_or_updated = []

        for idx, cand in enumerate(primary_records):
            status_val = self.calculate_status(
                extracted_date=cand["parsed_date"],
                reminder_days_before=30,
                reminder_enabled=True,
                user_confirmed=False,
                confidence=cand["confidence"]
            )

            target_rec = existing_records[idx] if idx < len(existing_records) else None

            if target_rec:
                target_rec.document_type = cand["document_type"]
                target_rec.date_type = cand["date_type"]
                target_rec.extracted_date = cand["parsed_date"]
                target_rec.issue_date = issue_date_val
                target_rec.original_text = cand["original_text"]
                target_rec.confidence = cand["confidence"]
                target_rec.extraction_method = cand.get("extraction_method", extraction_method)
                target_rec.reason = cand.get("reason", "")
                target_rec.status = status_val
                target_rec.updated_at = datetime.utcnow()
            else:
                target_rec = FileExpiry(
                    file_id=file_id,
                    document_type=cand["document_type"],
                    date_type=cand["date_type"],
                    extracted_date=cand["parsed_date"],
                    issue_date=issue_date_val,
                    original_text=cand["original_text"],
                    confidence=cand["confidence"],
                    extraction_method=cand.get("extraction_method", extraction_method),
                    reason=cand.get("reason", ""),
                    status=status_val,
                    user_confirmed=False,
                    reminder_enabled=True,
                    reminder_days_before=30
                )
                db.add(target_rec)

            created_or_updated.append(target_rec)

        if len(existing_records) > len(primary_records):
            for old_rec in existing_records[len(primary_records):]:
                if not old_rec.user_confirmed:
                    db.delete(old_rec)

        db.commit()
        for rec in created_or_updated:
            db.refresh(rec)
        return created_or_updated[0] if created_or_updated else None

    def scan_all_files(self, db: Session) -> Dict[str, Any]:
        """
        Scans all files in database to analyze dates and populate file_expiries.
        """
        from .scanner import is_valid_user_file

        all_files = db.query(File).all()
        scanned_count = 0
        detected_count = 0

        for file_obj in all_files:
            if not is_valid_user_file(file_obj):
                continue

            scanned_count += 1
            try:
                res = self.analyze_file(db=db, file_id=file_obj.id, reanalyze=False)
                if res:
                    detected_count += 1
            except Exception as err:
                logger.error(f"Error scanning file '{file_obj.name}' (ID {file_obj.id}): {err}", exc_info=True)

        summary = self.get_summary_counts(db)
        summary["files_scanned"] = scanned_count
        summary["expiries_detected"] = detected_count
        return summary

    def get_expiry_records(
        self,
        db: Session,
        status: Optional[str] = None,
        document_type: Optional[str] = None,
        date_type: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "date_asc"
    ) -> List[FileExpiry]:
        """
        Retrieves expiry records with filtering and sorting.
        Also recalculates dynamic statuses relative to current date.
        """
        query = db.query(FileExpiry).join(File, FileExpiry.file_id == File.id)

        records = query.all()
        now = datetime.utcnow()
        for rec in records:
            old_status = rec.status
            new_status = self.calculate_status(
                extracted_date=rec.extracted_date,
                reminder_days_before=rec.reminder_days_before,
                reminder_enabled=rec.reminder_enabled,
                user_confirmed=rec.user_confirmed,
                confidence=rec.confidence
            )
            if old_status != new_status:
                rec.status = new_status

        db.commit()

        if status:
            if status.lower() == "needs_review":
                query = query.filter((FileExpiry.status == "needs_review") | (FileExpiry.user_confirmed == False))
            elif status.lower() != "all":
                query = query.filter(FileExpiry.status == status.lower())

        if document_type and document_type.lower() != "all":
            query = query.filter(FileExpiry.document_type.ilike(document_type))

        if date_type and date_type.lower() != "all":
            query = query.filter(FileExpiry.date_type.ilike(date_type))

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter((File.name.ilike(term)) | (FileExpiry.original_text.ilike(term)))

        if sort_by == "date_desc":
            query = query.order_by(FileExpiry.extracted_date.desc())
        elif sort_by == "name_asc":
            query = query.order_by(File.name.asc())
        elif sort_by == "status":
            query = query.order_by(FileExpiry.status.asc(), FileExpiry.extracted_date.asc())
        else:
            query = query.order_by(FileExpiry.extracted_date.asc())

        return query.all()

    def get_summary_counts(self, db: Session) -> Dict[str, Any]:
        """
        Calculates live DB metrics for dashboard cards and Ollama AI status.
        """
        records = self.get_expiry_records(db, status="all")
        upcoming = sum(1 for r in records if r.status == "upcoming")
        due_soon = sum(1 for r in records if r.status == "due_soon")
        expired = sum(1 for r in records if r.status == "expired")
        needs_review = sum(1 for r in records if r.status == "needs_review" or not r.user_confirmed)

        is_avail, active_model = self.is_ollama_available()

        return {
            "total_tracked": len(records),
            "upcoming": upcoming,
            "due_soon": due_soon,
            "expired": expired,
            "needs_review": needs_review,
            "ollama_available": is_avail,
            "ollama_model": active_model
        }

    def update_expiry_record(self, db: Session, expiry_id: int, update_data: Dict[str, Any]) -> Optional[FileExpiry]:
        """
        Updates fields on an expiry record (e.g. manually corrected date or document type).
        """
        rec = db.query(FileExpiry).filter(FileExpiry.id == expiry_id).first()
        if not rec:
            return None

        if "document_type" in update_data and update_data["document_type"]:
            rec.document_type = update_data["document_type"]

        if "date_type" in update_data and update_data["date_type"]:
            rec.date_type = update_data["date_type"]

        if "extracted_date" in update_data and update_data["extracted_date"]:
            new_date = update_data["extracted_date"]
            if isinstance(new_date, str):
                parsed = self.parse_date_string(new_date)
                if parsed:
                    rec.extracted_date = parsed
            elif isinstance(new_date, datetime):
                rec.extracted_date = new_date

        if "reminder_enabled" in update_data and update_data["reminder_enabled"] is not None:
            rec.reminder_enabled = bool(update_data["reminder_enabled"])

        if "reminder_days_before" in update_data and update_data["reminder_days_before"] is not None:
            rec.reminder_days_before = int(update_data["reminder_days_before"])

        if "user_confirmed" in update_data and update_data["user_confirmed"] is not None:
            rec.user_confirmed = bool(update_data["user_confirmed"])

        if "reason" in update_data and update_data["reason"]:
            rec.reason = update_data["reason"]

        rec.extraction_method = update_data.get("extraction_method", rec.extraction_method or "user_manual")
        rec.updated_at = datetime.utcnow()

        # Recalculate status
        rec.status = self.calculate_status(
            extracted_date=rec.extracted_date,
            reminder_days_before=rec.reminder_days_before,
            reminder_enabled=rec.reminder_enabled,
            user_confirmed=rec.user_confirmed,
            confidence=rec.confidence
        )

        db.commit()
        db.refresh(rec)
        return rec

    def confirm_expiry_record(self, db: Session, expiry_id: int) -> Optional[FileExpiry]:
        """
        Marks an extracted date record as confirmed by user.
        """
        return self.update_expiry_record(db, expiry_id, {"user_confirmed": True})

    def get_due_reminders(self, db: Session) -> List[FileExpiry]:
        """
        Gets records where status is 'due_soon' or 'expired', reminders are enabled,
        and last notification was not delivered recently.
        """
        now = datetime.utcnow()
        records = self.get_expiry_records(db, status="all")
        due_list = []

        for r in records:
            if not r.reminder_enabled:
                continue

            if r.status in ["due_soon", "expired"]:
                # Check if notified in past 24 hours
                if r.last_notified_at and (now - r.last_notified_at).total_seconds() < 86400:
                    continue
                due_list.append(r)

        return due_list

    def dismiss_reminder(self, db: Session, expiry_id: int) -> Optional[FileExpiry]:
        """
        Updates last_notified_at timestamp to acknowledge notification delivery.
        """
        rec = db.query(FileExpiry).filter(FileExpiry.id == expiry_id).first()
        if not rec:
            return None

        rec.last_notified_at = datetime.utcnow()
        db.commit()
        db.refresh(rec)
        return rec


expiry_service = ExpiryService()
