import React, { useState } from "react";
import {
  CheckCircle,
  Clock,
  Download,
  HardDrive,
  SlidersHorizontal,
} from "lucide-react";
import { CATEGORY_NAMES, CATEGORY_GROUPS, GROUP_NAMES } from "../constants";

const DashboardPage = ({
  user,
  ipcrData,
  onExport,
  selectedYear,
  selectedSemester,
  onGoToTargets,
}) => {
  const [viewMode, setViewMode] = useState("category");

  const calculateRating = (target, accomplished) => {
    if (target === 0) return 0;
    const rawRating = (accomplished / target) * 5;
    const finalRating = Math.max(0, Math.min(5, rawRating));
    return parseFloat(finalRating.toFixed(2));
  };

  // ✅ Helpers
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

  // ✅ FINAL RATING (MATCHES EXCEL H85)
  const calculateOverallRating = () => {
    try {
      // --- GROUPS (EXACT MATCH TO EXCEL) ---
      const INS_KEYS = [
        "syllabus",
        "courseGuide",
        "slm",
        "communityImmersion",
        "attendanceSheet",
        "classRecord",
        "evaluationOfTeachingEffectiveness",
        "classroomObservation",
        "tos",
        "testQuestions",
        "answerKeys",
        "gradingSheet",
        "facultyAndStudentsSeekAdvices",
        "accomplishmentReport",
      ];

      const RES_KEYS = [
        "randdProposal",
        "researchImplemented",
        "researchPresented",
        "researchPublished",
        "intellectualPropertyRights",
        "researchUtilizedDeveloped",
        "numberOfCitations",
      ];

      const EXT_KEYS = [
        "extentionProposal",
        "personsTrained",
        "personServiceRating",
        "personGivenTraining",
        "technicalAdvice",
      ];

      const SUPT_KEYS = [
        "accomplishmentReportSupport",
        "attendanceFlagCeremony",
        "attendanceFlagLowering",
        "attendanceHealthAndWellnessProgram",
        "attendanceSchoolCelebrations",
        "trainingSeminarConferenceCertificate",
        "atttendanceFacultyMeeting",
        "attendanceISOAndRelatedActivities",
        "attendaceSpiritualActivities",
      ];

      const DGT_KEYS = []; // (I76:I83 not implemented yet)

      // --- COMPUTE GROUP AVERAGES ---
      const INS = safeAverage(INS_KEYS.map((k) => getRating(ipcrData[k])));
      const RES = safeAverage(RES_KEYS.map((k) => getRating(ipcrData[k])));
      const EXT = safeAverage(EXT_KEYS.map((k) => getRating(ipcrData[k])));
      const SUPT = safeAverage(SUPT_KEYS.map((k) => getRating(ipcrData[k])));
      const DGT = safeAverage(DGT_KEYS.map((k) => getRating(ipcrData[k])));

      // ⚠️ MATCH THESE WITH YOUR EXCEL NAMED VALUES
      const INS_W = 0.72;
      const RES_W = 0.04;
      const EXT_W = 0.04;
      const SUPT_W = 0.2;
      const DGT_W = 0;

      const final =
        INS * INS_W +
        RES * RES_W +
        EXT * EXT_W +
        SUPT * SUPT_W +
        (DGT * DGT_W || 0);

      return final.toFixed(2);
    } catch {
      return "0.00";
    }
  };

  const items = Object.entries(ipcrData).map(([key, data]) => ({
    key,
    name: CATEGORY_NAMES[key] || key,
    data,
    rating: getRating(data),
  }));

  function renderCard(item) {
    const { key, name, data, rating } = item;
    return (
      <div
        key={key}
        className="group bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {name}
          </h3>
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded-md ${
              rating >= 4
                ? "bg-green-50 text-green-700"
                : rating >= 3
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {rating.toFixed(1)}
          </span>
        </div>

        <div className="space-y-4 mt-auto border-t border-gray-50 pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">
              <span className="text-gray-900">{data.accomplished}</span>{" "}
              <span className="text-gray-300 mx-1">/</span> {data.target} target
            </span>
            {data.submitted && (
              <span className="text-gray-400 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> {data.submitted}
              </span>
            )}
          </div>

          <div className="w-full bg-gray-100/80 rounded-full h-1.5 overflow-hidden border border-gray-200/50">
            <div
              className={`h-full transition-all duration-500 ease-out shadow-sm ${
                rating >= 4
                  ? "bg-gradient-to-r from-gray-700 to-gray-900"
                  : rating >= 3
                    ? "bg-gradient-to-r from-gray-400 to-gray-600"
                    : "bg-gradient-to-r from-gray-200 to-gray-400"
              }`}
              style={{
                width: `${Math.min((data.accomplished / (data.target || 1)) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  let displayContent;
  if (viewMode === "table") {
    displayContent = (
      <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="py-4 px-6 text-xs font-semibold text-gray-900 uppercase tracking-wider">Strategic Objective / Output</th>
              <th className="py-4 px-4 text-xs font-semibold text-gray-900 uppercase tracking-wider text-center">Target</th>
              <th className="py-4 px-4 text-xs font-semibold text-gray-900 uppercase tracking-wider text-center">Acc</th>
              <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Qnty</th>
              <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Ql/E</th>
              <th className="py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">T</th>
              <th className="py-4 px-4 text-xs font-semibold text-gray-900 uppercase tracking-wider text-center">A</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.key} className="hover:bg-gray-50/80 transition-colors">
                <td className="py-4 px-6">
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                </td>
                <td className="py-4 px-4 text-center text-sm text-gray-600">{item.data.target}</td>
                <td className="py-4 px-4 text-center text-sm text-gray-900 font-medium">{item.data.accomplished}</td>
                <td className="py-4 px-4 text-center text-sm text-gray-500">{(item.data.qty || item.rating).toFixed(2)}</td>
                <td className="py-4 px-4 text-center text-sm text-gray-500">{(item.data.qle || item.rating).toFixed(2)}</td>
                <td className="py-4 px-4 text-center text-sm text-gray-500">{(item.data.timeliness || item.rating).toFixed(2)}</td>
                <td className="py-4 px-4 text-center">
                  <span className={`text-sm font-bold px-2 py-1 rounded-md ${
                    item.rating >= 4 ? "bg-green-50 text-green-700" :
                    item.rating >= 3 ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>
                    {item.rating.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (viewMode === "category") {
    displayContent = Object.entries(CATEGORY_GROUPS).map(
      ([groupKey, itemKeys]) => {
        const groupItems = items.filter((i) => itemKeys.includes(i.key));
        if (groupItems.length === 0) return null;
        return (
          <div key={groupKey} className="mb-12">
            <h2 className="text-xl font-medium text-gray-900 mb-6 border-b border-gray-100 pb-2">
              {GROUP_NAMES[groupKey]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
              {groupItems.map(renderCard)}
            </div>
          </div>
        );
      },
    );
  } else {
    let sortedItems = [...items];
    if (viewMode === "alpha") {
      sortedItems.sort((a, b) => a.name.localeCompare(b.name));
    } else if (viewMode === "desc") {
      sortedItems.sort((a, b) => b.data.accomplished - a.data.accomplished);
    } else if (viewMode === "asc") {
      sortedItems.sort((a, b) => a.data.accomplished - b.data.accomplished);
    }
    displayContent = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
        {sortedItems.map(renderCard)}
      </div>
    );
  }

  // Check if user has set targets for this period
  const noTargetsSet = Object.values(ipcrData).some(d => d.hasTargets === false);

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-8 px-4 sm:px-6 lg:px-8 bg-gray-50/30 min-h-screen">
      {/* No-targets banner */}
      {noTargetsSet && onGoToTargets && (
        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 text-sm">
          <span className="text-amber-700">
            ⚠️ You haven&apos;t set targets for{" "}
            <strong>{selectedYear} · {selectedSemester}</strong> yet. Targets default to
            5 until you customize them.
          </span>
          <button
            onClick={onGoToTargets}
            className="shrink-0 text-amber-700 font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors"
          >
            Set Targets →
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            {selectedYear && selectedSemester && (
              <span>
                AY {selectedYear} · {selectedSemester}
              </span>
            )}
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1.5">
              {user.tokens ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" /> Drive
                  Connected
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-gray-400" /> Local Storage
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
              Overall Rating
            </p>
            <p className="text-3xl font-semibold text-gray-800 leading-none">
              {calculateOverallRating()}{" "}
              <span className="text-lg text-gray-400 font-normal">/ 5.0</span>
            </p>
          </div>
          <button
            onClick={onExport}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            Export IPCR
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-end mt-[-10px] mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="font-medium mr-1">View by:</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="bg-transparent font-medium text-gray-900 border-none outline-none cursor-pointer p-0"
          >
            <option value="category">Category Groups</option>
            <option value="table">Table Detailed View</option>
            <option value="alpha">Alphabetical (A-Z)</option>
            <option value="desc">Accomplished (Highest First)</option>
            <option value="asc">Accomplished (Lowest First)</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div>{displayContent}</div>
    </div>
  );
};

export default DashboardPage;
