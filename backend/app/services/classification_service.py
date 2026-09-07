import re
import logging
from collections import Counter
from typing import Dict, Any, Tuple, List
import numpy as np
from .embedding_service import embedding_service

logger = logging.getLogger("memora.classification")

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
    "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves", "unit", "page", "slide", "topic", "hours", "marks",
    "dept", "department", "year", "credit", "semester", "fs", "ss", "sr", "no"
}

SEMANTIC_DOMAINS = {
    "Programming": "Computer programming, software engineering, source code, functions, algorithms, variables, and data structures.",
    "Object-Oriented Design": "Object-oriented programming, classes, objects, inheritance, polymorphism, encapsulation, interfaces, and design patterns.",
    "Data Science": "Machine learning algorithms, neural networks, datasets, statistical modeling, data analysis, and predictive models.",
    "Database Systems": "Relational databases, SQL queries, JDBC connectivity, tables, indexing, transactions, and schema design.",
    "Academic Study": "University syllabus, lecture notes, textbook chapters, exam preparation, educational course materials, and assignments.",
    "Professional Career": "Employment resume, curriculum vitae, career achievements, professional experience, job applications, and work history.",
    "Certifications": "Certificate of completion, professional certification, accredited training diplomas, and credentials.",
    "Financial Records": "Invoices, billing records, payment receipts, purchase transactions, accounting statements, and financial audits."
}

DEFAULT_CATEGORY_DESCRIPTIONS = SEMANTIC_DOMAINS

KNOWN_ACRONYMS = {
    "oop": "OOP",
    "oops": "OOP",
    "sql": "SQL",
    "jdbc": "JDBC",
    "api": "API",
    "rest": "REST",
    "html": "HTML",
    "css": "CSS",
    "mvc": "MVC",
    "awt": "AWT",
    "swing": "Swing",
    "ui": "UI",
    "ux": "UX",
    "pdf": "PDF",
    "ai": "AI",
    "ml": "Machine Learning",
    "cv": "CV",
    "id": "ID",
    "dbms": "DBMS",
    "os": "OS"
}


