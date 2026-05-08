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

const WEIGHTS = {
  syllabus: 0.5,
  courseGuide: 0.5,
  slm: 0.5,
  tos: 0.5,
  gradingSheet: 0.5,
  testQuestions: 0.5,
  attendanceSheet: 0.5,
  classRecord: 0.5,
  classroomObservation: 0.5,
  evaluationOfTeachingEffectiveness: 0.5,
  accomplishmentReport: 0.5,
  communityImmersion: 0.5
};

/**
 * Convert accomplished vs target → IPCR score (1–5)
 */
function autoRate(accomplished, target) {
  // Use 5 if target is missing or 0
  const effectiveTarget = target > 0 ? target : 5;
  
  // Calculate raw ratio-based score (0 to 5 scale)
  const rawRating = (accomplished / effectiveTarget) * 5;
  
  // Clamp between 0.00 and 5.00
  const finalRating = Math.max(0, Math.min(5, rawRating));
  
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
    rating,
    weight: WEIGHTS[category] || 0
  };
}

/**
 * Calculate overall IPCR rating
 */
function calculateOverallRating(rows) {

  const total = rows.reduce((sum, r) => {
    return sum + (r.rating * r.weight);
  }, 0);

  return Number(total.toFixed(2));
}

const categoryMap = {
  syllabus: "Syllabus",
  courseGuide: "Course Guide",
  slm: "SLM",
  communityImmersion: "Number of subject areas with community immersion/involvement component",
  gradingSheet: "Grading Sheet",
  tos: "TOS",
  attendanceSheet: "Attendance Sheet",
  classRecord: "Class Record",
  evaluationOfTeachingEffectiveness: "Evaluation of Teaching Effectiveness",
  classroomObservation: "Classroom Observation",
  testQuestions: "Test Questions",
  answerKeys: "Answer Keys",
  facultyAndStudentsSeekAdvices: "Faculty and Students Seek Advices",
  accomplishmentReport: "Accomplishment Report",
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
  accomplishmentReportSupport: "Accomplishment Report Support",
  attendanceFlagCeremony: "Attendance Flag Ceremony",
  attendanceFlagLowering: "Attendance Flag Lowering",
  attendanceHealthAndWellnessProgram: "Attendance Health and Wellness Program",
  attendanceSchoolCelebrations: "Attendance School Celebrations",
  trainingSeminarConferenceCertificate: "Training/Seminar/Conference Certificate",
  atttendanceFacultyMeeting: "Attendance Faculty Meeting",
  attendanceISOAndRelatedActivities: "Attendance ISO and Related Activities",
  attendaceSpiritualActivities: "Attendance Spiritual Activities"
};

module.exports = {
  computeCategory,
  calculateOverallRating,
  categoryMap,
  autoRate
};