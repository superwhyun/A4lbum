// 인증 공통 설정. JWT 서명 비밀키를 한 곳에서만 읽는다.
import jwt from 'jsonwebtoken';

export const TOKEN_COOKIE = 'token';
export const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7일

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * JWT 서명 비밀키를 돌려준다.
 * 기본값을 두지 않는다 — 소스에 박힌 비밀키는 누구나 관리자 토큰을 위조할 수 있게 만든다.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. 인증을 사용할 수 없습니다.');
  }

  return secret;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
}

export const tokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: TOKEN_MAX_AGE_SECONDS,
};
