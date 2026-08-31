export const INITIAL_FOLDERS = [
  {
    id: 'f-1',
    name: 'Documents',
    path: 'C:\\Users\\Alex\\Documents',
    fileCount: 420,
    scanStatus: 'indexed',
    addedAt: '2026-07-15T10:30:00Z',
    icon: 'Folder'
  },
  {
    id: 'f-2',
    name: 'College',
    path: 'C:\\Users\\Alex\\College\\FinalYear',
    fileCount: 850,
    scanStatus: 'indexed',
    addedAt: '2026-07-20T14:20:00Z',
    icon: 'GraduationCap'
  },
  {
    id: 'f-3',
    name: 'Downloads',
    path: 'C:\\Users\\Alex\\Downloads',
    fileCount: 1180,
    scanStatus: 'ready',
    addedAt: '2026-08-01T09:00:00Z',
    icon: 'Download'
  },
  {
    id: 'f-4',
    name: 'Pictures',
    path: 'C:\\Users\\Alex\\Pictures\\Memories',
    fileCount: 640,
    scanStatus: 'indexed',
    addedAt: '2026-08-02T16:45:00Z',
    icon: 'Image'
  }
];

export const MOCK_FILES = [
  {
    id: 'file-1',
    name: 'Resume_Alex_Chen_AI_Internship_2025.pdf',
    path: 'C:\\Users\\Alex\\Documents\\Resumes\\Resume_Alex_Chen_AI_Internship_2025.pdf',
    folderPath: 'C:\\Users\\Alex\\Documents\\Resumes',
    category: 'pdf',
    fileExtension: 'pdf',
    sizeBytes: 1240000,
    modifiedAt: '2026-07-28T14:30:00Z',
    createdAt: '2026-07-10T11:20:00Z',
    extractedSnippet: 'Senior CS student seeking AI Research Internship. Built local vector search engine using FAISS, PyTorch, and Sentence-Transformers with sub-second retrieval latency.',
    ocrText: 'Alex Chen | Machine Learning & Fullstack Specialist | B.Tech Computer Science 2026',
    aiSummary: 'Latest updated resume tailored for AI/ML engineering internships featuring vector search projects and full-stack React skills.',
    tags: ['Resume', 'Internship', 'Machine Learning', 'FAISS', 'Career'],
    relevanceScore: 98,
    similarityRank: 0.98,
    explanation: 'Contains exact query match "internship resume" and highlights machine learning project experience updated last month.'
  },
  {
    id: 'file-2',
    name: 'Machine_Learning_Unit3_NeuralNetworks.docx',
    path: 'C:\\Users\\Alex\\College\\FinalYear\\ML\\Machine_Learning_Unit3_NeuralNetworks.docx',
    folderPath: 'C:\\Users\\Alex\\College\\FinalYear\\ML',
    category: 'docx',
    fileExtension: 'docx',
    sizeBytes: 3450000,
    modifiedAt: '2026-08-02T09:15:00Z',
    createdAt: '2026-07-01T08:00:00Z',
    extractedSnippet: 'Unit 3: Deep Neural Networks, Backpropagation, Gradient Descent, Activation Functions (ReLU, Softmax), and Optimization Algorithms (Adam, RMSprop).',
    ocrText: '',
    aiSummary: 'Comprehensive course notes covering neural network architectures, hyperparameter tuning, and SGD optimizers.',
    tags: ['College', 'Machine Learning', 'Study Notes', 'Exams'],
    relevanceScore: 94,
    similarityRank: 0.94,
    explanation: 'Matches query "machine learning notes" with high semantic density around neural networks and study materials.'
  },
  {
    id: 'file-3',
    name: 'Amazon_AWS_Cloud_Invoice_Dec2025.png',
    path: 'C:\\Users\\Alex\\Downloads\\Invoices\\Amazon_AWS_Cloud_Invoice_Dec2025.png',
    folderPath: 'C:\\Users\\Alex\\Downloads\\Invoices',
    category: 'image',
    fileExtension: 'png',
    sizeBytes: 890000,
    modifiedAt: '2026-07-15T18:22:00Z',
    createdAt: '2026-07-15T18:22:00Z',
    extractedSnippet: '',
    ocrText: 'Amazon Web Services Invoice #AWS-9481023. Total Amount: $42.50. Payment Method: Visa ending 4092. Service: EC2 & S3 storage usage.',
    aiSummary: 'Scanned image invoice from Amazon Web Services for monthly cloud hosting expenditures ($42.50).',
    tags: ['Invoice', 'Receipt', 'Amazon', 'Cloud', 'Finance'],
    relevanceScore: 91,
    similarityRank: 0.91,
    explanation: 'Optical character recognition (EasyOCR) detected invoice number, Amazon header, and monetary totals.'
  },
  {
    id: 'file-4',
    name: 'College_Farewell_Party_Group_Photo_2026.jpg',
    path: 'C:\\Users\\Alex\\Pictures\\Memories\\College_Farewell_Party_Group_Photo_2026.jpg',
    folderPath: 'C:\\Users\\Alex\\Pictures\\Memories',
    category: 'image',
    fileExtension: 'jpg',
    sizeBytes: 5200000,
    modifiedAt: '2026-06-30T21:00:00Z',
    createdAt: '2026-06-30T21:00:00Z',
    extractedSnippet: '',
    ocrText: 'Senior Farewell Batch 2026 - Computer Science Department Celebrations',
    aiSummary: 'High-resolution photo of CS students and faculty members during the final year college farewell event.',
    tags: ['College', 'Farewell', 'Photos', 'Friends', 'Events'],
    relevanceScore: 89,
    similarityRank: 0.89,
    explanation: 'CLIP visual embeddings matched group event aesthetics and OCR parsed banner text "Senior Farewell Batch 2026".'
  },
  {
    id: 'file-5',
    name: 'Google_Cloud_Professional_AI_Engineer_Certificate.pdf',
    path: 'C:\\Users\\Alex\\Documents\\Certificates\\Google_Cloud_Professional_AI_Engineer_Certificate.pdf',
    folderPath: 'C:\\Users\\Alex\\Documents\\Certificates',
    category: 'pdf',
    fileExtension: 'pdf',
    sizeBytes: 2100000,
    modifiedAt: '2026-05-14T11:00:00Z',
    createdAt: '2026-05-14T11:00:00Z',
    extractedSnippet: 'This certifies that Alex Chen has successfully completed the requirements to be recognized as a Google Cloud Certified Professional AI Engineer.',
    ocrText: 'Google Cloud Certified Professional Machine Learning / AI Engineer ID: GCP-AI-883921',
    aiSummary: 'Official certification document awarded by Google Cloud for Machine Learning & AI Engineering.',
    tags: ['Certificates', 'Google Cloud', 'AI', 'Resume', 'Achievements'],
    relevanceScore: 95,
    similarityRank: 0.95,
    explanation: 'Extracted certificate credential metadata and verified authenticity stamp via document layout vector matching.'
  },
  {
    id: 'file-6',
    name: 'Memora_AI_Final_Project_Presentation.pdf',
    path: 'C:\\Users\\Alex\\College\\FinalYear\\Memora_AI_Final_Project_Presentation.pdf',
    folderPath: 'C:\\Users\\Alex\\College\\FinalYear',
    category: 'pdf',
    fileExtension: 'pdf',
    sizeBytes: 8400000,
    modifiedAt: '2026-08-05T16:00:00Z',
    createdAt: '2026-08-01T12:00:00Z',
    extractedSnippet: 'Memora AI: Intelligent Local Digital Memory Assistant. Slide 1: Introduction. Slide 2: FAISS Vector Architecture & Privacy First Model.',
    ocrText: '',
    aiSummary: 'Slide deck presentation detailing the architecture, UI design system, and vector retrieval pipeline of Memora AI.',
    tags: ['Project', 'Presentation', 'Memora AI', 'College', 'Slides'],
    relevanceScore: 97,
    similarityRank: 0.97,
    explanation: 'Recent modification date combined with direct match for project slide presentation keywords.'
  }
];

export const MOCK_SEARCH_SUGGESTIONS = [
  'Show my latest internship resume',
  'Find my machine learning notes',
  'Find my Amazon invoices',
  'Show my college farewell photos',
  'Find my certificates',
  'Show my project presentation'
];

export const MOCK_RECENT_SEARCHES = [
  'latest resume 2025',
  'machine learning unit 3',
  'aws receipt pdf',
  'google cloud certificate'
];
