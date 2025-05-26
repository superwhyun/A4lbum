import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: '로그아웃되었습니다.' });
  
  response.cookies.delete('token');
  
  return response;
}