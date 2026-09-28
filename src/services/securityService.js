/**
 * Memora AI - Security Service (Module 5)
 *
 * API client for all /api/security/* endpoints.
 * Session token is stored ONLY in memory (React state via AppContext).
 * It is never written to localStorage, sessionStorage, or cookies.
 */

const API_BASE = 'http://localhost:8000';

class SecurityService {
  /**
   * Internal fetch helper that always adds the session token header
   * when one is available. The token is passed in from the caller
   * (retrieved from React state — never from storage).
   */
  async _fetch(endpoint, options = {}, sessionToken = null) {
    const headers = {
      'Content-Type': 'application/json',
      ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
      ...options.headers,
    };
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(err.detail || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // --------------------------------------------------------------------------
  // Security settings
  // --------------------------------------------------------------------------

  async getSettings(sessionToken = null) {
    return this._fetch('/api/security/settings', {}, sessionToken);
  }

  // --------------------------------------------------------------------------
  // PIN management
  // --------------------------------------------------------------------------

  async setPin(pin, currentPin = null, recoveryEmail = null, sessionToken = null) {
    return this._fetch('/api/security/pin/set', {
      method: 'POST',
      body: JSON.stringify({
        pin,
        current_pin: currentPin,
        recovery_email: recoveryEmail,
      }),
    }, sessionToken);
  }

  async forgotPin(email) {
    return this._fetch('/api/security/pin/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyResetCode(resetCode) {
    return this._fetch('/api/security/pin/verify-reset', {
      method: 'POST',
      body: JSON.stringify({ reset_code: resetCode }),
    });
  }

  async resetPin(resetCode, newPin) {
    return this._fetch('/api/security/pin/reset', {
      method: 'POST',
      body: JSON.stringify({ reset_code: resetCode, new_pin: newPin }),
    });
  }

  async changeRecoveryEmail(currentPin, newEmail, sessionToken = null) {
    return this._fetch('/api/security/recovery-email/change', {
      method: 'POST',
      body: JSON.stringify({ current_pin: currentPin, new_email: newEmail }),
    }, sessionToken);
  }

  async removePin(pin, sessionToken = null) {
    return this._fetch('/api/security/pin', {
      method: 'DELETE',
      body: JSON.stringify({ pin }),
    }, sessionToken);
  }

  async verifyPin(pin) {
    // Note: verifyPin does NOT take a session token — it IS the authentication step
    return this._fetch('/api/security/pin/verify', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  }

  // --------------------------------------------------------------------------
  // Lock management
  // --------------------------------------------------------------------------

  async setLockEnabled(enabled, sessionToken = null) {
    return this._fetch('/api/security/lock/enable', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }, sessionToken);
  }

  async lockNow(sessionToken = null) {
    return this._fetch('/api/security/lock/lock-now', {
      method: 'POST',
    }, sessionToken);
  }

  // --------------------------------------------------------------------------
  // Excluded folders
  // --------------------------------------------------------------------------

  async getExcludedFolders(sessionToken = null) {
    return this._fetch('/api/security/excluded-folders', {}, sessionToken);
  }

  async addExcludedFolder(path, sessionToken = null) {
    return this._fetch('/api/security/excluded-folders', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }, sessionToken);
  }

  async removeExcludedFolder(id, sessionToken = null) {
    return this._fetch(`/api/security/excluded-folders/${id}`, {
      method: 'DELETE',
    }, sessionToken);
  }

  // --------------------------------------------------------------------------
  // Audit logs
  // --------------------------------------------------------------------------

  async getAuditLogs({ action, status, limit = 200 } = {}, sessionToken = null) {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (status) params.set('status_filter', status);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this._fetch(`/api/security/audit-logs${qs}`, {}, sessionToken);
  }

  async clearAuditLogs(sessionToken = null) {
    return this._fetch('/api/security/audit-logs', {
      method: 'DELETE',
    }, sessionToken);
  }

  // --------------------------------------------------------------------------
  // Data management, Encryption & Permanent Deletion
  // --------------------------------------------------------------------------

  async removeIndexData({ scope = 'metadata', folderId = null } = {}, sessionToken = null) {
    return this._fetch('/api/security/data/remove-index', {
      method: 'POST',
      body: JSON.stringify({ scope, folder_id: folderId }),
    }, sessionToken);
  }

  async inspectDelete(path, sessionToken = null) {
    return this._fetch('/api/security/data/inspect-delete', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }, sessionToken);
  }

  async deletePermanently(path, confirm = true, sessionToken = null) {
    return this._fetch('/api/security/data/delete-permanently', {
      method: 'POST',
      body: JSON.stringify({ path, confirm }),
    }, sessionToken);
  }

  async encryptItem(path, sessionToken = null) {
    return this._fetch('/api/security/encrypt', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }, sessionToken);
  }

  async decryptItem(path, sessionToken = null) {
    return this._fetch('/api/security/decrypt', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }, sessionToken);
  }

  async getEncryptionStatus(path, sessionToken = null) {
    return this._fetch('/api/security/encryption-status', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }, sessionToken);
  }

  // --------------------------------------------------------------------------
  // Backup & Restore
  // --------------------------------------------------------------------------

  async createBackup(destinationDir, sessionToken = null) {
    return this._fetch('/api/security/backup', {
      method: 'POST',
      body: JSON.stringify({ destination_dir: destinationDir }),
    }, sessionToken);
  }

  async validateBackup(backupPath, sessionToken = null) {
    return this._fetch('/api/security/backup/validate', {
      method: 'POST',
      body: JSON.stringify({ backup_path: backupPath }),
    }, sessionToken);
  }

  async restoreBackup(backupPath, sessionToken = null) {
    return this._fetch('/api/security/restore', {
      method: 'POST',
      body: JSON.stringify({ backup_path: backupPath }),
    }, sessionToken);
  }
}

export const securityService = new SecurityService();