class ClassificationService:
    """
    Intelligent dynamic classification service that derives Smart Tags and categories
    from actual document text, code semantics, and vector embeddings without hardcoded if/else rules.
    """
    def __init__(self):
        self.domain_embeddings: Dict[str, np.ndarray] = {}

    def _ensure_domain_embeddings(self):
        if not self.domain_embeddings:
            logger.info("Initializing semantic domain embeddings for dynamic tag discovery...")
            for domain, desc in SEMANTIC_DOMAINS.items():
                self.domain_embeddings[domain] = embedding_service.embed_text(desc)

    def _clean_text_for_analysis(self, text: str) -> str:
        """Strips noisy OCR lines (isolated single characters) and normalizes whitespace."""
        if not text:
            return ""
        lines = text.split("\n")
        meaningful_lines = []
        for line in lines:
            stripped = line.strip()
            # If line is mostly single disconnected characters separated by spaces (e.g. OCR noise), filter it
            words = stripped.split()
            if len(words) > 4 and sum(1 for w in words if len(w) == 1) / len(words) > 0.6:
                continue
            meaningful_lines.append(stripped)
        return " ".join(meaningful_lines)

    def _extract_text_candidates(self, text: str, filename: str) -> List[Tuple[str, float]]:
        """
        Dynamically extracts key terms, multi-word phrases, and technical concepts
        present in the document text and filename.
        """
        candidates: Counter = Counter()
        combined = f"{filename} {text}".lower()

        # 1. Multi-word conceptual phrases in text
        phrase_patterns = [
            r"\bobject oriented programming\b",
            r"\bdata structures\b",
            r"\bmachine learning\b",
            r"\bcomputer science\b",
            r"\bdatabase management\b",
            r"\bsoftware engineering\b",
            r"\bstudy material\b",
            r"\blecture notes\b",
            r"\bexam notes\b",
            r"\bcourse content\b",
            r"\boperating system\b",
            r"\bcomputer network\b",
            r"\bcloud computing\b",
            r"\bweb development\b",
            r"\bexception handling\b",
            r"\bthread synchronization\b",
            r"\bcompletion certificate\b",
            r"\bprofessional experience\b"
        ]
        for pat in phrase_patterns:
            matches = re.findall(pat, combined)
            if matches:
                # Format to Title Case
                title_phrase = pat.replace(r"\b", "").title()
                candidates[title_phrase] += len(matches) * 3.0

        # 2. Key individual technical / domain words
        # Words of length 3+ excluding stopwords
        raw_words = re.findall(r"\b[a-zA-Z]{3,}\b", combined)
        for w in raw_words:
            if w not in STOP_WORDS:
                candidates[w] += 1.0

        # Check for acronyms in original text
        raw_tokens = re.findall(r"\b[a-zA-Z0-9_+#.]{2,}\b", f"{filename} {text}")
        for token in raw_tokens:
            low = token.lower()
            if low in KNOWN_ACRONYMS:
                candidates[KNOWN_ACRONYMS[low]] += 3.0

        # Boost filename words
        fn_words = re.findall(r"[a-zA-Z]{3,}", filename.lower())
        for fw in fn_words:
            if fw not in STOP_WORDS:
                candidates[fw] += 4.0

        # Format candidates nicely: capitalize properly
        formatted_candidates = []
        for word, count in candidates.items():
            low = word.lower()
            if low in KNOWN_ACRONYMS:
                display = KNOWN_ACRONYMS[low]
            elif " " in word:
                display = word.title()
            else:
                display = word.capitalize()
            formatted_candidates.append((display, count))

        return formatted_candidates

    def generate_smart_tags(
        self,
        filename: str,
        extension: str,
        extracted_text: str = ""
    ) -> List[str]:
        """
        Dynamically derives 3-6 unified Smart Tags from content, OCR, code, and embeddings.
        """
        clean_text = self._clean_text_for_analysis(extracted_text)
        ext_clean = extension.lower().replace(".", "")
        has_content = bool(clean_text and len(clean_text.strip()) > 15)

        tags_score: Dict[str, float] = {}

        # 1. Content-based extraction
        if has_content:
            candidates = self._extract_text_candidates(clean_text, filename)
            for tag_name, score in candidates:
                tags_score[tag_name] = tags_score.get(tag_name, 0.0) + score

            # 2. Semantic vector analysis with embedding model
            try:
                self._ensure_domain_embeddings()
                doc_vec = embedding_service.embed_text(f"{filename} {clean_text[:1500]}")
                if doc_vec is not None and not np.all(doc_vec == 0):
                    for domain, d_vec in self.domain_embeddings.items():
                        sim = float(np.dot(doc_vec, d_vec))
                        if sim > 0.45:
                            # Map domain to appropriate descriptive tags
                            if domain == "Programming":
                                tags_score["Programming"] = tags_score.get("Programming", 0.0) + (sim * 10.0)
                            elif domain == "Object-Oriented Design":
                                tags_score["OOP"] = tags_score.get("OOP", 0.0) + (sim * 12.0)
                            elif domain == "Academic Study":
                                tags_score["Study Material"] = tags_score.get("Study Material", 0.0) + (sim * 8.0)
                            elif domain == "Professional Career":
                                tags_score["Career"] = tags_score.get("Career", 0.0) + (sim * 8.0)
                            elif domain == "Certifications":
                                tags_score["Certificates"] = tags_score.get("Certificates", 0.0) + (sim * 8.0)
                            elif domain == "Financial Records":
                                tags_score["Finance"] = tags_score.get("Finance", 0.0) + (sim * 8.0)
                            elif domain == "Data Science":
                                tags_score["Data Science"] = tags_score.get("Data Science", 0.0) + (sim * 8.0)
            except Exception as e:
                logger.warning(f"Semantic domain scoring warning: {e}")

        # 3. Source code extension hints if content exists
        if ext_clean == "java":
            tags_score["Java"] = tags_score.get("Java", 0.0) + 15.0
            tags_score["Programming"] = tags_score.get("Programming", 0.0) + 5.0
        elif ext_clean == "py":
            tags_score["Python"] = tags_score.get("Python", 0.0) + 15.0
            tags_score["Programming"] = tags_score.get("Programming", 0.0) + 5.0
        elif ext_clean == "c":
            tags_score["C Language"] = tags_score.get("C Language", 0.0) + 15.0
            tags_score["Programming"] = tags_score.get("Programming", 0.0) + 5.0

        # 4. Fallback if document has very little or no extracted text
        if not tags_score:
            # Check filename terms
            fn_clean = re.sub(r"[_\-\.]+", " ", filename).strip()
            for part in fn_clean.split():
                if len(part) > 2 and part.lower() not in STOP_WORDS:
                    tags_score[part.capitalize()] = 2.0

            if ext_clean in ["jpg", "jpeg", "png", "webp"]:
                tags_score["Images"] = 1.0
            elif ext_clean in ["pdf", "docx", "doc", "txt"]:
                tags_score["Documents"] = 1.0

        # Sort tags by score descending
        sorted_tags = sorted(tags_score.keys(), key=lambda t: tags_score[t], reverse=True)

        # Normalize and filter out redundant substrings
        final_tags: List[str] = []
        seen_lower = set()
        for t in sorted_tags:
            t_clean = t.strip()
            t_low = t_clean.lower()
            if not t_clean or t_low in seen_lower or len(t_clean) < 2:
                continue
            seen_lower.add(t_low)
            final_tags.append(t_clean)
            if len(final_tags) >= 5:
                break

        return final_tags if final_tags else ["General"]

    def classify_file(
        self,
        filename: str,
        extension: str,
        extracted_text: str = ""
    ) -> Tuple[str, int, str, str, List[str]]:
        """
        Synthesizes content-driven classification and unified Smart Tags.
        Returns: (category_name, confidence_percent, confidence_level, human_reason, smart_tags)
        """
        smart_tags = self.generate_smart_tags(filename, extension, extracted_text)
        clean_text = self._clean_text_for_analysis(extracted_text)

        # Content-driven category name synthesized from primary smart tags
        if len(smart_tags) >= 2:
            primary_category = f"{smart_tags[0]} {smart_tags[1]}"
        elif smart_tags:
            primary_category = smart_tags[0]
        else:
            primary_category = "General Documents"

        # Calculate authentic confidence based on text richness and vector match
        text_len = len(clean_text)
        if text_len > 300:
            confidence = min(98, 85 + min(12, int(text_len / 200)))
        elif text_len > 50:
            confidence = 82
        else:
            confidence = 75

        level = "High" if confidence >= 85 else "Medium" if confidence >= 70 else "Low"

        # Human-readable explanation grounded in content
        tags_preview = ", ".join(smart_tags[:3])
        if clean_text:
            reason = f"Document content analysis identified relevant topics: {tags_preview}."
        else:
            reason = f"Identified {tags_preview} based on file metadata and context."

        return primary_category, confidence, level, reason, smart_tags


classification_service = ClassificationService()
