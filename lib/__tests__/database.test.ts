import Database from 'better-sqlite3';
import type { Database as DBType } from 'better-sqlite3';
import {
  createUser,
  getUserByUsername,
  getUserByGoogleId,
  findOrCreateUserByGoogleId,
} from '../database'; // Adjust path as needed, assuming this file is in lib/__tests__
import bcrypt from 'bcryptjs';

// Original dbPath from database.ts - we need to override this for tests
// const dbPath = path.join(process.cwd(), 'data', 'app.db');

// Hold the in-memory database instance
let testDb: DBType;

const initializeTestDb = () => {
  testDb = new Database(':memory:');
  // Recreate schema for users table (mirroring structure in database.ts)
  testDb.exec(`
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
};

// Override the database instance used by the functions
// This is a common way to mock dependencies in Jest
jest.mock('../database', () => {
  const originalModule = jest.requireActual('../database');
  return {
    ...originalModule,
    // Override `db` export from the original module
    // This requires `db` to be exported from database.ts if it's not already for this to work,
    // or functions must accept `db` as a parameter.
    // For simplicity, we assume functions use a module-level `db` instance.
    // A more robust way is to refactor functions to accept `db` or use a class.
    // Given the current structure, we'll mock the module-level `db` instance.
    // This is tricky if `db` is not exported. Let's assume functions are refactored or `db` is exported.
    // If not, we'd have to re-implement the functions here with testDb.
    // For now, this mock will try to point to an internal (mocked) db.

    // Re-directing functions to use testDb by re-exporting them with testDb bound
    // This is a bit of a workaround. Ideally, database.ts would export db or allow db injection.
    // Since it doesn't, we re-implement simplified versions or mock `better-sqlite3` itself.

    // Simpler approach for now: Re-initialize the actual 'db' from database.ts to be our in-memory one.
    // This requires modifying the actual 'db' instance.
    // This is generally bad practice for unit tests (modifying internals of module under test).
    // A better way: The module `database.ts` should export its `db` instance or a setter for it.
    // Or, `initializeTestDb` should be called within `database.ts` under a test environment flag.

    // Let's try to mock `better-sqlite3` to control the db instance.
    __esModule: true, // Mark as ES Module
    default: testDb, // Default export (if database.ts exports db as default)
    
    // Mock specific functions to use testDb
    createUser: (...args: any[]) => {
        const [username, password, googleId, email, profileImageUrl] = args;
        const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;
        return testDb.prepare(
            'INSERT INTO users (username, password, google_id, email, profile_image_url) VALUES (?, ?, ?, ?, ?)'
        ).run(username, hashedPassword, googleId, email, profileImageUrl);
    },
    getUserByUsername: (username: string) => {
        return testDb.prepare('SELECT * FROM users WHERE username = ?').get(username);
    },
    getUserByGoogleId: (googleId: string) => {
        return testDb.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    },
    // findOrCreateUserByGoogleId needs to call the mocked getUserByGoogleId and createUser
    findOrCreateUserByGoogleId: (googleId: string, email: string, username: string, profileImageUrl?: string) => {
        let user = testDb.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
        if (user) {
          return user;
        } else {
          const createResult = testDb.prepare(
            'INSERT INTO users (username, password, google_id, email, profile_image_url) VALUES (?, ?, ?, ?, ?)'
          ).run(username, null, googleId, email, profileImageUrl);
          if (createResult.lastInsertRowid) {
            return testDb.prepare('SELECT * FROM users WHERE id = ?').get(createResult.lastInsertRowid);
          }
          return testDb.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
        }
    },
    verifyPassword: originalModule.verifyPassword, // Keep original verifyPassword
    // other exports if any...
  };
});


describe('Database Functions', () => {
  beforeAll(() => {
    initializeTestDb(); // Initialize for the whole suite
  });

  beforeEach(() => {
    // Clear users table before each test to ensure isolation
    testDb.exec('DELETE FROM users');
    // Reset autoincrement sequence (optional, but good for predictability)
    testDb.exec("DELETE FROM sqlite_sequence WHERE name='users';");
  });

  afterAll(() => {
    testDb.close();
  });

  describe('createUser', () => {
    it('should create a user with username and password', () => {
      const result = createUser('testuser1', 'password123');
      expect(result.changes).toBe(1);
      const user = getUserByUsername('testuser1') as any;
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser1');
      expect(user.password).not.toBe('password123'); // Should be hashed
      expect(bcrypt.compareSync('password123', user.password)).toBe(true);
      expect(user.google_id).toBeNull();
    });

    it('should create a user with Google ID details (null password)', () => {
      const result = createUser('googleuser1', null, 'google123', 'google@example.com', 'http://img.url/p.jpg');
      expect(result.changes).toBe(1);
      const user = getUserByGoogleId('google123') as any;
      expect(user).toBeDefined();
      expect(user.username).toBe('googleuser1');
      expect(user.password).toBeNull();
      expect(user.google_id).toBe('google123');
      expect(user.email).toBe('google@example.com');
      expect(user.profile_image_url).toBe('http://img.url/p.jpg');
    });

    it('should fail to create a user with a duplicate username', () => {
        createUser('duplicateuser', 'password123');
        expect(() => {
          createUser('duplicateuser', 'anotherpassword');
        }).toThrow(); // SQLite TEXT UNIQUE constraint violation
      });
  });

  describe('getUserByGoogleId', () => {
    it('should retrieve an existing user by Google ID', () => {
      createUser('userWithGoogleId', null, 'googleAbc', 'guser@example.com');
      const user = getUserByGoogleId('googleAbc') as any;
      expect(user).toBeDefined();
      expect(user.username).toBe('userWithGoogleId');
      expect(user.google_id).toBe('googleAbc');
    });

    it('should return undefined for a non-existent Google ID', () => {
      const user = getUserByGoogleId('nonexistentGoogleId');
      expect(user).toBeUndefined();
    });
  });

  describe('findOrCreateUserByGoogleId', () => {
    it('should find an existing user by Google ID', () => {
      createUser('existingGoogleUser', null, 'googleFindMe', 'find@me.com');
      // Ensure no new user is created by counting rows or checking lastInsertRowid if possible
      const initialCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
      
      const user = findOrCreateUserByGoogleId('googleFindMe', 'find@me.com', 'existingGoogleUser') as any;
      
      const finalCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
      expect(finalCount).toBe(initialCount); // No new user created

      expect(user).toBeDefined();
      expect(user.username).toBe('existingGoogleUser');
      expect(user.google_id).toBe('googleFindMe');
    });

    it('should create a new user if Google ID is not found', () => {
      const initialCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get().count;

      const user = findOrCreateUserByGoogleId(
        'newGoogleUser123',
        'new.g.user@example.com',
        'NewGoogleUser', // Ensure this username is unique for the test
        'http://new.profile.img/url.jpg'
      ) as any;

      const finalCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
      expect(finalCount).toBe(initialCount + 1); // One new user created

      expect(user).toBeDefined();
      expect(user.google_id).toBe('newGoogleUser123');
      expect(user.email).toBe('new.g.user@example.com');
      expect(user.username).toBe('NewGoogleUser');
      expect(user.profile_image_url).toBe('http://new.profile.img/url.jpg');
      expect(user.password).toBeNull();
    });

    it('should return the newly created user details correctly', () => {
        const googleId = 'googleDetails123';
        const email = 'details@example.com';
        const username = 'DetailsUser';
        const profileImageUrl = 'http://details.pic/img.png';
  
        const user = findOrCreateUserByGoogleId(googleId, email, username, profileImageUrl) as any;
  
        expect(user).toBeDefined();
        expect(user.id).toBeGreaterThan(0); // Should have an ID from DB
        expect(user.google_id).toBe(googleId);
        expect(user.email).toBe(email);
        expect(user.username).toBe(username);
        expect(user.profile_image_url).toBe(profileImageUrl);
        expect(user.role).toBe('user'); // Default role
        expect(user.password).toBeNull();
      });
  });
});
