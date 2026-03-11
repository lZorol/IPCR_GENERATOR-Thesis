const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'ipcr.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Initialize database tables
db.serialize(() => {

  /**
   * USERS TABLE
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'professor',
      department TEXT,
      profile_image TEXT,
      google_drive_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);


  /**
   * CATEGORY DEADLINES TABLE
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS category_deadlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT UNIQUE NOT NULL,
      deadline DATE NOT NULL
    )
  `);


  /**
   * IPCR TARGETS TABLE
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS ipcr_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      target INTEGER DEFAULT 0,
      academic_year TEXT DEFAULT '2023-2024',
      semester TEXT DEFAULT '1st',
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, category, academic_year, semester)
    )
  `);


  /**
   * DOCUMENTS TABLE
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_size INTEGER,
      category TEXT NOT NULL,
      confidence REAL,
      google_drive_id TEXT,
      google_drive_link TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      academic_year TEXT DEFAULT '2023-2024',
      semester TEXT DEFAULT '1st',
      status TEXT DEFAULT 'processed',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);


  /**
   * IPCR RECORDS TABLE
   * Added q_score, e_score, t_score
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS ipcr_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,

      target INTEGER DEFAULT 0,
      accomplished INTEGER DEFAULT 0,

      q_score REAL DEFAULT 0,
      e_score REAL DEFAULT 0,
      t_score REAL DEFAULT 0,

      rating REAL DEFAULT 0,

      submission_date DATE,
      completion_date DATE,
      remarks TEXT,

      academic_year TEXT DEFAULT '2023-2024',
      semester TEXT DEFAULT '1st',

      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, category, academic_year, semester)
    )
  `);


  /**
   * INDEXES
   */
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)`);

  /**
   * MIGRATION: ensure ipcr_records has rating columns (for DBs created before they existed)
   */
  const addColumnIfMissing = (columnName, typeDef) => {
    db.run(`ALTER TABLE ipcr_records ADD COLUMN ${columnName} ${typeDef}`, (err) => {
      if (err && !err.message.includes('duplicate column name')) console.error(`Migration add column ${columnName}:`, err.message);
    });
  };
  addColumnIfMissing('q_score', 'REAL DEFAULT 0');
  addColumnIfMissing('e_score', 'REAL DEFAULT 0');
  addColumnIfMissing('t_score', 'REAL DEFAULT 0');
  addColumnIfMissing('rating', 'REAL DEFAULT 0');

  /**
   * DEFAULT DEADLINES
   */
  const insertDeadline = `
    INSERT OR IGNORE INTO category_deadlines (category, deadline)
    VALUES (?, ?)
  `;

  db.run(insertDeadline, ['syllabus', '2026-04-15']);
  db.run(insertDeadline, ['courseGuide', '2026-04-20']);
  db.run(insertDeadline, ['slm', '2026-05-01']);
  db.run(insertDeadline, ['tos', '2026-05-10']);
  db.run(insertDeadline, ['gradingSheet', '2026-05-20']);

  console.log('✅ Default deadlines inserted');
  console.log('✅ Database initialization complete');
});

module.exports = db;