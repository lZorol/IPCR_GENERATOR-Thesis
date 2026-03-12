const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const db = require("../database");
const { computeCategory } = require("../ipcrCalculator");
const DefaultTarget = require("../../shared/defaultTarget.json");

const TEMPLATE_PATH = path.resolve(__dirname, "Template.xlsx");
const DEFAULT_ACADEMIC_YEAR = "2023-2024";

/**
 * 1. EASY CONFIGURATION AREA
 */
const META_DATA_MAPPING = [
  { key: "name", cell: "A13", format: "{{val.upper}}" },
  { key: "name", cell: "A6", format: "I, {{val}}, Instructor III of the Laguna State Polytechnic University, commit to deliver and agree to be rated on the attainment of the" },
  { key: "department", cell: "A14", format: "{{val.upper}}" }
];

// Added 'dateCell' to map the submission_date for each category
const CELL_MAPPING = {
  syllabus:     { target: "B19", accomplished: "C19", Q: "F19", E: "G19", T: "H19", rating: "I19", dateCell: "E19" },
  courseGuide:  { target: "B20", accomplished: "C20", Q: "F20", E: "G20", T: "H20", rating: "I20", dateCell: "E20" },
  slm:          { target: "B21", accomplished: "C21", Q: "F21", E: "G21", T: "H21", rating: "I21", dateCell: "E21" },
  tos:          { target: "B30", accomplished: "C30", Q: "F30", E: "G30", T: "H30", rating: "I30", dateCell: "E30" },
  gradingSheet: { target: "B34", accomplished: "C34", Q: "F34", E: "G34", T: "H34", rating: "I34", dateCell: "E34" },
};

const DB_CATEGORY_TO_KEY = {
  Syllabus: "syllabus", "Course Guide": "courseGuide", SLM: "slm", TOS: "tos", "Grading Sheet": "gradingSheet"
};

async function exportIPCRToExcel(userId) {
  const workbook = new ExcelJS.Workbook();
  if (!fs.existsSync(TEMPLATE_PATH)) throw new Error(`Template not found at ${TEMPLATE_PATH}`);
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const worksheet = workbook.getWorksheet("IPCR") || workbook.worksheets[0];

  const uid = parseInt(userId, 10) || userId;

  // 2. FETCH USER DETAILS
  const user = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE id = ?", [uid], (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });

  // 3. FETCH IPCR RECORDS
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT category, target, accomplished, q_score, e_score, t_score, rating, submission_date 
       FROM ipcr_records 
       WHERE user_id = ? AND (academic_year = ? OR academic_year IS NULL OR academic_year = '')`,
      [uid, DEFAULT_ACADEMIC_YEAR],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });

  // 4. FILL CUSTOM META DATA
  if (user) {
    META_DATA_MAPPING.forEach(item => {
      const dbValue = (user[item.key] || "").toString();
      let finalString = item.format;
      finalString = finalString.replace("{{val.upper}}", dbValue.toUpperCase());
      finalString = finalString.replace("{{val}}", dbValue);
      worksheet.getCell(item.cell).value = finalString;
    });
  }

  // 5. FILL CATEGORY DATA
  const byKey = {};
  rows.forEach((r) => {
    const key = DB_CATEGORY_TO_KEY[r.category];
    if (key) byKey[key] = r;
  });

  Object.keys(CELL_MAPPING).forEach((key) => {
    const map = CELL_MAPPING[key];
    const r = byKey[key];
    
    const target = r?.target != null ? Number(r.target) : Number(DefaultTarget[key] || 0);
    const accomplished = r?.accomplished != null ? Number(r.accomplished) : 0;
    const computed = computeCategory(key, accomplished, target);

    worksheet.getCell(map.target).value = target;
    worksheet.getCell(map.accomplished).value = accomplished;
    worksheet.getCell(map.Q).value = r?.q_score != null ? Number(r.q_score) : computed.Q;
    worksheet.getCell(map.E).value = r?.e_score != null ? Number(r.e_score) : computed.E;
    worksheet.getCell(map.T).value = r?.t_score != null ? Number(r.t_score) : computed.T;
    worksheet.getCell(map.rating).value = r?.rating != null ? Number(r.rating) : computed.rating;
    
    // Fill submission date if it exists and a cell is mapped
    if (r?.submission_date && map.dateCell) {
      worksheet.getCell(map.dateCell).value = r.submission_date;
    }
  });

  return await workbook.xlsx.writeBuffer();
}

module.exports = { exportIPCRToExcel };