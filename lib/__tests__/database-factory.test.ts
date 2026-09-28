/**
 * DATABASE_URL 유무에 따른 어댑터 선택과 PostgresAdapter의 lazy 연결/반환 모양을 검증한다.
 * pg는 목으로 바꿔 실제 DB에 연결하지 않는다.
 */
import type { DatabaseAdapter } from '@/lib/database-types';

const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockPoolConnect = jest.fn();
const mockPoolOn = jest.fn();
const mockPoolCtor = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation((config) => {
    mockPoolCtor(config);
    return { query: mockPoolQuery, connect: mockPoolConnect, on: mockPoolOn };
  }),
  types: { getTypeParser: jest.fn() },
}));

jest.mock('@/lib/database-sqlite');

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

// lib/database는 import 시점에 db를 만들므로 모듈 레지스트리를 격리해 매번 새로 로드한다.
// 어댑터 클래스도 같은 레지스트리에서 꺼내야 instanceof 비교가 맞는다.
function loadDatabaseModule() {
  let loaded!: {
    db: DatabaseAdapter;
    SQLiteAdapter: new (...args: any[]) => DatabaseAdapter;
    PostgresAdapter: new (...args: any[]) => DatabaseAdapter;
  };
  jest.isolateModules(() => {
    loaded = {
      db: require('@/lib/database').db,
      SQLiteAdapter: require('@/lib/database-sqlite').SQLiteAdapter,
      PostgresAdapter: require('@/lib/database-postgres').PostgresAdapter,
    };
  });
  return loaded;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockPoolConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
  mockClientQuery.mockImplementation(async (text: string) =>
    /COUNT\(\*\)/.test(text) ? { rows: [{ count: '5' }], rowCount: 1 } : { rows: [], rowCount: 0 }
  );
});

afterEach(() => {
  jest.restoreAllMocks();
  if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe('createDatabaseAdapter', () => {
  test('DATABASE_URL이 없으면 SQLiteAdapter를 쓴다', () => {
    delete process.env.DATABASE_URL;
    const { db, SQLiteAdapter, PostgresAdapter } = loadDatabaseModule();

    expect(db).toBeInstanceOf(SQLiteAdapter);
    expect(db).not.toBeInstanceOf(PostgresAdapter);
    expect(mockPoolCtor).not.toHaveBeenCalled();
  });

  test('DATABASE_URL이 있으면 PostgresAdapter를 쓰되, 생성 시점에는 연결하지 않는다', () => {
    process.env.DATABASE_URL = 'postgres://user:pw@example.invalid:5432/db';
    const { db, PostgresAdapter } = loadDatabaseModule();

    expect(db).toBeInstanceOf(PostgresAdapter);
    expect(mockPoolCtor).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: process.env.DATABASE_URL })
    );
    expect(mockPoolConnect).not.toHaveBeenCalled();
    expect(mockPoolQuery).not.toHaveBeenCalled();
    // 유휴 연결 에러로 프로세스가 죽지 않도록 리스너를 건다
    expect(mockPoolOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});

describe('PostgresAdapter', () => {
  function createPostgres(): DatabaseAdapter {
    process.env.DATABASE_URL = 'postgres://user:pw@example.invalid:5432/db';
    const { PostgresAdapter } = require('@/lib/database-postgres');
    return new PostgresAdapter();
  }

  test('첫 쿼리 전에 한 번만 테이블을 초기화한다', async () => {
    const db = createPostgres();
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await Promise.all([db.getLayouts(), db.getUserByUsername('x')]);
    await db.getLayouts();

    expect(mockPoolConnect).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS users'));
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mockClientRelease).toHaveBeenCalledTimes(1);
    expect(mockPoolQuery).toHaveBeenCalledTimes(3);
  });

  test('초기화가 실패하면 에러를 던지고, 다음 호출에서 다시 시도한다', async () => {
    const db = createPostgres();
    mockPoolConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(db.getLayouts()).rejects.toThrow('ECONNREFUSED');
    await expect(db.getLayouts()).resolves.toEqual([]);
    expect(mockPoolConnect).toHaveBeenCalledTimes(2);
  });

  test('saveLayout은 SQLite RunResult처럼 lastInsertRowid를 돌려준다', async () => {
    const db = createPostgres();
    mockPoolQuery.mockResolvedValue({ rows: [{ id: 42 }], rowCount: 1 });

    const result = await db.saveLayout('레이아웃', '{}', 1);

    expect(result).toEqual({ changes: 1, lastInsertRowid: 42 });
  });

  test('createUser는 bcrypt 해시를 저장해 SQLiteAdapter와 비밀번호가 호환된다', async () => {
    const db = createPostgres();
    mockPoolQuery.mockImplementation(async (_text: string, params: unknown[]) => ({
      rows: [{ id: 7, username: params[0], password: params[1] }],
      rowCount: 1,
    }));

    const result = await db.createUser('alice', 'plaintext-password');
    const storedHash = mockPoolQuery.mock.calls[0][1][1] as string;

    expect(result).toMatchObject({ id: 7, lastInsertRowid: 7, changes: 1 });
    expect(storedHash).toMatch(/^\$2[aby]\$10\$/);

    const { SQLiteAdapter } = jest.requireActual('@/lib/database-sqlite');
    const sqlite = new SQLiteAdapter(':memory:');
    expect(sqlite.verifyPassword('plaintext-password', storedHash)).toBe(true);
    expect(sqlite.verifyPassword('wrong', storedHash)).toBe(false);
  });
});
