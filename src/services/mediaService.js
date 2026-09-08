/**
 * Memora AI - Module 3: Visual & Media Intelligence API Service
 */

export const API_BASE_URL = 'http://localhost:8000';

class MediaService {
  getThumbnailUrl(fileId) {
    return `${API_BASE_URL}/api/media/${fileId}/thumbnail`;
  }

  getPreviewUrl(fileId) {
    return `${API_BASE_URL}/api/media/${fileId}/preview`;
  }

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
        throw new Error(errorData.detail || `HTTP Error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`Media API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  async getOverview() {
    return await this._fetch('/api/media/overview');
  }

  async getStatus() {
    return await this._fetch('/api/media/status');
  }

  async triggerAnalysis(forceReanalyze = false) {
    return await this._fetch('/api/media/analyze', {
      method: 'POST',
      body: JSON.stringify({ force_reanalyze: forceReanalyze })
    });
  }

  async getMediaFiles(mediaType = 'all', limit = 100) {
    const query = new URLSearchParams();
    if (mediaType && mediaType !== 'all') query.append('media_type', mediaType);
    if (limit) query.append('limit', limit);
    return await this._fetch(`/api/media/files?${query.toString()}`);
  }

  async getFileDetail(fileId) {
    return await this._fetch(`/api/media/${fileId}`);
  }

  async getSimilarMedia(fileId) {
    return await this._fetch(`/api/media/similar/${fileId}`);
  }

  async getVisualGroups() {
    return await this._fetch('/api/media/groups');
  }

  async getRecommendations() {
    return await this._fetch('/api/media/recommendations');
  }

  async handleRecommendationAction(recommendationId, action) {
    return await this._fetch(`/api/media/recommendations/${recommendationId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  }

  async deleteMediaFile(fileId) {
    return await this._fetch(`/api/media/delete/${fileId}`, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true })
    });
  }
}

export const mediaService = new MediaService();
