import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Clock, Plus, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import { API_URL, CATEGORY_NAMES } from '../constants';

const UploadPage = ({ user, uploadedFiles, isUploading, uploadProgress, processedFiles, totalFiles, onFileUpload, selectedYear, selectedSemester, onManualSubmitSuccess, onNavigate }) => {
  const [isManualInput, setIsManualInput] = useState(false);
  const [selectedUploadCategory, setSelectedUploadCategory] = useState('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [regularFaculty, setRegularFaculty] = useState([]);

  const initialFormData = {
    accomplishment_category: 'Seminars, Conferences, and Training',
    title: '',
    date: '',
    venue: '',
    scope: 'Local',
    hours: '',
    sponsoredBy: '',
    researchRelated: 'No',
    target_presentation: '', target_publication: '', target_utilized: '',
    acc_presentation: '', acc_publication: '', acc_utilized: '',
    stat_proposal: '', stat_completed: '', stat_presented: '',
    stat_ip_rights: '', stat_utilized: '', stat_citations: '',
    admin_scopus: '', admin_rg: '', admin_gs: '',
    beneficiaries_count: '', beneficiaries_type: '',
    location: '', budget_allocation: '', evaluation: '', references: '',
    is_multiple_days: false, end_date: '',
    ext_total_target: '',
    ext_row7_tq1: '0', ext_row7_aq1: '0', ext_row7_tq2: '0', ext_row7_aq2: '0',
    ext_row7_tq3: '0', ext_row7_aq3: '0', ext_row7_tq4: '0', ext_row7_aq4: '0',
    ext_row8_aq1: '0', ext_row8_aq2: '0', ext_row8_aq3: '0', ext_row8_aq4: '0',
    ext_row9_tq1: '0', ext_row9_aq1: '0', ext_row9_tq2: '0', ext_row9_aq2: '0',
    ext_row9_tq3: '0', ext_row9_aq3: '0', ext_row9_tq4: '0', ext_row9_aq4: '0'
  };

  const [formData, setFormData] = useState(initialFormData);
  const [manualFile, setManualFile] = useState(null);

  const [extensionists, setExtensionists] = useState([
    { id: Date.now(), role: 'Project Head', members: [{ name: '', isRegularFaculty: false, userId: null }] }
  ]);
  const [individualExtData, setIndividualExtData] = useState({}); // { userId: { q1, q2, q3, q4 } }
  const [userExtensions, setUserExtensions] = useState([]);

  const addRoleGroup = () => {
    setExtensionists([...extensionists, { id: Date.now(), role: '', members: [{ name: '', isRegularFaculty: false, userId: null }] }]);
  };

  const removeRoleGroup = (id) => {
    setExtensionists(extensionists.filter(g => g.id !== id));
  };

  const updateRoleName = (id, newRole) => {
    setExtensionists(extensionists.map(g => g.id === id ? { ...g, role: newRole } : g));
  };

  const addMember = (groupId) => {
    setExtensionists(extensionists.map(g => g.id === groupId ? { ...g, members: [...g.members, { name: '', isRegularFaculty: false, userId: null }] } : g));
  };

  const updateMember = (groupId, memberIndex, field, value) => {
    setExtensionists(extensionists.map(g => {
      if (g.id === groupId) {
        const newMembers = [...g.members];
        if (field === 'isRegularFaculty') {
          newMembers[memberIndex] = { ...newMembers[memberIndex], isRegularFaculty: value, name: '', userId: null };
        } else if (field === 'userId') {
          const faculty = regularFaculty.find(f => f.id.toString() === value.toString());
          newMembers[memberIndex] = { ...newMembers[memberIndex], userId: value, name: faculty ? faculty.name : '' };
        } else {
          newMembers[memberIndex] = { ...newMembers[memberIndex], [field]: value };
        }
        return { ...g, members: newMembers };
      }
      return g;
    }));
  };

  const removeMember = (groupId, memberIndex) => {
    setExtensionists(extensionists.map(g => {
      if (g.id === groupId) {
        return { ...g, members: g.members.filter((_, idx) => idx !== memberIndex) };
      }
      return g;
    }));
  };

  const fetchHistory = () => {
    if (user?.id) {
      setIsLoadingHistory(true);
      fetch(`${API_URL}/accomplishments/history/${user.id}?year=${selectedYear}&semester=${selectedSemester}`)
        .then(res => res.json())
        .then(data => setHistory(Array.isArray(data) ? data : []))
        .catch(err => console.error(err))
        .finally(() => setIsLoadingHistory(false));
    }
  };

  useEffect(() => {
    if (user?.id && formData.accomplishment_category === 'Extension') {
      fetch(`${API_URL}/accomplishments/extension/${user.id}?year=${selectedYear}&semester=${selectedSemester}`)
        .then(res => res.json())
        .then(data => setUserExtensions(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    }
  }, [user, selectedYear, selectedSemester, formData.accomplishment_category]);

  const getQuarter = (dateString) => {
    if (!dateString) return 'q1';

    // Extract first date if it's a range
    const cleanDate = dateString.includes(' - ') ? dateString.split(' - ')[0] : dateString;

    let dateObj = new Date(cleanDate);

    // Fallback for MM/DD/YYYY if standard parsing fails or is ambiguous
    if (isNaN(dateObj.getTime()) || (cleanDate.includes('/') && !cleanDate.includes('-'))) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) {
        // Assume MM/DD/YYYY
        const m = parseInt(parts[0], 10) - 1;
        const d = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        const fallbackDate = new Date(y, m, d);
        if (!isNaN(fallbackDate.getTime())) dateObj = fallbackDate;
      }
    }

    if (isNaN(dateObj.getTime())) return 'q1';

    const month = dateObj.getMonth(); // 0-indexed
    if (month <= 2) return 'q1'; // Jan, Feb, Mar
    if (month <= 5) return 'q2'; // Apr, May, Jun
    if (month <= 8) return 'q3'; // Jul, Aug, Sep
    return 'q4'; // Oct, Nov, Dec
  };

  useEffect(() => {
    if (userExtensions.length > 0 && user?.id) {
      const totals = userExtensions.reduce((acc, ext) => {
        const q = getQuarter(ext.date);
        acc[q] += (ext.userBeneficiaryShare || 0);
        return acc;
      }, { q1: 0, q2: 0, q3: 0, q4: 0 });

      setIndividualExtData(prev => ({
        ...prev,
        [user.id]: {
          q1: totals.q1.toFixed(2),
          q2: totals.q2.toFixed(2),
          q3: totals.q3.toFixed(2),
          q4: totals.q4.toFixed(2)
        }
      }));
    }
  }, [userExtensions, user?.id]);

  useEffect(() => {
    if (isManualInput) {
      fetchHistory();
      fetch(`${API_URL}/users/regular`)
        .then(res => res.json())
        .then(data => setRegularFaculty(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    }
  }, [isManualInput, user, selectedYear, selectedSemester]);

  useEffect(() => {
    if (isManualInput && formData.accomplishment_category === 'Extension' && history.length > 0) {
      const extRecord = history.find(h => h.accomplishment_category === 'Extension');
      if (extRecord) {
        const parse = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } };
        const r7 = parse(extRecord.active_partnerships_data) || {};
        const r8 = parse(extRecord.trainees_accomplishment_data) || {};
        const r9 = parse(extRecord.extension_programs_data) || {};
        const ind = parse(extRecord.extension_individual_data) || {};

        setFormData(prev => ({
          ...prev,
          ext_total_target: (extRecord.totalExtensionTarget !== undefined && extRecord.totalExtensionTarget !== null) ? extRecord.totalExtensionTarget : '',
          ext_row7_tq1: r7.tq1 ?? '0', ext_row7_aq1: r7.aq1 ?? '0',
          ext_row7_tq2: r7.tq2 ?? '0', ext_row7_aq2: r7.aq2 ?? '0',
          ext_row7_tq3: r7.tq3 ?? '0', ext_row7_aq3: r7.aq3 ?? '0',
          ext_row7_tq4: r7.tq4 ?? '0', ext_row7_aq4: r7.aq4 ?? '0',
          ext_row8_aq1: r8.aq1 ?? '0', ext_row8_aq2: r8.aq2 ?? '0',
          ext_row8_aq3: r8.aq3 ?? '0', ext_row8_aq4: r8.aq4 ?? '0',
          ext_row9_tq1: r9.tq1 ?? '0', ext_row9_aq1: r9.aq1 ?? '0',
          ext_row9_tq2: r9.tq2 ?? '0', ext_row9_aq2: r9.aq2 ?? '0',
          ext_row9_tq3: r9.tq3 ?? '0', ext_row9_aq3: r9.aq3 ?? '0',
          ext_row9_tq4: r9.tq4 ?? '0', ext_row9_aq4: r9.aq4 ?? '0',
        }));
        if (ind && Object.keys(ind).length > 0) {
          setIndividualExtData(prev => ({ ...prev, ...ind }));
        }
      }
    }
  }, [formData.accomplishment_category, history, isManualInput]);

  useEffect(() => {
    if (isManualInput && formData.accomplishment_category === 'Research' && history.length > 0) {
      const resRecord = history.find(h => h.accomplishment_category === 'Research' && (h.target_presentation !== null || h.acc_presentation !== null));
      if (resRecord) {
        setFormData(prev => ({
          ...prev,
          target_presentation: resRecord.target_presentation ?? '',
          acc_presentation: resRecord.acc_presentation ?? '',
          target_publication: resRecord.target_publication ?? '',
          acc_publication: resRecord.acc_publication ?? '',
          target_utilized: resRecord.target_utilized ?? '',
          acc_utilized: resRecord.acc_utilized ?? '',
          admin_scopus: resRecord.admin_scopus ?? '',
          admin_rg: resRecord.admin_rg ?? '',
          admin_gs: resRecord.admin_gs ?? '',
        }));
      }
    }
  }, [formData.accomplishment_category, history, isManualInput]);

  const handleFileChange = (e) => {
    onFileUpload(e, selectedYear, selectedSemester, selectedUploadCategory);
  };

  const handleManualFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setManualFile(e.target.files[0]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === 'checkbox' ? checked : value;

    // Prevent negative integers globally for number inputs
    if (type === 'number') {
      if (value === '') {
        finalValue = '';
      } else {
        const num = parseFloat(value);
        finalValue = isNaN(num) ? '' : Math.max(0, num).toString();
      }
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();

    const isSeminar = formData.accomplishment_category === 'Seminars, Conferences, and Training';
    const isListOfExtension = formData.accomplishment_category === 'List of Extension';

    if (isSeminar) {
      if (!user.tokens) {
        alert('Google Drive is not connected. Please connect your Google Drive to upload attachments.');
        return;
      }
      if (!manualFile) {
        alert("Please upload a PDF file.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        let val = formData[key];
        if (formData.accomplishment_category === 'Research') {
          if (key === 'title' && !val) val = 'Research Portfolio Data';
          if (key === 'date' && !val) val = new Date().toISOString().split('T')[0];
          if (key === 'venue' && !val) val = 'N/A';
          if (key === 'hours' && !val) val = '0';
          if (key === 'sponsoredBy' && !val) val = 'N/A';
        }

        if (isListOfExtension) {
          if (key === 'date') val = formData.is_multiple_days ? `${formData.date} - ${formData.end_date}` : formData.date;
          if (key === 'venue') val = formData.location;
        }

        if (typeof val !== 'boolean') submitData.append(key, val);
      });

      if (isListOfExtension) {
        submitData.append('beneficiaries', `${formData.beneficiaries_count} ${formData.beneficiaries_type}`);
        submitData.append('extension_personnel', JSON.stringify(extensionists));
        if (formData.references) {
          submitData.append('gdrive_link', formData.references);
        }
      }

      if (formData.accomplishment_category === 'Extension') {
        const r7 = {
          tq1: formData.ext_row7_tq1, aq1: formData.ext_row7_aq1,
          tq2: formData.ext_row7_tq2, aq2: formData.ext_row7_aq2,
          tq3: formData.ext_row7_tq3, aq3: formData.ext_row7_aq3,
          tq4: formData.ext_row7_tq4, aq4: formData.ext_row7_aq4
        };
        const r8 = {
          aq1: formData.ext_row8_aq1, aq2: formData.ext_row8_aq2,
          aq3: formData.ext_row8_aq3, aq4: formData.ext_row8_aq4
        };
        const r9 = {
          tq1: formData.ext_row9_tq1, aq1: formData.ext_row9_aq1,
          tq2: formData.ext_row9_tq2, aq2: formData.ext_row9_aq2,
          tq3: formData.ext_row9_tq3, aq3: formData.ext_row9_aq3,
          tq4: formData.ext_row9_tq4, aq4: formData.ext_row9_aq4
        };
        submitData.append('totalExtensionTarget', formData.ext_total_target);
        submitData.append('active_partnerships_data', JSON.stringify(r7));
        submitData.append('trainees_accomplishment_data', JSON.stringify(r8));
        submitData.append('extension_programs_data', JSON.stringify(r9));
        submitData.append('extension_individual_data', JSON.stringify(individualExtData));

        if (!formData.title) submitData.set('title', `Extension Data ${selectedYear}`);
        if (!formData.date) submitData.set('date', new Date().toISOString().split('T')[0]);
        if (!formData.venue) submitData.set('venue', 'Santa Cruz Campus');
      }

      submitData.append('userId', user.id);
      submitData.append('academicYear', selectedYear);
      submitData.append('semester', selectedSemester);
      submitData.append('facultyName', user.name || 'Faculty');
      if (user.tokens) submitData.append('tokens', JSON.stringify(user.tokens));
      if (manualFile) submitData.append('file', manualFile);

      const res = await fetch(`${API_URL}/accomplishments/manual`, {
        method: 'POST',
        body: submitData
      });

      const data = await res.json();
      if (data.success) {
        alert('✅ Manual accomplishment saved successfully!');
        setFormData(initialFormData);
        setExtensionists([{ id: Date.now(), role: 'Project Head', members: [{ name: '', isRegularFaculty: false, userId: null }] }]);
        setIndividualExtData({});
        setManualFile(null);
        if (onManualSubmitSuccess) onManualSubmitSuccess();
        fetchHistory();
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Failed to submit form.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 sm:px-10 bg-white rounded-3xl shadow-sm border border-gray-200/60 min-h-[calc(100vh-12rem)] space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Upload Documents</h1>
          <p className="text-sm text-gray-500 mt-2">
            Add PDF files or manual inputs for <span className="font-medium text-gray-900">AY {selectedYear} · {selectedSemester}</span>
          </p>
        </div>
      </div>

      {(!user?.department || !user?.position) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 transition-all hover:bg-amber-100/50 group">
          <div className="bg-amber-100 p-3 rounded-xl text-amber-600 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-sm font-semibold text-amber-900">Incomplete Profile Information</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Your <b>Department</b> and <b>Position/Role</b> are required for accurate IPCR generation. Please update them in your profile.
            </p>
          </div>
          <button
            onClick={() => {
              if (onNavigate) onNavigate('profile');
            }}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-sm transition-colors whitespace-nowrap"
          >
            Update Profile <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex justify-center -mt-6">
        <div className="bg-gray-100 p-1 rounded-xl inline-flex shadow-inner">
          <button
            onClick={() => setIsManualInput(false)}
            className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${!isManualInput ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Automatic Upload
          </button>
          <button
            onClick={() => setIsManualInput(true)}
            className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${isManualInput ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Manual Input
          </button>
        </div>
      </div>

      {isManualInput ? (
        <div className="space-y-8">
          <form onSubmit={handleManualSubmit} className="space-y-5 max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-base font-medium text-gray-900 border-b border-gray-100 pb-3">Faculty Accomplishment Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Accomplishment Category *</label>
                <select required name="accomplishment_category" value={formData.accomplishment_category} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border bg-white">
                  <option value="Seminars, Conferences, and Training">Seminars, Conferences, and Training</option>
                  <option value="Research">Research</option>
                  <option value="Extension">Extension</option>
                  <option value="List of Extension">List of Extension</option>
                </select>
              </div>

              {formData.accomplishment_category === 'Seminars, Conferences, and Training' && (
                <>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Title *</label>
                    <input required type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="Enter title..." />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Date *</label>
                    <input required type="date" max={new Date().toISOString().split('T')[0]} name="date" value={formData.date} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Scope *</label>
                    <select required name="scope" value={formData.scope} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border bg-white">
                      <option value="Local">Local</option>
                      <option value="National">National</option>
                      <option value="Regional">Regional</option>
                      <option value="International">International</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Conducted by / Venue *</label>
                    <input required type="text" name="venue" value={formData.venue} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="Enter venue..." />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Participants</label>
                    <input type="text" readOnly value={user.name} className="w-full rounded-lg border-gray-300 bg-gray-200 text-gray-600 shadow-sm sm:text-sm p-2.5 border cursor-not-allowed" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Number of Hours *</label>
                    <input required type="number" min="1" name="hours" value={formData.hours} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="e.g. 8" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Research Related *</label>
                    <select required name="researchRelated" value={formData.researchRelated} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border bg-white">
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Conducted/Sponsored by *</label>
                    <input required type="text" name="sponsoredBy" value={formData.sponsoredBy} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="Sponsor name..." />
                  </div>
                </>
              )}

              {formData.accomplishment_category === 'Extension' && (
                <>
                  <div className="col-span-1 md:col-span-2 p-5 bg-gray-50 rounded-2xl border border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Global Extension Targets (Sheet 6)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide uppercase">Extension Target</label>
                        <input
                          type="number"
                          name="ext_total_target"
                          value={formData.ext_total_target}
                          onChange={handleInputChange}
                          disabled={user?.role !== 'admin'}
                          className={`w-full rounded-lg border-gray-200 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border ${user?.role !== 'admin' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                          min="0"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 overflow-x-auto pt-4">
                    <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-widest">Global Rows (7, 8, 9)</h4>
                    <table className="min-w-full text-xs border-collapse border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border p-2 text-left">Description</th>
                          <th className="border p-2" colSpan="2">Q1 (T/A)</th>
                          <th className="border p-2" colSpan="2">Q2 (T/A)</th>
                          <th className="border p-2" colSpan="2">Q3 (T/A)</th>
                          <th className="border p-2" colSpan="2">Q4 (T/A)</th>
                          <th className="border p-2" colSpan="2">Total (T/A)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border p-2 font-medium">Row 7: Partnerships</td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_tq1" value={formData.ext_row7_tq1} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_aq1" value={formData.ext_row7_aq1} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_tq2" value={formData.ext_row7_tq2} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_aq2" value={formData.ext_row7_aq2} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_tq3" value={formData.ext_row7_tq3} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_aq3" value={formData.ext_row7_aq3} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_tq4" value={formData.ext_row7_tq4} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row7_aq4" value={formData.ext_row7_aq4} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-2 text-center font-bold bg-gray-50">
                            {(Number(formData.ext_row7_tq1) || 0) + (Number(formData.ext_row7_tq2) || 0) + (Number(formData.ext_row7_tq3) || 0) + (Number(formData.ext_row7_tq4) || 0)}
                          </td>
                          <td className="border p-2 text-center font-bold bg-gray-50">
                            {(Number(formData.ext_row7_aq1) || 0) + (Number(formData.ext_row7_aq2) || 0) + (Number(formData.ext_row7_aq3) || 0) + (Number(formData.ext_row7_aq4) || 0)}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2 font-medium">Row 8: Trainees</td>
                          <td className="border p-1 bg-gray-50 text-center">-</td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row8_aq1" value={formData.ext_row8_aq1} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1 bg-gray-50 text-center">-</td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row8_aq2" value={formData.ext_row8_aq2} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1 bg-gray-50 text-center">-</td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row8_aq3" value={formData.ext_row8_aq3} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1 bg-gray-50 text-center">-</td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row8_aq4" value={formData.ext_row8_aq4} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-2 text-center font-bold bg-gray-50">-</td>
                          <td className="border p-2 text-center font-bold bg-gray-50">
                            {(Number(formData.ext_row8_aq1) || 0) + (Number(formData.ext_row8_aq2) || 0) + (Number(formData.ext_row8_aq3) || 0) + (Number(formData.ext_row8_aq4) || 0)}
                          </td>
                        </tr>
                        <tr>
                          <td className="border p-2 font-medium">Row 9: Programs</td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_tq1" value={formData.ext_row9_tq1} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_aq1" value={formData.ext_row9_aq1} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_tq2" value={formData.ext_row9_tq2} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_aq2" value={formData.ext_row9_aq2} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_tq3" value={formData.ext_row9_tq3} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_aq3" value={formData.ext_row9_aq3} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_tq4" value={formData.ext_row9_tq4} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-1"><input type="number" min="0" name="ext_row9_aq4" value={formData.ext_row9_aq4} onChange={handleInputChange} className="w-10 p-1 border rounded" /></td>
                          <td className="border p-2 text-center font-bold bg-gray-50">
                            {(Number(formData.ext_row9_tq1) || 0) + (Number(formData.ext_row9_tq2) || 0) + (Number(formData.ext_row9_tq3) || 0) + (Number(formData.ext_row9_tq4) || 0)}
                          </td>
                          <td className="border p-2 text-center font-bold bg-gray-50">
                            {(Number(formData.ext_row9_aq1) || 0) + (Number(formData.ext_row9_aq2) || 0) + (Number(formData.ext_row9_aq3) || 0) + (Number(formData.ext_row9_aq4) || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-6 border-t border-gray-100 mt-4">
                    <h4 className="text-xs font-bold text-gray-700 mb-4 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Individual Faculty Grid
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border-collapse border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border p-2 text-left">Faculty Name</th>
                            <th className="border p-2">Q1 Acc</th>
                            <th className="border p-2">Q2 Acc</th>
                            <th className="border p-2">Q3 Acc</th>
                            <th className="border p-2">Q4 Acc</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regularFaculty.map(f => (
                            <tr key={f.id} className="hover:bg-gray-50">
                              <td className="border p-2 font-medium">{f.name}</td>
                              {['q1', 'q2', 'q3', 'q4'].map(q => (
                                <td key={q} className="border p-1 text-center">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    disabled={String(user.id) !== String(f.id)}
                                    readOnly={String(user.id) !== String(f.id)}
                                    value={individualExtData[f.id]?.[q] || '0'}
                                    onChange={(e) => {
                                      const rawVal = e.target.value;
                                      let val = '0';
                                      if (rawVal !== '') {
                                        const num = parseFloat(rawVal);
                                        val = isNaN(num) ? '0' : Math.max(0, num).toString();
                                      } else {
                                        val = '';
                                      }
                                      setIndividualExtData(prev => ({
                                        ...prev,
                                        [f.id]: { ...(prev[f.id] || { q1: '0', q2: '0', q3: '0', q4: '0' }), [q]: val }
                                      }));
                                    }}
                                    className={`w-14 p-1 border rounded text-center ${String(user.id) !== String(f.id) ? 'bg-gray-200 cursor-not-allowed opacity-70' : 'bg-white'}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {userExtensions.length > 0 && (
                      <div className="mt-8">
                        <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5" /> Participating Extension Projects (Automatic Share)
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-[10px] border-collapse border border-blue-100 rounded-lg overflow-hidden bg-blue-50/10">
                            <thead className="bg-blue-50">
                              <tr>
                                <th className="border border-blue-100 p-2 text-left">Project Title</th>
                                <th className="border border-blue-100 p-2 text-center">Date</th>
                                <th className="border border-blue-100 p-2 text-center">Total Beneficiaries</th>
                                <th className="border border-blue-100 p-2 text-center">Your Share (Accomplished)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userExtensions.map(ext => (
                                <tr key={ext.id} className="hover:bg-white transition-colors">
                                  <td className="border border-blue-100 p-2 font-medium">{ext.title}</td>
                                  <td className="border border-blue-100 p-2 text-center">
                                    {ext.date && ext.date.includes(' - ') ? ext.date : (new Date(ext.date).toLocaleDateString())}
                                  </td>
                                  <td className="border border-blue-100 p-2 text-center font-bold text-gray-400">{ext.beneficiaries}</td>
                                  <td className="border border-blue-100 p-2 text-center font-bold text-blue-700">{ext.userBeneficiaryShare}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {formData.accomplishment_category === 'Research' && (
                <>
                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Research: Global Targets & Accomplishments</h4>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Target Presentation</label>
                    <input type="number" min="0" name="target_presentation" value={formData.target_presentation} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Acc. Presentation</label>
                    <input type="number" min="0" name="acc_presentation" value={formData.acc_presentation} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Target Publication</label>
                    <input type="number" min="0" name="target_publication" value={formData.target_publication} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Acc. Publication</label>
                    <input type="number" min="0" name="acc_publication" value={formData.acc_publication} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Target Utilized</label>
                    <input type="number" min="0" name="target_utilized" value={formData.target_utilized} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Acc. Utilized</label>
                    <input type="number" min="0" name="acc_utilized" value={formData.acc_utilized} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Research: Personal Statistics</h4>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Proposal Submitted</label>
                    <input type="number" name="stat_proposal" value={formData.stat_proposal} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Completed Timeframe</label>
                    <input type="number" name="stat_completed" value={formData.stat_completed} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Presented</label>
                    <input type="number" name="stat_presented" value={formData.stat_presented} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">IP Rights</label>
                    <input type="number" name="stat_ip_rights" value={formData.stat_ip_rights} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Utilized / Deployed</label>
                    <input type="number" name="stat_utilized" value={formData.stat_utilized} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Citations</label>
                    <input type="number" name="stat_citations" value={formData.stat_citations} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="0" />
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Global Citations (Department Summary)</h4>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Scopus</label>
                    <input
                      type="number"
                      min="0"
                      name="admin_scopus"
                      value={formData.admin_scopus}
                      onChange={handleInputChange}
                      disabled={user?.role !== 'admin'}
                      className={`w-full rounded-lg border-gray-200 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border ${user?.role !== 'admin' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">ResearchGate (RG)</label>
                    <input
                      type="number"
                      min="0"
                      name="admin_rg"
                      value={formData.admin_rg}
                      onChange={handleInputChange}
                      disabled={user?.role !== 'admin'}
                      className={`w-full rounded-lg border-gray-200 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border ${user?.role !== 'admin' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Google Scholar (GS)</label>
                    <input
                      type="number"
                      min="0"
                      name="admin_gs"
                      value={formData.admin_gs}
                      onChange={handleInputChange}
                      disabled={user?.role !== 'admin'}
                      className={`w-full rounded-lg border-gray-200 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border ${user?.role !== 'admin' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                      placeholder="0"
                    />
                  </div>
                </>
              )}

              {formData.accomplishment_category === 'List of Extension' && (
                <>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Title of Projects *</label>
                    <input required type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="Enter title..." />
                  </div>

                  <div className="col-span-1 md:col-span-2 flex items-center gap-2 mb-2">
                    <input type="checkbox" name="is_multiple_days" checked={formData.is_multiple_days} onChange={handleInputChange} className="rounded border-gray-300 text-gray-700 focus:ring-gray-400" />
                    <label className="text-sm font-medium text-gray-700">Multiple Days?</label>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">{formData.is_multiple_days ? 'Start Date *' : 'Date *'}</label>
                    <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" />
                  </div>

                  {formData.is_multiple_days && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">End Date *</label>
                      <input required type="date" name="end_date" value={formData.end_date} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Beneficiaries (Count) *</label>
                    <input required type="number" name="beneficiaries_count" value={formData.beneficiaries_count} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="e.g. 50" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Beneficiaries (Type/Name) *</label>
                    <input required type="text" name="beneficiaries_type" value={formData.beneficiaries_type} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="e.g. Students" />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Location *</label>
                    <input required type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="Enter location..." />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Budget Allocation</label>
                    <input type="text" name="budget_allocation" value={formData.budget_allocation} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="Optional..." />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">References (GDrive Link)</label>
                    <input type="text" name="references" value={formData.references} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="Optional link..." />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 tracking-wide">Evaluation Score *</label>
                    <input required type="number" step="0.1" min="0" max="5" name="evaluation" value={formData.evaluation} onChange={handleInputChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border" placeholder="e.g. 4.5" />
                  </div>

                  {/* Extensionists UI */}
                  <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Extensionists *</h4>
                      <button type="button" onClick={addRoleGroup} className="text-sm font-medium text-gray-900 hover:text-black flex items-center gap-1 underline underline-offset-4">
                        <Plus className="w-4 h-4" /> Add Role Group
                      </button>
                    </div>

                    <div className="space-y-4">
                      {extensionists.map((group) => (
                        <div key={group.id} className="p-4 bg-gray-50/50 border border-gray-200 rounded-xl shadow-sm">
                          <div className="flex justify-between gap-3 mb-3">
                            <input
                              type="text"
                              required
                              value={group.role}
                              onChange={(e) => updateRoleName(group.id, e.target.value)}
                              placeholder="Role Name (e.g. Project Head)"
                              className="w-full font-medium text-gray-900 rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2 border"
                            />
                            <button type="button" onClick={() => removeRoleGroup(group.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-2 pl-2 border-l-2 border-gray-200 ml-1">
                            {group.members.map((member, mIdx) => (
                              <div key={mIdx} className="flex gap-2 items-center">
                                <div className="flex items-center gap-2 mr-2">
                                  <input
                                    type="checkbox"
                                    checked={member.isRegularFaculty}
                                    onChange={(e) => updateMember(group.id, mIdx, 'isRegularFaculty', e.target.checked)}
                                    className="rounded border-gray-300 text-gray-700 focus:ring-gray-400"
                                  />
                                  <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Is Regular Faculty?</label>
                                </div>
                                {member.isRegularFaculty ? (
                                  <select
                                    required
                                    value={member.userId || ''}
                                    onChange={(e) => updateMember(group.id, mIdx, 'userId', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-1.5 border bg-white"
                                  >
                                    <option value="" disabled>Select Faculty</option>
                                    {regularFaculty.map(f => {
                                      // Check if this faculty is already selected in ANY group, excluding the current member
                                      const isAlreadySelected = extensionists.some(g =>
                                        g.members.some(m => m.userId == f.id && m !== member)
                                      );
                                      return (
                                        <option key={f.id} value={f.id} disabled={isAlreadySelected}>
                                          {f.name} {isAlreadySelected ? '(Already Selected)' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    required
                                    value={member.name}
                                    onChange={(e) => updateMember(group.id, mIdx, 'name', e.target.value)}
                                    placeholder="Person's Name"
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-1.5 border"
                                  />
                                )}
                                {group.members.length > 1 && (
                                  <button type="button" onClick={() => removeMember(group.id, mIdx)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => addMember(group.id)} className="text-xs font-medium text-gray-500 hover:text-gray-700 mt-2 flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Add Member
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {formData.accomplishment_category === 'Seminars, Conferences, and Training' && (
                <div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">PDF Certificate Attachment *</label>
                  <input required type="file" accept=".pdf" name="file" onChange={handleManualFileChange} className="w-full rounded-xl border-gray-200 shadow-sm focus:border-gray-400 focus:ring-gray-400 sm:text-sm p-2.5 border bg-white text-gray-700 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-900 file:text-white hover:file:bg-black cursor-pointer" />
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={isSubmitting} className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all inline-flex items-center gap-2 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}>
                {isSubmitting ? (
                  <><div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-white animate-spin" /> Saving...</>
                ) : 'Submit'}
              </button>
            </div>
          </form>

          <div className="max-w-2xl mx-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 px-2 tracking-wide uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Your Manual Submissions
            </h3>
            {isLoadingHistory ? (
              <div className="text-center text-sm text-gray-400 py-8">Loading history...</div>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="group flex items-center justify-between py-4 px-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.accomplishment_category || 'General'}</span>
                          <span className="text-gray-300 text-xs">•</span>
                          <span className="text-xs text-gray-500">
                            {item.date && item.date.includes(' - ') ? item.date : (new Date(item.date).toLocaleDateString())}
                          </span>
                          {item.userBeneficiaryShare !== undefined && (
                            <>
                              <span className="text-gray-300 text-xs">•</span>
                              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                {item.userBeneficiaryShare.toFixed(2)} Beneficiaries
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.gdrive_link && (
                      <a href={item.gdrive_link} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors underline underline-offset-4 shrink-0 pl-4">
                        View Reference
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-gray-400 py-12 border-t border-gray-100">
                No manual submissions for this period yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div>
            <div className="group relative border-2 border-gray-200 border-dashed hover:border-blue-300 bg-gray-50/50 hover:bg-blue-50/30 rounded-2xl p-12 text-center transition-all duration-300 shadow-inner">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4 group-hover:text-blue-500 transition-colors duration-300" strokeWidth={1.5} />
              <h3 className="text-base font-medium text-gray-900">Select IPCR PDF Files</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
                Files will be categorized using AI.
              </p>

              {/* Manual Input for IPCR "if set to Auto-Detect, or manually assigned to your chosen category"*/}
              {/*
              <div className="mt-6 max-w-xs mx-auto">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Categorization Mode</label>
                <select
                  value={selectedUploadCategory}
                  onChange={(e) => setSelectedUploadCategory(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-xl border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm focus:border-blue-400 focus:ring-blue-400 p-2.5 transition-all"
                >

                  <option value="auto">✨ Auto-Detect (AI Classifier)</option>
                  <optgroup label="Manual Categories (Bypass AI)">
                    {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>*/}

              <div className="mt-8">
                <label className="inline-block relative">
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <span className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-2 ${isUploading
                    ? 'bg-gray-100 text-gray-400 pointer-events-none'
                    : 'bg-gray-900 text-white hover:bg-black'
                    }`}>
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                        Classifying... {processedFiles} / {totalFiles}
                      </>
                    ) : 'Browse Files'}
                  </span>
                </label>
              </div>


              {isUploading && (
                <div className="mt-6 w-full max-w-sm mx-auto">
                  <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden border border-gray-300">
                    <div
                      className="bg-gray-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Classifying files... ({processedFiles} / {totalFiles})</p>
                </div>
              )}
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 px-2 tracking-wide uppercase">
                Uploaded ({uploadedFiles.length})
              </h3>
              <div className="space-y-3">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="group flex items-center justify-between py-4 px-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                          <span className="text-gray-300 text-xs">•</span>
                          <span className="text-xs font-medium text-gray-700">{file.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-4">
                      {file.driveLink && (
                        <a
                          href={file.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors underline underline-offset-4"
                        >
                          View
                        </a>
                      )}
                      <CheckCircle className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadedFiles.length === 0 && !isUploading && (
            <div className="text-center text-gray-400 py-12 text-sm border-t border-gray-100">
              No documents uploaded for this period yet.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UploadPage;