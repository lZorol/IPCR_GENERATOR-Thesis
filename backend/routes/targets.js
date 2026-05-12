const express = require('express');
const router = express.Router();
const db = require('../database');
const { categoryMap } = require('../ipcrCalculator');

// Mapping from camelCase frontend keys to snake_case DB columns
const KEY_TO_COL = {
  syllabus: 'syllabus',
  courseGuide: 'course_guide',
  slm: 'slm',
  communityImmersion: 'community_immersion',
  gradingSheet: 'grading_sheet',
  tos: 'tos',
  attendanceSheet: 'attendance_sheet',
  classRecord: 'class_records',
  evaluationOfTeachingEffectiveness: 'evaluation_of_teaching_effectiveness',
  classroomObservation: 'classroom_observation',
  testQuestions: 'test_questions',
  answerKeys: 'answer_keys',
  facultyAndStudentsSeekAdvices: 'faculty_and_students_seek_advices',
  accomplishmentReport: 'accomplishment_report',
  randdProposal: 'randd_proposal',
  researchImplemented: 'research_implemented',
  researchPresented: 'research_presented',
  researchPublished: 'research_published',
  intellectualPropertyRights: 'intellectual_property_rights',
  researchUtilizedDeveloped: 'research_utilized_developed',
  numberOfCitations: 'number_of_citations',
  extentionProposal: 'extention_proposal',
  personsTrained: 'persons_trained',
  personServiceRating: 'person_service_rating',
  personGivenTraining: 'person_given_training',
  technicalAdvice: 'technical_advice',
  accomplishmentReportSupport: 'accomplishment_report_support',
  attendanceFlagCeremony: 'attendance_flag_ceremony',
  attendanceFlagLowering: 'attendance_flag_lowering',
  attendanceHealthAndWellnessProgram: 'attendance_health_and_wellness_program',
  attendanceSchoolCelebrations: 'attendance_school_celebrations',
  trainingSeminarConferenceCertificate: 'training_seminar_conference_certificate',
  atttendanceFacultyMeeting: 'atttendance_faculty_meeting',
  attendanceISOAndRelatedActivities: 'attendance_iso_and_related_activities',
  attendaceSpiritualActivities: 'attendace_spiritual_activities',
};

// Convert a DB row (snake_case) to the camelCase format expected by the frontend
function rowToTargets(row) {
  if (!row) return null;
  const result = {};
  for (const [camel, col] of Object.entries(KEY_TO_COL)) {
    result[camel] = row[col] != null ? Number(row[col]) : 5;
  }
  return result;
}

/**
 * GET /api/targets/:userId/:year/:semester
 * Returns target values for a user+period. Returns defaults (5) if none set.
 */
router.get('/targets/:userId/:year/:semester', (req, res) => {
  const { userId, year, semester } = req.params;

  db.get(
    `SELECT * FROM user_targets WHERE user_id = ? AND academic_year = ? AND semester = ?`,
    [userId, year, semester],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) {
        // No targets set yet — return defaults of 5 and signal "not set"
        const defaults = {};
        Object.keys(KEY_TO_COL).forEach(k => { defaults[k] = 5; });
        return res.json({ targets: defaults, hasTargets: false });
      }
      res.json({ targets: rowToTargets(row), hasTargets: true });
    }
  );
});

/**
 * POST /api/targets/save
 * Body: { userId, academic_year, semester, targets: { camelKey: number, ... } }
 * Upserts the user_targets row.
 */
router.post('/targets/save', (req, res) => {
  const { userId, academic_year, semester, targets } = req.body;

  if (!userId || !academic_year || !semester || !targets) {
    return res.status(400).json({ error: 'userId, academic_year, semester, and targets are required' });
  }

  // Validate: all target values must be non-negative numbers
  for (const [key, val] of Object.entries(targets)) {
    const n = Number(val);
    if (isNaN(n) || n < 0) {
      return res.status(400).json({ error: `Invalid value for ${key}: must be a non-negative number` });
    }
  }

  // Build column list + values dynamically from whitelisted keys
  const setCols = [];
  const values = [];
  for (const [camel, col] of Object.entries(KEY_TO_COL)) {
    if (targets[camel] !== undefined) {
      setCols.push(col);
      values.push(Number(targets[camel]));
    }
  }

  if (setCols.length === 0) {
    return res.status(400).json({ error: 'No valid target keys provided' });
  }

  const colList = setCols.join(', ');
  const placeholders = setCols.map(() => '?').join(', ');
  const updateClause = setCols.map(c => `${c} = excluded.${c}`).join(', ');

  const sql = `
    INSERT INTO user_targets (user_id, academic_year, semester, ${colList}, updated_at)
    VALUES (?, ?, ?, ${placeholders}, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, academic_year, semester) DO UPDATE SET
      ${updateClause},
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(sql, [userId, academic_year, semester, ...values], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // SYNC: Overwrite targets in ipcr_records. 
    // If a category is NOT automated, also update the manual accomplishment count.
    const { accomplishments } = req.body;
    const { AUTOMATED_CATEGORIES } = require('../ipcrCalculator');

    Object.entries(targets).forEach(([key, targetValue]) => {
      const category = categoryMap[key];
      if (category) {
        const isAutomated = AUTOMATED_CATEGORIES.includes(category);
        const manualAcc = accomplishments && accomplishments[key] !== undefined ? accomplishments[key] : 0;

        if (isAutomated) {
          // Automated: Update target ONLY. Accomplished is handled by document uploads.
          db.run(
            `INSERT INTO ipcr_records (user_id, category, target, accomplished, academic_year, semester)
             VALUES (?, ?, ?, 0, ?, ?)
             ON CONFLICT(user_id, category, academic_year, semester) 
             DO UPDATE SET target = excluded.target`,
            [userId, category, targetValue, academic_year, semester]
          );
        } else {
          // Manual: Update both Target AND Accomplished
          db.run(
            `INSERT INTO ipcr_records (user_id, category, target, accomplished, academic_year, semester)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, category, academic_year, semester) 
             DO UPDATE SET 
               target = excluded.target,
               accomplished = excluded.accomplished`,
            [userId, category, targetValue, manualAcc, academic_year, semester]
          );
        }
      }
    });

    res.json({ success: true, id: this.lastID });
  });
});

module.exports = router;
module.exports.KEY_TO_COL = KEY_TO_COL;
module.exports.rowToTargets = rowToTargets;
