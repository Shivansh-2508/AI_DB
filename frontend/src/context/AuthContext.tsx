'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  [key: string]: unknown;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  setAuthInfo: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Safe localStorage helpers
const getStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStorageItem = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Failed to set localStorage item ${key}:`, error);
  }
};

const removeStorageItem = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove localStorage item ${key}:`, error);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth info from localStorage on mount
  useEffect(() => {
    const loadAuthFromStorage = () => {
      try {
        const savedToken = getStorageItem('authToken');
        const savedUser = getStorageItem('authUser');
        
        if (savedToken && savedUser) {
          // Validate token format (basic JWT check)
          const tokenParts = savedToken.split('.');
          if (tokenParts.length === 3) {
            try {
              // Check if token is expired (if it has exp claim)
              const payload = JSON.parse(atob(tokenParts[1]));
              const currentTime = Math.floor(Date.now() / 1000);
              
              if (payload.exp && payload.exp < currentTime) {
                console.log('Token expired, clearing auth data');
                removeStorageItem('authToken');
                removeStorageItem('authUser');
                return;
              }
            } catch (e) {
              console.log('Token validation error:', e);
            }
            
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            console.log('Auth restored from localStorage');
          } else {
            console.log('Invalid token format, clearing auth data');
            removeStorageItem('authToken');
            removeStorageItem('authUser');
          }
        }
      } catch (error) {
        console.error('Error loading auth from storage:', error);
        removeStorageItem('authToken');
        removeStorageItem('authUser');
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthFromStorage();
  }, []);

  const setAuthInfo = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    // Persist to localStorage
    setStorageItem('authToken', newToken);
    setStorageItem('authUser', JSON.stringify(newUser));
    console.log('Auth info updated and persisted');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    // Clear from localStorage
    removeStorageItem('authToken');
    removeStorageItem('authUser');
    console.log('User logged out, auth data cleared');
  };

  return (
    <AuthContext.Provider value={{ token, user, setAuthInfo, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

