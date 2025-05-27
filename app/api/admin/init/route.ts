// app/api/admin/init/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    // 보안을 위해 특별한 키가 필요하도록 설정
    const { initKey } = await req.json();
    
    if (initKey !== 'a4lbum-init-2025') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // PostgresAdapter의 경우 이미 initializeAdmin이 생성자에서 호출됨
    // 하지만 확실하게 하기 위해 한 번 더 체크
    const existingAdmin = await db.getUserByUsername('admin');
    
    if (existingAdmin) {
      return NextResponse.json({ 
        message: 'Admin already exists',
        admin: { id: existingAdmin.id, username: existingAdmin.username, role: existingAdmin.role }
      });
    }

    // 관리자 계정 생성
    const adminUser = await db.createUser('admin', 'admin', null, null, null);
    
    return NextResponse.json({ 
      message: 'Admin initialized successfully',
      admin: { id: adminUser.id, username: 'admin', role: 'admin' }
    });

  } catch (error) {
    console.error('Admin initialization error:', error);
    return NextResponse.json({ 
      message: 'Failed to initialize admin', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// %%%%%LAST%%%%%