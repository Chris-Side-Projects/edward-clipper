// Database configuration and connection
import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'clips.db');
    
    // Ensure data directory exists
    const fs = require('fs');
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    db = new Database(dbPath);
    
    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS clips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        tag TEXT,
        company TEXT,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        r2_folder TEXT NOT NULL,
        file_count INTEGER DEFAULT 0,
        has_screenshot BOOLEAN DEFAULT FALSE,
        has_html BOOLEAN DEFAULT FALSE,
        has_pdf BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_clips_url ON clips(url);
      CREATE INDEX IF NOT EXISTS idx_clips_tag ON clips(tag);
      CREATE INDEX IF NOT EXISTS idx_clips_captured_at ON clips(captured_at);
    `);
  }
  
  return db;
}

export interface ClipRecord {
  id?: number;
  url: string;
  title?: string;
  tag?: string;
  company?: string;
  captured_at: string;
  r2_folder: string;
  file_count: number;
  has_screenshot: boolean;
  has_html: boolean;
  has_pdf: boolean;
}

export function insertClip(clip: Omit<ClipRecord, 'id'>): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO clips (url, title, tag, company, captured_at, r2_folder, file_count, has_screenshot, has_html, has_pdf)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    clip.url,
    clip.title,
    clip.tag,
    clip.company,
    clip.captured_at,
    clip.r2_folder,
    clip.file_count,
    clip.has_screenshot,
    clip.has_html,
    clip.has_pdf
  );
  
  return result.lastInsertRowid as number;
}

export function getClips(limit: number = 50, offset: number = 0): ClipRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM clips 
    ORDER BY captured_at DESC 
    LIMIT ? OFFSET ?
  `);
  
  return stmt.all(limit, offset) as ClipRecord[];
}