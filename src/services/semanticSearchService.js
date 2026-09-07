/**
 * Memora AI - Dedicated Semantic Search Service
 * 
 * Clean API wrapper delegating vector search and query history directly to FastAPI backend.
 */

const API_BASE_URL = 'http://localhost:8000';

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'how', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'what', 'when', 'where', 'who', 'will', 'with', 'my', 'your', 'file', 'files', 'show', 'find'
]);

/**
 * Returns clean cosine similarity relevance percentage (0-100%) from backend.
 * No arbitrary bonuses are added, preserving true mathematical vector similarity.
 */
export function calculateRelevanceScore({ score }) {
  if (typeof score === 'number') {
    return Math.min(100, Math.max(0, Math.round(score)));
  }
  const parsed = parseFloat(score);
  return !isNaN(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : 0;
}

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

    const targetSmartTags = Array.isArray(filters.smartTags) && filters.smartTags.length > 0 
      ? filters.smartTags 
      : (Array.isArray(filters.labels) && filters.labels.length > 0 ? filters.labels : null);

    const payload = {
      query: query.trim(),
      top_k: 20,
      filters: {
        file_type: filters.fileType && filters.fileType !== 'all' ? filters.fileType : null,
        date_range: filters.dateRange && filters.dateRange !== 'any' ? filters.dateRange : null,
        smart_tags: targetSmartTags,
        labels: targetSmartTags,
        size: filters.size && filters.size !== 'any' ? filters.size : null
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

      // Transform backend SearchResultItem objects & apply calibrated relevance percentage
      const formattedResults = (data.results || []).map(item => {
        const calibratedScore = calculateRelevanceScore({
          score: item.score,
          query: query.trim(),
          filename: item.file_name,
          filePath: item.file_path,
          snippet: item.matched_snippet,
          explanation: item.ai_explanation
        });

        const smartTagsList = Array.isArray(item.smart_tags) && item.smart_tags.length > 0
          ? item.smart_tags
          : (Array.isArray(item.labels) ? item.labels : []);

        return {
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
            smartTags: smartTagsList,
            tags: smartTagsList
          },
          score: calibratedScore,
          matchedSnippet: item.matched_snippet,
          aiExplanation: item.ai_explanation,
          matchHighlights: [query.trim()]
        };
      });

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

  async getAvailableSmartTags() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/search/tags`);
      if (!response.ok) return [];
      const tags = await response.json();
      return Array.isArray(tags) ? tags : [];
    } catch (err) {
      console.warn('Failed to fetch available smart tags from backend:', err);
      return [];
    }
  }
}

export const semanticSearchService = new SemanticSearchService();
