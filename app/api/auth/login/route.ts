import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsername, verifyPassword } from '@/lib/database';
import { signToken } from '@/lib/auth';


export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '사용자명과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    console.log('Attempting login for username:', username);
    
    const user = await getUserByUsername(username) as any;
    console.log('User found:', user ? 'yes' : 'no');
    
    if (!user) {
      return NextResponse.json({ error: '잘못된 사용자명 또는 비밀번호입니다.' }, { status: 401 });
    }

    if (!user.password) {
      console.log('User has no password (passwordless/legacy Google-only user)');
      return NextResponse.json({ error: '이 계정은 비밀번호가 없어 로그인할 수 없습니다. 관리자에게 문의하세요.' }, { status: 401 });
    }

    const passwordValid = verifyPassword(password, user.password);
    console.log('Password valid:', passwordValid);
    
    if (!passwordValid) {
      return NextResponse.json({ error: '잘못된 사용자명 또는 비밀번호입니다.' }, { status: 401 });
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role });

    const response = NextResponse.json({
      message: '로그인 성공',
      user: { id: user.id, username: user.username, role: user.role }
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7일
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}