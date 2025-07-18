// 공유 템플릿 데이터를 사용하는 최종 템플릿 삽입 스크립트
const Database = require('better-sqlite3');
const path = require('path');

// 템플릿 데이터를 test-full-init.js에서 가져옴
const { defaultTemplates } = require('./test-full-init.js');

// 데이터베이스 연결
const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new Database(dbPath);

// 관리자 사용자 ID 조회
function getAdminUserId() {
  const adminUser = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  return adminUser ? adminUser.id : 1;
}

// 템플릿 삽입 함수
function insertTemplates() {
  const adminUserId = getAdminUserId();
  
  // 기존 템플릿 삭제 (선택사항)
  console.log('기존 템플릿 삭제...');
  db.prepare('DELETE FROM layouts WHERE created_by = ?').run(adminUserId);
  
  // 새 템플릿 삽입
  const insertStmt = db.prepare(`
    INSERT INTO layouts (name, config, created_by, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  
  // defaultTemplates를 사용하여 삽입
  const templates = defaultTemplates.map(template => ({
    name: template.name,
    config: JSON.stringify(template.config)
  }));
  
  console.log(`총 ${templates.length}개의 템플릿을 삽입합니다...`);
  
  const insertMany = db.transaction((templates) => {
    let successCount = 0;
    for (const template of templates) {
      try {
        insertStmt.run(template.name, template.config, adminUserId);
        successCount++;
        console.log(`✓ ${successCount}/${templates.length}: ${template.name}`);
      } catch (error) {
        console.error(`✗ ${template.name}: ${error.message}`);
      }
    }
    return successCount;
  });
  
  const inserted = insertMany(templates);
  console.log(`완료! ${inserted}개의 템플릿이 성공적으로 삽입되었습니다.`);
}

// 스크립트 실행
insertTemplates();

// 데이터베이스 연결 종료
db.close();

// 공유 템플릿 데이터 내보내기
module.exports = { defaultTemplates };