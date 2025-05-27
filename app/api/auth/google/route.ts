import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { findOrCreateUserByGoogleId } from '@/lib/database'; // Assuming @ refers to the root project directory

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ message: 'ID token is required' }, { status: 400 });
    }

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER',
      });
    } catch (error) {
      console.error('Google ID token verification error:', error);
      return NextResponse.json({ message: 'Invalid Google ID token' }, { status: 401 });
    }
    
    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json({ message: 'Could not get payload from token' }, { status: 401 });
    }

    const { sub: googleId, email, name, picture: profileImageUrl } = payload;

    if (!googleId || !email) {
      return NextResponse.json({ message: 'Missing Google ID or email in token payload' }, { status: 401 });
    }

    // Derive username from email (part before '@')
    // Ensure it's a valid username (e.g., non-empty)
    const usernameFromEmail = email.split('@')[0];
    if (!usernameFromEmail) {
        return NextResponse.json({ message: 'Could not derive username from email' }, { status: 400 });
    }
    
    // Use name as a fallback if username from email is problematic, or simply use name if preferred.
    // For this implementation, we'll stick to username from email.
    // The 'name' from Google could be used as a display name, separate from the unique username.
    const user = await findOrCreateUserByGoogleId(googleId, email, usernameFromEmail, profileImageUrl);

    if (!user) {
      // This case should ideally be handled within findOrCreateUserByGoogleId or indicate a specific error
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
    // Check if error is an instance of Error to access message property safely
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}
