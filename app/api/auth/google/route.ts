import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { findOrCreateUserByGoogleId } from '@/lib/database'; // Assuming @ refers to the root project directory

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { googleId, email, name, picture } = body;

    if (!googleId || !email) {
      return NextResponse.json({ message: 'Google ID and email are required' }, { status: 400 });
    }

    // Derive username from email (part before '@')
    const usernameFromEmail = email.split('@')[0];
    if (!usernameFromEmail) {
        return NextResponse.json({ message: 'Could not derive username from email' }, { status: 400 });
    }
    
    const user = await findOrCreateUserByGoogleId(googleId, email, usernameFromEmail, picture);

    if (!user) {
      return NextResponse.json({ message: 'Could not find or create user' }, { status: 500 });
    }

    // Ensure user object has id, username, and role for the JWT
    if (!user.id || !user.username || !user.role) {
        console.error('User object is missing required fields (id, username, role):', user);
        return NextResponse.json({ message: 'User data is incomplete after creation/retrieval' }, { status: 500 });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      message: 'Google Sign-In successful',
      user: { id: user.id, username: user.username, role: user.role, email: user.email, profileImageUrl: user.profile_image_url },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;

  } catch (error) {
    console.error('Google Sign-In error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}
