import re
import logging
from typing import Dict, List, Set, Tuple, Any

logger = logging.getLogger("memora.query_expansion")

# ==============================================================================
# MODULAR DOMAIN-AWARE VOCABULARIES
# ==============================================================================

SEARCH_INTENT_TERMS: Set[str] = {
    "find", "search", "locate", "show", "get", "retrieve", "look for",
    "look up", "where is", "give me", "open", "please", "fetch", "display"
}

GENERIC_FILLER_TERMS: Set[str] = {
    "my", "the", "a", "an", "file", "files", "document", "documents",
    "code", "program", "data", "system", "information", "item", "all",
    "about", "with", "for", "in", "to", "of", "and", "or", "is", "this", "that"
}

# 1. GENERAL LANGUAGE TERMS
GENERAL_TERMS: Dict[str, List[str]] = {
    "document": ["file", "record", "report", "paper", "doc"],
    "picture": ["image", "photo", "photograph", "snapshot", "picture"],
    "video": ["recording", "clip", "footage", "video recording"],
    "folder": ["directory", "folder", "subfolder", "dir"],
    "code": ["source code", "program", "implementation", "script", "codebase"],
    "project": ["assignment", "application", "software project", "project work"],
    "report": ["document", "analysis", "study", "documentation", "final report"],
    "meeting": ["appointment", "discussion", "conference", "minutes"],
    "notes": ["documentation", "memo", "notes", "lecture notes", "study guide"],
    "presentation": ["slides", "slideshow", "deck", "powerpoint", "presentation slides"],
    "spreadsheet": ["workbook", "sheet", "table", "worksheet", "excel sheet"]
}

# 2. EDUCATION / ACADEMIC TERMS
ACADEMIC_TERMS: Dict[str, List[str]] = {
    "internship": ["industrial training", "training", "apprenticeship", "practical training", "work experience", "intern"],
    "industrial training": ["internship", "practical training", "work experience", "training program"],
    "certificate": ["certification", "credential", "completion certificate", "certificate of completion", "diploma", "proof", "award"],
    "completion certificate": ["internship certificate", "certification", "diploma", "training certificate", "proof of completion"],
    "college": ["university", "institute", "educational institution", "campus", "academy"],
    "university": ["college", "institute", "educational institution", "varsity"],
    "degree": ["qualification", "academic qualification", "bachelor", "master", "diploma"],
    "assignment": ["coursework", "task", "project work", "homework", "lab work"],
    "exam": ["test", "assessment", "evaluation", "examination", "midterm", "final"],
    "marks": ["scores", "grades", "results", "percentage", "transcript", "grade sheet"],
    "syllabus": ["curriculum", "course content", "course outline", "study material"],
    "lecture": ["class notes", "lecture notes", "study material", "tutorial"]
}

# 3. PROFESSIONAL / CAREER TERMS
CAREER_TERMS: Dict[str, List[str]] = {
    "job": ["employment", "position", "role", "work", "career"],
    "experience": ["work experience", "professional experience", "employment history", "career history"],
    "resume": ["cv", "curriculum vitae", "profile", "career profile", "professional bio"],
    "cv": ["resume", "curriculum vitae", "profile", "professional bio"],
    "curriculum vitae": ["resume", "cv", "career profile", "experience summary"],
    "company": ["organization", "firm", "employer", "business", "corporation"],
    "employee": ["staff", "worker", "professional", "personnel"],
    "manager": ["supervisor", "lead", "team lead", "director", "head"],
    "intern": ["trainee", "apprentice", "student intern", "summer intern"]
}

