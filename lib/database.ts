// lib/database.ts
import { DatabaseAdapter } from './database-types';
import { SQLiteAdapter } from './database-sqlite';
import { PostgresAdapter } from './database-postgres';

// 환경별 데이터베이스 어댑터 선택
const createDatabaseAdapter = (): DatabaseAdapter => {
  // Vercel 환경 감지 방법들
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
  const hasPostgresUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
  
  console.log('Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    hasPostgresUrl: !!hasPostgresUrl
  });
  
  // Postgres 환경변수가 있으면 Postgres 사용 (Vercel/배포 환경)
  if (hasPostgresUrl) {
    console.log('Using PostgreSQL database (Neon) for production');
    return new PostgresAdapter();
  }
  
  // 그 외에는 SQLite 사용 (로컬 개발환경)
  console.log('Using SQLite database for local development');
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