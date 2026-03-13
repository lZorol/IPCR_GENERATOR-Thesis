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
   * SEMESTER CONFIG TABLE
   * Stores the active academic period configured by admin.
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS semester_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      remarks TEXT,

      academic_year TEXT DEFAULT '2023-2024',
      semester TEXT DEFAULT '1st',

      start_date DATE,
      end_date DATE,

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
   * MIGRATIONS — add columns to existing tables if they are missing
   */
  const addColumnIfMissing = (table, columnName, typeDef) => {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${typeDef}`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error(`Migration add column ${table}.${columnName}:`, err.message);
      }
    });
  };

  // Rating score columns (legacy migration)
  addColumnIfMissing('ipcr_records', 'q_score', 'REAL DEFAULT 0');
  addColumnIfMissing('ipcr_records', 'e_score', 'REAL DEFAULT 0');
  addColumnIfMissing('ipcr_records', 't_score', 'REAL DEFAULT 0');
  addColumnIfMissing('ipcr_records', 'rating',  'REAL DEFAULT 0');

  // New semester date columns
  addColumnIfMissing('ipcr_records', 'start_date', 'DATE');
  addColumnIfMissing('ipcr_records', 'end_date',   'DATE');

  /**
   * SEED: default semester_config if none exists
   */
  db.get(`SELECT COUNT(*) as cnt FROM semester_config`, (err, row) => {
    if (!err && row && row.cnt === 0) {
      db.run(
        `INSERT INTO semester_config (academic_year, semester, start_date, end_date, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        ['2025-2026', '1st Semester', '2025-08-01', '2025-12-15'],
        () => console.log('✅ Default semester config seeded')
      );
    }
  });

  console.log('✅ Database initialization complete');
});

module.exports = db;