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
 * Calibrates raw backend score & text signals into a user-friendly relevance percentage (0-100%).
 */
export function calculateRelevanceScore({ score, query, filename, filePath, snippet, explanation }) {
  if (!query || !query.trim()) {
    return Math.min(100, Math.max(0, Math.round(score || 0)));
  }

  const q = query.trim().toLowerCase();
  const name = (filename || '').toLowerCase();
  const path = (filePath || '').toLowerCase();
  const text = ((snippet || '') + ' ' + (explanation || '')).toLowerCase();

  // 1. Uncompress raw vector score (backend maps raw cosine sim to ~70..98 range)
  const rawScore = typeof score === 'number' ? score : parseFloat(score) || 70;
  let vectorNorm = 0;
  if (rawScore > 1) {
    // Backend score range ~70 to 98
    vectorNorm = Math.max(0, Math.min(1, (rawScore - 70) / 28));
  } else {
    // Raw similarity range 0 to 1
    vectorNorm = Math.max(0, Math.min(1, rawScore));
  }

  // 2. Base score from vector similarity (30 to 65)
  let calibrated = 30 + (vectorNorm * 35);

  // 3. Exact query phrase matches in title/path or text
  const inName = name.includes(q) || path.includes(q);
  const inText = text.includes(q);

  if (inName) {
    calibrated += 28;
  }
  if (inText) {
    calibrated += 22;
  }

  // 4. Token-based matching for individual query words
  const words = q.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  if (words.length > 0) {
    const titleMatchedCount = words.filter(w => name.includes(w) || path.includes(w)).length;
    const textMatchedCount = words.filter(w => text.includes(w)).length;

    const titleRatio = titleMatchedCount / words.length;
    const textRatio = textMatchedCount / words.length;

    if (!inName && titleRatio > 0) {
      calibrated += titleRatio * 18;
    }
    if (!inText && textRatio > 0) {
      calibrated += textRatio * 14;
    }

    // Keyword density bonus if multiple query terms appear in snippet/explanation
    if (textMatchedCount >= 2 || (textMatchedCount === 1 && words.length === 1)) {
      calibrated += 5;
    }
  }

  // 5. Final bounding (0 - 99, 100 for exact title & snippet match)
  const isExactFullMatch = inName && inText;
  const maxCap = isExactFullMatch ? 100 : 98;
  return Math.min(maxCap, Math.max(25, Math.round(calibrated)));
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

    const payload = {
      query: query.trim(),
      top_k: 20,
      filters: {
        file_type: filters.fileType && filters.fileType !== 'all' ? filters.fileType : null,
        date_range: filters.dateRange && filters.dateRange !== 'any' ? filters.dateRange : null,
        category: filters.category && filters.category !== 'all' ? filters.category : null,
        labels: Array.isArray(filters.labels) && filters.labels.length > 0 ? filters.labels : (typeof filters.labels === 'string' && filters.labels !== 'all' && filters.labels !== '' ? [filters.labels] : null),
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
            tags: [item.category.toUpperCase(), item.folder_name]
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
}

export const semanticSearchService = new SemanticSearchService();
