/**
 * saveIPCR.js
 * Handles saving IPCR records into SQLite, scoped by academic year + semester.
 * Auto-populates start_date / end_date from semester_config.
 */

const db = require("./database");
const { computeCategory } = require("./ipcrCalculator");

const DEFAULT_ACADEMIC_YEAR = "2025-2026";
const DEFAULT_SEMESTER = "1st Semester";

// Category map (ML/key → DB display name)
const categoryMap = {
  syllabus: "Syllabus",
  courseGuide: "Course Guide",
  slm: "SLM",
  communityImmersion: "Community Immersion",
  gradingSheet: "Grading Sheet",
  tos: "TOS",
  testQuestions: "Test Questions",
  attendanceSheet: "Attendance Sheet",
  classRecord: "Class Records",
  classroomObservation: "Classroom Observation",
  evaluationOfTeachingEffectiveness: "Evaluation of Teaching Effectiveness",
  accomplishmentReport: "Accomplishment Report (Instruction)",
};

// Reverse map (DB name → key) for computeCategory
const categoryKeyMap = {
  Syllabus: "syllabus",
  "Course Guide": "courseGuide",
  SLM: "slm",
  "Community Immersion": "communityImmersion",
  "Grading Sheet": "gradingSheet",
  TOS: "tos",
  "Test Questions": "testQuestions",
  "Attendance Sheet": "attendanceSheet",
  "Class Records": "classRecord",
  "Classroom Observation": "classroomObservation",
  "Evaluation of Teaching Effectiveness": "evaluationOfTeachingEffectiveness",
  "Accomplishment Report (Instruction)": "accomplishmentReport",
};

/**
 * Fetch start_date and end_date from semester_config for a given period.
 */
function getSemesterDates(academicYear, semester) {
  return new Promise((resolve) => {
    db.get(
      `SELECT start_date, end_date FROM semester_config
       WHERE academic_year = ? AND semester = ? ORDER BY id DESC LIMIT 1`,
      [academicYear, semester],
      (err, row) => {
        if (err || !row) {
          resolve({ start_date: null, end_date: null });
        } else {
          resolve({ start_date: row.start_date || null, end_date: row.end_date || null });
        }
      }
    );
  });
}

/**
 * Save a single category record (UPSERT: Insert or Update).
 * If target is null, it resolves the correct target from the database (ipcr_records or user_targets).
 */
async function saveIPCR(userId, category, accomplished, target = null, academicYear, semester) {
  const uid = parseInt(userId, 10) || userId;
  const dbCategory = categoryMap[category] || category;
  const computeKey = categoryKeyMap[dbCategory] || category;
  const year = academicYear || DEFAULT_ACADEMIC_YEAR;
  const sem = semester || DEFAULT_SEMESTER;

  // 1. RESOLVE TARGET
  let finalTarget = target;
  if (finalTarget === null) {
    // Check if there's already an IPCR record with a target
    const existing = await new Promise((resolve) => {
      db.get(
        `SELECT target FROM ipcr_records WHERE user_id = ? AND category = ? AND academic_year = ? AND semester = ?`,
        [uid, dbCategory, year, sem],
        (err, row) => resolve(row)
      );
    });

    if (existing?.target != null) {
      finalTarget = existing.target;
    } else {
      // Pull from user_targets
      const userTargetRow = await new Promise((resolve) => {
        db.get(
          `SELECT * FROM user_targets WHERE user_id = ? AND academic_year = ? AND semester = ?`,
          [uid, year, sem],
          (err, row) => resolve(row)
        );
      });
      // Convert camelCase key to snake_case column
      const dbColumnName = computeKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      finalTarget = userTargetRow?.[dbColumnName] ?? 5;
    }
  }

  const result = computeCategory(computeKey, accomplished, finalTarget);
  const { start_date, end_date } = await getSemesterDates(year, sem);
  const rating = Number(result.rating);

  return new Promise((resolve, reject) => {
    // 2. UPSERT Logic: Strictly exclude 'target' from the DO UPDATE clause
    const sql = `
      INSERT INTO ipcr_records 
      (user_id, category, academic_year, semester, target, accomplished, q_score, e_score, t_score, rating, submission_date, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'), ?, ?)
      ON CONFLICT(user_id, category, academic_year, semester) DO UPDATE SET
        accomplished = excluded.accomplished,
        q_score = excluded.q_score,
        e_score = excluded.e_score,
        t_score = excluded.t_score,
        rating = excluded.rating,
        submission_date = excluded.submission_date,
        start_date = COALESCE(excluded.start_date, start_date),
        end_date = COALESCE(excluded.end_date, end_date)
    `;

    const params = [
      uid, dbCategory, year, sem,
      result.target, result.accomplished,
      result.Q, result.E, result.T, rating,
      start_date, end_date
    ];

    db.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve({ success: true, data: result });
    });
  });
}

/**
 * Save multiple categories at once.
 * @param {string|number} userId
 * @param {object}        ocrResults  - { category: { accomplished, target }, ... }
 * @param {string}        [academicYear]
 * @param {string}        [semester]
 */
async function saveMultipleIPCR(userId, ocrResults, academicYear, semester) {
  const results = [];

  for (const [category, data] of Object.entries(ocrResults)) {
    const accomplished = Number(data?.accomplished) || 0;
    const target = Number(data?.target) || 0;

    const res = await saveIPCR(userId, category, accomplished, target, academicYear, semester);
    results.push(res.data);
  }

  return results;
}

module.exports = {
  saveIPCR,
  saveMultipleIPCR,
};