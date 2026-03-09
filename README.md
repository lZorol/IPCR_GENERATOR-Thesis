# IPCR Generator - Intelligent Document Management System

**A full-stack application for automating Individual Performance Commitment and Review (IPCR) document processing using machine learning-powered PDF classification and OCR.**

![Status](https://img.shields.io/badge/status-active-success) ![License](https://img.shields.io/badge/license-MIT-blue) ![Type](https://img.shields.io/badge/type-Thesis%20Project-informational)

---

## 📋 Project Overview

IPCR Generator is an intelligent document management system developed for Laguna State Polytechnic University (LSPU) as a thesis project. The system automates the processing and classification of IPCR documents using advanced machine learning techniques combined with modern web technologies.

### Key Capabilities
- **AI-Powered Classification**: Intelligent PDF document classification using deep learning models
- **Optical Character Recognition (OCR)**: Advanced PDF text extraction with transformer-based models
- **Cloud Storage Integration**: Seamless Google Drive integration for document storage and retrieval
- **Export Functionality**: Generate Excel reports from processed documents
- **User Authentication**: Secure authentication system with role-based access control
- **Real-time Processing**: Efficient async document processing pipeline

---

## 🏗️ Architecture

The system follows a modern three-tier architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│              Tailwind CSS + Vite + Lucide Icons         │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                  Backend (Express.js)                    │
│        Authentication, API Routes, Database Layer       │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
    ┌────▼──────┐          ┌─────────▼─────┐
    │  SQLite   │          │  Python ML    │
    │  Database │          │  Service      │
    └───────────┘          └───────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
            ┌───────▼────────┐        ┌─────────▼──────┐
            │  PDF OCR Model │        │ Classification │
            │  (Transformers)│        │   Deep Learning│
            └────────────────┘        └────────────────┘
```

---

## 🚀 Tech Stack

### Frontend
- **React 18** - Component-based UI library
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library

### Backend
- **Node.js + Express.js** - RESTful API server
- **SQLite3** - Lightweight database
- **Multer** - File upload handling
- **Google APIs** - Drive integration for document storage
- **ExcelJS** - Excel file generation

### Machine Learning
- **PyTorch** - Deep learning framework
- **Transformers** - Pre-trained models for NLP and vision tasks
- **PDF2Image** - PDF to image conversion
- **Tesseract (pytesseract)** - OCR engine
- **OpenCV** - Computer vision processing
- **Flask** - Lightweight Python web framework

---

## 📦 Project Structure

```
IPCR_Generator-Thesis/
├── frontend/                 # React SPAsingle-page application
│   ├── src/
│   │   ├── App.jsx          # Main application component
│   │   ├── main.jsx         # Entry point
│   │   └── assets/          # Static assets
│   ├── public/              # Public static files
│   ├── vite.config.js       # Vite configuration
│   ├── tailwind.config.js   # Tailwind configuration
│   └── package.json
│
├── backend/                  # Express.js REST API
│   ├── server.js            # Main server entry point
│   ├── database.js          # Database initialization
│   ├── routes/
│   │   └── auth.js          # Authentication endpoints
│   ├── utils/
│   │   ├── excelExport.js   # Excel generation utility
│   │   └── googleDrive.js   # Google Drive integration
│   ├── uploads/             # Temporary file storage
│   └── package.json
│
├── ml-service/              # Python Flask ML Service
│   ├── app.py               # Flask application
│   ├── classifier.py        # Document classification logic
│   ├── hybrid_pdf_ocr_model.pt  # Pre-trained ML model
│   ├── requirements.txt      # Python dependencies
│   └── __pycache__/         # Python cache
│
├── start.bat                # Windows batch startup script
├── LICENSE                  # MIT License
└── README.md               # This file
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v16 or higher) with npm
- **Python** (v3.8 or higher) with pip
- **Tesseract OCR** (for PDF text extraction)
- **Google API Credentials** (for Drive integration)

### Installation

#### 1. Clone Repository
```bash
git clone https://github.com/your-username/IPCR_Generator-Thesis.git
cd IPCR_Generator-Thesis
```

#### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file with required variables
# Example .env:
# GOOGLE_CLIENT_ID=your_client_id
# GOOGLE_CLIENT_SECRET=your_client_secret
# GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
# DATABASE_PATH=./ipcr.db
# ML_SERVICE_URL=http://localhost:5000

