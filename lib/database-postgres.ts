// lib/database-postgres.ts
import { Pool, PoolClient, QueryResult, types } from 'pg';
import bcrypt from 'bcryptjs';
import { DatabaseAdapter, User, Layout } from './database-types';
import { defaultTemplates, serializeTemplate } from './default-templates';

// SQLiteAdapter처럼 created_at을 문자열로 돌려준다(pg 기본값은 Date 객체라 User/Layout 타입과 어긋남).
const TIMESTAMP_OID = 1114;
const pgTypes = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
    oid === TIMESTAMP_OID ? (value: string) => value : types.getTypeParser(oid, format as any)) as typeof types.getTypeParser,
};

// 동시에 뜬 서버리스 인스턴스들이 테이블 생성/템플릿 시딩을 중복 실행하지 않도록 거는 advisory lock 키.
const INIT_LOCK_KEY = 4_142_001;

// 라우트가 better-sqlite3 RunResult 모양(lastInsertRowid/changes)을 기대하므로 같은 모양으로 맞춘다.
const toRunResult = (result: QueryResult) => ({
  changes: result.rowCount ?? 0,
  lastInsertRowid: result.rows[0]?.id,
});

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Pool 생성은 네트워크 연결을 하지 않는다. 연결/테이블 초기화는 첫 쿼리 때 lazy하게 한다.
    // (생성자에서 바로 연결하면 콜드 스타트마다 DB를 치고, 첫 요청이 테이블 생성보다 먼저 도착할 수 있었다)
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      types: pgTypes,
    });

    // 유휴 연결이 끊기면(Neon은 유휴 연결을 닫는다) Pool이 'error'를 내는데, 리스너가 없으면 프로세스가 죽는다.
    this.pool.on('error', (error) => {
      console.error('Postgres pool error:', error);
    });
  }

  private ready(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initialize().catch((error) => {
        // 실패하면 다음 요청에서 다시 시도한다(일시적 연결 실패로 인스턴스가 영구히 망가지지 않게).
        this.initPromise = null;
        throw error;
      });
    }
    return this.initPromise;
  }

  private async query(text: string, params?: unknown[]): Promise<QueryResult> {
    await this.ready();
    return this.pool.query(text, params);
  }

  private async initialize() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [INIT_LOCK_KEY]);
      await this.initializeTables(client);
      await this.initializeAdmin(client);
      await this.initializeTemplates(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('Postgres 초기화 실패:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async initializeTables(client: PoolClient) {
    // Users 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        google_id VARCHAR(255) UNIQUE,
        email VARCHAR(255),
        profile_image_url TEXT
      )
    `);

    // Layouts 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS layouts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        config TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async initializeAdmin(client: PoolClient) {
    const result = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (result.rows.length > 0) return;

    // 초기 비밀번호를 환경변수로만 받는다. 예전처럼 'admin'을 기본값으로 심으면
    // 배포된 인스턴스마다 admin/admin으로 관리자 로그인이 뚫린다.
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!initialPassword) {
      console.warn(
        'ADMIN_INITIAL_PASSWORD가 없어 관리자 계정을 만들지 않았습니다. ' +
          '관리자가 필요하면 환경변수를 설정하세요.'
      );
      return;
    }

    const hashedPassword = bcrypt.hashSync(initialPassword, 10);
    await client.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
      ['admin', hashedPassword, 'admin']
    );
  }

  private async initializeTemplates(client: PoolClient) {
    // 기존 템플릿 개수 확인 (COUNT(*)는 bigint라 문자열로 온다)
    const countResult = await client.query('SELECT COUNT(*) as count FROM layouts');
    if (parseInt(countResult.rows[0].count, 10) > 0) return;

    // 관리자 사용자 ID 조회 (없으면 NULL — SQLite와 달리 FK가 강제되므로 존재하지 않는 1을 넣으면 실패한다)
    const adminResult = await client.query('SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1', ['admin']);
    const adminUserId = adminResult.rows[0]?.id ?? null;

    // 기본 템플릿 삽입
    for (const template of defaultTemplates) {
      const serialized = serializeTemplate(template);
      await client.query(
        'INSERT INTO layouts (name, config, created_by, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [serialized.name, serialized.config, adminUserId]
      );
    }
  }

  private async insertUser(
    username: string,
    password?: string | null,
    googleId?: string | null,
    email?: string | null,
    profileImageUrl?: string | null
  ): Promise<QueryResult> {
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
    return this.query(
      'INSERT INTO users (username, password, google_id, email, profile_image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [username, hashedPassword, googleId ?? null, email ?? null, profileImageUrl ?? null]
    );
  }

  async createUser(
    username: string,
    password?: string | null,
    googleId?: string | null,
    email?: string | null,
    profileImageUrl?: string | null
  ) {
    const result = await this.insertUser(username, password, googleId, email, profileImageUrl);
    // RunResult 모양 + id (app/api/admin/init은 반환값의 id를 읽는다)
    return { ...toRunResult(result), id: result.rows[0]?.id };
  }

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    const result = await this.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  }

  async findOrCreateUserByGoogleId(
    googleId: string,
    email: string,
    username: string,
    profileImageUrl?: string
  ): Promise<User | null> {
    const user = await this.getUserByGoogleId(googleId);
    if (user) return user;

    const result = await this.insertUser(username, null, googleId, email, profileImageUrl);
    return (result.rows[0] as User) || null;
  }

  verifyPassword(password: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(password, hashedPassword);
  }

  async saveLayout(name: string, config: string, userId: number) {
    const result = await this.query(
      'INSERT INTO layouts (name, config, created_by) VALUES ($1, $2, $3) RETURNING id',
      [name, config, userId]
    );
    return toRunResult(result);
  }

  async updateLayout(id: number, name: string, config: string) {
    const result = await this.query(
      'UPDATE layouts SET name = $1, config = $2 WHERE id = $3',
      [name, config, id]
    );
    return toRunResult(result);
  }

  async deleteLayout(id: number) {
    const result = await this.query('DELETE FROM layouts WHERE id = $1', [id]);
    return toRunResult(result);
  }

  async getLayouts(): Promise<Layout[]> {
    const result = await this.query('SELECT * FROM layouts ORDER BY created_at DESC, id DESC');
    return result.rows;
  }
}
