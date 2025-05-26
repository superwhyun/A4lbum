import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByUsername } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '사용자명과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    if (username.length < 3 || password.length < 4) {
      return NextResponse.json({ error: '사용자명은 3자 이상, 비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
    }

    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: '이미 존재하는 사용자명입니다.' }, { status: 409 });
    }

    createUser(username, password);

    return NextResponse.json({ message: '회원가입이 완료되었습니다.' });

  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}