// lib/database-types.ts
export interface User {
  id: number;
  username: string;
  password?: string | null;
  role: string;
  created_at: string;
  google_id?: string | null;
  email?: string | null;
  profile_image_url?: string | null;
}

export interface Layout {
  id: number;
  name: string;
  config: string;
  created_by: number;
  created_at: string;
}

export interface DatabaseAdapter {
  // User methods
  createUser(
    username: string,
    password?: string | null,
    googleId?: string | null,
    email?: string | null,
    profileImageUrl?: string | null
  ): any | Promise<any>;
  
  getUserByGoogleId(googleId: string): User | null | Promise<User | null>;
  getUserByUsername(username: string): User | null | Promise<User | null>;
  findOrCreateUserByGoogleId(
    googleId: string,
    email: string,
    username: string,
    profileImageUrl?: string
  ): User | null | Promise<User | null>;
  
  // Layout methods
  saveLayout(name: string, config: string, userId: number): any | Promise<any>;
  updateLayout(id: number, name: string, config: string): any | Promise<any>;
  deleteLayout(id: number): any | Promise<any>;
  getLayouts(): Layout[] | Promise<Layout[]>;
  
  // Utility methods
  verifyPassword(password: string, hashedPassword: string): boolean;
}

// %%%%%LAST%%%%%