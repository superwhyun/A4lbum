// lib/database-postgres.ts
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { DatabaseAdapter, User, Layout } from './database-types';

export class PostgresAdapter implements DatabaseAdapter {
  constructor() {
    // Vercel Postgres는 자동으로 연결됨
    this.initializeTables();
  }

  private async initializeTables() {
    try {
      // Users 테이블 생성
      await sql`
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
      `;

      // Layouts 테이블 생성  
      await sql`
        CREATE TABLE IF NOT EXISTS layouts (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          config TEXT NOT NULL,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // 기본 관리자 계정 생성
      await this.initializeAdmin();
    } catch (error) {
      console.error('Failed to initialize tables:', error);
    }
  }

  private async initializeAdmin() {
    try {
      const result = await sql`SELECT * FROM users WHERE username = 'admin'`;
      
      if (result.rows.length === 0) {
        const hashedPassword = bcrypt.hashSync('admin', 10);
        await sql`
          INSERT INTO users (username, password, role) 
          VALUES ('admin', ${hashedPassword}, 'admin')
        `;
        console.log('Admin user created');
      }
    } catch (error) {
      console.error('Failed to initialize admin:', error);
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
    
    const result = await sql`
      INSERT INTO users (username, password, google_id, email, profile_image_url)
      VALUES (${username}, ${hashedPassword}, ${googleId}, ${email}, ${profileImageUrl})
      RETURNING *
    `;
    
    return result.rows[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    try {
      const result = await sql`SELECT * FROM users WHERE google_id = ${googleId}`;
      return result.rows[0] as User || null;
    } catch (error) {
      console.error('Failed to get user by Google ID:', error);
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const result = await sql`SELECT * FROM users WHERE username = ${username}`;
      return result.rows[0] as User || null;
    } catch (error) {
      console.error('Failed to get user by username:', error);
      return null;
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
    const result = await sql`
      INSERT INTO layouts (name, config, created_by)
      VALUES (${name}, ${config}, ${userId})
      RETURNING *
    `;
    return result.rows[0];
  }

  async updateLayout(id: number, name: string, config: string) {
    const result = await sql`
      UPDATE layouts SET name = ${name}, config = ${config}
      WHERE id = ${id}
      RETURNING *
    `;
    return result.rows[0];
  }

  async deleteLayout(id: number) {
    const result = await sql`DELETE FROM layouts WHERE id = ${id} RETURNING *`;
    return result.rows[0];
  }

  async getLayouts(): Promise<Layout[]> {
    const result = await sql`SELECT * FROM layouts ORDER BY created_at DESC`;
    return result.rows as Layout[];
  }
}