/**
 * Organization Feature Mock Data
 * Used exclusively for Module 2 Frontend Demo/Mock Phase.
 */

export const INITIAL_CATEGORIES = [
  'Documents',
  'Education',
  'Projects',
  'Work',
  'Certificates',
  'Finance',
  'Personal',
  'Images',
  'Other'
];

export const INITIAL_SUGGESTIONS = [
  {
    id: 's-1',
    filename: 'resume.pdf',
    type: 'PDF',
    currentPath: 'Downloads/resume.pdf',
    suggestedCategory: 'Work',
    confidence: 96,
    confidenceLevel: 'High',
    reason: 'Resume and professional profile content detected.',
    status: 'Pending'
  },
  {
    id: 's-2',
    filename: 'resume_final.pdf',
    type: 'PDF',
    currentPath: 'Downloads/resume_final.pdf',
    suggestedCategory: 'Work',
    confidence: 94,
    confidenceLevel: 'High',
    reason: 'Professional resume content detected.',
    status: 'Pending'
  },
  {
    id: 's-3',
    filename: 'internship_certificate.pdf',
    type: 'PDF',
    currentPath: 'Downloads/internship_certificate.pdf',
    suggestedCategory: 'Certificates',
    confidence: 94,
    confidenceLevel: 'High',
    reason: 'Certificate and internship completion terminology detected.',
    status: 'Pending'
  },
  {
    id: 's-4',
    filename: 'python_notes.pdf',
    type: 'PDF',
    currentPath: 'Downloads/python_notes.pdf',
    suggestedCategory: 'Education',
    confidence: 91,
    confidenceLevel: 'High',
    reason: 'Academic programming notes detected.',
    status: 'Pending'
  },
  {
    id: 's-5',
    filename: 'memora_project_report.docx',
    type: 'DOCX',
    currentPath: 'Downloads/memora_project_report.docx',
    suggestedCategory: 'Projects',
    confidence: 97,
    confidenceLevel: 'High',
    reason: 'Technical project documentation detected.',
    status: 'Pending'
  },
  {
    id: 's-6',
    filename: 'aws_cloud_notes.pdf',
    type: 'PDF',
    currentPath: 'Downloads/aws_cloud_notes.pdf',
    suggestedCategory: 'Education',
    confidence: 89,
    confidenceLevel: 'Medium',
    reason: 'Cloud computing study material detected.',
    status: 'Pending'
  },
  {
    id: 's-7',
    filename: 'invoice_august.pdf',
    type: 'PDF',
    currentPath: 'Downloads/invoice_august.pdf',
    suggestedCategory: 'Finance',
    confidence: 93,
    confidenceLevel: 'High',
    reason: 'Invoice number, billing and payment information detected.',
    status: 'Pending'
  },
  {
    id: 's-8',
    filename: 'college_id_card.pdf',
    type: 'PDF',
    currentPath: 'Downloads/college_id_card.pdf',
    suggestedCategory: 'Personal',
    confidence: 86,
    confidenceLevel: 'Medium',
    reason: 'Personal identification document detected.',
    status: 'Pending'
  },
  {
    id: 's-9',
    filename: 'machine_learning_assignment.docx',
    type: 'DOCX',
    currentPath: 'Downloads/machine_learning_assignment.docx',
    suggestedCategory: 'Education',
    confidence: 92,
    confidenceLevel: 'High',
    reason: 'Academic assignment and machine learning content detected.',
    status: 'Pending'
  },
  {
    id: 's-10',
    filename: 'project_presentation.pptx',
    type: 'PPTX',
    currentPath: 'Downloads/project_presentation.pptx',
    suggestedCategory: 'Projects',
    confidence: 95,
    confidenceLevel: 'High',
    reason: 'Technical project presentation detected.',
    status: 'Pending'
  },
  {
    id: 's-11',
    filename: 'IMG_20260815.jpg',
    type: 'JPG',
    currentPath: 'Downloads/IMG_20260815.jpg',
    suggestedCategory: 'Images',
    confidence: 99,
    confidenceLevel: 'High',
    reason: 'Image file detected.',
    status: 'Pending'
  },
  {
    id: 's-12',
    filename: 'internship_offer_letter.pdf',
    type: 'PDF',
    currentPath: 'Downloads/internship_offer_letter.pdf',
    suggestedCategory: 'Work',
    confidence: 90,
    confidenceLevel: 'High',
    reason: 'Employment and internship offer terminology detected.',
    status: 'Pending'
  },
  {
    id: 's-13',
    filename: 'shopping_invoice.pdf',
    type: 'PDF',
    currentPath: 'Downloads/shopping_invoice.pdf',
    suggestedCategory: 'Finance',
    confidence: 88,
    confidenceLevel: 'Medium',
    reason: 'Purchase and billing information detected.',
    status: 'Pending'
  },
  {
    id: 's-14',
    filename: 'database_notes.txt',
    type: 'TXT',
    currentPath: 'Downloads/database_notes.txt',
    suggestedCategory: 'Education',
    confidence: 84,
    confidenceLevel: 'Medium',
    reason: 'Technical database study notes detected.',
    status: 'Pending'
  }
];

export const INITIAL_DUPLICATES = [
  {
    id: 'dup-1',
    fileA: { filename: 'resume.pdf', path: 'Downloads/resume.pdf', size: '245 KB' },
    fileB: { filename: 'resume_final.pdf', path: 'Downloads/resume_final.pdf', size: '248 KB' },
    similarity: 96,
    detectionType: 'Similar content',
    status: 'Unresolved'
  },
  {
    id: 'dup-2',
    fileA: { filename: 'internship_certificate.pdf', path: 'Downloads/internship_certificate.pdf', size: '1.2 MB' },
    fileB: { filename: 'internship_completion.pdf', path: 'Downloads/internship_completion.pdf', size: '1.2 MB' },
    similarity: 92,
    detectionType: 'Similar content',
    status: 'Unresolved'
  },
  {
    id: 'dup-3',
    fileA: { filename: 'project_report.pdf', path: 'Downloads/project_report.pdf', size: '3.4 MB' },
    fileB: { filename: 'project_report_copy.pdf', path: 'Downloads/project_report_copy.pdf', size: '3.4 MB' },
    similarity: 100,
    detectionType: 'Exact duplicate',
    status: 'Unresolved'
  }
];

export const CATEGORY_OVERVIEW_DATA = [
  { category: 'Education', fileCount: 6, maxCount: 10 },
  { category: 'Projects', fileCount: 4, maxCount: 10 },
  { category: 'Work', fileCount: 3, maxCount: 10 },
  { category: 'Certificates', fileCount: 2, maxCount: 10 },
  { category: 'Finance', fileCount: 3, maxCount: 10 },
  { category: 'Personal', fileCount: 1, maxCount: 10 },
  { category: 'Images', fileCount: 2, maxCount: 10 },
  { category: 'Other', fileCount: 3, maxCount: 10 }
];
