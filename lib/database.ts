import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'app.db');
const db = new Database(dbPath);

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )
`);

// 기본 관리자 계정 생성
const initializeAdmin = () => {
  const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync('admin', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
    console.log('Admin user created');
  }
};

initializeAdmin();

// 사용자 관련 함수들
export const createUser = (username: string, password: string) => {
  const hashedPassword = bcrypt.hashSync(password, 10);
  return db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
};

export const getUserByUsername = (username: string) => {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
};

export const verifyPassword = (password: string, hashedPassword: string) => {
  return bcrypt.compareSync(password, hashedPassword);
};

// 레이아웃 관련 함수들
export const saveLayout = (name: string, config: string, userId: number) => {
  return db.prepare('INSERT INTO layouts (name, config, created_by) VALUES (?, ?, ?)').run(name, config, userId);
};

export const getLayouts = () => {
  return db.prepare('SELECT * FROM layouts ORDER BY created_at DESC').all();
};

export default db;