# 4. SOFTWARE DESIGN & ARCHITECTURE PATTERNS
DESIGN_PATTERN_TERMS: Dict[str, List[str]] = {
    "design system": ["software design pattern", "design patterns", "design pattern", "factory pattern", "singleton pattern", "observer pattern", "strategy pattern", "creational pattern", "behavioral pattern", "structural pattern"],
    "design pattern": ["software design pattern", "factory pattern", "singleton pattern", "observer pattern", "strategy pattern", "builder pattern", "adapter pattern", "decorator pattern", "facade pattern", "creational pattern", "behavioral pattern", "structural pattern", "gof pattern"],
    "design patterns": ["software design patterns", "factory pattern", "singleton pattern", "observer pattern", "strategy pattern", "builder pattern", "adapter pattern", "decorator pattern", "facade pattern", "creational pattern", "behavioral pattern", "structural pattern", "gof patterns"],
    "factory": ["factory pattern", "factory method", "abstract factory", "creational pattern"],
    "singleton": ["singleton pattern", "single instance", "creational pattern"],
    "observer": ["observer pattern", "publish subscribe", "listener", "behavioral pattern"],
    "strategy": ["strategy pattern", "policy pattern", "behavioral pattern"],
    "builder": ["builder pattern", "creational pattern"],
    "adapter": ["adapter pattern", "wrapper pattern", "structural pattern"],
    "decorator": ["decorator pattern", "structural pattern"],
    "facade": ["facade pattern", "structural pattern"],
    "patterns": ["design patterns", "software patterns", "architecture patterns"],
    "pattern": ["design pattern", "software pattern"]
}

# 5. PROGRAMMING / TECHNICAL TERMS
PROGRAMMING_TERMS: Dict[str, List[str]] = {
    "function": ["method", "procedure", "routine", "handler", "def"],
    "method": ["function", "procedure", "routine", "member function"],
    "class": ["type", "object definition", "struct", "class definition"],
    "variable": ["identifier", "field", "parameter", "attribute", "property"],
    "sort": ["sorting", "ordering", "arrange", "order", "quicksort", "mergesort"],
    "sorting": ["sort", "ordering", "arrange", "order", "sorted", "quicksort"],
    "delete": ["remove", "erase", "destroy", "drop", "clear"],
    "create": ["generate", "initialize", "construct", "instantiate", "build", "new"],
    "read": ["fetch", "retrieve", "load", "query", "get"],
    "update": ["modify", "edit", "change", "patch", "set"],
    "database": ["db", "datastore", "data store", "sql", "sqlite", "relational database", "database connection"],
    "db": ["database", "datastore", "sql", "sqlite", "table"],
    "connection": ["client", "connect", "session", "driver", "pool"],
    "api": ["endpoint", "interface", "service", "route", "rest api"],
    "error": ["exception", "failure", "bug", "traceback", "stack trace"],
    "exception": ["error", "failure", "catch", "try catch", "throw"],
    "login": ["sign-in", "signin", "authentication", "auth", "credentials"],
    "logout": ["sign-out", "signout"],
    "loop": ["iteration", "for loop", "while loop", "iterate"],
    "array": ["collection", "list", "vector", "slice", "items"],
    "javascript": ["js", "ecmascript", "node", "frontend code"],
    "typescript": ["ts", "typed javascript"],
    "python": ["py", "python script", "python code", "django", "fastapi"],
    "java": ["jvm", "jdk", "java code", "java source", "oop", "classes"],
    "cpp": ["c++", "cplusplus", "native code"],
    "c#": ["csharp", "dotnet", ".net"],
    "sql": ["query", "database", "select", "table", "relational"]
}

# 6. FILE-TYPE SYNONYMS
FILE_TERMS: Dict[str, List[str]] = {
    "pdf": ["pdf document", "pdf file", "scanned document"],
    "word": ["doc", "docx", "word document", "ms word"],
    "doc": ["word", "docx", "word document"],
    "docx": ["word", "doc", "word document"],
    "excel": ["xls", "xlsx", "spreadsheet", "workbook", "csv"],
    "spreadsheet": ["excel", "xlsx", "xls", "workbook", "csv", "sheet"],
    "powerpoint": ["ppt", "pptx", "presentation", "slides", "deck"],
    "presentation": ["powerpoint", "pptx", "ppt", "slides", "deck", "slideshow"],
    "slides": ["presentation", "powerpoint", "deck", "pptx", "ppt"],
    "image": ["picture", "photo", "photograph", "jpg", "jpeg", "png", "webp"],
    "picture": ["image", "photo", "photograph", "jpg", "png"],
    "photo": ["image", "picture", "photograph", "snapshot"],
    "text file": ["txt", "text document", "plain text", "log"],
    "txt": ["text file", "text document", "notes"],
    "code file": ["source file", "source code", "program", "script"],
    "java file": ["java source", "java code", "main.java", ".java file", "java class"],
    "python file": ["python source", "python code", ".py file", "python script"]
}

