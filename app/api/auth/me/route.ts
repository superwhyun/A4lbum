import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';


export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: '인증되지 않음' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    
    return NextResponse.json({
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    });

  } catch (error) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 401 });
  }
}