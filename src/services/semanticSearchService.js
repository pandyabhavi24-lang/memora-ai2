/**
 * Memora AI - Dedicated Semantic Search Service
 * 
 * Clean API wrapper delegating vector search and query history directly to FastAPI backend.
 */

const API_BASE_URL = 'http://localhost:8000';

class SemanticSearchService {
  async search(query = '', filters = {}, sortBy = 'relevant') {
    if (!query || !query.trim()) {
      return {
        results: [],
        total: 0,
        query: '',
        executionTimeMs: 0
      };
    }

    const payload = {
      query: query.trim(),
      top_k: 20,
      filters: {
        file_type: filters.fileType && filters.fileType !== 'all' ? filters.fileType : null,
        folder_id: filters.folder && filters.folder !== 'all' ? parseInt(filters.folder, 10) : null,
        date_range: filters.dateRange && filters.dateRange !== 'any' ? filters.dateRange : null
      },
      sort_by: sortBy
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Transform backend SearchResultItem objects to UI-expected SearchResult structures
      const formattedResults = (data.results || []).map(item => ({
        file: {
          id: item.file_id,
          name: item.file_name,
          path: item.file_path,
          folderName: item.folder_name,
          category: item.category,
          fileExtension: item.extension,
          sizeBytes: item.size_bytes,
          modifiedAt: item.modified_at,
          aiSummary: item.ai_explanation,
          extractedSnippet: item.matched_snippet,
          tags: [item.category.toUpperCase(), item.folder_name]
        },
        score: item.score,
        matchedSnippet: item.matched_snippet,
        aiExplanation: item.ai_explanation,
        matchHighlights: [query.trim()]
      }));

      return {
        results: formattedResults,
        total: data.total,
        query: data.query,
        executionTimeMs: data.execution_time_ms
      };
    } catch (err) {
      console.error('Semantic Search API Error:', err);
      throw err;
    }
  }

  async getSearchHistory() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/search/history`);
      if (!response.ok) return [];
      const history = await response.json();
      return history.map(item => ({
        id: item.id.toString(),
        query: item.query,
        timestamp: item.created_at,
        resultCount: item.result_count
      }));
    } catch (err) {
      console.warn('Failed to fetch search history from backend:', err);
      return [];
    }
  }

  async removeSearchHistory(id) {
    try {
      await fetch(`${API_BASE_URL}/api/search/history/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error(`Failed to remove search history item ${id}:`, err);
    }
  }

  async clearSearchHistory() {
    try {
      await fetch(`${API_BASE_URL}/api/search/history`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to clear search history:', err);
    }
  }
}

export const semanticSearchService = new SemanticSearchService();
