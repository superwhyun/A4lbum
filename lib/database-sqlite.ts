// lib/database-sqlite.ts
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { DatabaseAdapter, User, Layout } from './database-types';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'app.db');
    this.db = new Database(dbPath);
    this.initializeTables();
    this.initializeAdmin();
  }

  private initializeTables() {
    // 테이블 생성
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        google_id TEXT UNIQUE,
        email TEXT,
        profile_image_url TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS layouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);
  }

  private initializeAdmin() {
    const existingAdmin = this.db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    
    if (!existingAdmin) {
      const hashedPassword = bcrypt.hashSync('admin', 10);
      this.db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
      console.log('Admin user created');
    }
  }

  createUser(
    username: string,
    password?: string | null,
    googleId?: string | null,
    email?: string | null,
    profileImageUrl?: string | null
  ) {
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
    return this.db.prepare(
      'INSERT INTO users (username, password, google_id, email, profile_image_url) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hashedPassword, googleId, email, profileImageUrl);
  }

  getUserByGoogleId(googleId: string): User | null {
    return this.db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as User | null;
  }

  getUserByUsername(username: string): User | null {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | null;
  }

  findOrCreateUserByGoogleId(
    googleId: string,
    email: string,
    username: string,
    profileImageUrl?: string
  ): User | null {
    let user = this.getUserByGoogleId(googleId);
    if (user) {
      return user;
    } else {
      const createResult = this.createUser(username, null, googleId, email, profileImageUrl);
      if (createResult.lastInsertRowid) {
        return this.db.prepare('SELECT * FROM users WHERE id = ?').get(createResult.lastInsertRowid) as User;
      }
      return this.getUserByGoogleId(googleId);
    }
  }

  verifyPassword(password: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(password, hashedPassword);
  }

  saveLayout(name: string, config: string, userId: number) {
    return this.db.prepare('INSERT INTO layouts (name, config, created_by) VALUES (?, ?, ?)').run(name, config, userId);
  }

  updateLayout(id: number, name: string, config: string) {
    return this.db.prepare('UPDATE layouts SET name = ?, config = ? WHERE id = ?').run(name, config, id);
  }

  deleteLayout(id: number) {
    return this.db.prepare('DELETE FROM layouts WHERE id = ?').run(id);
  }

  getLayouts(): Layout[] {
    return this.db.prepare('SELECT * FROM layouts ORDER BY created_at DESC').all() as Layout[];
  }
}

// %%%%%LAST%%%%%