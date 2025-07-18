// 데이터베이스 초기화 테스트 스크립트
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// 기본 템플릿 데이터 (간단한 버전)
const defaultTemplates = [
  {
    name: "1장 세로형 - 전체 화면",
    config: JSON.stringify({
      photoCount: 1,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 94, height: 94 }
      ]
    })
  },
  {
    name: "2장 세로형 - 상하 분할",
    config: JSON.stringify({
      photoCount: 2,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 5, y: 3, width: 90, height: 46 },
        { id: "layout-1", x: 5, y: 51, width: 90, height: 46 }
      ]
    })
  }
];

// 데이터베이스 초기화 함수
function initializeDatabase() {
  const dbPath = path.join(__dirname, '..', 'data', 'app.db');
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

  // 관리자 사용자 생성
  const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync('admin', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
    console.log('Admin user created');
  }

  // 템플릿 초기화
  const existingTemplateCount = db.prepare('SELECT COUNT(*) as count FROM layouts').get().count;
  if (existingTemplateCount === 0) {
    const adminUser = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
    const adminUserId = adminUser?.id || 1;
    
    const insertStmt = db.prepare(`
      INSERT INTO layouts (name, config, created_by, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    let insertedCount = 0;
    for (const template of defaultTemplates) {
      try {
        insertStmt.run(template.name, template.config, adminUserId);
        insertedCount++;
      } catch (error) {
        console.error(`Failed to insert template ${template.name}:`, error);
      }
    }
    
    console.log(`Initialized ${insertedCount} default templates`);
  }

  // 결과 확인
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const layoutCount = db.prepare('SELECT COUNT(*) as count FROM layouts').get().count;
  
  console.log(`Database initialized with ${userCount} users and ${layoutCount} layouts`);
  
  db.close();
}

// 테스트 실행
initializeDatabase();