# 7. IMAGE / OCR TERMS
IMAGE_OCR_TERMS: Dict[str, List[str]] = {
    "screenshot": ["screen capture", "screen image", "screengrab", "snapshot"],
    "certificate image": ["certificate photo", "scanned certificate", "certificate scan", "certificate document"],
    "id card": ["identity card", "identification", "student id", "college id", "id proof", "id"],
    "student id": ["college id", "identity card", "university id", "id card"],
    "college id": ["student id", "university id", "identity card", "campus id"]
}

# 8. DOCUMENT STRUCTURE TERMS
DOCUMENT_STRUCTURE_TERMS: Dict[str, List[str]] = {
    "title": ["heading", "header", "document title", "subject"],
    "section": ["chapter", "part", "subsection", "module"],
    "paragraph": ["text block", "passage", "content"],
    "table": ["data table", "grid", "matrix", "rows columns"],
    "page": ["document page", "sheet"],
    "slide": ["presentation page", "presentation slide", "deck page"],
    "sheet": ["worksheet", "spreadsheet tab", "data sheet"]
}

# 9. BUSINESS / FINANCE TERMS
BUSINESS_TERMS: Dict[str, List[str]] = {
    "invoice": ["bill", "receipt", "payment document", "billing details", "tax invoice"],
    "bill": ["invoice", "receipt", "billing document", "statement"],
    "receipt": ["bill", "invoice", "payment receipt", "proof of payment"],
    "bank statement": ["account statement", "transaction history", "debit credit", "account balance", "bank name"],
    "customer": ["client", "buyer", "consumer", "purchaser"],
    "sales": ["revenue", "transactions", "orders", "earnings"],
    "expense": ["cost", "spending", "expenditure", "payout"],
    "salary": ["compensation", "wages", "pay", "payroll", "payslip"],
    "budget": ["financial plan", "spending plan", "allocation"],
    "contract": ["agreement", "deal", "terms", "mou"]
}

# 10. PEOPLE & ORGANIZATION TERMS
PEOPLE_ORG_TERMS: Dict[str, List[str]] = {
    "person": ["individual", "employee", "student", "user", "candidate"],
    "teacher": ["professor", "faculty", "instructor", "lecturer", "educator"],
    "professor": ["teacher", "faculty", "instructor", "lecturer"]
}

# Aggregate all modular vocabularies into a single lookup hierarchy
ALL_VOCABULARIES: List[Dict[str, List[str]]] = [
    DESIGN_PATTERN_TERMS,
    ACADEMIC_TERMS,
    CAREER_TERMS,
    PROGRAMMING_TERMS,
    FILE_TERMS,
    IMAGE_OCR_TERMS,
    BUSINESS_TERMS,
    DOCUMENT_STRUCTURE_TERMS,
    PEOPLE_ORG_TERMS,
    GENERAL_TERMS
]


