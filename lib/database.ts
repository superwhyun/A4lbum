// lib/database.ts
import { DatabaseAdapter } from './database-types';
import { SQLiteAdapter } from './database-sqlite';
import { PostgresAdapter } from './database-postgres';

// DATABASE_URL(Neon Postgres 등)이 주입되면 Postgres(영속), 없으면 로컬 SQLite로 폴백.
// - 로컬/CLI 개발: DATABASE_URL이 없어 SQLiteAdapter(data/app.db) 사용 — 기존 동작 유지.
// - Vercel 배포: 대시보드 DATABASE_URL(Neon) 주입 시 PostgresAdapter 사용 → 로그인/레이아웃 영속.
// SQLiteAdapter는 DB 파일 경로를 환경에 맞게 결정(Vercel: /tmp, 그 외: data/app.db).
export const createDatabaseAdapter = (): DatabaseAdapter => {
  return process.env.DATABASE_URL ? new PostgresAdapter() : new SQLiteAdapter();
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