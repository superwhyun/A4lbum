// lib/database-postgres.ts
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { DatabaseAdapter, User, Layout } from './database-types';
import { defaultTemplates, serializeTemplate } from './default-templates';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    this.initializeTables();
  }

  private async initializeTables() {
    try {
      const client = await this.pool.connect();
      
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

      client.release();
      
      // 기본 관리자 계정 생성
      await this.initializeAdmin();
      
      // 기본 템플릿 초기화
      await this.initializeTemplates();
    } catch (error) {
      // 테이블 초기화 실패 시 무시
    }
  }

  private async initializeAdmin() {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT * FROM users WHERE username = $1', ['admin']);
      
      if (result.rows.length === 0) {
        const hashedPassword = bcrypt.hashSync('admin', 10);
        await client.query(
          'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
          ['admin', hashedPassword, 'admin']
        );
      }
      
      client.release();
    } catch (error) {
      // 관리자 초기화 실패 시 무시
    }
  }

  private async initializeTemplates() {
    try {
      const client = await this.pool.connect();
      
      // 기존 템플릿 개수 확인
      const countResult = await client.query('SELECT COUNT(*) as count FROM layouts');
      const existingTemplateCount = parseInt(countResult.rows[0].count);
      
      if (existingTemplateCount === 0) {
        // 관리자 사용자 ID 조회
        const adminResult = await client.query('SELECT id FROM users WHERE role = $1', ['admin']);
        const adminUserId = adminResult.rows[0]?.id || 1;
        
        // 기본 템플릿 삽입
        let insertedCount = 0;
        for (const template of defaultTemplates) {
          const serialized = serializeTemplate(template);
          try {
            await client.query(
              'INSERT INTO layouts (name, config, created_by, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
              [serialized.name, serialized.config, adminUserId]
            );
            insertedCount++;
          } catch (error) {
            // 템플릿 삽입 실패 시 에러는 무시
          }
        }
      }
      
      client.release();
    } catch (error) {
      // 템플릿 초기화 실패 시 무시
    }
  }

  async createUser(
    username: string,
    password?: string | null,
    googleId?: string | null,
    email?: string | null,
    profileImageUrl?: string | null
  ) {
    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO users (username, password, google_id, email, profile_image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [username, hashedPassword, googleId, email, profileImageUrl]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Failed to get user by Google ID:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Failed to get user by username:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async findOrCreateUserByGoogleId(
    googleId: string,
    email: string,
    username: string,
    profileImageUrl?: string
  ): Promise<User | null> {
    try {
      let user = await this.getUserByGoogleId(googleId);
      if (user) {
        return user;
      } else {
        const newUser = await this.createUser(username, null, googleId, email, profileImageUrl);
        return newUser as User;
      }
    } catch (error) {
      console.error('Failed to find or create user:', error);
      return null;
    }
  }

  verifyPassword(password: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(password, hashedPassword);
  }

  async saveLayout(name: string, config: string, userId: number) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO layouts (name, config, created_by) VALUES ($1, $2, $3) RETURNING *',
        [name, config, userId]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateLayout(id: number, name: string, config: string) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'UPDATE layouts SET name = $1, config = $2 WHERE id = $3 RETURNING *',
        [name, config, id]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteLayout(id: number) {
    const client = await this.pool.connect();
    try {
      const result = await client.query('DELETE FROM layouts WHERE id = $1 RETURNING *', [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getLayouts(): Promise<Layout[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT * FROM layouts ORDER BY created_at DESC');
      return result.rows;
    } finally {
      client.release();
    }
  }
}