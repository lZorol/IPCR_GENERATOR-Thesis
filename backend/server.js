// Load environment variables
require("dotenv").config();

const DefaultTarget = require("../shared/defaultTarget.json");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs-extra");
const path = require("path");

const db = require("./database");
const authRoutes = require("./routes/auth");
const GoogleDriveService = require("./utils/googleDrive");
const { saveIPCR } = require("./saveIPCR");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
fs.ensureDirSync("uploads");

// Routes
app.use("/api/auth", authRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

// ──────────────────────────────────────────────────────────────────────────────
// CATEGORY MAP
// ──────────────────────────────────────────────────────────────────────────────
const categoryMap = {
  syllabus: "Syllabus",
  courseGuide: "Course Guide",
  slm: "SLM",
  gradingSheet: "Grading Sheet",
  tos: "TOS",
};

// ──────────────────────────────────────────────────────────────────────────────
// HELPER: resolve active semester config from DB
// ──────────────────────────────────────────────────────────────────────────────
function getActiveConfig() {
  return new Promise((resolve) => {
    db.get(
      `SELECT academic_year, semester FROM semester_config WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
      (err, row) => {
        if (err || !row) {
          resolve({ academic_year: "2025-2026", semester: "1st Semester" });
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
 * Body: { academic_year, semester, start_date, end_date }
 */
app.post("/api/semester-config", (req, res) => {
  const { academic_year, semester, start_date, end_date } = req.body;

  if (!academic_year || !semester) {
    return res.status(400).json({ error: "academic_year and semester are required" });
  }

  // Deactivate all existing configs, then insert new active one
  db.run(`UPDATE semester_config SET is_active = 0`, (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run(
      `INSERT INTO semester_config (academic_year, semester, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [academic_year, semester, start_date || null, end_date || null],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true, id: this.lastID, academic_year, semester, start_date, end_date });
      }
    );
  });
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
  const academicYear = req.query.year     || active.academic_year;
  const semester     = req.query.semester || active.semester;

  const query = `
    SELECT category, target, accomplished, rating, submission_date
    FROM ipcr_records
    WHERE user_id = ? AND (academic_year = ? OR academic_year IS NULL) AND (semester = ? OR semester IS NULL)
    ORDER BY COALESCE(academic_year,'') DESC, COALESCE(semester,'') DESC
  `;

  db.all(query, [userId, academicYear, semester], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const ipcrData = {
      syllabus:     { target: DefaultTarget.syllabus,     accomplished: 0, submitted: null },
      courseGuide:  { target: DefaultTarget.courseGuide,  accomplished: 0, submitted: null },
      slm:          { target: DefaultTarget.slm,          accomplished: 0, submitted: null },
      gradingSheet: { target: DefaultTarget.gradingSheet, accomplished: 0, submitted: null },
      tos:          { target: DefaultTarget.tos,          accomplished: 0, submitted: null },
    };

    const byCategory = {};
    rows.forEach((row) => {
      const key = Object.keys(categoryMap).find((k) => categoryMap[k] === row.category);
      if (key) {
        const hasRating = row.rating != null && Number(row.rating) > 0;
        if (!byCategory[key] || hasRating) byCategory[key] = row;
      }
    });
    Object.entries(byCategory).forEach(([key, row]) => {
      ipcrData[key] = {
        target: row.target,
        accomplished: row.accomplished,
        submitted: row.submission_date,
        rating: row.rating != null ? Number(row.rating) : null,
      };
    });

    res.json(ipcrData);
  });
});

/**
 * POST /api/ipcr/targets
 * Body: { userId, targets, year?, semester? }
 */
app.post("/api/ipcr/targets", async (req, res) => {
  const { userId, targets, year, semester } = req.body;
  const active = await getActiveConfig();
  const academicYear = year     || active.academic_year;
  const sem          = semester || active.semester;

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
// DOCUMENT UPLOAD
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/documents/upload
 * Body fields: userId, tokens?, year?, semester?, facultyName?
 */
app.post("/api/documents/upload", upload.array("files"), async (req, res) => {
  try {
    const rawUserId   = req.body.userId;
    const userId      = parseInt(rawUserId, 10) || rawUserId;
    const tokens      = req.body.tokens;
    const files       = req.files;
    const facultyName = req.body.facultyName || "Faculty";

    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const active = await getActiveConfig();
    const academicYear = req.body.year     || active.academic_year;
    const semester     = req.body.semester || active.semester;

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

        const mlResponse = await axios.post("http://localhost:5000/classify", formData, {
          headers: formData.getHeaders(),
          timeout: 60000,
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
        const driveId   = driveUploaded ? driveResult.fileId   : Math.random().toString(36).substring(7);
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
        const row = await new Promise((resolve, reject) =>
          db.get(
            `SELECT target, accomplished FROM ipcr_records
             WHERE user_id = ? AND category = ? AND academic_year = ? AND semester = ?`,
            [userId, dbCategory, academicYear, semester],
            (err, r) => (err ? reject(err) : resolve(r))
          )
        );

        const target       = row?.target      || 0;
        const accomplished = (row?.accomplished || 0) + 1;

        await saveIPCR(userId, dbCategory, accomplished, target, academicYear, semester);

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
  const academicYear = req.query.year     || active.academic_year;
  const semester     = req.query.semester || active.semester;

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

app.get("/api/ipcr/export/:userId", async (req, res) => {
  try {
    const { exportIPCRToExcel } = require("./utils/excelExport");
    const buffer = await exportIPCRToExcel(req.params.userId);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=IPCR_${req.params.userId}_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ error: "Failed to generate Excel file" });
  }
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
  const academicYear = req.query.year     || active.academic_year;
  const semester     = req.query.semester || active.semester;

  const query = `
    SELECT
      u.id, u.name, u.department, u.email,
      COUNT(DISTINCT d.id) as document_count,
      AVG(ir.rating) as avg_rating
    FROM users u
    LEFT JOIN documents d
      ON u.id = d.user_id AND d.academic_year = ? AND d.semester = ?
    LEFT JOIN ipcr_records ir
      ON u.id = ir.user_id AND ir.academic_year = ? AND ir.semester = ?
    WHERE u.role = 'professor'
    GROUP BY u.id
  `;
  db.all(query, [academicYear, semester, academicYear, semester], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});