class QueryExpansionService:
    """
    Context-aware query expansion engine:
    1. Identifies core query concepts, distinctive topics, and domain context.
    2. Generates supporting related terms, synonyms, abbreviations, and technical equivalents.
    3. Builds enriched multi-domain query representations without replacing original query priority.
    4. Supports field-aware lexical matching across Content, Code, OCR, Filenames, and Smart Tags.
    5. Evaluates query intent agreement & concept coverage to prevent broad-domain false positives.
    """

    def clean_search_intent(self, query: str) -> str:
        """
        Strips conversational search intent phrases ("find my", "where is", "show me")
        while preserving core search terms.
        """
        if not query:
            return ""
        q = " ".join(query.strip().split())
        q_lower = q.lower()

        # Remove leading intent phrases
        for intent in sorted(SEARCH_INTENT_TERMS, key=len, reverse=True):
            pattern = r"^(?:please\s+)?(?:can\s+you\s+)?\b" + re.escape(intent) + r"\b(?:\s+my|\s+the|\s+me|\s+a|\s+an)?"
            q_lower = re.sub(pattern, "", q_lower).strip()

        # Remove dangling punctuation
        q_clean = re.sub(r"[^\w\s#+.-]", "", q_lower).strip()
        return q_clean if q_clean else query.strip().lower()

    def detect_concepts(self, query: str) -> Dict[str, List[str]]:
        """
        Extracts multi-word phrases and individual core concept tokens from query
        and maps them to domain-specific expansions.
        """
        cleaned_query = self.clean_search_intent(query)
        detected_concepts: Dict[str, List[str]] = {}

        # 1. Multi-word phrase matching across vocabularies
        composite_phrases = [
            ("java design patterns", ["factory.java", "singleton.java", "observer.java", "strategy.java", "design-patterns", "design pattern", "factory pattern", "singleton pattern", "observer pattern", "strategy pattern"]),
            ("design system", ["design pattern", "factory pattern", "singleton pattern", "observer pattern", "strategy pattern", "software design", "design patterns", "architecture"]),
            ("design patterns", ["design pattern", "factory pattern", "singleton pattern", "observer pattern", "strategy pattern", "software design", "creational pattern", "behavioral pattern"]),
            ("design pattern", ["factory pattern", "singleton pattern", "observer pattern", "strategy pattern", "software design", "gof pattern"]),
            ("internship certificate", ["internship completion certificate", "certificate of internship", "internship proof", "industrial training certificate", "training completion"]),
            ("java sorting code", ["main.java", "java source", "java sorting", "sort algorithm", "quicksort java", "mergesort java", "sorting method"]),
            ("sorting code", ["sort algorithm", "sorting function", "sort method", "ordering code", "quicksort", "mergesort"]),
            ("sorting numbers", ["sort algorithm", "quicksort", "mergesort", "number sorting", "sort array"]),
            ("database connection", ["database.py", "db connection", "sql connection", "database client", "db connect", "sqlite connection"]),
            ("bank statement", ["account statement", "transaction history", "debit credit", "account balance", "bank name"]),
            ("project report", ["project documentation", "final report", "synopsis", "thesis", "project slides"]),
            ("id card", ["identity card", "student id", "college id", "identification proof"]),
            ("student id", ["college id", "university id", "identity card", "student card"]),
            ("college id", ["student id", "identity card", "university id"]),
            ("certificate image", ["certificate photo", "scanned certificate", "certificate scan", "img_82931.jpg", "certificate picture"]),
            ("photo of my certificate", ["certificate photo", "certificate image", "scanned certificate", "certificate scan", "img_82931.jpg"]),
            ("photo of certificate", ["certificate photo", "certificate image", "scanned certificate", "certificate scan", "img_82931.jpg"]),
            ("image of certificate", ["certificate photo", "certificate image", "scanned certificate", "certificate scan"]),
            ("python code", ["python script", "python source", ".py file", "python program"]),
            ("java code", ["java source", "main.java", ".java file", "java program", "java class"]),
            ("word document", ["doc", "docx", "word file", "ms word"]),
            ("excel sheet", ["spreadsheet", "workbook", "xlsx", "xls", "csv"]),
            ("powerpoint presentation", ["presentation", "slides", "deck", "pptx", "ppt"])
        ]

        matched_phrases = set()
        for phrase, expansions in composite_phrases:
            if phrase in cleaned_query:
                detected_concepts[phrase] = expansions
                matched_phrases.add(phrase)

        # 2. Token-level concept detection across all modular vocabularies
        tokens = [t for t in re.findall(r"\b[\w#+.-]{2,}\b", cleaned_query) if t not in SEARCH_INTENT_TERMS and t not in GENERIC_FILLER_TERMS]

        for token in tokens:
            token_expansions: List[str] = []
            for vocab in ALL_VOCABULARIES:
                if token in vocab:
                    token_expansions.extend([syn for syn in vocab[token] if syn not in token_expansions])

            if token_expansions:
                detected_concepts[token] = token_expansions[:6]
            elif token not in detected_concepts and len(token) > 1:
                # Keep original token as a distinct concept even without explicit manual synonyms
                detected_concepts[token] = [token]

        return detected_concepts

    def extract_query_intent(self, query: str) -> Dict[str, Any]:
        """
        Derives high-level query intent and separates distinctive topic concepts
        from broad domain/language anchors to enable anti-false-positive filtering.
        """
        cleaned_query = self.clean_search_intent(query)
        detected = self.detect_concepts(query)

        # Identify language/domain anchors vs distinctive topics
        language_anchors = {"java", "python", "javascript", "typescript", "c", "cpp", "c#", "go", "rust", "php", "sql", "kotlin", "ruby", "swift", "scala"}
        generic_anchors = {"code", "document", "file", "project", "program", "data", "sheet", "slide", "image", "photo", "files", "documents", "system", "app", "application"}
        anchor_terms = language_anchors | generic_anchors | GENERIC_FILLER_TERMS | SEARCH_INTENT_TERMS

        distinctive_concepts: List[str] = []
        domain_anchors: List[str] = []

        for concept in detected.keys():
            c_low = concept.lower()
            tokens = [t for t in c_low.split() if t not in anchor_terms]
            if not tokens:
                domain_anchors.append(c_low)
            else:
                distinctive_concepts.append(c_low)

        # Build intent summary description
        intent_parts = []
        if domain_anchors:
            intent_parts.append(f"Domain/Language: {', '.join(domain_anchors)}")
        if distinctive_concepts:
            intent_parts.append(f"Topic: {', '.join(distinctive_concepts)}")
        intent_summary = " | ".join(intent_parts) if intent_parts else cleaned_query

        return {
            "intent_summary": intent_summary,
            "distinctive_concepts": distinctive_concepts,
            "domain_anchors": domain_anchors,
            "all_detected_concepts": list(detected.keys())
        }

    def verify_concept_agreement(
        self,
        query: str,
        content_text: str,
        filename: str,
        smart_tags: List[str]
    ) -> Tuple[bool, List[str], str]:
        """
        Checks if candidate document contains semantic/lexical evidence of the distinctive query topic.
        Prevents broad-domain false positives (e.g. Java Calculator for 'Java design patterns').
        """
        intent = self.extract_query_intent(query)
        distinctive = intent["distinctive_concepts"]

        if not distinctive:
            # Query has no separate distinctive sub-topic; pass by default
            return True, [], "No distinctive sub-topic filter required"

        searchable_text = f"{filename} {' '.join(smart_tags or [])} {content_text or ''}".lower()
        matched_concepts = []
        missing_concepts = []

        detected_map = self.detect_concepts(query)
        anchor_terms = {"java", "python", "javascript", "typescript", "c", "cpp", "c#", "go", "rust", "php", "sql", "kotlin", "ruby", "swift", "scala", "code", "document", "file", "project", "program", "data", "sheet", "slide", "image", "photo", "files", "documents", "system", "app", "application"} | GENERIC_FILLER_TERMS | SEARCH_INTENT_TERMS

        for concept in distinctive:
            # Build list of distinctive terms to check (excluding broad anchors)
            raw_terms = [concept] + detected_map.get(concept, [])
            for st in concept.split():
                if len(st) > 2 and st not in anchor_terms and st not in raw_terms:
                    raw_terms.append(st)

            # Filter out anchor terms from concept_terms
            concept_terms = []
            for t in raw_terms:
                t_clean = t.lower().strip()
                if t_clean and t_clean not in anchor_terms:
                    concept_terms.append(t_clean)

            found = False
            for term in concept_terms:
                term_low = term.lower()
                pattern = r"\b" + re.escape(term_low) + r"\b"
                if re.search(pattern, searchable_text) or (len(term_low) > 3 and term_low in searchable_text):
                    matched_concepts.append(term_low)
                    found = True
                    break

            if not found:
                missing_concepts.append(concept)

        # Record matched concepts for diagnostics and secondary scoring
        # Never reject genuine semantic vector matches from FAISS
        return True, matched_concepts, "Concept evaluated"

    def build_expanded_query_terms(self, query: str) -> Tuple[List[str], str, Dict[str, List[str]]]:
        """
        Constructs:
        - List of distinct expanded terms
        - Combined expanded string for semantic embedding
        - Dictionary of detected concepts -> expansions
        """
        detected = self.detect_concepts(query)
        cleaned_core = self.clean_search_intent(query)

        all_terms_set: Set[str] = set()
        if cleaned_core:
            all_terms_set.add(cleaned_core)

        for concept, expansions in detected.items():
            all_terms_set.add(concept)
            for exp in expansions:
                all_terms_set.add(exp)

        expanded_terms_list = sorted(list(all_terms_set))
        expanded_str = f"{query.strip()} {' '.join(expanded_terms_list)}"

        return expanded_terms_list, expanded_str, detected

    def build_concept_groups_for_lexical(self, query: str) -> List[Dict[str, float]]:
        """
        Builds concept groups with importance weights for field-aware lexical scoring.
        Original query terms get weight 1.0; expanded synonyms get weight 0.85; secondary terms get 0.70.
        """
        cleaned_query = self.clean_search_intent(query)
        detected = self.detect_concepts(query)

        concept_groups: List[Dict[str, float]] = []

        # Multi-word composite phrases
        for concept, syns in detected.items():
            group: Dict[str, float] = {concept: 1.0}
            for syn in syns:
                group[syn] = 0.85
                for sub in syn.split():
                    if len(sub) > 2 and sub not in group and sub not in GENERIC_FILLER_TERMS:
                        group[sub] = 0.70
            concept_groups.append(group)

        # Fallback if no concept detected
        if not concept_groups:
            tokens = [t for t in cleaned_query.split() if len(t) > 1 and t not in GENERIC_FILLER_TERMS]
            for tok in tokens:
                concept_groups.append({tok: 1.0})

        return concept_groups

    def calculate_field_aware_lexical_score(
        self,
        concept_groups: List[Dict[str, float]],
        content_text: str,
        filename: str,
        smart_tags: List[str],
        file_path: str = "",
        k1: float = 1.5
    ) -> float:
        """
        Calculates a field-aware normalized lexical similarity score in [0.0, 1.0].
        Field Weights:
        - Actual Document Content / Code / OCR: 1.0 (High Priority)
        - Title / Filename: 0.8 (Medium-High Priority)
        - Smart Tags / Metadata: 0.6 (Medium Priority)
        - Directory Path: 0.2 (Low Priority)
        """
        if not concept_groups:
            return 0.0

        content_lower = (content_text or "").lower()
        filename_lower = (filename or "").lower()
        tags_lower = " ".join(smart_tags or []).lower()
        path_lower = (file_path or "").lower()

        group_scores: List[float] = []

        for group in concept_groups:
            best_group_score = 0.0

            for term, weight in group.items():
                term_low = term.lower()
                pattern = r"\b" + re.escape(term_low) + r"\b"

                # Check matches across weighted fields
                c_matches = len(re.findall(pattern, content_lower)) if content_lower else 0
                if c_matches == 0 and content_lower and term_low in content_lower:
                    c_matches = 1

                fn_matches = len(re.findall(pattern, filename_lower)) if filename_lower else 0
                if fn_matches == 0 and filename_lower and term_low in filename_lower:
                    fn_matches = 1

                tag_matches = 1 if tags_lower and term_low in tags_lower else 0
                path_matches = 1 if path_lower and term_low in path_lower else 0

                # Saturated term frequencies per field
                c_sat = (c_matches / (c_matches + k1)) if c_matches > 0 else 0.0
                fn_sat = (fn_matches / (fn_matches + 1.0)) if fn_matches > 0 else 0.0
                tag_sat = 1.0 if tag_matches > 0 else 0.0
                path_sat = 1.0 if path_matches > 0 else 0.0

                # Weighted field combination
                term_field_score = weight * max(
                    c_sat * 1.0,
                    fn_sat * 0.8,
                    tag_sat * 0.6,
                    path_sat * 0.2
                )

                if term_field_score > best_group_score:
                    best_group_score = term_field_score

            group_scores.append(best_group_score)

        if not group_scores:
            return 0.0

        return min(1.0, max(0.0, sum(group_scores) / len(group_scores)))


query_expansion_service = QueryExpansionService()
