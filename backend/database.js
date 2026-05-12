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
   * IPCR SUMMARIES TABLE
   * Permanent source of truth for overall ratings to prevent discrepancies.
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS ipcr_summaries (
      user_id INTEGER,
      academic_year TEXT,
      semester TEXT,
      overall_rating REAL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, academic_year, semester),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

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

      folder_link TEXT,

      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, category, academic_year, semester)
    )
  `);


  /**
   * USER PROFILES TABLE
   * Stores locally-editable profile information (not from Google).
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      name TEXT,
      department TEXT,
      position TEXT,
      contact_number TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);


  /**
   * USER TARGETS TABLE
   * Per-user, per-semester target values (replaces static defaultTarget.json).
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS user_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      syllabus INTEGER DEFAULT 5,
      course_guide INTEGER DEFAULT 5,
      slm INTEGER DEFAULT 5,
      community_immersion INTEGER DEFAULT 5,
      grading_sheet INTEGER DEFAULT 5,
      tos INTEGER DEFAULT 5,
      attendance_sheet INTEGER DEFAULT 5,
      class_records INTEGER DEFAULT 5,
      evaluation_of_teaching_effectiveness INTEGER DEFAULT 5,
      classroom_observation INTEGER DEFAULT 5,
      test_questions INTEGER DEFAULT 5,
      answer_keys INTEGER DEFAULT 5,
      faculty_and_students_seek_advices INTEGER DEFAULT 5,
      accomplishment_report INTEGER DEFAULT 5,
      randd_proposal INTEGER DEFAULT 5,
      research_implemented INTEGER DEFAULT 5,
      research_presented INTEGER DEFAULT 5,
      research_published INTEGER DEFAULT 5,
      intellectual_property_rights INTEGER DEFAULT 5,
      research_utilized_developed INTEGER DEFAULT 5,
      number_of_citations INTEGER DEFAULT 5,
      extention_proposal INTEGER DEFAULT 5,
      persons_trained INTEGER DEFAULT 5,
      person_service_rating INTEGER DEFAULT 5,
      person_given_training INTEGER DEFAULT 5,
      technical_advice INTEGER DEFAULT 5,
      accomplishment_report_support INTEGER DEFAULT 5,
      attendance_flag_ceremony INTEGER DEFAULT 5,
      attendance_flag_lowering INTEGER DEFAULT 5,
      attendance_health_and_wellness_program INTEGER DEFAULT 5,
      attendance_school_celebrations INTEGER DEFAULT 5,
      training_seminar_conference_certificate INTEGER DEFAULT 5,
      atttendance_faculty_meeting INTEGER DEFAULT 5,
      attendance_iso_and_related_activities INTEGER DEFAULT 5,
      attendace_spiritual_activities INTEGER DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, academic_year, semester)
    )
  `);


  /**
   * TARGET PRESETS TABLE
   * Named presets that users can save and reuse across periods.
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS target_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      preset_name TEXT NOT NULL,
      syllabus INTEGER DEFAULT 5,
      course_guide INTEGER DEFAULT 5,
      slm INTEGER DEFAULT 5,
      community_immersion INTEGER DEFAULT 5,
      grading_sheet INTEGER DEFAULT 5,
      tos INTEGER DEFAULT 5,
      attendance_sheet INTEGER DEFAULT 5,
      class_records INTEGER DEFAULT 5,
      evaluation_of_teaching_effectiveness INTEGER DEFAULT 5,
      classroom_observation INTEGER DEFAULT 5,
      test_questions INTEGER DEFAULT 5,
      answer_keys INTEGER DEFAULT 5,
      faculty_and_students_seek_advices INTEGER DEFAULT 5,
      accomplishment_report INTEGER DEFAULT 5,
      randd_proposal INTEGER DEFAULT 5,
      research_implemented INTEGER DEFAULT 5,
      research_presented INTEGER DEFAULT 5,
      research_published INTEGER DEFAULT 5,
      intellectual_property_rights INTEGER DEFAULT 5,
      research_utilized_developed INTEGER DEFAULT 5,
      number_of_citations INTEGER DEFAULT 5,
      extention_proposal INTEGER DEFAULT 5,
      persons_trained INTEGER DEFAULT 5,
      person_service_rating INTEGER DEFAULT 5,
      person_given_training INTEGER DEFAULT 5,
      technical_advice INTEGER DEFAULT 5,
      accomplishment_report_support INTEGER DEFAULT 5,
      attendance_flag_ceremony INTEGER DEFAULT 5,
      attendance_flag_lowering INTEGER DEFAULT 5,
      attendance_health_and_wellness_program INTEGER DEFAULT 5,
      attendance_school_celebrations INTEGER DEFAULT 5,
      training_seminar_conference_certificate INTEGER DEFAULT 5,
      atttendance_faculty_meeting INTEGER DEFAULT 5,
      attendance_iso_and_related_activities INTEGER DEFAULT 5,
      attendace_spiritual_activities INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);


  /**
   * FACULTY ACCOMPLISHMENTS TABLE
   * Stores manually inputted accomplishments for Excel routing.
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS faculty_accomplishments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date DATE,
      venue TEXT,
      scope TEXT,
      hours INTEGER,
      sponsored_by TEXT,
      gdrive_link TEXT,
      research_related TEXT,
      academic_year TEXT DEFAULT '2023-2024',
      semester TEXT DEFAULT '1st',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);


  /**
   * ACADEMIC YEARS TABLE
   * Dynamically stores school years and semester dates.
   */
  db.run(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_year TEXT UNIQUE NOT NULL,
      first_sem_start TEXT,
      first_sem_end TEXT,
      second_sem_start TEXT,
      second_sem_end TEXT
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
  addColumnIfMissing('ipcr_records', 'rating', 'REAL DEFAULT 0');

  // New semester date columns
  addColumnIfMissing('ipcr_records', 'start_date', 'DATE');
  addColumnIfMissing('ipcr_records', 'end_date', 'DATE');

  // Google Drive folder link column (one per category row)
  addColumnIfMissing('ipcr_records', 'folder_link', 'TEXT');

  // Faculty Accomplishment / User role additions
  addColumnIfMissing('users', 'is_regular_faculty', 'INTEGER DEFAULT 1');
  addColumnIfMissing('users', 'position', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'accomplishment_category', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'target_presentation', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'target_publication', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'target_utilized', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'acc_presentation', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'acc_publication', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'acc_utilized', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'stat_proposal', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'stat_completed', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'stat_presented', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'stat_ip_rights', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'stat_utilized', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'stat_citations', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'extension_personnel', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'beneficiaries', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'budget_allocation', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'evaluation', 'REAL');
  addColumnIfMissing('faculty_accomplishments', 'admin_scopus', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'admin_rg', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'admin_gs', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'ext_total_target', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'ext_row7', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'ext_row8', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'ext_row9', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'extension_individual_data', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'totalExtensionTarget', 'INTEGER');
  addColumnIfMissing('faculty_accomplishments', 'active_partnerships_data', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'trainees_accomplishment_data', 'TEXT');
  addColumnIfMissing('faculty_accomplishments', 'extension_programs_data', 'TEXT');


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