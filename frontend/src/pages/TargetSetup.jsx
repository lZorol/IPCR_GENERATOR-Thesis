import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  BookmarkPlus,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Target,
  CheckCircle2,
} from "lucide-react";
import { API_URL, CATEGORY_NAMES, CATEGORY_GROUPS, GROUP_NAMES } from "../constants";

// ─── Ordered list of all category keys ────────────────────────────────────────
const ALL_KEYS = [
  "syllabus","courseGuide","slm","communityImmersion","gradingSheet","tos","attendanceSheet",
  "classRecord","evaluationOfTeachingEffectiveness","classroomObservation",
  "testQuestions","answerKeys","facultyAndStudentsSeekAdvices","accomplishmentReport",
  "randdProposal","researchImplemented","researchPresented","researchPublished",
  "intellectualPropertyRights","researchUtilizedDeveloped","numberOfCitations",
  "extentionProposal","personsTrained","personServiceRating","personGivenTraining",
  "technicalAdvice","accomplishmentReportSupport","attendanceFlagCeremony",
  "attendanceFlagLowering","attendanceHealthAndWellnessProgram","attendanceSchoolCelebrations",
  "trainingSeminarConferenceCertificate","atttendanceFacultyMeeting",
  "attendanceISOAndRelatedActivities","attendaceSpiritualActivities",
];

const INITIAL_TARGETS = () =>
  Object.fromEntries(ALL_KEYS.map((k) => [k, 5]));

// ─── Group config ─────────────────────────────────────────────────────────────
const GROUPS = {
  instruction: CATEGORY_GROUPS.instruction,
  research: CATEGORY_GROUPS.research,
  extension: CATEGORY_GROUPS.extension,
  supportFunction: [
    "accomplishmentReportSupport",
    ...CATEGORY_GROUPS.supportFunction,
  ],
};

const TargetSetup = ({ user, selectedYear, selectedSemester, onTargetsSaved, availableYears = [], availableSemesters = [] }) => {
  const [year, setYear]       = useState(selectedYear);
  const [semester, setSem]    = useState(selectedSemester);
  const [targets, setTargets] = useState(INITIAL_TARGETS());
  const [hasTargets, setHasTargets] = useState(false);

  // Presets
  const [presets, setPresets]           = useState([]);
  const [newPresetName, setNewPresetName] = useState("");

  // UI state
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);   // { type: 'success'|'error', msg }
  const [collapsed, setCollapsed] = useState({});   // groupKey → bool

  // ── Load targets when year/semester changes ──────────────────────────────────
  const loadTargets = useCallback(async (uid, y, s) => {
    try {
      const res  = await fetch(`${API_URL}/targets/${uid}/${encodeURIComponent(y)}/${encodeURIComponent(s)}`);
      const data = await res.json();
      if (data.targets) {
        setTargets({ ...INITIAL_TARGETS(), ...data.targets });
        setHasTargets(data.hasTargets);
      }
    } catch {
      setTargets(INITIAL_TARGETS());
    }
  }, []);

  const loadPresets = useCallback(async (uid) => {
    try {
      const res  = await fetch(`${API_URL}/presets/${uid}`);
      const data = await res.json();
      setPresets(Array.isArray(data) ? data : []);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadTargets(user.id, year, semester);
      loadPresets(user.id);
    }
  }, [user, year, semester, loadTargets, loadPresets]);

  // Keep local year/sem in sync with parent selections
  useEffect(() => { setYear(selectedYear); }, [selectedYear]);
  useEffect(() => { setSem(selectedSemester); }, [selectedSemester]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleChange = (key, val) => {
    const n = parseInt(val, 10);
    setTargets((prev) => ({ ...prev, [key]: isNaN(n) || n < 0 ? 0 : n }));
  };

  // ── Save targets ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/targets/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          academic_year: year,
          semester,
          targets,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setHasTargets(true);
      showToast("success", "Targets saved successfully!");
      onTargetsSaved?.();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Presets ──────────────────────────────────────────────────────────────────
  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return showToast("error", "Enter a preset name");
    try {
      const res = await fetch(`${API_URL}/presets/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, preset_name: newPresetName.trim(), targets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create preset");
      setNewPresetName("");
      await loadPresets(user.id);
      showToast("success", `Preset "${newPresetName}" saved!`);
    } catch (err) {
      showToast("error", err.message);
    }
  };

  const handleLoadPreset = (preset) => {
    setTargets({ ...INITIAL_TARGETS(), ...preset.targets });
    showToast("success", `Loaded preset "${preset.preset_name}"`);
  };

  const handleDeletePreset = async (presetId) => {
    try {
      const res = await fetch(`${API_URL}/presets/${presetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await loadPresets(user.id);
      showToast("success", "Preset deleted");
    } catch (err) {
      showToast("error", err.message);
    }
  };

  const toggleCollapse = (groupKey) =>
    setCollapsed((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <span className="text-red-500 font-bold">!</span>
          )}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="pb-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <Target className="w-6 h-6 text-gray-700" />
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Target Setup</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1 ml-9">
          Set your personal submission targets per category for each academic period.
        </p>
      </div>

      {/* Period selector + Save button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
              Academic Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSem(e.target.value)}
              className="text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300"
            >
              {availableSemesters.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!hasTargets && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              No targets set for this period yet
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Targets"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* ── Category target groups (left 2/3) ───────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">
          {Object.entries(GROUPS).map(([groupKey, keys]) => {
            const isCollapsed = collapsed[groupKey];
            return (
              <div
                key={groupKey}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Group header */}
                <button
                  onClick={() => toggleCollapse(groupKey)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                    {GROUP_NAMES[groupKey]}
                  </h2>
                  {isCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Category rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-50 border-t border-gray-100">
                    {keys.map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/70 transition-colors"
                      >
                        <label
                          htmlFor={`target-${key}`}
                          className="text-sm text-gray-700 flex-1 pr-4"
                        >
                          {CATEGORY_NAMES[key] || key}
                        </label>
                        <input
                          id={`target-${key}`}
                          type="number"
                          min="0"
                          value={targets[key] ?? 5}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className="w-20 text-center text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Presets panel (right 1/3) ──────────────────────────────────── */}
        <div className="space-y-5">
          {/* Save as preset */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Save as Preset
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Save the current target values as a reusable preset.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Preset name…"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300 placeholder-gray-300"
              />
              <button
                onClick={handleSavePreset}
                title="Create preset"
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all"
              >
                <BookmarkPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Presets list */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              My Presets
            </h3>
            {presets.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No presets yet. Create one above.
              </p>
            ) : (
              <ul className="space-y-2">
                {presets.map((preset) => (
                  <li
                    key={preset.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all"
                  >
                    <span className="text-sm font-medium text-gray-800 truncate flex-1">
                      {preset.preset_name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoadPreset(preset)}
                        title="Load preset"
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 px-2 py-1 rounded-lg transition-all"
                      >
                        <Download className="w-3 h-3" />
                        Load
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        title="Delete preset"
                        className="flex items-center text-gray-400 hover:text-red-500 bg-white border border-gray-200 hover:border-red-200 p-1.5 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetSetup;
