import React, { useState, useEffect } from 'react';
import DefaultTarget from '../../shared/defaultTarget.json';
import { API_URL } from './constants';

// Layout
import Header from './components/Header';
import NavBar from './components/NavBar';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import AdminPanel from './pages/AdminPanel';

const App = () => {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [ipcrData, setIpcrData] = useState({
    syllabus:     { target: DefaultTarget.syllabus,     accomplished: 0, submitted: null },
    courseGuide:  { target: DefaultTarget.courseGuide,  accomplished: 0, submitted: null },
    slm:          { target: DefaultTarget.slm,          accomplished: 0, submitted: null },
    gradingSheet: { target: DefaultTarget.gradingSheet, accomplished: 0, submitted: null },
    tos:          { target: DefaultTarget.tos,          accomplished: 0, submitted: null },
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [adminData, setAdminData] = useState([]);

  // --- EFFECTS ---
  useEffect(() => {
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
        sessionStorage.setItem('user', JSON.stringify(userData));
        localStorage.removeItem('user');
        window.history.replaceState({}, document.title, '/');
        fetchIPCRData(userData.id);
        fetchDocuments(userData.id);
        if (userData.role === 'admin') fetchAdminData();
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    } else {
      let savedUser = sessionStorage.getItem('user');
      if (!savedUser) {
        const legacyUser = localStorage.getItem('user');
        if (legacyUser) {
          sessionStorage.setItem('user', legacyUser);
          localStorage.removeItem('user');
          savedUser = legacyUser;
        }
      }
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        fetchIPCRData(userData.id);
        fetchDocuments(userData.id);
        if (userData.role === 'admin') fetchAdminData();
      }
    }
  }, []);

  // --- API ---
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
      const response = await fetch(`${API_URL}/admin/ipcr`);
      const data = await response.json();
      setAdminData(data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setAdminData([]);
    }
  };

  // --- HANDLERS ---
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('userId', user.id);
    if (user.tokens) formData.append('tokens', JSON.stringify(user.tokens));

    try {
      const response = await fetch(`${API_URL}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        const driveUploaded = data.results.filter(r => r.driveUploaded).length;
        alert(
          `✅ Successfully uploaded ${data.results.length} file(s)\n` +
          `${driveUploaded > 0 ? `📁 ${driveUploaded} uploaded to Google Drive` : '⚠️ Google Drive upload unavailable'}`
        );
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
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentPage('dashboard');
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch(`${API_URL}/ipcr/export/${user.id}`);
      if (!response.ok) throw new Error('Export failed');
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

  // --- RENDER ---
  if (!user) {
    return <LoginPage onLogin={handleGoogleLogin} />;
  }

  const pageMap = {
    dashboard: (
      <DashboardPage
        user={user}
        ipcrData={ipcrData}
        onExport={exportToExcel}
      />
    ),
    upload: (
      <UploadPage
        user={user}
        uploadedFiles={uploadedFiles}
        isUploading={isUploading}
        onFileUpload={handleFileUpload}
      />
    ),
    profile: <ProfilePage user={user} />,
    admin: user.role === 'admin' ? <AdminPanel adminData={adminData} /> : null,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <NavBar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          isAdmin={user.role === 'admin'}
        />
        {pageMap[currentPage]}
      </div>
    </div>
  );
};

export default App;