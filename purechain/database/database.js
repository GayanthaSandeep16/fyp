const Database = require('better-sqlite3');
const path = require('path');

// Create/connect to database
const db = new Database(path.join(__dirname, 'fyp-database.db'));

// Create users table
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      national_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,  
      organization TEXT NOT NULL,
      sector TEXT CHECK(sector IN ('Healthcare', 'Finance')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

module.exports = db;