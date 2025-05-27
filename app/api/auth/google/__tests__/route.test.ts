import { POST } from '../route'; // Adjust path as needed
import httpMocks, { MockRequest, MockResponse } from 'node-mocks-http';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import * as database from '@/lib/database'; // Using * as db to mock its functions

// Mocking external dependencies
jest.mock('google-auth-library');
jest.mock('jsonwebtoken');
jest.mock('@/lib/database');

// Define types for mocked functions for clarity
const mockVerifyIdToken = OAuth2Client.prototype.verifyIdToken as jest.Mock;
const mockJwtSign = jwt.sign as jest.Mock;
const mockFindOrCreateUserByGoogleId = database.findOrCreateUserByGoogleId as jest.Mock;

// Helper to create mock request
const createMockRequest = (body: any = {}): MockRequest<any> => {
  return httpMocks.createRequest({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body,
  });
};

describe('POST /api/auth/google', () => {
  let mockReq: MockRequest<any>;
  let mockRes: MockResponse<any>;

  beforeEach(() => {
    mockRes = httpMocks.createResponse();
    // Reset mocks before each test
    mockVerifyIdToken.mockReset();
    mockJwtSign.mockReset();
    mockFindOrCreateUserByGoogleId.mockReset();

    // Default successful mock implementations
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'test_google_id',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'http://example.com/pic.jpg',
      }),
    });
    mockFindOrCreateUserByGoogleId.mockResolvedValue({
      id: 1,
      username: 'testuser_from_email', // Derived in API route
      role: 'user',
      email: 'test@example.com',
      google_id: 'test_google_id',
      profile_image_url: 'http://example.com/pic.jpg',
    });
    mockJwtSign.mockReturnValue('mocked_jwt_token');

    // Mock environment variables (if your route uses them directly and they are not set in test env)
    // process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
    // process.env.JWT_SECRET = 'test_jwt_secret';
  });

  afterEach(() => {
    // jest.restoreAllMocks(); // Cleans up spies, but we use jest.Mock for specific functions
  });

  it('should successfully sign in/up a user with a valid idToken', async () => {
    mockReq = createMockRequest({ idToken: 'valid_id_token' });
    await POST(mockReq as any, mockRes as any); // Using 'as any' due to NextRequest typing complexities with mocks

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'valid_id_token',
      audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER',
    });
    expect(mockFindOrCreateUserByGoogleId).toHaveBeenCalledWith(
      'test_google_id',
      'test@example.com',
      'test', // Username derived from email 'test@example.com'
      'http://example.com/pic.jpg'
    );
    expect(mockJwtSign).toHaveBeenCalledWith(
      { userId: 1, username: 'testuser_from_email', role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    expect(mockRes.statusCode).toBe(200);
    const jsonData = mockRes._getJSONData();
    expect(jsonData.message).toBe('Google Sign-In successful');
    expect(jsonData.user.id).toBe(1);
    expect(jsonData.user.username).toBe('testuser_from_email');
    
    const cookie = mockRes.getCookie('token');
    expect(cookie).toBeDefined();
    expect(cookie.value).toBe('mocked_jwt_token');
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.path).toBe('/');
    // expect(cookie.options.secure).toBe(process.env.NODE_ENV !== 'development'); // This can be tricky to test without setting NODE_ENV
    expect(cookie.options.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('should return 400 if idToken is missing', async () => {
    mockReq = createMockRequest({}); // No idToken
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(400);
    expect(mockRes._getJSONData().message).toBe('ID token is required');
  });

  it('should return 401 if Google ID token verification fails', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    mockReq = createMockRequest({ idToken: 'invalid_id_token' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(401);
    expect(mockRes._getJSONData().message).toBe('Invalid Google ID token');
  });

  it('should return 401 if token payload is missing', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => null });
    mockReq = createMockRequest({ idToken: 'valid_id_token_no_payload' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(401);
    expect(mockRes._getJSONData().message).toBe('Could not get payload from token');
  });

  it('should return 401 if googleId (sub) is missing in payload', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ /* sub is missing */ email: 'test@example.com' }),
    });
    mockReq = createMockRequest({ idToken: 'valid_id_token_missing_sub' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(401);
    expect(mockRes._getJSONData().message).toBe('Missing Google ID or email in token payload');
  });

  it('should return 401 if email is missing in payload', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'test_google_id' /* email is missing */ }),
    });
    mockReq = createMockRequest({ idToken: 'valid_id_token_missing_email' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(401);
    expect(mockRes._getJSONData().message).toBe('Missing Google ID or email in token payload');
  });
  
  it('should return 400 if username cannot be derived from email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'test_google_id', email: '@malformed.com', name: 'Test' }),
    });
    mockReq = createMockRequest({ idToken: 'token_malformed_email' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Could not derive username from email');
  });

  it('should return 500 if findOrCreateUserByGoogleId returns null (user not found/created)', async () => {
    mockFindOrCreateUserByGoogleId.mockResolvedValue(null);
    mockReq = createMockRequest({ idToken: 'valid_id_token' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(500);
    expect(mockRes._getJSONData().message).toBe('Could not find or create user');
  });
  
  it('should return 500 if user object from DB is missing required fields for JWT', async () => {
    mockFindOrCreateUserByGoogleId.mockResolvedValue({
      // Missing id, username, or role
      email: 'test@example.com',
    });
    mockReq = createMockRequest({ idToken: 'valid_id_token' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(500);
    expect(mockRes._getJSONData().message).toBe('User data is incomplete after creation/retrieval');
  });

  it('should handle general errors during POST processing', async () => {
    // For example, if req.json() fails (though httpMocks might not simulate this well)
    // Or if an unexpected error occurs in the logic
    mockJwtSign.mockImplementation(() => { throw new Error("Unexpected JWT error"); });
    mockReq = createMockRequest({ idToken: 'valid_id_token' });
    await POST(mockReq as any, mockRes as any);

    expect(mockRes.statusCode).toBe(500);
    expect(mockRes._getJSONData().message).toBe('Internal Server Error');
    expect(mockRes._getJSONData().error).toBe('Unexpected JWT error');
  });
});

// To run these tests, you would typically use a command like:
// npx jest app/api/auth/google/__tests__/route.test.ts
// or if jest is configured in package.json scripts:
// npm test -- app/api/auth/google/__tests__/route.test.ts
