import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { saveLayout, getLayouts, updateLayout, deleteLayout } from '@/lib/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { name, config } = await request.json();
    
    if (!name || !config) {
      return NextResponse.json({ error: '레이아웃 이름과 설정이 필요합니다.' }, { status: 400 });
    }

    const result = await saveLayout(name, JSON.stringify(config), decoded.userId);
    
    return NextResponse.json({ 
      message: '레이아웃이 저장되었습니다.',
      id: result.lastInsertRowid 
    });

  } catch (error) {
    console.error('Layout save error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const layouts = await getLayouts();
    
    return NextResponse.json({
      layouts: layouts.map((layout: any) => ({
        ...layout,
        config: JSON.parse(layout.config)
      }))
    });

  } catch (error) {
    console.error('Layout fetch error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id, name, config } = await request.json();
    
    if (!id || !name || !config) {
      return NextResponse.json({ error: '레이아웃 ID, 이름, 설정이 필요합니다.' }, { status: 400 });
    }

    await updateLayout(id, name, JSON.stringify(config));
    
    return NextResponse.json({ 
      message: '레이아웃이 수정되었습니다.'
    });

  } catch (error) {
    console.error('Layout update error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '레이아웃 ID가 필요합니다.' }, { status: 400 });
    }

    await deleteLayout(parseInt(id));
    
    return NextResponse.json({ 
      message: '레이아웃이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('Layout delete error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}