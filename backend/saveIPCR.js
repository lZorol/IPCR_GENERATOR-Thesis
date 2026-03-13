/**
 * saveIPCR.js
 * Handles saving IPCR records into SQLite, scoped by academic year + semester.
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
 * Save a single category record (UPDATE existing row or INSERT new one).
 * @param {string|number} userId
 * @param {string}        category     - ML key or DB display name
 * @param {number}        accomplished
 * @param {number}        target
 * @param {string}        [academicYear]  - e.g. "2025-2026"
 * @param {string}        [semester]      - e.g. "1st Semester"
 */
function saveIPCR(userId, category, accomplished, target = 0, academicYear, semester) {
  const uid = parseInt(userId, 10) || userId;
  const dbCategory = categoryMap[category] || category;
  const computeKey = categoryKeyMap[dbCategory] || category;
  const year = academicYear || DEFAULT_ACADEMIC_YEAR;
  const sem  = semester    || DEFAULT_SEMESTER;

  const numericTarget  = Number(target);
  const targetOverride = numericTarget > 0 ? numericTarget : undefined;

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
    year,
    sem,
  ];

  return new Promise((resolve, reject) => {
    // 1) Try to update an existing row for this year/semester
    const updateSql = `
      UPDATE ipcr_records
      SET target = ?, accomplished = ?, q_score = ?, e_score = ?, t_score = ?, rating = ?, submission_date = DATE('now')
      WHERE user_id = ? AND category = ? AND academic_year = ? AND semester = ?
    `;
    db.run(updateSql, updateParams, function (err) {
      if (err) return reject(err);
      if (this.changes > 0) return resolve({ success: true, data: result });

      // 2) Try to backfill legacy rows (NULL year/semester)
      const legacySql = `
        UPDATE ipcr_records
        SET target = ?, accomplished = ?, q_score = ?, e_score = ?, t_score = ?, rating = ?,
            submission_date = DATE('now'), academic_year = ?, semester = ?
        WHERE user_id = ? AND category = ?
          AND (academic_year IS NULL OR academic_year = '')
          AND (semester IS NULL OR semester = '')
      `;
      db.run(
        legacySql,
        [result.target, result.accomplished, result.Q, result.E, result.T, rating, year, sem, uid, dbCategory],
        function (err2) {
          if (err2) return reject(err2);
          if (this.changes > 0) return resolve({ success: true, data: result });

          // 3) Insert brand new row
          const insertSql = `
            INSERT INTO ipcr_records
            (user_id, category, academic_year, semester, target, accomplished, q_score, e_score, t_score, rating, submission_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))
          `;
          db.run(
            insertSql,
            [uid, dbCategory, year, sem, result.target, result.accomplished, result.Q, result.E, result.T, rating],
            (err3) => (err3 ? reject(err3) : resolve({ success: true, data: result })),
          );
        },
      );
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
    const target       = Number(data?.target)       || 0;

    const res = await saveIPCR(userId, category, accomplished, target, academicYear, semester);
    results.push(res.data);
  }

  return results;
}

module.exports = {
  saveIPCR,
  saveMultipleIPCR,
};