npm start              # Production
# OR
npm run dev           # Development with nodemon
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev           # Start Vite dev server (typically http://localhost:5173)
```

#### 4. ML Service Setup
```bash
cd ml-service
# Make a virtual environment
python -m venv .venv
# Activate Virtual Environment
.venv\Scripts\activate
pip install -r requirements.txt


python app.py        # ML service runs on http://localhost:5000
```

#### 5. Start All Services
```bash
# From project root, run the batch file (Windows)
start.bat

# OR manually in separate terminals:
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: ML Service
cd ml-service && python app.py
```

---

## 🔑 Key Features

### 1. **Intelligent Document Processing**
- Automatically classify IPCR documents
- Extract and validate document content
- Support for multiple document formats

### 2. **Machine Learning Pipeline**
- **Hybrid PDF OCR Model**: Combines vision transformers with traditional OCR
- **Custom Classification**: Deep learning model for document categorization
- **High Accuracy**: Trained on university-specific document patterns

### 3. **User Management**
- Secure authentication and authorization
- Role-based access control
- Session management

### 4. **Data Export & Reporting**
- Generate Excel reports with processed data
- Batch export functionality
- Customizable export templates

### 5. **Cloud Integration**
- Direct Google Drive sync
- Automated backup and archival
- Secure file handling

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify token

### IPCR Management
- `GET /api/ipcr/:userId` - Retrieve user IPCR data
- `POST /api/ipcr/upload` - Upload and process IPCR document
- `GET /api/ipcr/export` - Export to Excel

### ML Classification
- `POST /classify` - Classify PDF document
- `GET /health` - ML service health check

---

## 🤖 Machine Learning Model

The system utilizes a **hybrid PDF OCR model** that combines:
- **Vision Transformers** for document layout understanding
- **Transformer-based Text Recognition** for accurate character extraction
- **Custom Classification Head** for document type prediction

**Model Path**: `ml-service/hybrid_pdf_ocr_model.pt`

### Performance Metrics
- Classification Accuracy: [To be updated with actual metrics]
- OCR Character Recognition: [To be updated with actual metrics]
- Average Processing Time: [To be updated with actual metrics]

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Database
DATABASE_PATH=./ipcr.db

# ML Service
ML_SERVICE_URL=http://localhost:5000

# Server
PORT=3000
NODE_ENV=development
```

Create a `.env` file in the `ml-service/` directory:

```env
FLASK_ENV=development
FLASK_DEBUG=True
PYTESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
```

---

## 👥 Usage Examples

### Processing an IPCR Document
```javascript
// Frontend: Upload and process document
const formData = new FormData();
formData.append('file', pdfFile);

const response = await fetch('/api/ipcr/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Classification:', result.classification);
```

### Exporting Data to Excel
```javascript
// Request Excel export
const response = await fetch('/api/ipcr/export?userId=12345');
const blob = await response.blob();

// Download file
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'ipcr_report.xlsx';
link.click();
```

---

## 📊 Performance Considerstions

- **Async Processing**: Large PDF files are processed asynchronously to prevent server blocking
- **Caching**: ML model loaded once in memory for multiple inference requests
- **Batch Operations**: Support for processing multiple documents in batches
- **Optimized OCR**: Configurable resolution and processing parameters

---

## 🐛 Troubleshooting

### ML Model Not Loading
Ensure `hybrid_pdf_ocr_model.pt` is in the `ml-service/` directory:
```bash
ls ml-service/hybrid_pdf_ocr_model.pt
```

### Tesseract Not Found
**Windows**: Download from [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki)

**Linux**: 
```bash
sudo apt-get install tesseract-ocr
```

### CORS Errors
Verify that `cors()` is enabled in `backend/server.js` and frontend requests use correct API URLs.

### Google Drive Connection Issues
- Verify credentials in `.env` file
- Check OAuth consent screen configuration in Google Cloud Console
- Ensure redirect URI matches exactly

---

## 🚀 Future Enhancements

- [ ] Multi-language OCR support
- [ ] Real-time document preview
- [ ] Advanced analytics dashboard
- [ ] Mobile app companion
- [ ] Batch processing API
- [ ] Custom model training interface
- [ ] Document versioning and archive system
- [ ] Automated report generation

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

---

## 👨‍💼 Author

Developed as a Thesis Project at Laguna State Polytechnic University (LSPU)
- Arat, Carlo James G.
- Driz, Eldi Nill L.
---

## 💬 Support & Questions

For questions or support, please open an issue on GitHub.

---

## 📞 Contact

- GitHub: [lZorol](https://github.com/lZorol)
- Email: strawhat424@gmail.com

---

**Last Updated**: March 2026