import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { findOrCreateUserByGoogleId } from '@/lib/database';
import { signToken, TOKEN_COOKIE, tokenCookieOptions } from '@/lib/auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface GoogleProfile {
  name?: string;
  picture?: string;
}

/**
 * 액세스 토큰으로 구글 프로필(이름/사진)을 가져온다.
 * 신원 판단에는 쓰지 않으므로 실패해도 로그인은 계속 진행한다.
 */
async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return {};

    const profile = (await response.json()) as GoogleProfile;
    return { name: profile.name, picture: profile.picture };
  } catch (error) {
    console.warn('구글 프로필 조회 실패 (로그인은 계속 진행):', error);
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID 환경변수가 없습니다.');
      return NextResponse.json({ message: 'Google Sign-In is not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const accessToken = body?.accessToken;

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json({ message: 'Access token is required' }, { status: 400 });
    }

    // 신원은 반드시 구글에서 확인한다. 클라이언트가 보낸 googleId/email은 믿지 않는다.
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let tokenInfo;
    try {
      tokenInfo = await client.getTokenInfo(accessToken);
    } catch (error) {
      console.warn('구글 액세스 토큰 검증 실패:', error);
      return NextResponse.json({ message: 'Invalid Google access token' }, { status: 401 });
    }

    // 다른 앱에 발급된 토큰을 가져와 쓰는 것을 막는다.
    if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
      console.warn('다른 클라이언트 ID로 발급된 토큰입니다:', tokenInfo.aud);
      return NextResponse.json({ message: 'Token was not issued for this application' }, { status: 401 });
    }

    const googleId = tokenInfo.sub;
    const email = tokenInfo.email;

    if (!googleId || !email) {
      return NextResponse.json({ message: 'Missing Google ID or email in token info' }, { status: 401 });
    }

    const usernameFromEmail = email.split('@')[0];
    if (!usernameFromEmail) {
      return NextResponse.json({ message: 'Could not derive username from email' }, { status: 400 });
    }

    const profile = await fetchProfile(accessToken);
    const user = await findOrCreateUserByGoogleId(googleId, email, usernameFromEmail, profile.picture);

    if (!user) {
      return NextResponse.json({ message: 'Could not find or create user' }, { status: 500 });
    }

    if (!user.id || !user.username || !user.role) {
      console.error('User object is missing required fields (id, username, role):', user);
      return NextResponse.json({ message: 'User data is incomplete after creation/retrieval' }, { status: 500 });
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role });

    const response = NextResponse.json({
      message: 'Google Sign-In successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        profileImageUrl: user.profile_image_url,
      },
    });

    response.cookies.set(TOKEN_COOKIE, token, tokenCookieOptions);

    return response;
  } catch (error) {
    console.error('Google Sign-In error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}
