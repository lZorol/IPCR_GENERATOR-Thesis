import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, User, Phone, Building, Briefcase, FileText, Loader2 } from 'lucide-react';
import { API_URL } from '../constants';

const ProfilePage = ({ user }) => {
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    position: '',
    contact_number: '',
    notes: '',
    is_regular_faculty: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'ok' | 'error'
  const [profileMeta, setProfileMeta] = useState({ email: '', profile_image: '', role: '' });

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/profile/${user.id}`)
      .then(r => r.json())
      .then(data => {
        setFormData({
          name: data.name || user.name || '',
          department: data.department || user.department || '',
          position: data.position || '',
          contact_number: data.contact_number || '',
          notes: data.notes || '',
          is_regular_faculty: data.is_regular_faculty !== undefined ? data.is_regular_faculty : 1,
        });
        setProfileMeta({
          email: data.email || user.email || '',
          profile_image: data.profile_image || user.profileImage || '',
          role: data.role || user.role || 'faculty',
        });
      })
      .catch(() => {
        setFormData({
          name: user.name || '',
          department: user.department || '',
          position: '',
          contact_number: '',
          notes: '',
          is_regular_faculty: user.is_regular_faculty !== undefined ? user.is_regular_faculty : 1,
        });
        setProfileMeta({
          email: user.email || '',
          profile_image: user.profileImage || '',
          role: user.role || 'faculty',
        });
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaveStatus(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`${API_URL}/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('ok');
        const savedUserStr = sessionStorage.getItem('user');
        if (savedUserStr) {
          const savedUser = JSON.parse(savedUserStr);
          savedUser.is_regular_faculty = formData.is_regular_faculty;
          savedUser.name = formData.name;
          savedUser.department = formData.department;
          sessionStorage.setItem('user', JSON.stringify(savedUser));
          // Mutate the active user prop object to immediately unlock UI views without reload
          user.is_regular_faculty = formData.is_regular_faculty;
        }
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-3 text-sm text-gray-500">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 sm:px-10 bg-white rounded-3xl shadow-sm border border-gray-200/60 min-h-[calc(100vh-12rem)] space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Profile Settings</h1>
          <p className="text-sm text-gray-500 mt-2">Manage your personal information and preferences.</p>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-10 bg-gray-50/50 p-6 rounded-2xl border border-gray-100/50">
        {profileMeta.profile_image ? (
          <img src={profileMeta.profile_image} alt={formData.name} className="w-20 h-20 rounded-full object-cover border border-gray-200" />
        ) : (
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-xl font-medium border border-gray-200">
            {formData.name ? formData.name.split(' ').map(n => n[0]).join('') : 'U'}
          </div>
        )}
        <div>
          <h2 className="text-xl font-medium text-gray-900">{formData.name || 'Your Profile'}</h2>
          <p className="text-gray-500 text-sm mt-0.5">{profileMeta.email}</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600 font-medium capitalize">
            {profileMeta.role}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
            <User className="w-4 h-4 text-gray-400" /> Full Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
            <Building className="w-4 h-4 text-gray-400" /> Department
          </label>
          <input
            type="text"
            value={formData.department}
            onChange={e => handleChange('department', e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            placeholder="Enter your department"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <Briefcase className="w-4 h-4 text-gray-400" /> Position / Role
            </label>
            <input
              type="text"
              value={formData.position}
              onChange={e => handleChange('position', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="e.g. Instructor III"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <Phone className="w-4 h-4 text-gray-400" /> Contact Number
            </label>
            <input
              type="text"
              value={formData.contact_number}
              onChange={e => handleChange('contact_number', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="e.g. 0917-123-4567"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
            <FileText className="w-4 h-4 text-gray-400" /> Optional Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={e => handleChange('notes', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            placeholder="Any additional information..."
          />
        </div>

        <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white px-6 py-3 rounded-xl shadow-sm hover:shadow transition-all text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {saveStatus === 'ok' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                <CheckCircle className="w-4 h-4" /> Saved successfully
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
                <AlertCircle className="w-4 h-4" /> Failed to save
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
