/**
 * IPCR Calculation Service
 * Handles all rating computations before saving to database
 */
const DefaultTarget = require("../shared/defaultTarget.json");

const DEFAULT_TARGETS = {
  syllabus: DefaultTarget.syllabus,
  courseGuide: DefaultTarget.courseGuide,
  slm: DefaultTarget.slm,
  tos: DefaultTarget.tos,
  gradingSheet: DefaultTarget.gradingSheet,
  testQuestions: DefaultTarget.testQuestions,
  attendanceSheet: DefaultTarget.attendanceSheet,
  classRecord: DefaultTarget.classRecord,
  classroomObservation: DefaultTarget.classroomObservation,
  evaluationOfTeachingEffectiveness: DefaultTarget.evaluationOfTeachingEffectiveness,
  accomplishmentReport: DefaultTarget.accomplishmentReport,
  communityImmersion: 5,
};

const CATEGORY_GROUPS = {
  instruction: [
    'syllabus', 'courseGuide', 'slm', 'communityImmersion', 'gradingSheet', 'tos', 'attendanceSheet', 'classRecord',
    'evaluationOfTeachingEffectiveness', 'classroomObservation', 'testQuestions', 'answerKeys',
    'facultyAndStudentsSeekAdvices', 'accomplishmentReport'
  ],
  research: [
    'randdProposal', 'researchImplemented', 'researchPresented', 'researchPublished',
    'intellectualPropertyRights', 'researchUtilizedDeveloped', 'numberOfCitations'
  ],
  extension: [
    'extentionProposal', 'personsTrained', 'personServiceRating', 'personGivenTraining', 'technicalAdvice'
  ],
  support: [
    'accomplishmentReportSupport', 'attendanceFlagCeremony', 'attendanceFlagLowering', 'attendanceHealthAndWellnessProgram',
    'attendanceSchoolCelebrations', 'trainingSeminarConferenceCertificate', 'atttendanceFacultyMeeting',
    'attendanceISOAndRelatedActivities', 'attendaceSpiritualActivities'
  ]
};

const GROUP_WEIGHTS = {
  instruction: 0.72,
  research: 0.04,
  extension: 0.04,
  support: 0.20
};

/**
 * Convert accomplished vs target → IPCR score (1–5)
 */
function autoRate(accomplished, target) {
  // Use 5 if target is missing or 0
  const effectiveTarget = target > 0 ? target : 5;
  
  // Calculate raw ratio-based score (1 to 5 scale)
  const rawRating = (accomplished / effectiveTarget) * 5;
  
  // Clamp between 1.00 and 5.00
  const finalRating = Math.max(1, Math.min(5, rawRating));
  
  return parseFloat(finalRating.toFixed(2));
}

/**
 * Calculate row rating
 * (Average of Q, E, T)
 */
function calculateRowRating(Q, E, T) {
  return Number(((Q + E + T) / 3).toFixed(2));
}

/**
 * Compute one category result
 * @param {string} category - Key: syllabus, courseGuide, slm, tos, gradingSheet (or DB name for backwards compat)
 * @param {number} accomplished
 * @param {number} [targetOverride] - If provided, use this instead of DEFAULT_TARGETS for rating
 */
function computeCategory(category, accomplished, targetOverride) {

  const target = targetOverride !== undefined && targetOverride !== null
    ? Number(targetOverride)
    : (DEFAULT_TARGETS[category] || 0);

  const score = autoRate(accomplished, target);

  const Q = score;
  const E = score;
  const T = score;

  const rating = calculateRowRating(Q, E, T);

  return {
    category,
    target,
    accomplished,
    Q,
    E,
    T,
    rating
  };
}

/**
 * Calculate overall IPCR rating
 */
function calculateOverallRating(ipcrData) {
  let totalWeightedRating = 0;

  for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
    const groupWeight = GROUP_WEIGHTS[group] || 0;
    
    // Get ratings for all categories in this group, defaulting to 1.0 if missing
    const groupRatings = categories.map(cat => {
      const r = ipcrData[cat]?.rating;
      return (r != null && r > 0) ? Number(r) : 1.0;
    });

    const groupAverage = groupRatings.reduce((sum, r) => sum + r, 0) / groupRatings.length;
    totalWeightedRating += groupAverage * groupWeight;
  }

  // Final rounding to match Excel H85
  return Number(totalWeightedRating.toFixed(2)) || 1.0;
}

const categoryMap = {
  syllabus: "Syllabus",
  courseGuide: "Course Guide",
  slm: "SLM",
  communityImmersion: "Community Immersion",
  gradingSheet: "Grading Sheet",
  tos: "TOS",
  attendanceSheet: "Attendance Sheet",
  classRecord: "Class Records",
  evaluationOfTeachingEffectiveness: "Evaluation of Teaching Effectiveness",
  classroomObservation: "Classroom Observation",
  testQuestions: "Test Questions",
  answerKeys: "Answer Keys",
  facultyAndStudentsSeekAdvices: "Faculty and Students Seek Advices",
  accomplishmentReport: "Accomplishment Report (Instruction)",
  randdProposal: "R&D Proposal",
  researchImplemented: "Research Implemented",
  researchPresented: "Research Presented",
  researchPublished: "Research Published",
  intellectualPropertyRights: "Intellectual Property Rights",
  researchUtilizedDeveloped: "Research Utilized/Developed",
  numberOfCitations: "Number of Citations",
  extentionProposal: "Extension Proposal",
  personsTrained: "Persons Trained",
  personServiceRating: "Person Service Rating",
  personGivenTraining: "Person Given Training",
  technicalAdvice: "Technical Advice",
  accomplishmentReportSupport: "Accomplishment Report (Support)",
  attendanceFlagCeremony: "Attendance Flag Ceremony",
  attendanceFlagLowering: "Attendance Flag Lowering",
  attendanceHealthAndWellnessProgram: "Attendance Health and Wellness Program",
  attendanceSchoolCelebrations: "Attendance School Celebrations",
  trainingSeminarConferenceCertificate: "Training/Seminar/Conference Certificate",
  atttendanceFacultyMeeting: "Attendance Faculty Meeting",
  attendanceISOAndRelatedActivities: "Attendance ISO and Related Activities",
  attendaceSpiritualActivities: "Attendance Spiritual Activities"
};

const AUTOMATED_CATEGORIES = [
  "Accomplishment Report (Instruction)",
  "Attendance Sheet",
  "Class Records",
  "Classroom Observation",
  "Course Guide",
  "Evaluation of Teaching Effectiveness",
  "Grading Sheet",
  "Research Implemented",
  "SLM",
  "Syllabus",
  "Test Questions",
  "TOS"
];

module.exports = {
  computeCategory,
  calculateOverallRating,
  categoryMap,
  autoRate,
  AUTOMATED_CATEGORIES
};