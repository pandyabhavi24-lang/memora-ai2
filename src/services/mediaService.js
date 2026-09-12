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

  async searchVisualMedia(query, threshold = 60.0, topK = 20) {
    return await this._fetch('/api/media/search', {
      method: 'POST',
      body: JSON.stringify({ query, threshold, top_k: topK })
    });
  }

  async getFileTags(fileId) {
    return await this._fetch(`/api/media/${fileId}/tags`);
  }

  async updateFileTags(fileId, userTags, aiTags = null) {
    return await this._fetch(`/api/media/${fileId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ user_tags: userTags, ai_tags: aiTags })
    });
  }

  async recordFileInspection(fileId) {
    return await this._fetch(`/api/media/${fileId}/inspect`, {
      method: 'POST'
    });
  }

  async getRecentlyChecked(limit = 12) {
    return await this._fetch(`/api/media/recent?limit=${limit}`);
  }

  async createVisualGroup(groupName, fileIds, representativeFileId = null) {
    return await this._fetch('/api/media/groups/create', {
      method: 'POST',
      body: JSON.stringify({
        group_name: groupName,
        file_ids: fileIds,
        representative_file_id: representativeFileId
      })
    });
  }

  async deleteVisualGroup(groupId) {
    return await this._fetch(`/api/media/groups/${groupId}`, {
      method: 'DELETE'
    });
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

  async findSimilarByExternalImage(fileBlob, filename = 'query.jpg') {
    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    const url = `${API_BASE_URL}/api/media/similar-image`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `HTTP Error ${response.status}`);
    }
    return await response.json();
  }
}

export const mediaService = new MediaService();
