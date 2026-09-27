/**
 * @jest-environment node
 */
import { OAuth2Client } from 'google-auth-library';
import * as database from '@/lib/database';

jest.mock('google-auth-library');
jest.mock('@/lib/database');

const CLIENT_ID = 'test-google-client-id';

// 라우트가 모듈 로드 시점에 클라이언트 ID를 읽으므로 import보다 먼저 세팅해야 한다.
process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.JWT_SECRET = 'test-jwt-secret';

const { POST } = require('../route') as typeof import('../route');

const mockGetTokenInfo = OAuth2Client.prototype.getTokenInfo as jest.Mock;
const mockFindOrCreateUser = database.findOrCreateUserByGoogleId as jest.Mock;

const VALID_TOKEN_INFO = {
  aud: CLIENT_ID,
  sub: 'google-sub-123',
  email: 'test@example.com',
  scopes: ['openid', 'profile', 'email'],
  expiry_date: Date.now() + 3600_000,
};

const DB_USER = {
  id: 1,
  username: 'test',
  role: 'user',
  email: 'test@example.com',
  google_id: 'google-sub-123',
  profile_image_url: 'http://example.com/pic.jpg',
};

function request(body: unknown): any {
  return new Request('http://localhost/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/google', () => {
  beforeEach(() => {
    mockGetTokenInfo.mockReset();
    mockFindOrCreateUser.mockReset();

    mockGetTokenInfo.mockResolvedValue(VALID_TOKEN_INFO);
    mockFindOrCreateUser.mockResolvedValue(DB_USER);

    // 프로필 조회(이름/사진)는 신원 판단과 무관하므로 단순 목으로 대체
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Test User', picture: 'http://example.com/pic.jpg' }),
    }) as unknown as typeof fetch;

    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs in a user when Google validates the access token', async () => {
    const response = await POST(request({ accessToken: 'valid-access-token' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Google Sign-In successful');
    expect(data.user).toMatchObject({ id: 1, username: 'test', role: 'user' });
    expect(mockGetTokenInfo).toHaveBeenCalledWith('valid-access-token');
  });

  it('derives identity from Google rather than from the request body', async () => {
    await POST(
      request({
        accessToken: 'valid-access-token',
        googleId: 'attacker-supplied-id',
        email: 'admin@example.com',
      }),
    );

    // 요청 본문에 실린 값이 아니라 토큰 검증 결과가 쓰여야 한다
    expect(mockFindOrCreateUser).toHaveBeenCalledWith(
      'google-sub-123',
      'test@example.com',
      'test',
      'http://example.com/pic.jpg',
    );
  });

  it('sets an httpOnly session cookie', async () => {
    const response = await POST(request({ accessToken: 'valid-access-token' }));
    const cookie = response.cookies.get('token');

    expect(cookie).toBeDefined();
    expect(cookie!.value).toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.path).toBe('/');
    expect(cookie!.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('returns 400 when the access token is missing', async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe('Access token is required');
    expect(mockGetTokenInfo).not.toHaveBeenCalled();
  });

  it('returns 401 when Google rejects the access token', async () => {
    mockGetTokenInfo.mockRejectedValue(new Error('invalid_token'));

    const response = await POST(request({ accessToken: 'bad-token' }));

    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe('Invalid Google access token');
    expect(mockFindOrCreateUser).not.toHaveBeenCalled();
  });

  it('rejects a token issued for a different application', async () => {
    mockGetTokenInfo.mockResolvedValue({ ...VALID_TOKEN_INFO, aud: 'someone-elses-client-id' });

    const response = await POST(request({ accessToken: 'foreign-token' }));

    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe('Token was not issued for this application');
    expect(mockFindOrCreateUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the token info carries no email', async () => {
    mockGetTokenInfo.mockResolvedValue({ ...VALID_TOKEN_INFO, email: undefined });

    const response = await POST(request({ accessToken: 'valid-access-token' }));

    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe('Missing Google ID or email in token info');
  });

  it('returns 400 when a username cannot be derived from the email', async () => {
    mockGetTokenInfo.mockResolvedValue({ ...VALID_TOKEN_INFO, email: '@malformed.com' });

    const response = await POST(request({ accessToken: 'valid-access-token' }));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe('Could not derive username from email');
  });

  it('returns 500 when the user cannot be found or created', async () => {
    mockFindOrCreateUser.mockResolvedValue(null);

    const response = await POST(request({ accessToken: 'valid-access-token' }));

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe('Could not find or create user');
  });

  it('returns 500 when the stored user is missing fields needed for the token', async () => {
    mockFindOrCreateUser.mockResolvedValue({ email: 'test@example.com' });

    const response = await POST(request({ accessToken: 'valid-access-token' }));

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe('User data is incomplete after creation/retrieval');
  });

  it('still signs in when the profile lookup fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const response = await POST(request({ accessToken: 'valid-access-token' }));

    expect(response.status).toBe(200);
    expect(mockFindOrCreateUser).toHaveBeenCalledWith(
      'google-sub-123',
      'test@example.com',
      'test',
      undefined,
    );
  });
});
