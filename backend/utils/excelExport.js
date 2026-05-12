const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const db = require("../database");
const { computeCategory } = require("../ipcrCalculator");

function getQuarter(dateString) {
  const month = new Date(dateString).getMonth(); // 0-11
  if (month <= 2) return '1';
  if (month <= 5) return '2';
  if (month <= 8) return '3';
  return '4';
}

const TEMPLATE_PATH = path.resolve(__dirname, "Template.xlsx");

/**
 * HELPER: Generates cell addresses for a row to avoid repetition.
 * Columns: Target(B), Acc(C), Date(D), SubDate(E), Q(F), E(G), T(H), Rating(I), Link(J)
 */
const mapRow = (row, dateType = "end") => ({
  target: `B${row}`,
  accomplished: `C${row}`,
  dateCell: `D${row}`,
  submissionDate: `E${row}`,
  Q: `F${row}`,
  E: `G${row}`,
  T: `H${row}`,
  rating: `I${row}`,
  folderLink: `J${row}`,
  dateType: dateType // "start" or "end"
});

/**
 * META DATA MAPPING
 */
const META_DATA_MAPPING = [
  { key: "name", cell: "A13", format: "{{val.upper}}" },
  { key: "period", cell: "A7", format: " following  in accordance with the indicated measures for the {{val}}" },
];

/**
 * CELL MAPPING - Organized by row number
 */
const CELL_MAPPING = {
  syllabus: mapRow(19, "start"),
  courseGuide: mapRow(20, "start"),
  slm: mapRow(21, "start"),
  communityImmersion: mapRow(22, "start"),
  attendanceSheet: mapRow(24, "end"),
  classRecord: mapRow(25, "end"),
  evaluationOfTeachingEffectiveness: mapRow(27, "end"),
  classroomObservation: mapRow(28, "end"),
  tos: mapRow(30, "end"),
  testQuestions: mapRow(31, "end"),
  answerKeys: mapRow(32, "end"),
  gradingSheet: mapRow(34, "end"),
  facultyAndStudentsSeekAdvices: mapRow(36, "end"),
  accomplishmentReport: mapRow(38, "end"),
  randdProposal: mapRow(41, "end"),
  researchImplemented: mapRow(42, "end"),
  researchPresented: mapRow(43, "end"),
  researchPublished: mapRow(44, "end"),
  intellectualPropertyRights: mapRow(45, "end"),
  researchUtilizedDeveloped: mapRow(46, "end"),
  numberOfCitations: mapRow(47, "end"),
  extentionProposal: mapRow(50, "end"),
  personsTrained: mapRow(51, "end"),
  personServiceRating: mapRow(52, "end"),
  personGivenTraining: mapRow(53, "end"),
  technicalAdvice: mapRow(54, "end"),
  accomplishmentReportSupport: mapRow(57, "end"),
  attendanceFlagCeremony: mapRow(59, "end"),
  attendanceFlagLowering: mapRow(61, "end"),
  attendanceHealthAndWellnessProgram: mapRow(63, "end"),
  attendanceSchoolCelebrations: mapRow(65, "end"),
  trainingSeminarConferenceCertificate: mapRow(67, "end"),
  atttendanceFacultyMeeting: mapRow(69, "end"),
  attendanceISOAndRelatedActivities: mapRow(71, "end"),
  attendaceSpiritualActivities: mapRow(73, "end"),
};

const DB_CATEGORY_TO_KEY = {
  Syllabus: "syllabus",
  "Course Guide": "courseGuide",
  SLM: "slm",
  "Community Immersion": "communityImmersion",
  TOS: "tos",
  "Grading Sheet": "gradingSheet",
  "Attendance Sheet": "attendanceSheet",
  "Class Records": "classRecord",
  "Evaluation of Teaching Effectiveness": "evaluationOfTeachingEffectiveness",
  "Classroom Observation": "classroomObservation",
  "Test Questions": "testQuestions",
  "Answer Keys": "answerKeys",
  "Faculty and Students Seek Advices": "facultyAndStudentsSeekAdvices",
  "Accomplishment Report": "accomplishmentReport",
  "R&D Proposal": "randdProposal",
  "Research Implemented": "researchImplemented",
  "Research Presented": "researchPresented",
  "Research Published": "researchPublished",
  "Intellectual Property Rights": "intellectualPropertyRights",
  "Research Utilized/Developed": "researchUtilizedDeveloped",
  "Number of Citations": "numberOfCitations",
  "Extension Proposal": "extentionProposal",
  "Persons Trained": "personsTrained",
  "Person Service Rating": "personServiceRating",
  "Person Given Training": "personGivenTraining",
  "Technical Advice": "technicalAdvice",
  "Accomplishment Report (Support)": "accomplishmentReportSupport",
  "Attendance Flag Ceremony": "attendanceFlagCeremony",
  "Attendance Flag Lowering": "attendanceFlagLowering",
  "Attendance Health and Wellness Program": "attendanceHealthAndWellnessProgram",
  "Attendance School Celebrations": "attendanceSchoolCelebrations",
  "Training/Seminar/Conference Certificate": "trainingSeminarConferenceCertificate",
  "Attendance Faculty Meeting": "atttendanceFacultyMeeting",
  "Attendance ISO and Related Activities": "attendanceISOAndRelatedActivities",
  "Attendance Spiritual Activities": "attendaceSpiritualActivities",
};

