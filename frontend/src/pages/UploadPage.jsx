import React from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';

const UploadPage = ({ user, uploadedFiles, isUploading, onFileUpload }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-8 border-2 border-dashed border-gray-300">
        <div className="text-center">
          <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload IPCR Documents</h3>
          <p className="text-gray-600 mb-6">
            Upload PDF files. They will be automatically categorized using AI
            {user.tokens && ' and uploaded to your Google Drive.'}
          </p>
          <label className="inline-block">
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={onFileUpload}
              className="hidden"
              disabled={isUploading}
            />
            <span className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition cursor-pointer inline-block">
              {isUploading ? '⏳ Processing...' : '📁 Select PDF Files'}
            </span>
          </label>
        </div>
      </div>

      {isUploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-blue-800">Processing documents with AI classification...</p>
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Uploaded Documents ({uploadedFiles.length})</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {uploadedFiles.map(file => (
              <div key={file.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{file.name}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          file.category === 'Syllabus' ? 'bg-purple-100 text-purple-700' :
                          file.category === 'Course Guide' ? 'bg-blue-100 text-blue-700' :
                          file.category === 'SLM' ? 'bg-green-100 text-green-700' :
                          file.category === 'Grading Sheet' ? 'bg-orange-100 text-orange-700' :
                          'bg-pink-100 text-pink-700'
                        }`}>
                          {file.category}
                        </span>
                        {file.confidence && (
                          <span className="text-xs text-gray-500">
                            {file.confidence.toFixed(1)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
    </div>
  );
};

export default UploadPage;
