import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { defaultTemplates, serializeTemplate } from '@/lib/default-templates';
import { deleteLayout, saveLayout, getLayouts } from '@/lib/database';

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

    // 기존 모든 레이아웃 조회 후 삭제
    const existingLayouts = await getLayouts();
    for (const layout of existingLayouts) {
      await deleteLayout(layout.id);
    }
    
    // 기본 템플릿 삽입
    let insertedCount = 0;
    for (const template of defaultTemplates) {
      try {
        const serialized = serializeTemplate(template);
        await saveLayout(serialized.name, serialized.config, decoded.userId);
        insertedCount++;
      } catch (error) {
        console.error(`Failed to insert template ${template.name}:`, error);
      }
    }
    
    return NextResponse.json({ 
      message: '템플릿 데이터베이스가 초기화되었습니다.',
      insertedCount,
      totalTemplates: defaultTemplates.length
    });

  } catch (error) {
    console.error('Template initialization error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}