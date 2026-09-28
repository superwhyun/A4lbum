// lib/database.ts
import { DatabaseAdapter } from './database-types';
import { SQLiteAdapter } from './database-sqlite';
// PostgresAdapter(lib/database-postgres.ts)는 참고용으로 파일만 남겨두고 더 이상 사용하지 않는다.

// 모든 환경(로컬, Vercel 배포 포함)에서 SQLite로 고정한다.
// DATABASE_URL(Neon Postgres 등)이 주입돼 있어도 무시한다.
// DB 파일 경로는 SQLiteAdapter가 환경에 맞게 결정한다(Vercel: /tmp, 그 외: data/app.db).
const createDatabaseAdapter = (): DatabaseAdapter => {
  return new SQLiteAdapter();
};

// 데이터베이스 인스턴스 생성
export const db = createDatabaseAdapter();

// 기존 함수들을 어댑터 메서드로 래핑 (하위 호환성)
export const createUser = (
  username: string,
  password?: string | null,
  googleId?: string | null,
  email?: string | null,
  profileImageUrl?: string | null
) => db.createUser(username, password, googleId, email, profileImageUrl);

export const getUserByGoogleId = (googleId: string) => db.getUserByGoogleId(googleId);

export const getUserByUsername = (username: string) => db.getUserByUsername(username);

export const findOrCreateUserByGoogleId = (
  googleId: string,
  email: string,
  username: string,
  profileImageUrl?: string
) => db.findOrCreateUserByGoogleId(googleId, email, username, profileImageUrl);

export const verifyPassword = (password: string, hashedPassword: string) => 
  db.verifyPassword(password, hashedPassword);

export const saveLayout = (name: string, config: string, userId: number) => 
  db.saveLayout(name, config, userId);

export const updateLayout = (id: number, name: string, config: string) => 
  db.updateLayout(id, name, config);

export const deleteLayout = (id: number) => db.deleteLayout(id);

export const getLayouts = () => db.getLayouts();

export default db;

// %%%%%LAST%%%%%