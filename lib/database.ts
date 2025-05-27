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
    password TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    google_id TEXT UNIQUE,
    email TEXT,
    profile_image_url TEXT
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
export const createUser = (
  username: string,
  password?: string | null,
  googleId?: string | null,
  email?: string | null,
  profileImageUrl?: string | null
) => {
  const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
  return db.prepare(
    'INSERT INTO users (username, password, google_id, email, profile_image_url) VALUES (?, ?, ?, ?, ?)'
  ).run(username, hashedPassword, googleId, email, profileImageUrl);
};

export const getUserByGoogleId = (googleId: string) => {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
};

export const findOrCreateUserByGoogleId = (
  googleId: string,
  email: string,
  username: string,
  profileImageUrl?: string
) => {
  let user = getUserByGoogleId(googleId);
  if (user) {
    return user;
  } else {
    const createResult = createUser(username, null, googleId, email, profileImageUrl);
    if (createResult.lastInsertRowid) {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(createResult.lastInsertRowid);
    }
    // Fallback if lastInsertRowid is not available (should not happen with AUTOINCREMENT PK)
    // or if there was an issue with the insert not returning it (e.g. UNIQUE constraint violation)
    // A more robust error handling might be needed here depending on application logic.
    return getUserByGoogleId(googleId); // Attempt to fetch by googleId as a fallback
  }
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

export const updateLayout = (id: number, name: string, config: string) => {
  return db.prepare('UPDATE layouts SET name = ?, config = ? WHERE id = ?').run(name, config, id);
};

export const deleteLayout = (id: number) => {
  return db.prepare('DELETE FROM layouts WHERE id = ?').run(id);
};

export const getLayouts = () => {
  return db.prepare('SELECT * FROM layouts ORDER BY created_at DESC').all();
};

export default db;