async function exportIPCRToExcel(userId, academicYear, semester) {
  const workbook = new ExcelJS.Workbook();
  if (!fs.existsSync(TEMPLATE_PATH)) throw new Error(`Template not found at ${TEMPLATE_PATH}`);

  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const worksheet = workbook.getWorksheet("IPCR") || workbook.worksheets[0];

  const uid = parseInt(userId, 10) || userId;

  // 1. FETCH SEMESTER CONFIG (Fallback for global dates)
  const config = await new Promise((resolve) => {
    db.get(
      `SELECT academic_year, semester, start_date, end_date FROM semester_config WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
      (err, row) => resolve(row || { academic_year: "2025-2026", semester: "1st Semester" })
    );
  });

  const activeYear = academicYear || config.academic_year;
  const activeSem = semester || config.semester;

  // 2. FETCH DATA IN PARALLEL
  const [user, records, userTargetRow, summaries, docLinks] = await Promise.all([
    new Promise(res => db.get(`SELECT u.*, COALESCE(up.name, u.name) as display_name, COALESCE(up.department, u.department) as display_department, up.position FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = ?`, [uid], (err, row) => res(row))),
    new Promise(res => db.all(`SELECT * FROM ipcr_records WHERE user_id = ? AND academic_year = ? AND semester = ?`, [uid, activeYear, activeSem], (err, rows) => res(rows || []))),
    new Promise(res => db.get(`SELECT * FROM user_targets WHERE user_id = ? AND academic_year = ? AND semester = ?`, [uid, activeYear, activeSem], (err, row) => res(row))),
    new Promise(res => db.get(`SELECT overall_rating FROM ipcr_summaries WHERE user_id = ? AND academic_year = ? AND semester = ?`, [uid, activeYear, activeSem], (err, row) => res(row))),
    new Promise(res => db.all(`SELECT category, google_drive_link FROM documents WHERE user_id = ? AND academic_year = ? AND semester = ? GROUP BY category`, [uid, activeYear, activeSem], (err, rows) => res(rows || [])))
  ]);

  // Index records by key
  const recordsByKey = {};
  records.forEach(r => {
    const key = DB_CATEGORY_TO_KEY[r.category];
    if (key) recordsByKey[key] = r;
  });

  // Index doc links by key
  const linksByKey = {};
  docLinks.forEach(dl => {
    const key = DB_CATEGORY_TO_KEY[dl.category];
    if (key) linksByKey[key] = dl.google_drive_link;
  });

  // 3. SET METADATA
  if (user) {
    const metaUser = {
      name: user.display_name || user.name,
      department: user.display_department || user.department,
      period: `${activeSem} of Academic Year ${activeYear}`,
    };
    META_DATA_MAPPING.forEach((item) => {
      const dbValue = (metaUser[item.key] || "").toString();
      let finalString = item.format
        .replace("{{val.upper}}", dbValue.toUpperCase())
        .replace("{{val}}", dbValue);
      worksheet.getCell(item.cell).value = finalString;
    });

    // 3.5 Dynamic Commitment Statement (Cell A6)
    const rank = user.position || 'Instructor';
    const userName = (user.display_name || user.name || 'FACULTY').toUpperCase();
    worksheet.getCell('A6').value = `I, ${userName}, - ${rank} of the Laguna State Polytechnic University, commit to deliver and agree to be rated on the attainment of the `;
  }

  // 4. POPULATE ROWS
  Object.keys(CELL_MAPPING).forEach((key) => {
    const map = CELL_MAPPING[key];
    const r = recordsByKey[key];

    // TARGET LOGIC: DB Record -> user_targets table -> Hard Default (5)
    // Converts camelCase to snake_case to match user_targets columns
    const dbColumnName = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    const rawTarget = r?.target ?? userTargetRow?.[dbColumnName];
    const target = (rawTarget != null && Number(rawTarget) > 0) ? Number(rawTarget) : 5;

    const accomplished = Number(r?.accomplished) || 0;

    // DYNAMIC CALCULATION: Compute Q, E, T, A on the fly for Excel
    const safeTarget = Number(target) > 0 ? Number(target) : 5;
    const acc = Number(accomplished) || 0;

    // Explicitly declared baseRating with 1-5 bounds
    let baseRating = Math.max(1, Math.min(5, (acc / safeTarget) * 5));

    const qty = baseRating;
    const qle = baseRating;
    const timeliness = baseRating;
    const average = (qty + qle + timeliness) / 3;

    // Strict Sanitization to prevent Excel corruption (NaN/Infinity)
    worksheet.getCell(map.target).value = Number(target) || 5;
    worksheet.getCell(map.accomplished).value = Number(accomplished) || 0;

    // Assign dynamic Q, E, T, A values
    worksheet.getCell(map.Q).value = Number(qty.toFixed(2));
    worksheet.getCell(map.E).value = Number(qle.toFixed(2));
    worksheet.getCell(map.T).value = Number(timeliness.toFixed(2));
    worksheet.getCell(map.rating).value = Number(average.toFixed(2));

    // DATE LOGIC: DB Record -> Global Semester Config -> Empty
    if (map.dateCell) {
      const recordDate = map.dateType === "start" ? r?.start_date : r?.end_date;
      const globalDate = map.dateType === "start" ? config.start_date : config.end_date;
      worksheet.getCell(map.dateCell).value = recordDate || globalDate || "";
    }

    if (map.submissionDate) worksheet.getCell(map.submissionDate).value = r?.submission_date || "";
    
    // Fill GDrive Link (Priority: documents table > existing link)
    const folderLink = linksByKey[key] || r?.folder_link || "";
    if (map.folderLink) worksheet.getCell(map.folderLink).value = folderLink;
  });

  // 5. FINAL RATING (Source of Truth)
  // We use the formula from the template as requested, but update the fallback to match 72/4/4/20
  if (summaries && summaries.overall_rating) {
    // We still write the result for display, but keep the formula capability if template allows
    worksheet.getCell("H85").value = {
      formula: 'IFERROR((AVERAGE(I19:I22,I24:I25,I27:I28,I30:I32,I34,I36,I38))*0.72+(AVERAGE(I41:I47))*0.04+(AVERAGE(I50:I54))*0.04+(AVERAGE(I57,I59,I61,I63,I65,I67,I69,I71,I73))*0.20, 1.00)',
    };
  } else {
    // Original template formula using named ranges
    worksheet.getCell("H85").value = {
      formula: 'IFERROR((AVERAGE(I19:I22,I24:I25,I27:I28,I30:I32,I34,I36,I38))*INS+(AVERAGE(I41:I47))*RES+(AVERAGE(I50:I54))*EXT+(AVERAGE(I57,I59,I61,I63,I65,I67,I69,I71,I73))*SUPT+IFERROR((AVERAGE(I76:I83))*DGT,0),"")',
    };
  }
  worksheet.getCell("H85").result = summaries?.overall_rating || null;

  // ---------------------------------------------------------
  // FINAL CELL OVERRIDES (MUST BE PLACED IMMEDIATELY BEFORE writeBuffer)
  // ---------------------------------------------------------
  const fetchedUserName = (user?.display_name || user?.name || 'Name Not Found in DB').toUpperCase();

  // 1. Dynamic Commitment Statement (Cell A7)
  worksheet.getCell('A7').value = `following in accordance with the indicated measures for the ${activeSem} of Academic Year ${activeYear}`;

  // 2. User Name in Header (Cell A13)
  worksheet.getCell('A13').value = fetchedUserName;

  // 3. User Name in Footer/Signatures (Cell A87)
  worksheet.getCell('A87').value = fetchedUserName;
  // ---------------------------------------------------------

  return await workbook.xlsx.writeBuffer();
}

async function exportManualAccomplishmentsToExcel(academicYear, semester) {
  const workbook = new ExcelJS.Workbook();
  const template2Path = path.resolve(__dirname, "Template2.xlsx");

  if (fs.existsSync(template2Path)) {
    await workbook.xlsx.readFile(template2Path);
  } else {
    // Fallback: Create sheets if template doesn't exist
    workbook.addWorksheet("1st Quarter");
    workbook.addWorksheet("2nd Quarter");
    workbook.addWorksheet("3rd Quarter");
    workbook.addWorksheet("4th Quarter");
    workbook.addWorksheet("Research");
    workbook.addWorksheet("Extension");
    workbook.addWorksheet("List of Extension");
  }

  // Helper to find the "partner" semester in the same calendar year.
  const getCalendarYearPartners = (ay, sem) => {
    if (!ay) return [];
    const parts = ay.split('-');
    if (parts.length < 2) return [{ year: ay, sem: sem }];
    const y1 = parseInt(parts[0]);
    const y2 = parseInt(parts[1]);
    if (sem && sem.includes('2nd')) {
      return [{ year: ay, sem: sem }, { year: `${y2}-${y2 + 1}`, sem: '1st Semester' }];
    } else {
      return [{ year: ay, sem: sem }, { year: `${y1 - 1}-${y1}`, sem: '2nd Semester' }];
    }
  };

  const partners = getCalendarYearPartners(academicYear, semester);
  const conditions = partners.map(() => "(fa.academic_year = ? AND fa.semester = ?)").join(" OR ");
  const queryParams = [];
  partners.forEach(p => { queryParams.push(p.year); queryParams.push(p.sem); });

  const records = await new Promise((resolve, reject) => {
    db.all(
      `SELECT fa.*, u.name as participants, u.is_regular_faculty 
       FROM faculty_accomplishments fa
       JOIN users u ON fa.user_id = u.id
       WHERE (${conditions})`,
      queryParams,
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });

  const historicalExtensionRecords = await new Promise((resolve, reject) => {
    db.all(
      `SELECT fa.*, u.name as participants, u.is_regular_faculty 
       FROM faculty_accomplishments fa
       JOIN users u ON fa.user_id = u.id
       WHERE fa.accomplishment_category = 'List of Extension'
       ORDER BY fa.date ASC`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });

  const allRegularFaculty = await new Promise((resolve, reject) => {
    db.all(
      `SELECT id, name FROM users WHERE is_regular_faculty = 1 ORDER BY name ASC`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });

  // Dynamic Year Parsing
  const years = (academicYear || "2025-2026").split('-');
  const startYear = parseInt(years[0], 10);
  const endYear = years.length > 1 ? parseInt(years[1], 10) : startYear + 1;

  // Determine computedYear (for Q22)
  let computedYear = startYear;
  if (semester === '2nd Semester' || semester === '2nd') {
    computedYear = endYear;
  }

  // Robust getQuarter helper for Excel
  const getQuarter = (dateString) => {
    if (!dateString) return 1;
    const cleanDate = dateString.includes(' - ') ? dateString.split(' - ')[0] : dateString;
    let dateObj = new Date(cleanDate);
    if (isNaN(dateObj.getTime()) || (cleanDate.includes('/') && !cleanDate.includes('-'))) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[0], 10) - 1;
        const d = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        const fallbackDate = new Date(y, m, d);
        if (!isNaN(fallbackDate.getTime())) dateObj = fallbackDate;
      }
    }
    if (isNaN(dateObj.getTime())) return 1;
    const month = dateObj.getMonth();
    if (month <= 2) return 1;
    if (month <= 5) return 2;
    if (month <= 8) return 3;
    return 4;
  };

  // Calculate the Left and Right School Years
  const leftSchoolYear = `${computedYear - 1}-${computedYear}`;
  const rightSchoolYear = `${computedYear}-${computedYear + 1}`;

  // Helper for Headers
  const setHeader = (ws, cell, text) => {
    if (!ws) return;
    const c = ws.getCell(cell);
    c.value = text;
    c.font = { name: 'Poppins', bold: true };
  };

  // Sheet 1 to 4 Headers
  setHeader(workbook.worksheets[0], "A1", `COLLEGE OF COMPUTER STUDIES\nSanta Cruz Campus\nJANUARY TO MARCH ${computedYear}\nFACULTY SEMINAR, CONFERENCE AND TRAINING`);
  setHeader(workbook.worksheets[1], "A1", `COLLEGE OF COMPUTER STUDIES\nSanta Cruz Campus\nAPRIL TO JUNE ${computedYear}\nFACULTY SEMINAR, CONFERENCE AND TRAINING`);
  setHeader(workbook.worksheets[2], "A1", `COLLEGE OF COMPUTER STUDIES\nSanta Cruz Campus\nJULY TO SEPTEMBER ${computedYear}\nFACULTY SEMINAR, CONFERENCE AND TRAINING`);
  setHeader(workbook.worksheets[3], "A1", `COLLEGE OF COMPUTER STUDIES\nSanta Cruz Campus\nOCTOBER TO DECEMBER ${computedYear}\nFACULTY SEMINAR, CONFERENCE AND TRAINING`);

  // Sheet 5 Headers (Research)
  const ws5 = workbook.worksheets[4];
  setHeader(ws5, "A20", `${computedYear} CCS Accomplishment Report`);

  // Sheet 6 Headers (Extension)
  const ws6 = workbook.worksheets[5];
  setHeader(ws6, "A1", `CCS Extension and Services Target ${computedYear} - Santa Cruz`);
  setHeader(ws6, "A2", `${computedYear} EXTENSION TARGET`);
  setHeader(ws6, "C22", `2nd Semester A Y: ${leftSchoolYear}`);
  setHeader(ws6, "G23", `2nd Semester A Y: ${leftSchoolYear}`);
  setHeader(ws6, "J22", `1st Semester A Y: ${rightSchoolYear}`);
  setHeader(ws6, "N23", `1st Semester A Y: ${rightSchoolYear}`);
  setHeader(ws6, "Q22", computedYear.toString());

  // Loop records to populate Quarters
  records.forEach(record => {
    if (!record.date || record.accomplishment_category === 'Research' || record.accomplishment_category === 'Extension' || record.accomplishment_category === 'List of Extension') return;

    const qNum = getQuarter(record.date);
    const suffixes = ["", "st", "nd", "rd", "th"];
    const sheetName = `${qNum}${suffixes[qNum]} Quarter`;

    const ws = workbook.getWorksheet(sheetName) || workbook.worksheets[qNum - 1];
    if (ws) {
      if (!ws.nextRowIndex) ws.nextRowIndex = 3;

      const row = ws.getRow(ws.nextRowIndex);
      row.values = [
        record.title,
        record.date,
        record.venue,
        record.participants,
        record.scope,
        record.hours,
        record.sponsored_by,
        record.gdrive_link,
        record.research_related
      ];
      row.commit();
      ws.nextRowIndex += 1;
    }
  });

  // Data Mapping for Research (Sheet 5)
  if (ws5) {
    const researchRecords = records.filter(r => r.accomplishment_category === 'Research');

    // Write global targets from the LATEST record that has them
    const researchGlobalRecords = researchRecords.filter(r => r.target_presentation != null || r.target_publication != null);
    const globalOpts = researchGlobalRecords.sort((a, b) => b.id - a.id)[0] || {};

    ws5.getCell('B2').value = Number(globalOpts.target_presentation) || 0;
    ws5.getCell('B3').value = Number(globalOpts.target_publication) || 0;
    ws5.getCell('B4').value = Number(globalOpts.target_utilized) || 0;
    ws5.getCell('F2').value = Number(globalOpts.acc_presentation) || 0;
    ws5.getCell('F3').value = Number(globalOpts.acc_publication) || 0;
    ws5.getCell('F4').value = Number(globalOpts.acc_utilized) || 0;

    // Apply styling to global targets
    ['B2', 'B3', 'B4', 'F2', 'F3', 'F4'].forEach(cellAddr => {
      const c = ws5.getCell(cellAddr);
      c.font = { name: 'Poppins', bold: true };
    });

    // Dynamic user columns initialized with ALL regular faculty
    const usersData = {};
    allRegularFaculty.forEach(f => {
      usersData[f.id] = {
        name: (f.name || "").toUpperCase(),
        stat_proposal: 0, stat_completed: 0, stat_presented: 0,
        stat_ip_rights: 0, stat_utilized: 0, stat_citations: 0
      };
    });

    researchRecords.forEach(r => {
      if (r.is_regular_faculty === 1 && usersData[r.user_id]) {
        usersData[r.user_id].stat_proposal += (r.stat_proposal || 0);
        usersData[r.user_id].stat_completed += (r.stat_completed || 0);
        usersData[r.user_id].stat_presented += (r.stat_presented || 0);
        usersData[r.user_id].stat_ip_rights += (r.stat_ip_rights || 0);
        usersData[r.user_id].stat_utilized += (r.stat_utilized || 0);
        usersData[r.user_id].stat_citations += (r.stat_citations || 0);
      }
    });

    let colIndex = 2; // Column B (index 2)
    Object.values(usersData).forEach(uData => {
      ws5.getRow(6).getCell(colIndex).value = uData.name;
      ws5.getRow(6).getCell(colIndex).font = { name: 'Poppins', bold: true };

      ws5.getRow(7).getCell(colIndex).value = uData.stat_proposal;
      ws5.getRow(8).getCell(colIndex).value = uData.stat_completed;
      ws5.getRow(9).getCell(colIndex).value = uData.stat_presented;
      ws5.getRow(10).getCell(colIndex).value = uData.stat_ip_rights;
      ws5.getRow(11).getCell(colIndex).value = uData.stat_utilized;
      ws5.getRow(12).getCell(colIndex).value = uData.stat_citations;

      for (let i = 7; i <= 12; i++) {
        ws5.getRow(i).getCell(colIndex).font = { name: 'Poppins', size: 16, bold: true };
      }
      colIndex++;
    });

    // Write totals
    ws5.getRow(6).getCell(colIndex).value = "TOTAL";
    ws5.getRow(6).getCell(colIndex).font = { name: 'Poppins', bold: true };
    for (let rIdx = 7; rIdx <= 12; rIdx++) {
      let rowSum = 0;
      let tempCol = 2;
      Object.values(usersData).forEach(() => {
        rowSum += Number(ws5.getRow(rIdx).getCell(tempCol).value) || 0;
        tempCol++;
      });
      ws5.getRow(rIdx).getCell(colIndex).value = rowSum;
      ws5.getRow(rIdx).getCell(colIndex).font = { name: 'Poppins', size: 16, bold: true };
    }

    // Admin Inputs mapping to B17, C17, D17
    const adminRecord = researchRecords.find(r => r.admin_scopus != null || r.admin_rg != null || r.admin_gs != null);
    if (adminRecord) {
      if (adminRecord.admin_scopus != null) ws5.getCell('B17').value = adminRecord.admin_scopus;
      if (adminRecord.admin_rg != null) ws5.getCell('C17').value = adminRecord.admin_rg;
      if (adminRecord.admin_gs != null) ws5.getCell('D17').value = adminRecord.admin_gs;
    }
  }

  // Data Mapping for Extension (Sheet 6)
  if (ws6) {
    // Find the LATEST global Extension record (sorting by date or choosing the first if already sorted)
    const extRecords = records.filter(r => r.accomplishment_category === 'Extension' && r.totalExtensionTarget != null);
    // Sort by id DESC to get the latest if not already sorted
    const extRecord = extRecords.sort((a, b) => b.id - a.id)[0];

    if (extRecord) {
      console.log('--- EXPORT DEBUG: EXTENSION GLOBAL RECORD FOUND ---');
      console.log('ID:', extRecord.id, 'Target:', extRecord.totalExtensionTarget);

      const totalTarget = Number(extRecord.totalExtensionTarget) || 0;
      ws6.getCell('C2').value = totalTarget;

      const qTarget = Math.ceil(totalTarget / 4);
      ['C8', 'E8', 'G8', 'I8'].forEach(cell => ws6.getCell(cell).value = qTarget);
      ws6.getCell('K8').value = qTarget * 4;

      ['A16', 'C16', 'F16', 'H16'].forEach(cell => ws6.getCell(cell).value = `Target: ${qTarget}`);

      const parseJSON = (str) => { try { return JSON.parse(str); } catch (e) { return {}; } };
      const r7 = parseJSON(extRecord.active_partnerships_data);
      const r8 = parseJSON(extRecord.trainees_accomplishment_data);
      const r9 = parseJSON(extRecord.extension_programs_data);

      console.log('Parsed Row 7:', r7);
      console.log('Parsed Row 8:', r8);
      console.log('Parsed Row 9:', r9);

      // Row 7
      ws6.getCell('C7').value = Number(r7.tq1) || 0; ws6.getCell('D7').value = Number(r7.aq1) || 0;
      ws6.getCell('E7').value = Number(r7.tq2) || 0; ws6.getCell('F7').value = Number(r7.aq2) || 0;
      ws6.getCell('G7').value = Number(r7.tq3) || 0; ws6.getCell('H7').value = Number(r7.aq3) || 0;
      ws6.getCell('I7').value = Number(r7.tq4) || 0; ws6.getCell('J7').value = Number(r7.aq4) || 0;
      ws6.getCell('K7').value = (Number(r7.tq1) || 0) + (Number(r7.tq2) || 0) + (Number(r7.tq3) || 0) + (Number(r7.tq4) || 0);
      ws6.getCell('L7').value = (Number(r7.aq1) || 0) + (Number(r7.aq2) || 0) + (Number(r7.aq3) || 0) + (Number(r7.aq4) || 0);

      // Row 8
      ws6.getCell('D8').value = Number(r8.aq1) || 0; ws6.getCell('F8').value = Number(r8.aq2) || 0;
      ws6.getCell('H8').value = Number(r8.aq3) || 0; ws6.getCell('J8').value = Number(r8.aq4) || 0;
      ws6.getCell('L8').value = (Number(r8.aq1) || 0) + (Number(r8.aq2) || 0) + (Number(r8.aq3) || 0) + (Number(r8.aq4) || 0);

      // Row 9
      ws6.getCell('C9').value = Number(r9.tq1) || 0; ws6.getCell('D9').value = Number(r9.aq1) || 0;
      ws6.getCell('E9').value = Number(r9.tq2) || 0; ws6.getCell('F9').value = Number(r9.aq2) || 0;
      ws6.getCell('G9').value = Number(r9.tq3) || 0; ws6.getCell('H9').value = Number(r9.aq3) || 0;
      ws6.getCell('I9').value = Number(r9.tq4) || 0; ws6.getCell('J9').value = Number(r9.aq4) || 0;
      ws6.getCell('K9').value = (Number(r9.tq1) || 0) + (Number(r9.tq2) || 0) + (Number(r9.tq3) || 0) + (Number(r9.tq4) || 0);
      ws6.getCell('L9').value = (Number(r9.aq1) || 0) + (Number(r9.aq2) || 0) + (Number(r9.aq3) || 0) + (Number(r9.aq4) || 0);

      // Rank-Based Targets
      const totalFaculty = allRegularFaculty.length;
      const baseQuotient = totalFaculty > 0 ? totalTarget / totalFaculty : 0;
      const calcTarget = (multiplier) => Math.ceil(Math.ceil(baseQuotient * multiplier) / 4);

      const instructorTarget = calcTarget(1);
      const assistantProfTarget = calcTarget(1.2);
      const associateProfTarget = calcTarget(1.2);

      ['A17', 'C17', 'E17', 'G17'].forEach(cell => ws6.getCell(cell).value = instructorTarget);
      ['A18', 'C18', 'E18', 'G18'].forEach(cell => ws6.getCell(cell).value = assistantProfTarget);
      ['A19', 'C19', 'E19', 'G19'].forEach(cell => ws6.getCell(cell).value = associateProfTarget);

      // Dynamic Faculty Grid (Aggregated across all Extension projects)
      const aggregatedFacultyData = {};
      
      // Filter for 'List of Extension' records in the current period
      const currentPeriodExtensionProjects = records.filter(r => r.accomplishment_category === 'List of Extension');
      
      currentPeriodExtensionProjects.forEach(project => {
        const projectData = parseJSON(project.extension_individual_data);
        const beneficiariesStr = (project.beneficiaries || "0").split(' ')[0];
        const totalBeneficiaries = parseInt(beneficiariesStr) || 0;
        
        // Extract regular faculty IDs from personnel JSON
        let personnel = [];
        try { personnel = JSON.parse(project.extension_personnel); } catch(e) {}
        
        const regularFacultyIds = [];
        personnel.forEach(group => {
          if (group.members) {
            group.members.forEach(member => {
              if (member.userId) regularFacultyIds.push(member.userId);
            });
          }
        });

        const share = regularFacultyIds.length > 0 ? Number((totalBeneficiaries / regularFacultyIds.length).toFixed(2)) : 0;
        const qKey = `q${getQuarter(project.date)}`;

        regularFacultyIds.forEach(fid => {
          if (!aggregatedFacultyData[fid]) aggregatedFacultyData[fid] = { q1: 0, q2: 0, q3: 0, q4: 0 };
          // Use stored share if available in JSON, otherwise fallback to live calculation
          const storedShare = projectData[fid]?.[qKey];
          aggregatedFacultyData[fid][qKey] += (storedShare != null ? storedShare : share);
        });
      });

      let currentRow = 25;

      const facultyProfiles = await new Promise((resolve) => {
        db.all(`SELECT user_id, position FROM user_profiles`, [], (err, rows) => resolve(rows || []));
      });

      allRegularFaculty.forEach(faculty => {
        const profile = facultyProfiles.find(p => p.user_id === faculty.id);
        const rank = profile?.position || 'Instructor';

        let targetValue = instructorTarget;
        if (rank.includes('Assistant')) targetValue = assistantProfTarget;
        else if (rank.includes('Associate')) targetValue = associateProfTarget;

        const acc = aggregatedFacultyData[faculty.id] || { q1: 0, q2: 0, q3: 0, q4: 0 };

        const row = ws6.getRow(currentRow);
        row.getCell(1).value = (faculty.name || "").toUpperCase();
        row.getCell(2).value = rank;
        row.getCell(3).value = targetValue;
        row.getCell(4).value = Number(acc.q1 || 0);
        row.getCell(4).numFmt = '0.00';
        row.getCell(5).value = targetValue;
        row.getCell(6).value = Number(acc.q2 || 0);
        row.getCell(6).numFmt = '0.00';
        row.getCell(7).value = targetValue * 2;
        row.getCell(8).value = Number(acc.q1 || 0) + Number(acc.q2 || 0);
        row.getCell(8).numFmt = '0.00';

        row.getCell(10).value = targetValue;
        row.getCell(11).value = Number(acc.q3 || 0);
        row.getCell(11).numFmt = '0.00';
        row.getCell(12).value = targetValue;
        row.getCell(13).value = Number(acc.q4 || 0);
        row.getCell(13).numFmt = '0.00';
        row.getCell(14).value = targetValue * 2;
        row.getCell(15).value = Number(acc.q3 || 0) + Number(acc.q4 || 0);
        row.getCell(15).numFmt = '0.00';

        row.getCell(17).value = targetValue * 4;
        row.getCell(18).value = Number(acc.q1 || 0) + Number(acc.q2 || 0) + Number(acc.q3 || 0) + Number(acc.q4 || 0);
        row.getCell(18).numFmt = '0.00';
        currentRow++;
      });

      // Vertical Sums
      const summaryRow = ws6.getRow(currentRow);
      for (let col = 3; col <= 18; col++) {
        if (col === 9 || col === 16) continue;
        let sum = 0;
        for (let r = 25; r < currentRow; r++) {
          sum += Number(ws6.getRow(r).getCell(col).value) || 0;
        }
        summaryRow.getCell(col).value = sum;
        summaryRow.getCell(col).font = { bold: true };
      }
    }
  }

  // Data Mapping for Historical List of Extension (Sheet 7)
  const ws7 = workbook.worksheets[6];
  if (ws7 && historicalExtensionRecords.length > 0) {
    if (!ws7.nextRowIndex) ws7.nextRowIndex = 2; // Start appending after headers
    historicalExtensionRecords.forEach(record => {
      let formattedExtensionists = '';
      if (record.extension_personnel) {
        try {
          const parsed = JSON.parse(record.extension_personnel);
          if (Array.isArray(parsed)) {
            formattedExtensionists = parsed.map(g => {
              // Handle both the old string format and the new object format
              const memberNames = g.members.map(m => {
                const nameStr = typeof m === 'object' ? m.name : m;
                return (nameStr || "").toUpperCase();
              }).filter(n => n && n.trim() !== '');
              return `${g.role}:\n` + memberNames.join('\n');
            }).join('\n\n');
          }
        } catch (e) { }
      }

      const row = ws7.getRow(ws7.nextRowIndex);
      row.values = [
        `${record.semester} A.Y. ${record.academic_year}`, // A
        record.title, // B
        record.date, // C
        record.beneficiaries || '', // D
        record.venue || '', // E (Location is mapped to venue)
        formattedExtensionists, // F
        record.budget_allocation || 'N/A', // G
        record.evaluation || '', // H
        record.gdrive_link || '' // I (References mapped to gdrive_link)
      ];

      // wrapText on F
      row.getCell(6).alignment = { wrapText: true };

      row.commit();
      ws7.nextRowIndex += 1;
    });
  }

  return await workbook.xlsx.writeBuffer();
}

module.exports = { exportIPCRToExcel, exportManualAccomplishmentsToExcel };