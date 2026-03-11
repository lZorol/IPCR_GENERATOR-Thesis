const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const TEMPLATE_PATH = path.resolve(__dirname, 'Template.xlsx');

// Keep consistent with backend/saveIPCR.js and backend/server.js defaults
const DEFAULT_ACADEMIC_YEAR = '2023-2024';
const DEFAULT_SEMESTER = '1st';

const CELL_MAPPING = {

  syllabus: {
    target: 'B19',
    accomplished: 'C19',
    Q: 'D19',
    E: 'E19',
    T: 'F19',
    rating: 'G19'
  },

  courseGuide: {
    target: 'B20',
    accomplished: 'C20',
    Q: 'D20',
    E: 'E20',
    T: 'F20',
    rating: 'G20'
  },

  slm: {
    target: 'B21',
    accomplished: 'C21',
    Q: 'D21',
    E: 'E21',
    T: 'F21',
    rating: 'G21'
  },

  tos: {
    target: 'B30',
    accomplished: 'C30',
    Q: 'D30',
    E: 'E30',
    T: 'F30',
    rating: 'G30'
  },

  gradingSheet: {
    target: 'B34',
    accomplished: 'C34',
    Q: 'D34',
    E: 'E34',
    T: 'F34',
    rating: 'G34'
  }

};

// DB display name -> internal key used by CELL_MAPPING
const DB_CATEGORY_TO_KEY = {
  Syllabus: 'syllabus',
  'Course Guide': 'courseGuide',
  SLM: 'slm',
  TOS: 'tos',
  'Grading Sheet': 'gradingSheet',
};

async function exportIPCRToExcel(userId) {

  const workbook = new ExcelJS.Workbook();

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template not found at ${TEMPLATE_PATH}`);
  }

  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const worksheet = workbook.getWorksheet('IPCR') || workbook.worksheets[0];

  const uid = parseInt(userId, 10) || userId;

  const rows = await new Promise((resolve, reject) => {

    db.all(`
      SELECT category,
             target,
             accomplished,
             q_score,
             e_score,
             t_score,
             rating
      FROM ipcr_records
      WHERE user_id = ?
        AND (academic_year = ? OR academic_year IS NULL OR academic_year = '')
        AND (semester = ? OR semester IS NULL OR semester = '')
    `,
    [uid, DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER],
    (err, rows) => {

      if (err) reject(err);
      else resolve(rows);

    });

  });

  rows.forEach(r => {

    const key = DB_CATEGORY_TO_KEY[r.category] || r.category;
    const map = CELL_MAPPING[key];

    if (!map) return;

    worksheet.getCell(map.target).value = r.target;
    worksheet.getCell(map.accomplished).value = r.accomplished;

    worksheet.getCell(map.Q).value = r.q_score;
    worksheet.getCell(map.E).value = r.e_score;
    worksheet.getCell(map.T).value = r.t_score;

    worksheet.getCell(map.rating).value = r.rating;

  });

  return await workbook.xlsx.writeBuffer();
}

module.exports = { exportIPCRToExcel };