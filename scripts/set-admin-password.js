// 관리자 비밀번호를 설정하거나 교체하는 스크립트
//
//   node scripts/set-admin-password.js '<새 비밀번호>'
//
// DATABASE_URL이 설정돼 있으면 Postgres, 없으면 로컬 SQLite(data/app.db)를 대상으로 한다.
// 관리자 계정이 없으면 새로 만든다.
const path = require('path');
const bcrypt = require('bcryptjs');

const ADMIN_USERNAME = 'admin';
const MIN_LENGTH = 12;

async function updateSqlite(hashedPassword) {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, '..', 'data', 'app.db');
  const db = new Database(dbPath);

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);

  if (existing) {
    db.prepare('UPDATE users SET password = ?, role = ? WHERE username = ?').run(
      hashedPassword,
      'admin',
      ADMIN_USERNAME,
    );
    console.log(`SQLite(${dbPath}): 관리자 비밀번호를 변경했습니다.`);
  } else {
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
      ADMIN_USERNAME,
      hashedPassword,
      'admin',
    );
    console.log(`SQLite(${dbPath}): 관리자 계정을 새로 만들었습니다.`);
  }

  db.close();
}

async function updatePostgres(hashedPassword) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [ADMIN_USERNAME]);

    if (existing.rows.length > 0) {
      await client.query('UPDATE users SET password = $1, role = $2 WHERE username = $3', [
        hashedPassword,
        'admin',
        ADMIN_USERNAME,
      ]);
      console.log('Postgres: 관리자 비밀번호를 변경했습니다.');
    } else {
      await client.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', [
        ADMIN_USERNAME,
        hashedPassword,
        'admin',
      ]);
      console.log('Postgres: 관리자 계정을 새로 만들었습니다.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error("사용법: node scripts/set-admin-password.js '<새 비밀번호>'");
    process.exit(1);
  }

  if (password.length < MIN_LENGTH) {
    console.error(`비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.`);
    process.exit(1);
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const usePostgres = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'));

  if (usePostgres) {
    await updatePostgres(hashedPassword);
  } else {
    await updateSqlite(hashedPassword);
  }
}

main().catch((error) => {
  console.error('실패:', error.message);
  process.exit(1);
});
