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
const GoogleDriveService = require("./utils/googleDrive");
const { saveIPCR } = require("./saveIPCR"); // ✅ use the new saveIPCR module

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
fs.ensureDirSync("uploads");

// Routes
app.use("/api/auth", authRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

// CATEGORY MAP (ML → DATABASE)
const categoryMap = {
  syllabus: "Syllabus",
  courseGuide: "Course Guide",
  slm: "SLM",
  gradingSheet: "Grading Sheet",
  tos: "TOS",
};

// Same defaults as saveIPCR so we read the row we write
const DEFAULT_ACADEMIC_YEAR = "2023-2024";
const DEFAULT_SEMESTER = "1st";

// Get IPCR data (filter by academic year/semester so we return the row that has the saved rating)
app.get("/api/ipcr/:userId", (req, res) => {
  const userId = parseInt(req.params.userId, 10) || req.params.userId;

  const query = `
    SELECT category, target, accomplished, rating, submission_date
    FROM ipcr_records
    WHERE user_id = ? AND (academic_year = ? OR academic_year IS NULL) AND (semester = ? OR semester IS NULL)
    ORDER BY COALESCE(academic_year,'') DESC, COALESCE(semester,'') DESC
  `;

  db.all(query, [userId, DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const ipcrData = {
      syllabus: { target: 4, accomplished: 0, submitted: null },
      courseGuide: { target: 4, accomplished: 0, submitted: null },
      slm: { target: 10, accomplished: 0, submitted: null },
      gradingSheet: { target: 0, accomplished: 0, submitted: null },
      tos: { target: 0, accomplished: 0, submitted: null },
    };

    // One row per category: prefer row with rating (e.g. from saveIPCR)
    const byCategory = {};
    rows.forEach((row) => {
      const key = Object.keys(categoryMap).find(k => categoryMap[k] === row.category);
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

// Set IPCR targets
app.post("/api/ipcr/targets", (req, res) => {
  const { userId, targets } = req.body;

  Object.entries(targets).forEach(([key, value]) => {
    const category = categoryMap[key];
    const query = `
      INSERT INTO ipcr_records (user_id, category, target, accomplished)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(user_id, category, academic_year, semester)
      DO UPDATE SET target = ?
    `;
    db.run(query, [userId, category, value, value]);
  });

  res.json({ success: true });
});

// Upload documents
app.post("/api/documents/upload", upload.array("files"), async (req, res) => {
  try {
    const rawUserId = req.body.userId;
    const userId = parseInt(rawUserId, 10) || rawUserId;
    const tokens = req.body.tokens;
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const userTokens = tokens ? (typeof tokens === "string" ? JSON.parse(tokens) : tokens) : null;
    const results = [];

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}`);

        // ML classification
        const formData = new FormData();
        formData.append("file", fs.createReadStream(file.path), { filename: file.originalname, contentType: "application/pdf" });

        const mlResponse = await axios.post("http://localhost:5000/classify", formData, { headers: formData.getHeaders(), timeout: 60000 });
        const { category, confidence } = mlResponse.data;

        const dbCategory = categoryMap[category] || category;

        // Google Drive upload
        let driveResult = null;
        if (userTokens) {
          try {
            const driveService = new GoogleDriveService(userTokens);
            driveResult = await driveService.uploadFile(file.path, file.originalname, dbCategory);
          } catch (err) {
            console.warn("Drive upload failed:", err.message);
          }
        }

        const driveUploaded = !!driveResult;
        const driveId = driveUploaded ? driveResult.fileId : Math.random().toString(36).substring(7);
        const driveLink = driveUploaded ? driveResult.webViewLink : `https://drive.google.com/file/d/${driveId}`;

        // Save document info
        db.run(
          `INSERT INTO documents
           (user_id, filename, original_filename, file_size, category, confidence, google_drive_id, google_drive_link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, file.filename, file.originalname, file.size, dbCategory, confidence, driveId, driveLink],
        );

        // Update IPCR using saveIPCR
        const row = await new Promise((resolve, reject) =>
          db.get(`SELECT target, accomplished FROM ipcr_records WHERE user_id = ? AND category = ?`, [userId, dbCategory], (err, row) => err ? reject(err) : resolve(row))
        );

        const target = row?.target || 0;
        const accomplished = (row?.accomplished || 0) + 1;

        await saveIPCR(userId, dbCategory, accomplished, target);

        results.push({ filename: file.originalname, category: dbCategory, confidence, driveLink, driveUploaded });

        await fs.remove(file.path);
      } catch (err) {
        console.error("File processing error:", err.message);
        if (err.message && err.message.includes("saveIPCR")) console.error("saveIPCR error detail:", err);
        if (fs.existsSync(file.path)) await fs.remove(file.path);
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error("Upload error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get uploaded documents
app.get("/api/documents/:userId", (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, original_filename as name, file_size as size, category,
           confidence, google_drive_link as driveLink,
           upload_date as uploadDate
    FROM documents
    WHERE user_id = ?
    ORDER BY upload_date DESC
  `;
  db.all(query, [userId], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows));
});

// Export IPCR to Excel
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

// Admin dashboard
app.get("/api/admin/ipcr", (req, res) => {
  const query = `
    SELECT 
      u.id, u.name, u.department, u.email,
      COUNT(DISTINCT d.id) as document_count,
      AVG(ir.rating) as avg_rating
    FROM users u
    LEFT JOIN documents d ON u.id = d.user_id
    LEFT JOIN ipcr_records ir ON u.id = ir.user_id
    WHERE u.role = 'professor'
    GROUP BY u.id
  `;
  db.all(query, [], (err, rows) => err ? res.status(500).json({ error: err.message }) : res.json(rows));
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});