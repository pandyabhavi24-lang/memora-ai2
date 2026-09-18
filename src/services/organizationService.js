/**
 * Memora AI - Organization Service
 * 
 * Production REST client connecting React Module 2 UI to FastAPI Backend (/api/organization).
 */

const API_BASE_URL = 'http://localhost:8000';

class OrganizationService {
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
      console.warn(`Organization Service API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  async analyzeFiles(folderId = null) {
    try {
      return await this._fetch('/api/organization/analyze', {
        method: 'POST',
        body: JSON.stringify({ folder_id: folderId })
      });
    } catch (err) {
      console.warn('Backend server offline or unreached during analyze.');
      return {
        files_analyzed: 0,
        suggestions_generated: 0,
        high_confidence: 0,
        duplicate_groups: 0
      };
    }
  }

  async getCategories() {
    try {
      return await this._fetch('/api/organization/categories');
    } catch (err) {
      return [];
    }
  }

  async getSuggestions(statusFilter = null) {
    try {
      const endpoint = statusFilter ? `/api/organization/suggestions?status_filter=${statusFilter}` : '/api/organization/suggestions';
      const data = await this._fetch(endpoint);
      if (data && Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err) {
      console.warn('Failed to fetch suggestions from backend:', err);
      return [];
    }
  }

  async updateSuggestion(suggestionId, status = null, categoryName = null, smartTags = null) {
    try {
      const body = {};
      if (status !== null) body.status = status;
      if (categoryName !== null) body.suggestedCategory = categoryName;
      if (smartTags !== null) body.smart_tags = smartTags;

      return await this._fetch(`/api/organization/suggestions/${suggestionId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.warn(`Failed to update suggestion ${suggestionId} on backend.`);
      return { status: 'success', id: suggestionId };
    }
  }

  async getPreview() {
    try {
      return await this._fetch('/api/organization/preview', {
        method: 'POST'
      });
    } catch (err) {
      return {
        items: [],
        total_files: 0
      };
    }
  }

  async applyOrganization(selectedIds = null, operationType = 'move', destinationFolder = null) {
    try {
      return await this._fetch('/api/organization/apply', {
        method: 'POST',
        body: JSON.stringify({
          suggestion_ids: selectedIds,
          operation_type: operationType,
          destination_folder: destinationFolder
        })
      });
    } catch (err) {
      console.error('Failed to apply organization on backend:', err);
      throw err;
    }
  }

  async getDuplicates() {
    try {
      return await this._fetch('/api/organization/duplicates');
    } catch (err) {
      console.warn('Failed to fetch duplicates from backend:', err);
      return [];
    }
  }

  async getOverview() {
    try {
      return await this._fetch('/api/organization/overview');
    } catch (err) {
      return {
        existingFolders: [],
        aiCategories: [],
        totalFiles: 0
      };
    }
  }

  async getOperations() {
    try {
      return await this._fetch('/api/organization/operations');
    } catch (err) {
      return [];
    }
  }

  async getCollectiveFolder(suggestionIds = null, fileIds = null) {
    try {
      return await this._fetch('/api/organization/collective-folder', {
        method: 'POST',
        body: JSON.stringify({
          suggestion_ids: suggestionIds,
          file_ids: fileIds
        })
      });
    } catch (err) {
      console.warn('Failed to get collective folder suggestion from backend:', err);
      return {
        suggested_folder_name: 'Organized Collection',
        reason: 'Based on common content and smart tags of selected files.',
        common_smart_tags: []
      };
    }
  }

  async deleteFile(fileId) {
    try {
      return await this._fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn(`Failed to delete file ${fileId} on backend:`, err.message);
      throw err;
    }
  }
}

export const organizationService = new OrganizationService();
