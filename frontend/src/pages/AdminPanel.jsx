import React, { useState, useEffect } from 'react';
import { Search, Save, Calendar, CheckCircle, ChevronDown, ChevronUp, ExternalLink, FileText, FolderOpen, Loader2, Download } from 'lucide-react';
import { API_URL } from '../constants';

const AdminPanel = ({ currentUser, adminData, selectedYear, selectedSemester, onConfigSaved, availableYears = [], availableSemesters = [] }) => {
  const [configSemester, setConfigSemester] = useState(selectedSemester || availableSemesters[0] || '');
  const [configStartDate, setConfigStartDate] = useState('');
  const [configEndDate, setConfigEndDate] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [facultyDetail, setFacultyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // --- 🟢 WEIGHTED RATING LOGIC (MATCHES DASHBOARD) ---
  
  const calculateRating = (target, accomplished) => {
    if (!target || target === 0) return 0;
    const ratio = accomplished / target;
    if (ratio >= 1.0) return 5;
    if (ratio >= 0.8) return 4;
    if (ratio >= 0.6) return 3;
    if (ratio >= 0.4) return 2;
    return 1;
  };

  const safeAverage = (arr) => {
    const valid = arr.filter((v) => typeof v === "number" && !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  };

  const getRating = (cat) => {
    return cat?.rating != null && cat.rating > 0
      ? Number(cat.rating)
      : calculateRating(cat?.target || 0, cat?.accomplished || 0);
  };

  const computeOverallRating = (ipcrData) => {
    if (!ipcrData) return "0.00";
    try {
      const INS_KEYS = ["syllabus", "courseGuide", "slm", "attendanceSheet", "classRecord", "evaluationOfTeachingEffectiveness", "classroomObservation", "tos", "testQuestions", "answerKeys", "gradingSheet", "facultyAndStudentsSeekAdvices", "accomplishmentReport"];
      const RES_KEYS = ["randdProposal", "researchImplemented", "researchPresented", "researchPublished", "intellectualPropertyRights", "researchUtilizedDeveloped", "numberOfCitations"];
      const EXT_KEYS = ["extentionProposal", "personsTrained", "personServiceRating", "personGivenTraining", "technicalAdvice"];
      const SUPT_KEYS = ["accomplishmentReportSupport", "attendanceFlagCeremony", "attendanceFlagLowering", "attendanceHealthAndWellnessProgram", "attendanceSchoolCelebrations", "trainingSeminarConferenceCertificate", "atttendanceFacultyMeeting", "attendanceISOAndRelatedActivities", "attendaceSpiritualActivities"];

      const INS = safeAverage(INS_KEYS.map((k) => getRating(ipcrData[k])));
      const RES = safeAverage(RES_KEYS.map((k) => getRating(ipcrData[k])));
      const EXT = safeAverage(EXT_KEYS.map((k) => getRating(ipcrData[k])));
      const SUPT = safeAverage(SUPT_KEYS.map((k) => getRating(ipcrData[k])));

      // Applying the 72/4/4/20 weight
      const final = (INS * 0.72) + (RES * 0.04) + (EXT * 0.04) + (SUPT * 0.20);
      return final.toFixed(2);
    } catch (e) {
      return "0.00";
    }
  };

  // --- 🟢 END OF RATING LOGIC ---

  useEffect(() => {
    fetch(`${API_URL}/semester-config`)
      .then(r => r.json())
      .then(data => {
        if (data.semester) setConfigSemester(data.semester);
        if (data.start_date) setConfigStartDate(data.start_date);
        if (data.end_date) setConfigEndDate(data.end_date);
      })
      .catch(() => {});
  }, []);

  const handleSaveConfig = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_URL}/semester-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semester: configSemester,
          start_date: configStartDate,
          end_date: configEndDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('ok');
        if (onConfigSaved) onConfigSaved(data.academic_year, configSemester);
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch {
      setSaveStatus('error');
    }
  };

  const toggleFacultyDetail = async (userId) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setFacultyDetail(null);
      return;
    }
    setExpandedUserId(userId);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ year: selectedYear, semester: selectedSemester });
      const res = await fetch(`${API_URL}/admin/faculty/${userId}?${params}`);
      const data = await res.json();
      setFacultyDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportAccomplishments = async () => {
    try {
      const params = new URLSearchParams({ 
        year: selectedYear, 
        semester: selectedSemester,
        requesterId: currentUser?.id 
      });
      window.location.href = `${API_URL}/accomplishments/export-all?${params}`;
    } catch (error) {
      alert('Export failed');
    }
  };

  const filteredData = adminData.filter(faculty =>
    (faculty.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (faculty.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const folderLabels = {
    syllabus: 'Syllabus',
    courseGuide: 'Course Guide',
    slm: 'SLM',
    gradingSheet: 'Grading Sheet',
    tos: 'TOS',
  };

  return (
    <div className="space-y-16 py-6 max-w-6xl mx-auto">
      {/* 1. CONFIGURATION SECTION */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-gray-100 mb-8">
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">Admin System</h1>
            <p className="text-sm text-gray-500 mt-2">Manage academic periods and view faculty data.</p>
          </div>
          <button onClick={handleExportAccomplishments} className="group flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl shadow-sm transition-all">
            <Download className="w-4 h-4" />
            Export All Accomplishments
          </button>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-gray-200/60 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 tracking-wide uppercase mb-6 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" /> System Configuration
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Semester</label>
              <select value={configSemester} onChange={e => setConfigSemester(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm transition-all">
                {availableSemesters.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Start Date</label>
              <input type="date" value={configStartDate} onChange={e => setConfigStartDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">End Date</label>
              <input type="date" value={configEndDate} onChange={e => setConfigEndDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-4">
            <button onClick={handleSaveConfig} disabled={saveStatus === 'saving'} className="px-6 py-3 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saveStatus === 'saving' ? 'Saving...' : 'Apply Limits'}
            </button>
            {saveStatus === 'ok' && <span className="text-sm font-medium text-green-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Success</span>}
          </div>
        </div>
      </section>

      {/* 2. FACULTY LIST SECTION */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mb-6">
          <h2 className="text-xl font-medium text-gray-900">Faculty Records</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search faculty..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm" />
          </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="py-4 px-4 text-xs font-semibold text-gray-900 uppercase tracking-widest">Faculty Member</th>
                <th className="py-4 px-2 text-xs font-semibold text-gray-900 uppercase tracking-widest hidden md:table-cell">Department</th>
                <th className="py-4 px-2 text-xs font-semibold text-gray-900 uppercase tracking-widest text-right">Docs</th>
                <th className="py-4 px-4 text-xs font-semibold text-gray-900 uppercase tracking-widest text-right">Overall Rating</th>
                <th className="py-4 px-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((faculty, index) => {
                
                // ✅ REPLACED: Use computeOverallRating instead of avg_rating
                const overallRating = computeOverallRating(faculty.ipcrData);

                return (
                  <React.Fragment key={faculty.id || index}>
                    <tr className="hover:bg-gray-50 cursor-pointer group transition-colors" onClick={() => toggleFacultyDetail(faculty.id)}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                            {faculty.name ? faculty.name.split(' ').map(n => n[0]).join('') : 'U'}
                          </div>
                          <span className="font-medium text-gray-900">{faculty.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-sm text-gray-500 hidden md:table-cell">{faculty.department || '—'}</td>
                      <td className="py-4 px-2 text-sm text-gray-500 text-right">{faculty.document_count || 0}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`text-sm font-bold px-2 py-1 rounded-md ${
                          Number(overallRating) >= 4 ? "text-green-600 bg-green-50" :
                          Number(overallRating) >= 3 ? "text-amber-600 bg-amber-50" :
                          "text-red-600 bg-red-50"
                        }`}>
                          {overallRating}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-center text-gray-300 group-hover:text-gray-900">
                        {expandedUserId === faculty.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    
                    {/* 3. EXPANDABLE DETAILS */}
                    {expandedUserId === faculty.id && (
                      <tr className="bg-gray-50/80">
                        <td colSpan="5" className="px-6 py-10 border-b border-gray-200">
                          {detailLoading ? (
                            <div className="flex items-center justify-center text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...</div>
                          ) : facultyDetail ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
                               <div>
                                <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5" /> Drive Repositories</h4>
                                <div className="space-y-2">
                                  {Object.entries(folderLabels).map(([key, label]) => {
                                    const link = facultyDetail.folderLinks?.[key];
                                    return link ? (
                                      <a key={key} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md hover:border-gray-400 transition-colors group">
                                        <span className="text-sm font-medium text-gray-700">{label}</span>
                                        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-600" />
                                      </a>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Recent Uploads</h4>
                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                  <table className="w-full text-left text-sm">
                                    <tbody className="divide-y divide-gray-100">
                                      {(facultyDetail.documents || []).slice(0, 5).map(doc => (
                                        <tr key={doc.id}>
                                          <td className="px-3 py-2 text-gray-800 truncate max-w-[200px]">{doc.name}</td>
                                          <td className="px-3 py-2 text-xs text-gray-500">{doc.category}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          ) : <p className="text-center text-sm text-gray-400">No detailed records found for this period.</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminPanel;