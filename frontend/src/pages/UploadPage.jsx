import React from 'react';
import { Upload, FileText, CheckCircle, BookOpen, Calendar } from 'lucide-react';
import { ACADEMIC_YEARS, SEMESTERS } from '../constants';

/**
 * UploadPage
 *
 * Props:
 *   user            – logged-in user object
 *   uploadedFiles   – array of document objects for the selected period
 *   isUploading     – boolean
 *   onFileUpload    – callback(event, year, semester)
 *   selectedYear    – currently selected academic year
 *   selectedSemester– currently selected semester
 *   onYearChange    – callback(year)
 *   onSemesterChange– callback(semester)
 */
const UploadPage = ({
  user,
  uploadedFiles,
  isUploading,
  onFileUpload,
  selectedYear,
  selectedSemester,
  onYearChange,
  onSemesterChange,
}) => {
  const handleFileChange = (e) => {
    onFileUpload(e, selectedYear, selectedSemester);
  };

  const categoryColors = {
    'Syllabus':       'bg-purple-100 text-purple-700',
    'Course Guide':   'bg-blue-100   text-blue-700',
    'SLM':            'bg-green-100  text-green-700',
    'Grading Sheet':  'bg-orange-100 text-orange-700',
    'TOS':            'bg-pink-100   text-pink-700',
  };

  return (
    <div className="space-y-6">

      {/* ── Year / Semester selector ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-gray-700 font-medium shrink-0">
            <Calendar className="w-4 h-4 text-blue-500" />
            Academic Period:
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={selectedYear}
                onChange={e => onYearChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {ACADEMIC_YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <select
              value={selectedSemester}
              onChange={e => onSemesterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {SEMESTERS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <span className="hidden sm:block text-xs text-gray-400 ml-auto">
            Documents displayed and uploaded will be saved to the selected period.
          </span>
        </div>
      </div>

      {/* ── Upload dropzone ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-8 border-2 border-dashed border-gray-300 hover:border-blue-400 transition">
        <div className="text-center">
          <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Upload IPCR Documents</h3>
          <p className="text-sm text-gray-500 mb-1">
            AY <span className="font-medium text-blue-600">{selectedYear}</span> · <span className="font-medium text-blue-600">{selectedSemester}</span>
          </p>
          <p className="text-gray-500 text-sm mb-6">
            PDF files will be automatically categorized using AI
            {user.tokens && ' and uploaded to your Google Drive.'}
          </p>
          <label className="inline-block">
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            <span className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition cursor-pointer inline-block font-medium">
              {isUploading ? '⏳ Processing…' : '📁 Select PDF Files'}
            </span>
          </label>
        </div>
      </div>

      {/* ── Processing indicator ──────────────────────────────────────────── */}
      {isUploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-blue-800">Processing documents with AI classification…</p>
          </div>
        </div>
      )}

      {/* ── File list ─────────────────────────────────────────────────────── */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              Uploaded Documents ({uploadedFiles.length})
            </h3>
            <span className="text-xs text-gray-400">
              {selectedYear} · {selectedSemester}
            </span>
          </div>
          <div className="divide-y divide-gray-200">
            {uploadedFiles.map(file => (
              <div key={file.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{file.name}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[file.category] || 'bg-gray-100 text-gray-700'}`}>
                          {file.category}
                        </span>
                        {file.confidence && (
                          <span className="text-xs text-gray-500">
                            {(file.confidence * 100 > 1 ? file.confidence : file.confidence * 100).toFixed(1)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    {file.driveLink && (
                      <a
                        href={file.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View in Drive
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedFiles.length === 0 && !isUploading && (
        <div className="text-center text-gray-400 py-8 text-sm">
          No documents uploaded for <span className="font-medium">{selectedYear} · {selectedSemester}</span> yet.
        </div>
      )}
    </div>
  );
};

export default UploadPage;
