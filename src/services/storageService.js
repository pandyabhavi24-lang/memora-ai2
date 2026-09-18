/**
 * Memora AI - Module 5: Storage Analysis & Optimization API Service
 */

export const API_BASE_URL = 'http://localhost:8000';

class StorageService {
  /**
   * Helper method for JSON HTTP requests with error handling
   */
  async _fetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const errorMessage = errorData.detail || `HTTP Error ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }
      return await response.json();
    } catch (err) {
      console.error(`Storage API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  /**
   * Retrieves overall indexed storage summary, size, and category distribution.
   * GET /api/storage/summary
   */
  async getStorageSummary() {
    return await this._fetch('/api/storage/summary');
  }

  /**
   * Retrieves largest indexed files matching minimum size and limit parameters.
   * GET /api/storage/large-files
   * @param {Object} params - { min_size_mb?: number, limit?: number }
   */
  async getLargeFiles(params = {}) {
    const query = new URLSearchParams();
    if (params.min_size_mb !== undefined && params.min_size_mb !== null) {
      query.append('min_size_mb', params.min_size_mb);
    }
    if (params.limit !== undefined && params.limit !== null) {
      query.append('limit', params.limit);
    }
    const queryString = query.toString();
    const endpoint = `/api/storage/large-files${queryString ? `?${queryString}` : ''}`;
    return await this._fetch(endpoint);
  }

  /**
   * Retrieves optimizable indexed files regardless of size threshold.
   * GET /api/storage/optimizable-files
   * @param {Object} params - { limit?: number }
   */
  async getOptimizableFiles(params = {}) {
    const query = new URLSearchParams();
    if (params.limit !== undefined && params.limit !== null) {
      query.append('limit', params.limit);
    }
    const queryString = query.toString();
    const endpoint = `/api/storage/optimizable-files${queryString ? `?${queryString}` : ''}`;
    return await this._fetch(endpoint);
  }

  /**
   * Generates a lossless or lossy optimization candidate in the source directory.
   * POST /api/storage/optimize/candidate
   * @param {Object} payload - { file_id: number, mode?: 'lossless'|'lossy', lossy_quality?: number, bmp_target_format?: 'png'|'webp' }
   */
  async createOptimizationCandidate(payload) {
    return await this._fetch('/api/storage/optimize/candidate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Applies a validated optimization candidate using two-phase staged replacement.
   * POST /api/storage/optimize/apply
   * @param {Object} payload - { file_id: number, candidate_token: string, replace_original?: boolean }
   */
  async applyOptimization(payload) {
    return await this._fetch('/api/storage/optimize/apply', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Packages selected database-indexed files into a compressed ZIP archive.
   * POST /api/storage/archive/zip
   * @param {Object} payload - { file_ids: number[], destination_path: string, compression_level?: number, overwrite?: boolean }
   */
  async createZipArchive(payload) {
    return await this._fetch('/api/storage/archive/zip', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

export const storageService = new StorageService();
export default storageService;
