// 전체 템플릿 데이터베이스 초기화 테스트
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// 전체 36개 템플릿 데이터
const defaultTemplates = [
  // 1장 템플릿 (6개)
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
    name: "1장 세로형 - 중앙 정렬",
    config: JSON.stringify({
      photoCount: 1,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 15, y: 15, width: 70, height: 70 }
      ]
    })
  },
  {
    name: "1장 세로형 - 상단 배치",
    config: JSON.stringify({
      photoCount: 1,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 10, y: 5, width: 80, height: 60 }
      ]
    })
  },
  {
    name: "1장 가로형 - 전체 화면",
    config: JSON.stringify({
      photoCount: 1,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 94, height: 94 }
      ]
    })
  },
  {
    name: "1장 가로형 - 중앙 정렬",
    config: JSON.stringify({
      photoCount: 1,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 15, y: 15, width: 70, height: 70 }
      ]
    })
  },
  {
    name: "1장 가로형 - 좌측 배치",
    config: JSON.stringify({
      photoCount: 1,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 5, y: 10, width: 60, height: 80 }
      ]
    })
  },
  
  // 2장 템플릿 (6개)
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
  },
  {
    name: "2장 세로형 - 좌우 분할",
    config: JSON.stringify({
      photoCount: 2,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 10, width: 46, height: 80 },
        { id: "layout-1", x: 51, y: 10, width: 46, height: 80 }
      ]
    })
  },
  {
    name: "2장 세로형 - 대각선 배치",
    config: JSON.stringify({
      photoCount: 2,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 5, y: 5, width: 55, height: 55 },
        { id: "layout-1", x: 40, y: 40, width: 55, height: 55 }
      ]
    })
  },
  {
    name: "2장 가로형 - 좌우 분할",
    config: JSON.stringify({
      photoCount: 2,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 5, width: 46, height: 90 },
        { id: "layout-1", x: 51, y: 5, width: 46, height: 90 }
      ]
    })
  },
  {
    name: "2장 가로형 - 상하 분할",
    config: JSON.stringify({
      photoCount: 2,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 10, y: 3, width: 80, height: 46 },
        { id: "layout-1", x: 10, y: 51, width: 80, height: 46 }
      ]
    })
  },
  {
    name: "2장 가로형 - 비대칭 배치",
    config: JSON.stringify({
      photoCount: 2,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 5, y: 5, width: 60, height: 90 },
        { id: "layout-1", x: 67, y: 5, width: 28, height: 90 }
      ]
    })
  },
  
  // 3장 템플릿 (6개)
  {
    name: "3장 세로형 - 큰사진 + 2개 작은사진",
    config: JSON.stringify({
      photoCount: 3,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 94, height: 60 },
        { id: "layout-1", x: 3, y: 65, width: 46, height: 32 },
        { id: "layout-2", x: 51, y: 65, width: 46, height: 32 }
      ]
    })
  },
  {
    name: "3장 세로형 - 세로 3단 분할",
    config: JSON.stringify({
      photoCount: 3,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 8, y: 3, width: 84, height: 30 },
        { id: "layout-1", x: 8, y: 35, width: 84, height: 30 },
        { id: "layout-2", x: 8, y: 67, width: 84, height: 30 }
      ]
    })
  },
  {
    name: "3장 세로형 - L자 배치",
    config: JSON.stringify({
      photoCount: 3,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 60, height: 60 },
        { id: "layout-1", x: 65, y: 3, width: 32, height: 30 },
        { id: "layout-2", x: 65, y: 35, width: 32, height: 62 }
      ]
    })
  },
  {
    name: "3장 가로형 - 가로 3단 분할",
    config: JSON.stringify({
      photoCount: 3,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 8, width: 30, height: 84 },
        { id: "layout-1", x: 35, y: 8, width: 30, height: 84 },
        { id: "layout-2", x: 67, y: 8, width: 30, height: 84 }
      ]
    })
  },
  {
    name: "3장 가로형 - 큰사진 + 2개 작은사진",
    config: JSON.stringify({
      photoCount: 3,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 60, height: 94 },
        { id: "layout-1", x: 65, y: 3, width: 32, height: 46 },
        { id: "layout-2", x: 65, y: 51, width: 32, height: 46 }
      ]
    })
  },
  {
    name: "3장 가로형 - 역L자 배치",
    config: JSON.stringify({
      photoCount: 3,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 94, height: 45 },
        { id: "layout-1", x: 3, y: 50, width: 46, height: 47 },
        { id: "layout-2", x: 51, y: 50, width: 46, height: 47 }
      ]
    })
  },
  
  // 4장 템플릿 (6개)
  {
    name: "4장 세로형 - 2x2 그리드",
    config: JSON.stringify({
      photoCount: 4,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 46, height: 46 },
        { id: "layout-1", x: 51, y: 3, width: 46, height: 46 },
        { id: "layout-2", x: 3, y: 51, width: 46, height: 46 },
        { id: "layout-3", x: 51, y: 51, width: 46, height: 46 }
      ]
    })
  },
  {
    name: "4장 세로형 - 세로 4단",
    config: JSON.stringify({
      photoCount: 4,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 8, y: 2, width: 84, height: 22 },
        { id: "layout-1", x: 8, y: 26, width: 84, height: 22 },
        { id: "layout-2", x: 8, y: 50, width: 84, height: 22 },
        { id: "layout-3", x: 8, y: 74, width: 84, height: 22 }
      ]
    })
  },
  {
    name: "4장 세로형 - 큰사진 + 3개 작은사진",
    config: JSON.stringify({
      photoCount: 4,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 60, height: 60 },
        { id: "layout-1", x: 65, y: 3, width: 32, height: 30 },
        { id: "layout-2", x: 65, y: 35, width: 32, height: 30 },
        { id: "layout-3", x: 3, y: 65, width: 94, height: 32 }
      ]
    })
  },
  {
    name: "4장 가로형 - 2x2 그리드",
    config: JSON.stringify({
      photoCount: 4,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 46, height: 46 },
        { id: "layout-1", x: 51, y: 3, width: 46, height: 46 },
        { id: "layout-2", x: 3, y: 51, width: 46, height: 46 },
        { id: "layout-3", x: 51, y: 51, width: 46, height: 46 }
      ]
    })
  },
  {
    name: "4장 가로형 - 가로 4단",
    config: JSON.stringify({
      photoCount: 4,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 2, y: 8, width: 22, height: 84 },
        { id: "layout-1", x: 26, y: 8, width: 22, height: 84 },
        { id: "layout-2", x: 50, y: 8, width: 22, height: 84 },
        { id: "layout-3", x: 74, y: 8, width: 22, height: 84 }
      ]
    })
  },
  {
    name: "4장 가로형 - 큰사진 + 3개 작은사진",
    config: JSON.stringify({
      photoCount: 4,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 60, height: 60 },
        { id: "layout-1", x: 65, y: 3, width: 32, height: 30 },
        { id: "layout-2", x: 65, y: 35, width: 32, height: 30 },
        { id: "layout-3", x: 3, y: 65, width: 60, height: 32 }
      ]
    })
  },
  
  // 5장 템플릿 (6개)
  {
    name: "5장 세로형 - 큰사진 + 4개 작은사진",
    config: JSON.stringify({
      photoCount: 5,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 94, height: 50 },
        { id: "layout-1", x: 3, y: 55, width: 23, height: 22 },
        { id: "layout-2", x: 28, y: 55, width: 23, height: 22 },
        { id: "layout-3", x: 53, y: 55, width: 22, height: 22 },
        { id: "layout-4", x: 77, y: 55, width: 20, height: 22 }
      ]
    })
  },
  {
    name: "5장 세로형 - 센터 + 4모서리",
    config: JSON.stringify({
      photoCount: 5,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 25, y: 25, width: 50, height: 50 },
        { id: "layout-1", x: 3, y: 3, width: 20, height: 20 },
        { id: "layout-2", x: 77, y: 3, width: 20, height: 20 },
        { id: "layout-3", x: 3, y: 77, width: 20, height: 20 },
        { id: "layout-4", x: 77, y: 77, width: 20, height: 20 }
      ]
    })
  },
  {
    name: "5장 세로형 - 세로 중앙 + 좌우 배치",
    config: JSON.stringify({
      photoCount: 5,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 30, height: 94 },
        { id: "layout-1", x: 35, y: 3, width: 30, height: 46 },
        { id: "layout-2", x: 35, y: 51, width: 30, height: 46 },
        { id: "layout-3", x: 67, y: 3, width: 30, height: 46 },
        { id: "layout-4", x: 67, y: 51, width: 30, height: 46 }
      ]
    })
  },
  {
    name: "5장 가로형 - 큰사진 + 4개 작은사진",
    config: JSON.stringify({
      photoCount: 5,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 50, height: 94 },
        { id: "layout-1", x: 55, y: 3, width: 22, height: 23 },
        { id: "layout-2", x: 55, y: 28, width: 22, height: 23 },
        { id: "layout-3", x: 55, y: 53, width: 22, height: 22 },
        { id: "layout-4", x: 55, y: 77, width: 22, height: 20 }
      ]
    })
  },
  {
    name: "5장 가로형 - 가로 중앙 + 상하 배치",
    config: JSON.stringify({
      photoCount: 5,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 94, height: 30 },
        { id: "layout-1", x: 3, y: 35, width: 46, height: 30 },
        { id: "layout-2", x: 51, y: 35, width: 46, height: 30 },
        { id: "layout-3", x: 3, y: 67, width: 46, height: 30 },
        { id: "layout-4", x: 51, y: 67, width: 46, height: 30 }
      ]
    })
  },
  {
    name: "5장 가로형 - 모자이크 배치",
    config: JSON.stringify({
      photoCount: 5,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 40, height: 40 },
        { id: "layout-1", x: 45, y: 3, width: 25, height: 25 },
        { id: "layout-2", x: 72, y: 3, width: 25, height: 25 },
        { id: "layout-3", x: 45, y: 30, width: 52, height: 35 },
        { id: "layout-4", x: 3, y: 45, width: 40, height: 52 }
      ]
    })
  },
  
  // 6장 템플릿 (6개)
  {
    name: "6장 세로형 - 2x3 그리드",
    config: JSON.stringify({
      photoCount: 6,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 46, height: 30 },
        { id: "layout-1", x: 51, y: 3, width: 46, height: 30 },
        { id: "layout-2", x: 3, y: 35, width: 46, height: 30 },
        { id: "layout-3", x: 51, y: 35, width: 46, height: 30 },
        { id: "layout-4", x: 3, y: 67, width: 46, height: 30 },
        { id: "layout-5", x: 51, y: 67, width: 46, height: 30 }
      ]
    })
  },
  {
    name: "6장 세로형 - 3x2 그리드",
    config: JSON.stringify({
      photoCount: 6,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 30, height: 46 },
        { id: "layout-1", x: 35, y: 3, width: 30, height: 46 },
        { id: "layout-2", x: 67, y: 3, width: 30, height: 46 },
        { id: "layout-3", x: 3, y: 51, width: 30, height: 46 },
        { id: "layout-4", x: 35, y: 51, width: 30, height: 46 },
        { id: "layout-5", x: 67, y: 51, width: 30, height: 46 }
      ]
    })
  },
  {
    name: "6장 세로형 - 큰사진 + 5개 작은사진",
    config: JSON.stringify({
      photoCount: 6,
      orientation: "portrait",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 60, height: 60 },
        { id: "layout-1", x: 65, y: 3, width: 32, height: 30 },
        { id: "layout-2", x: 65, y: 35, width: 32, height: 28 },
        { id: "layout-3", x: 3, y: 65, width: 30, height: 32 },
        { id: "layout-4", x: 35, y: 65, width: 30, height: 32 },
        { id: "layout-5", x: 67, y: 65, width: 30, height: 32 }
      ]
    })
  },
  {
    name: "6장 가로형 - 3x2 그리드",
    config: JSON.stringify({
      photoCount: 6,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 30, height: 46 },
        { id: "layout-1", x: 35, y: 3, width: 30, height: 46 },
        { id: "layout-2", x: 67, y: 3, width: 30, height: 46 },
        { id: "layout-3", x: 3, y: 51, width: 30, height: 46 },
        { id: "layout-4", x: 35, y: 51, width: 30, height: 46 },
        { id: "layout-5", x: 67, y: 51, width: 30, height: 46 }
      ]
    })
  },
  {
    name: "6장 가로형 - 2x3 그리드",
    config: JSON.stringify({
      photoCount: 6,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 46, height: 30 },
        { id: "layout-1", x: 51, y: 3, width: 46, height: 30 },
        { id: "layout-2", x: 3, y: 35, width: 46, height: 30 },
        { id: "layout-3", x: 51, y: 35, width: 46, height: 30 },
        { id: "layout-4", x: 3, y: 67, width: 46, height: 30 },
        { id: "layout-5", x: 51, y: 67, width: 46, height: 30 }
      ]
    })
  },
  {
    name: "6장 가로형 - 큰사진 + 5개 작은사진",
    config: JSON.stringify({
      photoCount: 6,
      orientation: "landscape",
      layouts: [
        { id: "layout-0", x: 3, y: 3, width: 60, height: 60 },
        { id: "layout-1", x: 65, y: 3, width: 32, height: 30 },
        { id: "layout-2", x: 65, y: 35, width: 32, height: 28 },
        { id: "layout-3", x: 3, y: 65, width: 30, height: 32 },
        { id: "layout-4", x: 35, y: 65, width: 30, height: 32 },
        { id: "layout-5", x: 67, y: 65, width: 30, height: 32 }
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
    
    const insertMany = db.transaction((templates) => {
      let insertedCount = 0;
      for (const template of templates) {
        try {
          insertStmt.run(template.name, template.config, adminUserId);
          insertedCount++;
        } catch (error) {
          console.error(`Failed to insert template ${template.name}:`, error);
        }
      }
      return insertedCount;
    });
    
    const inserted = insertMany(defaultTemplates);
    console.log(`Initialized ${inserted} default templates`);
  }

  // 결과 확인
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const layoutCount = db.prepare('SELECT COUNT(*) as count FROM layouts').get().count;
  
  console.log(`Database initialized with ${userCount} users and ${layoutCount} layouts`);
  
  // 템플릿 목록 출력
  const layouts = db.prepare('SELECT name FROM layouts ORDER BY id').all();
  console.log('Templates created:');
  layouts.forEach((layout, index) => {
    console.log(`  ${index + 1}. ${layout.name}`);
  });
  
  db.close();
}

// 테스트 실행
initializeDatabase();