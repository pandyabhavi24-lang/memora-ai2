/**
 * @typedef {Object} ScannedFolder
 * @property {string} id
 * @property {string} path
 * @property {string} name
 * @property {number} fileCount
 * @property {string} scanStatus - 'ready' | 'scanning' | 'indexed' | 'error'
 * @property {string} addedAt
 */

/**
 * @typedef {Object} IndexedFile
 * @property {string} id
 * @property {string} name
 * @property {string} path
 * @property {string} folderPath
 * @property {'pdf' | 'docx' | 'image' | 'code' | 'note'} category
 * @property {string} fileExtension
 * @property {number} sizeBytes
 * @property {string} modifiedAt
 * @property {string} createdAt
 * @property {string} [extractedSnippet]
 * @property {string} [ocrText]
 * @property {string} [aiSummary]
 * @property {string[]} tags
 */

/**
 * @typedef {Object} SearchResult
 * @property {IndexedFile} file
 * @property {number} score - Relevance score (0-100)
 * @property {string} matchedSnippet
 * @property {string} aiExplanation
 * @property {string[]} matchHighlights
 */

export {};
