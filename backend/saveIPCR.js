/**
 * saveIPCR.js
 * Handles saving IPCR records into SQLite
 */

const db = require("./database");
const { computeCategory } = require("./ipcrCalculator");

const DEFAULT_ACADEMIC_YEAR = "2023-2024";
const DEFAULT_SEMESTER = "1st";

// Category map (ML/key → DB display name)
const categoryMap = {
  syllabus: "Syllabus",
  courseGuide: "Course Guide",
  slm: "SLM",
  gradingSheet: "Grading Sheet",
  tos: "TOS",
};

// Reverse map (DB name → key) for computeCategory
const categoryKeyMap = {
  Syllabus: "syllabus",
  "Course Guide": "courseGuide",
  SLM: "slm",
  "Grading Sheet": "gradingSheet",
  TOS: "tos",
};

/**
 * Save a single category record (UPDATE existing row or INSERT new one so rating is always saved)
 * @param {string} userId
 * @param {string} category - ML key (syllabus, courseGuide, ...) or DB name (Syllabus, Course Guide, ...)
 * @param {number} accomplished
 * @param {number} target
 */
function saveIPCR(userId, category, accomplished, target = 0) {
  const uid = parseInt(userId, 10) || userId;
  const dbCategory = categoryMap[category] || category;
  const computeKey = categoryKeyMap[dbCategory] || category;

  const numericTarget = Number(target);
  const targetOverride = numericTarget > 0 ? numericTarget : undefined;

  // If no target was set yet, computeCategory will fall back to DEFAULT_TARGETS.
  // We then persist that computed target so rating is meaningful (non-zero).
  const result = computeCategory(computeKey, accomplished, targetOverride);

  const rating = Number(result.rating);
  const updateParams = [
    result.target,
    result.accomplished,
    result.Q,
    result.E,
    result.T,
    rating,
    uid,
    dbCategory,
    DEFAULT_ACADEMIC_YEAR,
    DEFAULT_SEMESTER,
  ];

  return new Promise((resolve, reject) => {
    const updateSql = `
      UPDATE ipcr_records
      SET target = ?, accomplished = ?, q_score = ?, e_score = ?, t_score = ?, rating = ?, submission_date = DATE('now')
      WHERE user_id = ? AND category = ? AND academic_year = ? AND semester = ?
    `;
    db.run(updateSql, updateParams, function (err) {
      if (err) return reject(err);
      if (this.changes > 0) return resolve({ success: true, data: result });

      // No row with default year/semester: try legacy rows (NULL year/semester) and backfill
      const legacySql = `
        UPDATE ipcr_records
        SET target = ?, accomplished = ?, q_score = ?, e_score = ?, t_score = ?, rating = ?, submission_date = DATE('now'), academic_year = ?, semester = ?
        WHERE user_id = ? AND category = ? AND (academic_year IS NULL OR academic_year = '') AND (semester IS NULL OR semester = '')
      `;
      db.run(
        legacySql,
        [result.target, result.accomplished, result.Q, result.E, result.T, rating, DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER, uid, dbCategory],
        function (err2) {
          if (err2) return reject(err2);
          if (this.changes > 0) return resolve({ success: true, data: result });

          const insertSql = `
            INSERT INTO ipcr_records
            (user_id, category, academic_year, semester, target, accomplished, q_score, e_score, t_score, rating, submission_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))
          `;
          db.run(
            insertSql,
            [uid, dbCategory, DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER, result.target, result.accomplished, result.Q, result.E, result.T, rating],
            (err3) => (err3 ? reject(err3) : resolve({ success: true, data: result })),
          );
        },
      );
    });
  });
}

/**
 * Save multiple categories
 */
async function saveMultipleIPCR(userId, ocrResults) {
  const results = [];

  for (const [category, data] of Object.entries(ocrResults)) {
    const accomplished = Number(data?.accomplished) || 0;
    const target = Number(data?.target) || 0;

    const res = await saveIPCR(userId, category, accomplished, target);
    results.push(res.data);
  }

  return results;
}

module.exports = {
  saveIPCR,
  saveMultipleIPCR,
};