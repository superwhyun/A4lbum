'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  role: string;
}

import { useGoogleLogin, TokenResponse } from '@react-oauth/google';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  signInWithGoogle: () => Promise<boolean>; // Changed signature
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [googleLoginPromiseCallbacks, setGoogleLoginPromiseCallbacks] = 
    useState<{ resolve: (value: boolean) => void, reject: (reason?: any) => void } | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const register = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      return response.ok;
    } catch (error) {
      console.error('Register failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // useGoogleLogin hook for initiating Google Sign-In flow
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse: TokenResponse) => { 
      // Using authorization code flow, we get access_token
      const accessToken = tokenResponse.access_token;

      if (!accessToken) {
        console.error('Google Sign-In: No access_token found in response.', tokenResponse);
        googleLoginPromiseCallbacks?.resolve(false);
        setGoogleLoginPromiseCallbacks(null);
        return;
      }

      try {
        // Get user info from Google API using access_token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!userInfoResponse.ok) {
          console.error('Failed to get user info from Google');
          googleLoginPromiseCallbacks?.resolve(false);
          setGoogleLoginPromiseCallbacks(null);
          return;
        }

        const googleUser = await userInfoResponse.json();
        
        // Send user info to our backend
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            googleId: googleUser.id,
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          googleLoginPromiseCallbacks?.resolve(true);
        } else {
          const errorText = await response.text();
          console.error('Google Sign-In API failed:', errorText);
          googleLoginPromiseCallbacks?.resolve(false);
        }
      } catch (error) {
        console.error('Google Sign-In API call failed:', error);
        googleLoginPromiseCallbacks?.resolve(false);
      } finally {
        setGoogleLoginPromiseCallbacks(null);
      }
    },
    onError: (errorResponse) => {
      console.error('Google login hook error:', errorResponse);
      googleLoginPromiseCallbacks?.resolve(false);
      setGoogleLoginPromiseCallbacks(null);
    },
  });

  const signInWithGoogle = (): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      // Store the resolve/reject to be called by useGoogleLogin's callbacks
      setGoogleLoginPromiseCallbacks({ resolve, reject });
      // Trigger the Google login prompt
      triggerGoogleLogin();
    });
  };

  const value = {
    user,
    login,
    register,
    logout,
    isLoading,
    signInWithGoogle, // Expose the new function
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};