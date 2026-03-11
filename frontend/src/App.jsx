import React, { useState, useEffect } from 'react';
import { Upload, FileText, BarChart3, User, LogOut, Home, Shield, CheckCircle, Clock, Search, Download } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

const App = () => {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  
  // FIXED: Restored the missing uploading state
  const [isUploading, setIsUploading] = useState(false);
  
  const [ipcrData, setIpcrData] = useState({
    syllabus: { target: 4, accomplished: 0, submitted: null },
    courseGuide: { target: 4, accomplished: 0, submitted: null },
    slm: { target: 10, accomplished: 0, submitted: null },
    gradingSheet: { target: 0, accomplished: 0, submitted: null },
    tos: { target: 0, accomplished: 0, submitted: null }
  });
  
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [adminData, setAdminData] = useState([]); // State for Admin Panel

  // --- EFFECTS ---
  useEffect(() => {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    const error = params.get('error');

    if (error) {
      alert('Login failed: ' + error);
      window.history.replaceState({}, document.title, '/');
      return;
    }

    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        window.history.replaceState({}, document.title, '/');
        
        // Initial Data Fetch
        fetchIPCRData(userData.id);
        fetchDocuments(userData.id);
        
        // If Admin, fetch admin data
        if (userData.role === 'admin') {
          fetchAdminData();
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    } else {
      // Check localStorage for existing user
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        fetchIPCRData(userData.id);
        fetchDocuments(userData.id);
        
        // If Admin, fetch admin data
        if (userData.role === 'admin') {
          fetchAdminData();
        }
      }
    }
  }, []);

  // --- API FUNCTIONS ---
  const handleGoogleLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/google`);
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to initiate login');
    }
  };

  const fetchIPCRData = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/ipcr/${userId}`);
      const data = await response.json();
      setIpcrData(data);
    } catch (error) {
      console.error('Error fetching IPCR data:', error);
    }
  };

  const fetchDocuments = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/documents/${userId}`);
      const data = await response.json();
      setUploadedFiles(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchAdminData = async () => {
    try {
      // Assuming endpoint exists to get all faculty data
      const response = await fetch(`${API_URL}/admin/ipcr`); 
      const data = await response.json();
      setAdminData(data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      // Fallback/Mock data for demonstration if API fails
      setAdminData([]); 
    }
  };

  // --- HELPER FUNCTIONS ---
  const calculateRating = (target, accomplished) => {
    if (target === 0) return 0;
    const ratio = accomplished / target;
    if (ratio >= 1.0) return 5;
    if (ratio >= 0.8) return 4;
    if (ratio >= 0.6) return 3;
    if (ratio >= 0.4) return 2;
    return 1;
  };

  const calculateOverallRating = () => {
    const categories = Object.values(ipcrData);
    const validCategories = categories.filter(cat => cat.target > 0);
    if (validCategories.length === 0) return 0;
    
    const totalRating = validCategories.reduce((sum, cat) => {
      const r = cat.rating != null && cat.rating > 0 ? Number(cat.rating) : calculateRating(cat.target, cat.accomplished);
      return sum + r;
    }, 0);
    
    return (totalRating / validCategories.length).toFixed(2);
  };

  // --- HANDLERS ---
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    setIsUploading(true); // This caused the error before because state was missing

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('userId', user.id);
    
    if (user.tokens) {
      formData.append('tokens', JSON.stringify(user.tokens));
    }

    try {
      const response = await fetch(`${API_URL}/documents/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        const driveUploaded = data.results.filter(r => r.driveUploaded).length;
        alert(`✅ Successfully uploaded ${data.results.length} file(s)\n${driveUploaded > 0 ? `📁 ${driveUploaded} uploaded to Google Drive` : '⚠️ Google Drive upload unavailable'}`);
        fetchIPCRData(user.id);
        fetchDocuments(user.id);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Upload failed: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setCurrentPage('login');
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch(`${API_URL}/ipcr/export/${user.id}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IPCR_${user.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('✅ IPCR exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Export failed: ' + error.message);
    }
  };

  // --- RENDER: LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">IPCR System</h1>
            <p className="text-gray-600">Laguna State Polytechnic University</p>
          </div>
          
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-3 font-medium"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Use your LSPU Google account to login
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN APP ---
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">IPCR Management System</h1>
                <p className="text-sm text-gray-500">Laguna State Polytechnic University</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role === 'admin' ? 'Administrator' : 'Faculty'}</p>
              </div>
              {user.profileImage ? (
                <img src={user.profileImage} alt={user.name} className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation */}
        <nav className="bg-white rounded-lg shadow-sm mb-6 p-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentPage === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setCurrentPage('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentPage === 'upload' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Documents
          </button>
          <button
            onClick={() => setCurrentPage('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
              currentPage === 'profile' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => setCurrentPage('admin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
                currentPage === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </button>
          )}
        </nav>

        {/* Dashboard Page */}
        {currentPage === 'dashboard' && (
          <div className="space-y-6">
            {/* Google Drive Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                {user.tokens ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Google Drive Connected</p>
                      <p className="text-xs text-gray-600">Documents will be automatically uploaded to your Drive</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-yellow-500"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Google Drive Not Connected</p>
                      <p className="text-xs text-gray-600">Documents will only be stored locally</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Overall Rating Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-lg p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-2">Overall IPCR Rating</p>
                  <h2 className="text-5xl font-bold">{calculateOverallRating()}</h2>
                  <p className="text-blue-100 text-sm mt-2">out of 5.00</p>
                </div>
                <BarChart3 className="w-20 h-20 text-blue-300 opacity-50" />
              </div>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(ipcrData).map(([key, data]) => {
                const rating = data.rating != null && data.rating > 0 ? Number(data.rating) : calculateRating(data.target, data.accomplished);
                const categoryNames = {
                  syllabus: 'Syllabus',
                  courseGuide: 'Course Guide',
                  slm: 'Student Learning Materials',
                  gradingSheet: 'Grading Sheet',
                  tos: 'Table of Specifications'
                };
                
                return (
                  <div key={key} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">{categoryNames[key]}</h3>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        rating >= 4 ? 'bg-green-100 text-green-700' :
                        rating >= 3 ? 'bg-yellow-100 text-yellow-700' :
                        rating >= 1 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {rating.toFixed(1)}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Target:</span>
                        <span className="font-semibold text-gray-800">{data.target}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Accomplished:</span>
                        <span className="font-semibold text-blue-600">{data.accomplished}</span>
                      </div>
                      
                      <div className="pt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              rating >= 4 ? 'bg-green-500' :
                              rating >= 3 ? 'bg-yellow-500' :
                              rating >= 1 ? 'bg-orange-500' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min((data.accomplished / (data.target || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      {data.submitted && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2">
                          <Clock className="w-3 h-3" />
                          Last updated: {data.submitted}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Export Button */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Export IPCR Document</h3>
                  <p className="text-sm text-gray-600">Download your complete IPCR in Excel format</p>
                </div>
                <button
                  onClick={exportToExcel}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Page */}
        {currentPage === 'upload' && (
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
                    onChange={handleFileUpload}
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
        )}

        {/* Profile Page */}
        {currentPage === 'profile' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile Information</h2>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} className="w-24 h-24 rounded-full" />
                  ) : (
                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">{user.name}</h3>
                    <p className="text-gray-600">{user.department}</p>
                  </div>
                </div>
                
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-gray-800">{user.email}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700">Role</label>
                    <p className="mt-1 text-gray-800 capitalize">{user.role}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700">Department</label>
                    <p className="mt-1 text-gray-800">{user.department}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Panel */}
        {currentPage === 'admin' && user.role === 'admin' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Faculty Overview</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search faculty..." 
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Faculty Name</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Department</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">IPCR Status</th>
                                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {adminData.length > 0 ? (
                                adminData.map((faculty, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-bold">
                                                    {faculty.name ? faculty.name.split(' ').map(n => n[0]).join('') : 'U'}
                                                </div>
                                                <span className="font-medium text-gray-800">{faculty.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{faculty.department || 'N/A'}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                        No faculty data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;