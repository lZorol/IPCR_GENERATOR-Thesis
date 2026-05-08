// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs-extra");
const path = require("path");

const db = require("./database");
const authRoutes = require("./routes/auth");
const targetsRoutes = require("./routes/targets");
const presetsRoutes = require("./routes/presets");
const academicYearsRoutes = require("./routes/academicYears");
const GoogleDriveService = require("./utils/googleDrive");
const { saveIPCR } = require("./saveIPCR");
const { categoryMap, autoRate } = require("./ipcrCalculator");
const initializeAcademicYears = require("./utils/initializeAcademicYears");
const detectSchoolYear = require("./utils/detectSchoolYear");
const createSchoolYearIfMissing = require("./utils/createSchoolYearIfMissing");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
fs.ensureDirSync("uploads");

// Initialize default academic years
initializeAcademicYears();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", targetsRoutes);
app.use("/api", presetsRoutes);
app.use("/api", academicYearsRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

// CATEGORY MAP moved to ipcrCalculator.js
// ──────────────────────────────────────────────────────────────────────────────
// HELPER: resolve active semester config from DB
// ──────────────────────────────────────────────────────────────────────────────
function getActiveConfig() {
  return new Promise((resolve) => {
    db.get(
      `SELECT academic_year, semester, start_date, end_date FROM semester_config WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
      (err, row) => {
        if (err || !row) {
          resolve({ academic_year: "2025-2026", semester: "1st Semester", start_date: null, end_date: null });
        } else {
          resolve(row);
        }
      }
    );
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// SEMESTER CONFIG ROUTES
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/semester-config
 * Returns the current active semester configuration.
 */
app.get("/api/semester-config", (req, res) => {
  db.get(
    `SELECT * FROM semester_config WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.json({ academic_year: "2025-2026", semester: "1st Semester", start_date: null, end_date: null });
      res.json(row);
    }
  );
});

/**
 * POST /api/semester-config
 * Admin saves/updates the active semester configuration.
 * Body: { semester, start_date, end_date }
 */
app.post("/api/semester-config", async (req, res) => {
  const { semester, start_date, end_date } = req.body;

  if (!semester || !start_date || !end_date) {
    return res.status(400).json({ error: "semester, start_date, and end_date are required" });
  }

  try {
    // 1. Detect school year
    const academic_year = detectSchoolYear(start_date, end_date);

    // 2 & 3. Create if missing
    await createSchoolYearIfMissing(academic_year);

    // 4. Update academic_years table dates
    let startCol, endCol;
    if (semester === '1st' || semester === '1st Semester') {
      startCol = 'first_sem_start';
      endCol = 'first_sem_end';
    } else if (semester === '2nd' || semester === '2nd Semester') {
      startCol = 'second_sem_start';
      endCol = 'second_sem_end';
    }

    if (startCol && endCol) {
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE academic_years SET ${startCol} = ?, ${endCol} = ? WHERE school_year = ?`,
          [start_date, end_date, academic_year],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    // 5. Deactivate all existing configs, then insert new active one
    db.run(`UPDATE semester_config SET is_active = 0`, (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.run(
        `INSERT INTO semester_config (academic_year, semester, start_date, end_date, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [academic_year, semester, start_date, end_date],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, id: this.lastID, academic_year, semester, start_date, end_date });
        }
      );
    });
  } catch (error) {
    console.error("Error in /api/semester-config:", error);
    res.status(500).json({ error: error.message || error });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// IPCR RECORDS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ipcr/:userId
 * Optional query params: ?year=2025-2026&semester=1st+Semester
 * Falls back to active config when params are omitted.
 */
app.get("/api/ipcr/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10) || req.params.userId;
  const active = await getActiveConfig();
  const academicYear = req.query.year || active.academic_year;
  const semester = req.query.semester || active.semester;

  try {
    // 1. Load user-specific targets for this period (fallback to 5)
    const { rowToTargets } = require('./routes/targets');
    const userTargetRow = await new Promise((resolve, reject) =>
      db.get(
        `SELECT * FROM user_targets WHERE user_id = ? AND academic_year = ? AND semester = ?`,
        [userId, academicYear, semester],
        (err, row) => (err ? reject(err) : resolve(row))
      )
    );
    const userTargets = rowToTargets(userTargetRow);  // null row → defaults of 5
    const hasTargets = !!userTargetRow;

    // 2. Build baseline ipcrData from user targets
    const ipcrData = {};
    Object.keys(categoryMap).forEach((key) => {
      ipcrData[key] = {
        target: userTargets ? (userTargets[key] ?? 5) : 5,
        accomplished: 0,
        submitted: null,
        hasTargets,
      };
    });
    // Include accomplishmentReportSupport which has no categoryMap entry but may be in user_targets
    if (!ipcrData.accomplishmentReportSupport) {
      ipcrData.accomplishmentReportSupport = {
        target: userTargets ? (userTargets.accomplishmentReportSupport ?? 5) : 5,
        accomplished: 0,
        submitted: null,
        hasTargets,
      };
    }

    // 3. Overlay actual accomplished/rating from ipcr_records
    const rows = await new Promise((resolve, reject) =>
      db.all(
        `SELECT category, target, accomplished, rating, submission_date
         FROM ipcr_records
         WHERE user_id = ? AND (academic_year = ? OR academic_year IS NULL)
           AND (semester = ? OR semester IS NULL)
         ORDER BY COALESCE(academic_year,'') DESC, COALESCE(semester,'') DESC`,
        [userId, academicYear, semester],
        (err, r) => (err ? reject(err) : resolve(r))
      )
    );

    const byCategory = {};
    rows.forEach((row) => {
      const key = Object.keys(categoryMap).find((k) => categoryMap[k] === row.category);
      if (key) {
        const hasRating = row.rating != null && Number(row.rating) > 0;
        if (!byCategory[key] || hasRating) byCategory[key] = row;
      }
    });

    Object.entries(byCategory).forEach(([key, row]) => {
      // DYNAMIC CALCULATION: Compute Q, E, T, A on the fly
      const target = ipcrData[key].target > 0 ? ipcrData[key].target : 5;
      const accomplished = row.accomplished;
      
      const baseRating = autoRate(accomplished, target);
      const qty = baseRating;
      const qle = baseRating;
      const timeliness = baseRating;
      const average = (qty + qle + timeliness) / 3;

      ipcrData[key] = {
        target,
        accomplished,
        submitted: row.submission_date,
        rating: Number(average.toFixed(2)),
        qty: Number(qty.toFixed(2)),
        qle: Number(qle.toFixed(2)),
        timeliness: Number(timeliness.toFixed(2)),
        average: Number(average.toFixed(2)),
        hasTargets,
      };
    });

    // 4. Ensure all master categories have a rating (min 1.0)
    const masterKeys = Object.keys(categoryMap);
    masterKeys.forEach(key => {
      if (ipcrData[key].rating === undefined) {
        const target = ipcrData[key].target > 0 ? ipcrData[key].target : 5;
        const rating = autoRate(0, target);
        ipcrData[key] = {
          ...ipcrData[key],
          rating,
          qty: rating,
          qle: rating,
          timeliness: rating,
          average: rating
        };
      }
    });

    // 5. Final Aggregation (Strict All-Category Inclusion)
    let totalCategoryRatings = 0;
    masterKeys.forEach(key => {
      totalCategoryRatings += ipcrData[key].rating;
    });

    const overallRating = masterKeys.length > 0 
      ? Number((totalCategoryRatings / masterKeys.length).toFixed(2)) 
      : 1.0;

    res.json({
      ratings: ipcrData,
      overall_rating: overallRating
    });
  } catch (err) {
    console.error('GET /api/ipcr/:userId error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ipcr/targets
 * Body: { userId, targets, year?, semester? }
 */
app.post("/api/ipcr/targets", async (req, res) => {
  const { userId, targets, year, semester } = req.body;
  const active = await getActiveConfig();
  const academicYear = year || active.academic_year;
  const sem = semester || active.semester;

  Object.entries(targets).forEach(([key, value]) => {
    const category = categoryMap[key];
    const query = `
      INSERT INTO ipcr_records (user_id, category, target, accomplished, academic_year, semester)
      VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(user_id, category, academic_year, semester)
      DO UPDATE SET target = ?
    `;
    db.run(query, [userId, category, value, academicYear, sem, value]);
  });

  res.json({ success: true });
});

// ──────────────────────────────────────────────────────────────────────────────
// MANUAL ACCOMPLISHMENTS & USERS
// ──────────────────────────────────────────────────────────────────────────────

app.get("/api/users/regular", (req, res) => {
  db.all(
    `SELECT id, name FROM users WHERE is_regular_faculty = 1 ORDER BY name ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/accomplishments/manual", upload.single("file"), async (req, res) => {
  try {
    const {
      userId, title, date, venue, scope, hours, sponsoredBy, researchRelated,
      academicYear, semester, facultyName, tokens,
      accomplishment_category,
      target_presentation, target_publication, target_utilized,
      acc_presentation, acc_publication, acc_utilized,
      stat_proposal, stat_completed, stat_presented, stat_ip_rights, stat_utilized, stat_citations,
      admin_scopus, admin_rg, admin_gs,
      totalExtensionTarget, active_partnerships_data, trainees_accomplishment_data, extension_programs_data, extension_individual_data,
      ext_row9,
      extension_personnel, beneficiaries, budget_allocation, evaluation
    } = req.body;
    const file = req.file;

    const requiresFile = (accomplishment_category === 'Seminars, Conferences, and Training');

    if (!userId || !title || !date || (requiresFile && !file)) {
      if (file && fs.existsSync(file.path)) await fs.remove(file.path);
      return res.status(400).json({ error: "Missing required fields or file" });
    }

    let driveLink = "";

    if (file) {
      if (!tokens) {
        if (fs.existsSync(file.path)) await fs.remove(file.path);
        return res.status(403).json({ error: "Google Drive not connected." });
      }

      const userTokens = typeof tokens === "string" ? JSON.parse(tokens) : tokens;

      try {
        const driveService = new GoogleDriveService(userTokens);
        const driveResult = await driveService.uploadFile(
          file.path,
          file.originalname,
          "Training/Seminar/Conference Certificate",
          academicYear,
          semester,
          facultyName || "Faculty"
        );
        if (driveResult && driveResult.webViewLink) {
          driveLink = driveResult.webViewLink;
        } else {
          throw new Error("Failed to get Google Drive link.");
        }
      } catch (err) {
        console.warn("Manual drive upload failed:", err.message);
        if (fs.existsSync(file.path)) await fs.remove(file.path);
        return res.status(500).json({ error: "Google Drive upload failed." });
      }
    }

    db.run(
      `INSERT INTO faculty_accomplishments 
       (user_id, title, date, venue, scope, hours, sponsored_by, gdrive_link, research_related, academic_year, semester,
        accomplishment_category, target_presentation, target_publication, target_utilized,
        acc_presentation, acc_publication, acc_utilized, stat_proposal, stat_completed,
        stat_presented, stat_ip_rights, stat_utilized, stat_citations,
        extension_personnel, beneficiaries, budget_allocation, evaluation,
        admin_scopus, admin_rg, admin_gs,
        totalExtensionTarget, active_partnerships_data, trainees_accomplishment_data, extension_programs_data, extension_individual_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, date, venue, scope, hours, sponsoredBy, driveLink, researchRelated, academicYear, semester,
        accomplishment_category || 'Seminars, Conferences, and Training',
        Math.max(0, Number(target_presentation)) || null,
        Math.max(0, Number(target_publication)) || null,
        Math.max(0, Number(target_utilized)) || null,
        Math.max(0, Number(acc_presentation)) || null,
        Math.max(0, Number(acc_publication)) || null,
        Math.max(0, Number(acc_utilized)) || null,
        Math.max(0, Number(stat_proposal)) || null,
        Math.max(0, Number(stat_completed)) || null,
        Math.max(0, Number(stat_presented)) || null,
        Math.max(0, Number(stat_ip_rights)) || null,
        Math.max(0, Number(stat_utilized)) || null,
        Math.max(0, Number(stat_citations)) || null,
        extension_personnel || null, beneficiaries || null, budget_allocation || null, evaluation || null,
        admin_scopus ? Math.max(0, Number(admin_scopus)) : null,
        admin_rg ? Math.max(0, Number(admin_rg)) : null,
        admin_gs ? Math.max(0, Number(admin_gs)) : null,
        totalExtensionTarget || null, active_partnerships_data || null, trainees_accomplishment_data || null, extension_programs_data || null, extension_individual_data || null],
      async function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Update IPCR record count for Training/Seminar/Conference Certificate
        const category = "Training/Seminar/Conference Certificate";

        const row = await new Promise((resolve, reject) =>
          db.get(
            `SELECT target, accomplished FROM ipcr_records
             WHERE user_id = ? AND category = ? AND academic_year = ? AND semester = ?`,
            [userId, category, academicYear, semester],
            (err, r) => (err ? reject(err) : resolve(r))
          )
        );

        const target = row?.target || 5; // Default 5
        const accomplished = (row?.accomplished || 0) + 1;

        await saveIPCR(userId, category, accomplished, target, academicYear, semester);

        res.json({ success: true });
      }
    );
  } catch (err) {
    console.error("Manual accomplishment error:", err);
    if (req.file && fs.existsSync(req.file.path)) await fs.remove(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/accomplishments/history/:userId
 * Fetch manual accomplishments for a user
 */
app.get("/api/accomplishments/history/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10) || req.params.userId;
  const active = await getActiveConfig();
  const academicYear = req.query.year || active.academic_year;
  const semester = req.query.semester || active.semester;

  db.all(
    `SELECT * FROM faculty_accomplishments 
     WHERE (user_id = ? OR accomplishment_category = 'Extension' OR accomplishment_category = 'Research') 
     AND academic_year = ? AND semester = ? 
     ORDER BY created_at DESC`,
    [userId, academicYear, semester],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// DOCUMENT UPLOAD
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/documents/upload
 * Body fields: userId, tokens?, year?, semester?, facultyName?
 */
app.post("/api/documents/upload", upload.array("files"), async (req, res) => {
  try {
    const rawUserId = req.body.userId;
    const userId = parseInt(rawUserId, 10) || rawUserId;
    const tokens = req.body.tokens;
    const files = req.files;
    const facultyName = req.body.facultyName || "Faculty";

    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const active = await getActiveConfig();
    const academicYear = req.body.year || active.academic_year;
    const semester = req.body.semester || active.semester;

    const userTokens = tokens ? (typeof tokens === "string" ? JSON.parse(tokens) : tokens) : null;
    const results = [];

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);

        // ML classification
        const formData = new FormData();
        formData.append("file", fs.createReadStream(file.path), {
          filename: file.originalname,
          contentType: "application/pdf",
        });

        // Hard fix: Explicitly use Port 5050 to bypass Windows port 5000 conflicts
        const mlEndpoint = "http://127.0.0.1:5050/classify";
        console.log(`🤖 Requesting AI classification at: ${mlEndpoint}`);

        const mlResponse = await axios.post(mlEndpoint, formData, {
          headers: formData.getHeaders(),
          timeout: 30000,
        });
        const { category, confidence } = mlResponse.data;
        const dbCategory = categoryMap[category] || category;

        // Google Drive upload with new folder structure
        let driveResult = null;
        if (userTokens) {
          try {
            const driveService = new GoogleDriveService(userTokens);
            driveResult = await driveService.uploadFile(
              file.path,
              file.originalname,
              dbCategory,
              academicYear,
              semester,
              facultyName
            );
          } catch (err) {
            console.warn("Drive upload failed:", err.message);
          }
        }

        const driveUploaded = !!driveResult;
        const driveId = driveUploaded ? driveResult.fileId : Math.random().toString(36).substring(7);
        const driveLink = driveUploaded ? driveResult.webViewLink : `https://drive.google.com/file/d/${driveId}`;

        // Save document info (with year + semester)
        db.run(
          `INSERT INTO documents
           (user_id, filename, original_filename, file_size, category, confidence,
            google_drive_id, google_drive_link, academic_year, semester)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, file.filename, file.originalname, file.size, dbCategory,
            confidence, driveId, driveLink, academicYear, semester]
        );

        // Update IPCR record (scoped to year + semester)
        // Hard Fix: We no longer fetch the target here to avoid passing a default '5' 
        // that overwrites custom settings. We let saveIPCR handle target resolution.
        const ipcrRecord = await new Promise((resolve) =>
          db.get(
            `SELECT accomplished FROM ipcr_records
             WHERE user_id = ? AND category = ? AND academic_year = ? AND semester = ?`,
            [userId, dbCategory, academicYear, semester],
            (err, r) => resolve(r)
          )
        );

        const newAccomplished = (ipcrRecord?.accomplished || 0) + 1;
        await saveIPCR(userId, dbCategory, newAccomplished, null, academicYear, semester);

        // Store the category-specific folder link on this category's ipcr_record row
        if (driveResult && driveResult.categoryFolderLinks) {
          const catKey = dbCategory.replace(/\s+/g, '').toLowerCase();
          const folderLink = driveResult.categoryFolderLinks[catKey] || null;
          if (folderLink) {
            db.run(
              `UPDATE ipcr_records SET folder_link = ? WHERE user_id = ? AND category = ? AND academic_year = ? AND semester = ?`,
              [folderLink, userId, dbCategory, academicYear, semester]
            );
          }
        }

        results.push({ filename: file.originalname, category: dbCategory, confidence, driveLink, driveUploaded });

        await fs.remove(file.path);
      } catch (err) {
        console.error("File processing error:", err.message);
        if (fs.existsSync(file.path)) await fs.remove(file.path);
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DOCUMENTS LIST
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/documents/:userId
 * Optional query params: ?year=&semester=
 */
app.get("/api/documents/:userId", async (req, res) => {
  const { userId } = req.params;
  const active = await getActiveConfig();
  const academicYear = req.query.year || active.academic_year;
  const semester = req.query.semester || active.semester;

  const query = `
    SELECT id, original_filename as name, file_size as size, category,
           confidence, google_drive_link as driveLink, upload_date as uploadDate,
           academic_year, semester
    FROM documents
    WHERE user_id = ? AND academic_year = ? AND semester = ?
    ORDER BY upload_date DESC
  `;
  db.all(query, [userId, academicYear, semester], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ipcr/export/:userId
 * Optional query params: ?year=&semester=
 */
app.get("/api/ipcr/export/:userId", async (req, res) => {
  try {
    const { exportIPCRToExcel } = require("./utils/excelExport");
    const active = await getActiveConfig();
    const academicYear = req.query.year || active.academic_year;
    const semester = req.query.semester || active.semester;

    const buffer = await exportIPCRToExcel(req.params.userId, academicYear, semester);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=IPCR_${req.params.userId}_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ error: "Failed to generate Excel file" });
  }
});

/**
 * GET /api/accomplishments/export-all
 * Optional query params: ?year=&semester=&requesterId=
 */
app.get("/api/accomplishments/export-all", async (req, res) => {
  try {
    const requesterId = req.query.requesterId;
    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester ID is missing." });
    }

    const requester = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE id = ?', [requesterId], (err, row) => {
        err ? reject(err) : resolve(row);
      });
    });

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    const { exportManualAccomplishmentsToExcel } = require("./utils/excelExport");
    const active = await getActiveConfig();
    const academicYear = req.query.year || active.academic_year;
    const semester = req.query.semester || active.semester;

    const buffer = await exportManualAccomplishmentsToExcel(academicYear, semester);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=All_Faculty_Accomplishments_${academicYear}_${semester}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error("Accomplishments export error:", err);
    res.status(500).json({ error: "Failed to generate Excel file" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// USER PROFILE ROUTES
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/profile/:userId
 * Returns locally-editable profile (falls back to users table data).
 */
app.get("/api/profile/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10) || req.params.userId;

  // First try user_profiles, then fall back to users
  db.get(
    `SELECT up.name, up.department, up.position, up.contact_number, up.notes, up.updated_at,
            u.email, u.profile_image, u.role, u.is_regular_faculty
     FROM users u
     LEFT JOIN user_profiles up ON u.id = up.user_id
     WHERE u.id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "User not found" });

      // If no profile row exists yet, use data from users table
      db.get(`SELECT name, department, is_regular_faculty FROM users WHERE id = ?`, [userId], (err2, userRow) => {
        if (err2) return res.status(500).json({ error: err2.message });

        res.json({
          name: row.name || (userRow && userRow.name) || '',
          department: row.department || (userRow && userRow.department) || '',
          position: row.position || '',
          contact_number: row.contact_number || '',
          notes: row.notes || '',
          email: row.email || '',
          profile_image: row.profile_image || '',
          role: row.role || 'professor',
          is_regular_faculty: row.is_regular_faculty !== null ? row.is_regular_faculty : (userRow && userRow.is_regular_faculty !== null ? userRow.is_regular_faculty : 1),
          updated_at: row.updated_at || null,
        });
      });
    }
  );
});

/**
 * PUT /api/profile/:userId
 * Upserts locally-editable profile fields.
 * Body: { name, department, position, contact_number, notes }
 */
app.put("/api/profile/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10) || req.params.userId;
  const { name, department, position, contact_number, notes, is_regular_faculty } = req.body;

  const upsertSql = `
    INSERT INTO user_profiles (user_id, name, department, position, contact_number, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      name = excluded.name,
      department = excluded.department,
      position = excluded.position,
      contact_number = excluded.contact_number,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(upsertSql, [userId, name || null, department || null, position || null, contact_number || null, notes || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // Also update the users table name, department, and is_regular_faculty so it reflects everywhere
    db.run(
      `UPDATE users SET name = COALESCE(?, name), department = COALESCE(?, department), is_regular_faculty = COALESCE(?, is_regular_faculty) WHERE id = ?`,
      [name || null, department || null, is_regular_faculty !== undefined ? is_regular_faculty : null, userId],
      (err2) => {
        if (err2) console.error("Error syncing users table:", err2.message);
        res.json({ success: true, message: "Profile updated successfully" });
      }
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/ipcr
 * Optional query params: ?year=&semester=
 */
app.get("/api/admin/ipcr", async (req, res) => {
  const active = await getActiveConfig();
  const academicYear = req.query.year || active.academic_year;
  const semester = req.query.semester || active.semester;

  try {
    const query = `
      SELECT
        u.id, u.name, u.department, u.email,
        COUNT(DISTINCT d.id) as document_count
      FROM users u
      LEFT JOIN documents d
        ON u.id = d.user_id AND d.academic_year = ? AND d.semester = ?
      WHERE u.role = 'professor'
      GROUP BY u.id
    `;

    const usersRows = await new Promise((resolve, reject) => {
      db.all(query, [academicYear, semester], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const { rowToTargets } = require('./routes/targets');

    const results = await Promise.all(usersRows.map(async (user) => {
      const userTargetRow = await new Promise((resolve, reject) =>
        db.get(
          `SELECT * FROM user_targets WHERE user_id = ? AND academic_year = ? AND semester = ?`,
          [user.id, academicYear, semester],
          (err, row) => (err ? reject(err) : resolve(row))
        )
      );
      const userTargets = rowToTargets(userTargetRow);
      const hasTargets = !!userTargetRow;

      const ipcrData = {};
      Object.keys(categoryMap).forEach((key) => {
        ipcrData[key] = {
          target: userTargets ? (userTargets[key] ?? 5) : 5,
          accomplished: 0,
          submitted: null,
          hasTargets,
        };
      });
      if (!ipcrData.accomplishmentReportSupport) {
        ipcrData.accomplishmentReportSupport = {
          target: userTargets ? (userTargets.accomplishmentReportSupport ?? 5) : 5,
          accomplished: 0,
          submitted: null,
          hasTargets,
        };
      }

      const rows = await new Promise((resolve, reject) =>
        db.all(
          `SELECT category, target, accomplished, rating, submission_date
           FROM ipcr_records
           WHERE user_id = ? AND (academic_year = ? OR academic_year IS NULL)
             AND (semester = ? OR semester IS NULL)
           ORDER BY COALESCE(academic_year,'') DESC, COALESCE(semester,'') DESC`,
          [user.id, academicYear, semester],
          (err, r) => (err ? reject(err) : resolve(r))
        )
      );

      const byCategory = {};
      rows.forEach((row) => {
        const key = Object.keys(categoryMap).find((k) => categoryMap[k] === row.category);
        if (key) {
          const hasRating = row.rating != null && Number(row.rating) > 0;
          if (!byCategory[key] || hasRating) byCategory[key] = row;
        }
      });
      Object.entries(byCategory).forEach(([key, row]) => {
        const target = ipcrData[key].target > 0 ? ipcrData[key].target : 5;
        const rating = autoRate(row.accomplished, target);
        ipcrData[key] = {
          target,
          accomplished: row.accomplished,
          submitted: row.submission_date,
          qty: rating,
          qle: rating,
          timeliness: rating,
          rating: rating,
          hasTargets,
        };
      });

      // Ensure all categories have a rating (min 1.0)
      Object.keys(ipcrData).forEach(key => {
        if (ipcrData[key].rating === undefined) {
          const target = ipcrData[key].target > 0 ? ipcrData[key].target : 5;
          const rating = autoRate(0, target);
          ipcrData[key] = {
            ...ipcrData[key],
            rating,
            qty: rating,
            qle: rating,
            timeliness: rating
          };
        }
      });

      // Compute Overall Rating for the Admin Summary (Strict All-Category Inclusion)
      const masterKeys = Object.keys(categoryMap);
      let totalCategoryRatings = 0;

      masterKeys.forEach(key => {
        totalCategoryRatings += ipcrData[key].rating;
      });

      const overallRating = masterKeys.length > 0 
        ? Number((totalCategoryRatings / masterKeys.length).toFixed(2))
        : 1.0;

      return {
        ...user,
        overall_rating: overallRating,
        ipcrData
      };
    }));

    res.json(results);
  } catch (err) {
    console.error("GET /api/admin/ipcr error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/faculty/:userId
 * Admin detail view for a specific faculty member.
 * Returns profile info, folder links, and documents for the selected period.
 * Optional query params: ?year=&semester=
 */
app.get("/api/admin/faculty/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10) || req.params.userId;
  const active = await getActiveConfig();
  const academicYear = req.query.year || active.academic_year;
  const semester = req.query.semester || active.semester;

  try {
    // 1. Profile info (from user_profiles + users)
    const profile = await new Promise((resolve, reject) => {
      db.get(
        `SELECT u.id, u.email, u.profile_image, u.role,
                COALESCE(up.name, u.name) as name,
                COALESCE(up.department, u.department) as department,
                up.position, up.contact_number, up.notes
         FROM users u
         LEFT JOIN user_profiles up ON u.id = up.user_id
         WHERE u.id = ?`,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (!profile) return res.status(404).json({ error: "Faculty not found" });

    // 2. Folder links — one per category row
    const folderLinkRows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT category, folder_link
         FROM ipcr_records
         WHERE user_id = ? AND academic_year = ? AND semester = ? AND folder_link IS NOT NULL`,
        [userId, academicYear, semester],
        (err, rows) => (err ? reject(err) : resolve(rows || []))
      );
    });

    // Map DB category names to keys
    const categoryKeyMap = { Syllabus: 'syllabus', 'Course Guide': 'courseGuide', SLM: 'slm', 'Grading Sheet': 'gradingSheet', TOS: 'tos', attendanceSheet: 'attendanceSheet', classRecord: 'classRecord', evaluationOfTeachingEffectiveness: 'evaluationOfTeachingEffectiveness', classroomObservation: 'classroomObservation', testQuestions: 'testQuestions', answerKeys: 'answerKeys', facultyAndStudentsSeekAdvices: 'facultyAndStudentsSeekAdvices', accomplishmentReport: 'accomplishmentReport', randdProposal: 'randdProposal', researchImplemented: 'researchImplemented', researchPresented: 'researchPresented', researchPublished: 'researchPublished', intellectualPropertyRights: 'intellectualPropertyRights', researchUtilizedDeveloped: 'researchUtilizedDeveloped', numberOfCitations: 'numberOfCitations', extentionProposal: 'extentionProposal', personsTrained: 'personsTrained', personServiceRating: 'personServiceRating', personGivenTraining: 'personGivenTraining', technicalAdvice: 'technicalAdvice', attendanceFlagCeremony: 'attendanceFlagCeremony', attendanceFlagLowering: 'attendanceFlagLowering', attendanceHealthAndWellnessProgram: 'attendanceHealthAndWellnessProgram', attendanceSchoolCelebrations: 'attendanceSchoolCelebrations', trainingSeminarConferenceCertificate: 'trainingSeminarConferenceCertificate', atttendanceFacultyMeeting: 'atttendanceFacultyMeeting', attendanceISOAndRelatedActivities: 'attendanceISOAndRelatedActivities', attendaceSpiritualActivities: 'attendaceSpiritualActivities' };
    const folderLinks = {};
    folderLinkRows.forEach(row => {
      const key = categoryKeyMap[row.category];
      if (key) folderLinks[key] = row.folder_link;
    });

    // 3. Documents for this period
    const documents = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, original_filename as name, file_size as size, category,
                confidence, google_drive_link as driveLink, upload_date as uploadDate
         FROM documents
         WHERE user_id = ? AND academic_year = ? AND semester = ?
         ORDER BY upload_date DESC`,
        [userId, academicYear, semester],
        (err, rows) => (err ? reject(err) : resolve(rows || []))
      );
    });

    res.json({
      profile,
      folderLinks: {
        syllabus: folderLinks.syllabus || null,
        courseGuide: folderLinks.courseGuide || null,
        slm: folderLinks.slm || null,
        gradingSheet: folderLinks.gradingSheet || null,
        tos: folderLinks.tos || null,
        attendanceSheet: folderLinks.attendanceSheet || null,
        classRecord: folderLinks.classRecord || null,
        evaluationOfTeachingEffectiveness: folderLinks.evaluationOfTeachingEffectiveness || null,
        classroomObservation: folderLinks.classroomObservation || null,
        testQuestions: folderLinks.testQuestions || null,
        answerKeys: folderLinks.answerKeys || null,
        facultyAndStudentsSeekAdvices: folderLinks.facultyAndStudentsSeekAdvices || null,
        accomplishmentReport: folderLinks.accomplishmentReport || null,
        randdProposal: folderLinks.randdProposal || null,
        researchImplemented: folderLinks.researchImplemented || null,
        researchPresented: folderLinks.researchPresented || null,
        researchPublished: folderLinks.researchPublished || null,
        intellectualPropertyRights: folderLinks.intellectualPropertyRights || null,
        researchUtilizedDeveloped: folderLinks.researchUtilizedDeveloped || null,
        numberOfCitations: folderLinks.numberOfCitations || null,
        extentionProposal: folderLinks.extentionProposal || null,
        personsTrained: folderLinks.personsTrained || null,
        personServiceRating: folderLinks.personServiceRating || null,
        personGivenTraining: folderLinks.personGivenTraining || null,
        technicalAdvice: folderLinks.technicalAdvice || null,
        attendanceFlagCeremony: folderLinks.attendanceFlagCeremony || null,
        attendanceFlagLowering: folderLinks.attendanceFlagLowering || null,
        attendanceHealthAndWellnessProgram: folderLinks.attendanceHealthAndWellnessProgram || null,
        attendanceSchoolCelebrations: folderLinks.attendanceSchoolCelebrations || null,
        trainingSeminarConferenceCertificate: folderLinks.trainingSeminarConferenceCertificate || null,
        atttendanceFacultyMeeting: folderLinks.atttendanceFacultyMeeting || null,
        attendanceISOAndRelatedActivities: folderLinks.attendanceISOAndRelatedActivities || null,
        attendaceSpiritualActivities: folderLinks.attendaceSpiritualActivities || null,
      },
      documents,
    });
  } catch (error) {
    console.error("Admin faculty detail error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});