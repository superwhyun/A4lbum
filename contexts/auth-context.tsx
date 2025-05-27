'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  role: string;
}

import { GoogleOAuthProvider, useGoogleLogin, TokenResponse } from '@react-oauth/google';

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
  // Using flow: 'implicit' to attempt to get id_token directly. Note: Implicit flow is deprecated by Google.
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse: TokenResponse) => { 
      // For implicit flow, TokenResponse should contain id_token.
      const idToken = tokenResponse.id_token;

      if (!idToken) {
        console.error('Google Sign-In: No id_token found in response from implicit flow.', tokenResponse);
        googleLoginPromiseCallbacks?.resolve(false);
        setGoogleLoginPromiseCallbacks(null);
        return;
      }

      try {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }), // Send the obtained id_token
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
    onError: (errorResponse) => { // errorResponse can be an object with an error field
      console.error('Google login hook error:', errorResponse);
      googleLoginPromiseCallbacks?.resolve(false);
      setGoogleLoginPromiseCallbacks(null);
    },
    flow: 'implicit', // Requesting id_token directly (Implicit Flow).
                      // Note: Google has deprecated the implicit flow for new projects.
                      // Authorization Code Flow with PKCE is preferred.
                      // This might require backend changes if a 'code' is sent instead of 'idToken'.
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

  // It's important that GoogleOAuthProvider wraps AuthContext.Provider
  // if AuthContext itself needs to trigger Google login,
  // but here AuthContext only processes the token.
  // The component calling signInWithGoogle will use useGoogleLogin hook,
  // which needs to be under GoogleOAuthProvider.
  // So, wrapping AuthProvider's children is the correct placement.
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER'}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </GoogleOAuthProvider>
  );
};