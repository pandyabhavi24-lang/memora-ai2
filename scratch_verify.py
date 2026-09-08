import sys
import os

# Set working directory to memoramain
sys.path.insert(0, os.path.abspath("."))

from backend.app.database import SessionLocal, init_db_schema
from backend.app.models import File, OrganizationSuggestion
from backend.app.services.classification_service import classification_service
from backend.app.services.organization_service import organization_service
from backend.app.services.search_service import search_service
from backend.app.schemas import SearchFilters

def run_tests():
    print("=== Step 1: Initializing DB Schema ===")
    init_db_schema()
    db = SessionLocal()

    print("\n=== Step 2: Checking Files and Generating Smart Tags ===")
    files = db.query(File).all()
    print(f"Found {len(files)} files in memora.db")
    for f in files:
        tags = f.get_smart_tags()
        if not tags:
            # Generate and persist
            cat, conf, lvl, reason, smart_tags = classification_service.classify_file(
                f.name, f.extension, f.extracted_text or ""
            )
            f.set_smart_tags(smart_tags)
            print(f"  Tagged '{f.name}' -> {smart_tags}")
        else:
            print(f"  Existing tags for '{f.name}' -> {tags}")
    db.commit()

    print("\n=== Step 3: Testing Organization Analysis & Caching ===")
    analysis_res = organization_service.analyze_files(db)
    print(f"Analysis result: {analysis_res}")
    
    suggestions = organization_service.get_suggestions(db)
    print(f"Total suggestions: {len(suggestions)}")
    assert len(suggestions) > 0, "Expected suggestions to exist"
    for s in suggestions[:3]:
        print(f"  Suggestion ID {s['id']}: File '{s['filename']}', Tags: {s['smart_tags']}, Category: '{s['suggestedCategory']}'")

    print("\n=== Step 4: Testing Smart Tag User Edit Persistence ===")
    target_sug = suggestions[0]
    import time
    test_tag = f"CustomVerifiedTag_{int(time.time())}"
    test_tags = list(set(target_sug['smart_tags'] + [test_tag]))
    raw_id = target_sug['id']
    clean_id = int(str(raw_id).replace("s-", "")) if "s-" in str(raw_id) else int(raw_id)
    organization_service.update_suggestion(db, clean_id, smart_tags=test_tags)
    db.commit()

    # Re-fetch fresh from DB to verify persistence in SQLite
    refreshed_sug = db.query(OrganizationSuggestion).filter(OrganizationSuggestion.id == clean_id).first()
    assert refreshed_sug is not None, f"Suggestion with id {clean_id} should exist"
    assert test_tag in refreshed_sug.get_smart_tags(), "Tag should persist in suggestion"
    refreshed_file = db.query(File).filter(File.id == refreshed_sug.file_id).first()
    assert test_tag in refreshed_file.get_smart_tags(), "Tag should persist in file"
    print(f"Successfully verified tag edit persistence for file '{refreshed_file.name}': {refreshed_file.get_smart_tags()}")

    print("\n=== Step 5: Testing Collective Folder Synthesis ===")
    sug_ids = [s['id'] for s in suggestions[:3]]
    collective = organization_service.generate_collective_folder_name(db, suggestion_ids=sug_ids)
    print(f"Collective folder name: '{collective.get('suggested_folder_name', collective.get('folder_name'))}'")
    print(f"Reason: {collective['reason']}")
    print(f"Common Smart Tags: {collective['common_smart_tags']}")
    assert collective.get('suggested_folder_name', collective.get('folder_name', '')) != "", "Folder name should not be empty"

    print("\n=== Step 6: Testing Semantic Search & Mathematical Scores ===")
    search_res = search_service.execute_search(db, query="Java", top_k=5, sort_by="relevant")
    print(f"Search query: 'Java' -> Total hits: {search_res['total']}")
    for item in search_res['results']:
        score = item['score']
        print(f"  Match: '{item['file_name']}' | Score: {score}% | Tags: {item['smart_tags']}")
        print(f"    Snippet: {item['matched_snippet'][:100]}...")
        print(f"    AI Explanation: {item['ai_explanation']}")
        # Verify no fake +28 / no redundant string
        assert "Semantic match (" not in item['ai_explanation'], "Redundant percentage string should be removed"
        assert 0.0 <= score <= 100.0, "Score must be mathematically bound between 0 and 100"

    print("\n=== Step 7: Testing Strict Descending Date Sort ===")
    date_search = search_service.execute_search(db, query="Java", top_k=10, sort_by="newest")
    results = date_search['results']
    if len(results) >= 2:
        dates = [r['modified_at'] for r in results]
        print(f"Date sequence: {dates}")
        for i in range(len(dates) - 1):
            assert dates[i] >= dates[i+1], f"Date ordering violation: {dates[i]} < {dates[i+1]}"
        print("Date ordering verified strictly descending (newest first)!")

    print("\n=== Step 8: Testing Tag Filter ===")
    filter_res = search_service.execute_search(
        db, 
        query="Java", 
        top_k=5, 
        filters=SearchFilters(smart_tags=[test_tag])
    )
    print(f"Tag filter results for ['{test_tag}']: {filter_res['total']} files matched")
    for r in filter_res['results']:
        assert test_tag in r['smart_tags']

    db.close()
    print("\n ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
