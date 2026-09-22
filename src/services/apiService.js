/**
 * Memora AI - API Service Boundary
 * 
 * Production REST client connecting React UI to FastAPI Python Backend (localhost:8000).
 */

const API_BASE_URL = 'http://localhost:8000';

class ApiService {
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
        throw new Error(errorData.detail || `HTTP Error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`API Fetch Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Folder Selection & Scanning API
  // --------------------------------------------------------------------------
  async getFolders() {
    try {
      return await this._fetch('/api/folders');
    } catch (err) {
      console.warn('Backend unavailable for getFolders, returning empty array.');
      return [];
    }
  }

  async addFolder(folderPath, folderName = null) {
    return await this._fetch('/api/folders', {
      method: 'POST',
      body: JSON.stringify({
        path: folderPath,
        name: folderName
      })
    });
  }

  async removeFolder(folderId) {
    return await this._fetch(`/api/folders/${folderId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Electron Native Dialog Wrapper
   * Prompts user with native OS folder picker, registers path with backend, and triggers scan.
   */
  async selectFolderViaNativeDialog() {
    if (window.electronAPI && window.electronAPI.openDirectory) {
      try {
        const result = await window.electronAPI.openDirectory();
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          const addedFolders = [];
          for (const path of result.filePaths) {
            const f = await this.addFolder(path);
            addedFolders.push(f);
          }
          return addedFolders;
        }
      } catch (err) {
        console.error('Native Electron dialog error:', err);
      }
      return [];
    }
    
    // Web browser fallback prompt if Electron API unavailable
    const userPath = prompt('Enter absolute folder path to scan (e.g. C:\\Users\\Name\\Documents):');
    if (userPath && userPath.trim()) {
      const folder = await this.addFolder(userPath.trim());
      return [folder];
    }
    return [];
  }

  // --------------------------------------------------------------------------
  // Real Backend Scanning Pipeline Status & Control
  // --------------------------------------------------------------------------
  async startScan() {
    return await this._fetch('/api/scan', {
      method: 'POST'
    });
  }

  async getScanStatus() {
    try {
      return await this._fetch('/api/scan/status');
    } catch (err) {
      return {
        status: 'failed',
        files_found: 0,
        files_processed: 0,
        files_failed: 0,
        chunks_created: 0,
        vectors_created: 0,
        current_file: '',
        progress_percentage: 0,
        error_message: 'Backend server not responding'
      };
    }
  }

  async cancelScan() {
    return await this._fetch('/api/scan/cancel', {
      method: 'POST'
    });
  }

  async startScanProgress(onProgressUpdate) {
    // Initiate background scan on backend
    try {
      await this.startScan();
    } catch (err) {
      console.error('Failed to trigger scan on backend:', err);
    }

    // Poll status until completion or failure
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const status = await this.getScanStatus();
        
        onProgressUpdate({
          totalFiles: status.files_found || 0,
          processedFiles: status.files_processed || 0,
          percent: status.progress_percentage || 0,
          currentFile: status.current_file || 'Scanning documents...',
          ocrProcessed: status.files_processed || 0,
          vectorsIndexed: status.vectors_created || 0,
          status: status.status
        });

        if (status.status === 'complete' || status.status === 'failed' || status.status === 'idle') {
          clearInterval(interval);
          resolve(status.status === 'complete');
        }
      }, 500);
    });
  }

  // --------------------------------------------------------------------------
  // Dashboard & Statistics API
  // --------------------------------------------------------------------------
  async getStatistics() {
    try {
      return await this._fetch('/api/statistics');
    } catch (err) {
      console.warn('Backend unavailable for statistics, returning fallback defaults.');
      return {
        folders: 0,
        files: 0,
        chunks: 0,
        vectors: 0,
        searches: 0,
        recent_files: [],
        recent_searches: []
      };
    }
  }

  async getFileContent(fileId) {
    return await this._fetch(`/api/files/${fileId}/content`);
  }

  async updateFileTags(fileId, tags) {
    return await this._fetch(`/api/files/${fileId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags })
    });
  }

  // --------------------------------------------------------------------------
  // Desktop Action Triggers (Locate, Open)
  // --------------------------------------------------------------------------
  async openFile(filePath) {
    if (window.electronAPI && window.electronAPI.openPath) {
      return await window.electronAPI.openPath(filePath);
    }
    console.log(`[Desktop Action] Opening file: ${filePath}`);
    alert(`Opening file:\n${filePath}`);
  }

  async locateFile(filePath) {
    if (window.electronAPI && window.electronAPI.showItemInFolder) {
      window.electronAPI.showItemInFolder(filePath);
      return;
    }
    console.log(`[Desktop Action] Locating file in File Explorer: ${filePath}`);
    alert(`Locating file in folder:\n${filePath}`);
  }



  // --------------------------------------------------------------------------
  // Module 4 — PDF Studio API
  // --------------------------------------------------------------------------
  async getPDFStudioHealth() {
    return await this._fetch('/api/pdf/health');
  }

  async inspectPDF(filePath) {
    return await this._fetch('/api/pdf/inspect', {
      method: 'POST',
      body: JSON.stringify({ file_path: filePath })
    });
  }

  async createBlankPDF(data) {
    return await this._fetch('/api/pdf/create-blank', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async manipulatePDFPages(data) {
    return await this._fetch('/api/pdf/manipulate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async reorderPDFPages(data) {
    return await this._fetch('/api/pdf/reorder', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async extractPDFPages(data) {
    return await this._fetch('/api/pdf/extract-pages', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async mergePDFs(data) {
    return await this._fetch('/api/pdf/merge', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async alternatePDFs(data) {
    return await this._fetch('/api/pdf/alternate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async previewAlternatePDFs(data) {
    return await this._fetch('/api/pdf/alternate/preview', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async generatePDF(data) {
    return await this._fetch('/api/pdf/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async splitPDF(data) {
    return await this._fetch('/api/pdf/split', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async imagesToPDF(data) {
    return await this._fetch('/api/pdf/images-to-pdf', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async pdfToImages(data) {
    return await this._fetch('/api/pdf/convert/pdf-to-images', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async registerPDFDocument(data) {
    return await this._fetch('/api/pdf/documents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPDFDocument(documentId) {
    return await this._fetch(`/api/pdf/documents/${documentId}`);
  }

  async savePDFAnnotations(documentId, annotations) {
    return await this._fetch(`/api/pdf/documents/${documentId}/annotations`, {
      method: 'POST',
      body: JSON.stringify({ annotations })
    });
  }

  async getPDFAnnotations(documentId, pageIndex = null) {
    const query = pageIndex !== null ? `?page_index=${pageIndex}` : '';
    return await this._fetch(`/api/pdf/documents/${documentId}/annotations${query}`);
  }

  async exportPDFWithAnnotations(data) {
    return await this._fetch('/api/pdf/export-with-annotations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async exportWorkspacePDF(data) {
    return await this._fetch('/api/pdf/export-workspace', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PDF Studio Real Drafts API
  async savePDFDraft(draftData) {
    return await this._fetch('/api/pdf/drafts', {
      method: 'POST',
      body: JSON.stringify(draftData)
    });
  }

  async listPDFDrafts() {
    return await this._fetch('/api/pdf/drafts');
  }

  async getPDFDraft(draftId) {
    return await this._fetch(`/api/pdf/drafts/${draftId}`);
  }

  async deletePDFDraft(draftId) {
    return await this._fetch(`/api/pdf/drafts/${draftId}`, {
      method: 'DELETE'
    });
  }

  // Gmail OAuth & Email Sharing API
  async getEmailStatus() {
    return await this._fetch('/api/pdf/email/status');
  }

  async getEmailAuthUrl(redirectUri = 'http://localhost:8000/api/pdf/email/oauth-callback') {
    return await this._fetch(`/api/pdf/email/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`);
  }

  async handleEmailOAuthCallback(code, redirectUri = 'http://localhost:8000/api/pdf/email/oauth-callback') {
    return await this._fetch('/api/pdf/email/oauth-callback', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    });
  }

  async sendPDFEmail(data) {
    return await this._fetch('/api/pdf/email/send', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // WhatsApp Business Cloud API
  async getWhatsAppStatus() {
    return await this._fetch('/api/pdf/whatsapp/status');
  }

  async sendPDFWhatsApp(data) {
    return await this._fetch('/api/pdf/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getMemoraFilesForPDFStudio(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.file_type) queryParams.append('file_type', params.file_type);
    if (params.query) queryParams.append('query', params.query);
    if (params.folder_id) queryParams.append('folder_id', params.folder_id);
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return await this._fetch(`/api/pdf/memora/files${qs}`);
  }

  async searchMemoraFilesForPDFStudio(query, top_k = 20, file_type = null) {
    return await this._fetch('/api/pdf/memora/search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k, filters: file_type ? { file_type } : null })
    });
  }

  async exportImageComparisonToPDF(data) {
    return await this._fetch('/api/pdf/export-image-comparison', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --------------------------------------------------------------------------
  // Module 5 - File Expiry & Renewal Reminders API
  // --------------------------------------------------------------------------
  async getExpiries(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.document_type) queryParams.append('document_type', params.document_type);
    if (params.date_type) queryParams.append('date_type', params.date_type);
    if (params.search) queryParams.append('search', params.search);
    if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return await this._fetch(`/api/expiry${qs}`);
  }

  async getExpirySummary() {
    return await this._fetch('/api/expiry/summary');
  }

  async scanExpiries() {
    return await this._fetch('/api/expiry/scan', {
      method: 'POST'
    });
  }

  async getExpiryDetail(expiryId) {
    return await this._fetch(`/api/expiry/${expiryId}`);
  }

  async updateExpiryRecord(expiryId, data) {
    return await this._fetch(`/api/expiry/${expiryId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async confirmExpiryDate(expiryId) {
    return await this._fetch(`/api/expiry/${expiryId}/confirm`, {
      method: 'POST'
    });
  }

  async analyzeFileExpiry(fileId) {
    return await this._fetch(`/api/expiry/analyze/${fileId}`, {
      method: 'POST'
    });
  }

  async reanalyzeExpiryRecord(expiryId) {
    return await this._fetch(`/api/expiry/${expiryId}/reanalyze`, {
      method: 'POST'
    });
  }

  async deleteExpiryRecord(expiryId) {
    return await this._fetch(`/api/expiry/${expiryId}`, {
      method: 'DELETE'
    });
  }

  async getOllamaExpiryStatus() {
    try {
      return await this._fetch('/api/expiry/ollama-status');
    } catch (err) {
      return { available: false, model: '', base_url: 'http://127.0.0.1:11434' };
    }
  }

  async getDueReminders() {
    return await this._fetch('/api/expiry/reminders/due');
  }

  async dismissReminderNotification(expiryId) {
    return await this._fetch(`/api/expiry/reminders/${expiryId}/dismiss`, {
      method: 'POST'
    });
  }

}

export const apiService = new ApiService();
