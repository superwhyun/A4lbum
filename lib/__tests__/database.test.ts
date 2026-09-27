/**
 * 실제 SQLiteAdapter를 인메모리 DB에 붙여 검증한다.
 * (예전 버전은 모듈을 목으로 바꾼 뒤 그 안에서 SQL을 재구현해, 목 자신을 테스트하고 있었다)
 */
import { SQLiteAdapter } from '@/lib/database-sqlite';

const IN_MEMORY = ':memory:';

function createAdapter(): SQLiteAdapter {
  return new SQLiteAdapter(IN_MEMORY);
}

describe('SQLiteAdapter', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    delete process.env.ADMIN_INITIAL_PASSWORD;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.ADMIN_INITIAL_PASSWORD;
  });

  describe('초기 관리자 계정', () => {
    test('ADMIN_INITIAL_PASSWORD가 없으면 관리자를 만들지 않는다', () => {
      const db = createAdapter();

      expect(db.getUserByUsername('admin')).toBeFalsy();
      expect(warnSpy).toHaveBeenCalled();
    });

    test('환경변수가 있으면 그 비밀번호로 관리자를 만든다', () => {
      process.env.ADMIN_INITIAL_PASSWORD = 'a-long-enough-secret';
      const db = createAdapter();

      const admin = db.getUserByUsername('admin');
      expect(admin).toBeTruthy();
      expect(admin!.role).toBe('admin');
      expect(db.verifyPassword('a-long-enough-secret', admin!.password!)).toBe(true);
    });

    test("예전 기본값인 'admin'으로는 로그인할 수 없다", () => {
      process.env.ADMIN_INITIAL_PASSWORD = 'a-long-enough-secret';
      const db = createAdapter();

      const admin = db.getUserByUsername('admin');
      expect(db.verifyPassword('admin', admin!.password!)).toBe(false);
    });
  });

  describe('createUser', () => {
    test('비밀번호를 평문으로 저장하지 않는다', () => {
      const db = createAdapter();
      db.createUser('alice', 'plaintext-password');

      const user = db.getUserByUsername('alice');
      expect(user!.password).not.toBe('plaintext-password');
      expect(db.verifyPassword('plaintext-password', user!.password!)).toBe(true);
    });

    test('구글 계정 사용자는 비밀번호 없이 만들어진다', () => {
      const db = createAdapter();
      db.createUser('bob', null, 'google-1', 'bob@example.com', 'http://example.com/b.png');

      const user = db.getUserByGoogleId('google-1');
      expect(user).toMatchObject({
        username: 'bob',
        email: 'bob@example.com',
        google_id: 'google-1',
        role: 'user',
      });
      expect(user!.password).toBeNull();
    });

    test('새 사용자에게 관리자 역할을 주지 않는다', () => {
      const db = createAdapter();
      db.createUser('carol', null, 'google-2', 'carol@example.com');

      expect(db.getUserByGoogleId('google-2')!.role).toBe('user');
    });
  });

  describe('getUserByGoogleId', () => {
    test('없는 google_id면 null을 준다', () => {
      const db = createAdapter();
      expect(db.getUserByGoogleId('nope')).toBeFalsy();
    });
  });

  describe('findOrCreateUserByGoogleId', () => {
    test('처음 보는 google_id면 새로 만든다', () => {
      const db = createAdapter();
      const user = db.findOrCreateUserByGoogleId('google-3', 'dave@example.com', 'dave');

      expect(user).toBeTruthy();
      expect(user!.id).toBeGreaterThan(0);
      expect(user!.google_id).toBe('google-3');
      expect(user!.email).toBe('dave@example.com');
      expect(user!.role).toBe('user');
    });

    test('같은 google_id면 기존 사용자를 그대로 준다', () => {
      const db = createAdapter();
      const first = db.findOrCreateUserByGoogleId('google-4', 'erin@example.com', 'erin');
      const second = db.findOrCreateUserByGoogleId('google-4', 'erin@example.com', 'erin');

      expect(second!.id).toBe(first!.id);
    });

    test('기존 사용자의 역할을 요청 값으로 덮어쓰지 않는다', () => {
      process.env.ADMIN_INITIAL_PASSWORD = 'a-long-enough-secret';
      const db = createAdapter();

      // 관리자에게 google_id를 붙여둔 상태를 만든다
      db.createUser('frank', null, 'google-admin', 'frank@example.com');
      const created = db.getUserByGoogleId('google-admin');
      expect(created!.role).toBe('user');

      // 같은 google_id로 다시 들어와도 역할은 DB 값이 유지돼야 한다
      const again = db.findOrCreateUserByGoogleId('google-admin', 'someone-else@example.com', 'attacker');
      expect(again!.role).toBe('user');
      expect(again!.email).toBe('frank@example.com');
    });
  });

  describe('verifyPassword', () => {
    test('맞는 비밀번호만 통과시킨다', () => {
      const db = createAdapter();
      db.createUser('grace', 'correct-horse-battery');
      const user = db.getUserByUsername('grace');

      expect(db.verifyPassword('correct-horse-battery', user!.password!)).toBe(true);
      expect(db.verifyPassword('wrong', user!.password!)).toBe(false);
    });
  });

  describe('레이아웃', () => {
    test('저장한 레이아웃을 목록에서 찾을 수 있다', () => {
      const db = createAdapter();
      db.createUser('heidi', null, 'google-5', 'heidi@example.com');
      const author = db.getUserByGoogleId('google-5')!;

      const before = db.getLayouts().length;
      db.saveLayout('내 레이아웃', JSON.stringify({ photoCount: 2 }), author.id);
      const layouts = db.getLayouts();

      expect(layouts.length).toBe(before + 1);
      expect(layouts.some((layout) => layout.name === '내 레이아웃')).toBe(true);
    });

    test('삭제하면 목록에서 사라진다', () => {
      const db = createAdapter();
      db.createUser('ivan', null, 'google-6', 'ivan@example.com');
      const author = db.getUserByGoogleId('google-6')!;

      db.saveLayout('지울 레이아웃', JSON.stringify({ photoCount: 1 }), author.id);
      const target = db.getLayouts().find((layout) => layout.name === '지울 레이아웃')!;

      db.deleteLayout(target.id);

      expect(db.getLayouts().some((layout) => layout.id === target.id)).toBe(false);
    });
  });
});
