import React, { useState, useEffect, useCallback } from 'react';
import DefaultTarget from '../../shared/defaultTarget.json';
import { API_URL, ACADEMIC_YEARS, SEMESTERS } from './constants';

// Layout
import Header from './components/Header';
import NavBar from './components/NavBar';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import AdminPanel from './pages/AdminPanel';

const EMPTY_IPCR = {
  syllabus:     { target: DefaultTarget.syllabus,     accomplished: 0, submitted: null },
  courseGuide:  { target: DefaultTarget.courseGuide,  accomplished: 0, submitted: null },
  slm:          { target: DefaultTarget.slm,          accomplished: 0, submitted: null },
  gradingSheet: { target: DefaultTarget.gradingSheet, accomplished: 0, submitted: null },
  tos:          { target: DefaultTarget.tos,          accomplished: 0, submitted: null },
};

const App = () => {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);

  // ── Navigation ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState('dashboard');

  // ── Academic Period ───────────────────────────────────────────────────────
  const [selectedYear,     setSelectedYear]     = useState(ACADEMIC_YEARS[2]); // 2025-2026
  const [selectedSemester, setSelectedSemester] = useState(SEMESTERS[0]);      // 1st Semester

  // ── Data ─────────────────────────────────────────────────────────────────
  const [ipcrData,       setIpcrData]       = useState(EMPTY_IPCR);
  const [uploadedFiles,  setUploadedFiles]  = useState([]);
  const [adminData,      setAdminData]      = useState([]);
  const [isUploading,    setIsUploading]    = useState(false);

  // ── API helpers ──────────────────────────────────────────────────────────

  const fetchSemesterConfig = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/semester-config`);
      const data = await res.json();
      if (data.academic_year) setSelectedYear(data.academic_year);
      if (data.semester)      setSelectedSemester(data.semester);
    } catch {
      // keep defaults
    }
  }, []);

  const fetchIPCRData = useCallback(async (userId, year, semester) => {
    try {
      const params = new URLSearchParams({ year, semester });
      const res  = await fetch(`${API_URL}/ipcr/${userId}?${params}`);
      const data = await res.json();
      setIpcrData(data);
    } catch (error) {
      console.error('Error fetching IPCR data:', error);
    }
  }, []);

  const fetchDocuments = useCallback(async (userId, year, semester) => {
    try {
      const params = new URLSearchParams({ year, semester });
      const res  = await fetch(`${API_URL}/documents/${userId}?${params}`);
      const data = await res.json();
      setUploadedFiles(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  }, []);

  const fetchAdminData = useCallback(async (year, semester) => {
    try {
      const params = new URLSearchParams({ year, semester });
      const res  = await fetch(`${API_URL}/admin/ipcr?${params}`);
      const data = await res.json();
      setAdminData(data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setAdminData([]);
    }
  }, []);

  // ── Boot: restore session + load semester config ─────────────────────────
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    const error     = params.get('error');

    if (error) {
      alert('Login failed: ' + error);
      window.history.replaceState({}, document.title, '/');
      return;
    }

    const initUser = async (userData) => {
      setUser(userData);
      // First resolve the active semester config so all fetches use the right defaults
      let year = selectedYear;
      let sem  = selectedSemester;
      try {
        const res  = await fetch(`${API_URL}/semester-config`);
        const data = await res.json();
        if (data.academic_year) { year = data.academic_year; setSelectedYear(year); }
        if (data.semester)      { sem  = data.semester;      setSelectedSemester(sem); }
      } catch { /* use defaults */ }

      fetchIPCRData(userData.id, year, sem);
      fetchDocuments(userData.id, year, sem);
      if (userData.role === 'admin') fetchAdminData(year, sem);
    };

    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        sessionStorage.setItem('user', JSON.stringify(userData));
        localStorage.removeItem('user');
        window.history.replaceState({}, document.title, '/');
        initUser(userData);
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
        initUser(JSON.parse(savedUser));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fetch data when year/semester change ───────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchIPCRData(user.id, selectedYear, selectedSemester);
    fetchDocuments(user.id, selectedYear, selectedSemester);
    if (user.role === 'admin') fetchAdminData(selectedYear, selectedSemester);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedSemester]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    try {
      const res  = await fetch(`${API_URL}/auth/google`);
      const data = await res.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to initiate login');
    }
  };

  const handleFileUpload = async (event, year, semester) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const uploadYear = year || selectedYear;
    const uploadSem  = semester || selectedSemester;

    setIsUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('userId', user.id);
    formData.append('year',     uploadYear);
    formData.append('semester', uploadSem);
    formData.append('facultyName', user.name || 'Faculty');
    if (user.tokens) formData.append('tokens', JSON.stringify(user.tokens));

    try {
      const res  = await fetch(`${API_URL}/documents/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        const driveUploaded = data.results.filter(r => r.driveUploaded).length;
        alert(
          `✅ Successfully uploaded ${data.results.length} file(s)\n` +
          `${driveUploaded > 0 ? `📁 ${driveUploaded} uploaded to Google Drive` : '⚠️ Google Drive upload unavailable'}`
        );
        fetchIPCRData(user.id, uploadYear, uploadSem);
        fetchDocuments(user.id, uploadYear, uploadSem);
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
      const res = await fetch(`${API_URL}/ipcr/export/${user.id}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
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

  /** Called by AdminPanel after a config save; syncs global state. */
  const handleConfigSaved = (year, semester) => {
    setSelectedYear(year);
    setSelectedSemester(semester);
    // Data will re-fetch via the useEffect watching selectedYear/selectedSemester
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!user) {
    return <LoginPage onLogin={handleGoogleLogin} />;
  }

  const pageMap = {
    dashboard: (
      <DashboardPage
        user={user}
        ipcrData={ipcrData}
        onExport={exportToExcel}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
      />
    ),
    upload: (
      <UploadPage
        user={user}
        uploadedFiles={uploadedFiles}
        isUploading={isUploading}
        onFileUpload={handleFileUpload}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        onYearChange={setSelectedYear}
        onSemesterChange={setSelectedSemester}
      />
    ),
    profile: <ProfilePage user={user} />,
    admin: user.role === 'admin' ? (
      <AdminPanel
        adminData={adminData}
        selectedYear={selectedYear}
        selectedSemester={selectedSemester}
        onConfigSaved={handleConfigSaved}
      />
    ) : null,
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