"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function DebugPage() {
  const [cookieInfo, setCookieInfo] = useState<string>('');
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const { token: contextToken } = useAuth();

  useEffect(() => {
    // Get all cookies
    const allCookies = document.cookie;
    setCookieInfo(allCookies || 'No cookies found');

    // Try to get JWT specifically
    const getJwt = (): string | null => {
      if (typeof document === 'undefined') return null;
      const m = document.cookie.match(/(?:^|; )jwt=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    };

    const cookieToken = getJwt();
    setJwtToken(contextToken || cookieToken);
  }, [contextToken]);

  const testBackendCall = async () => {
    try {
  const combinedToken = jwtToken || contextToken; // prefer context token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (combinedToken) {
        headers['Authorization'] = `Bearer ${combinedToken}`;
      }

  const base = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:5000';
  const response = await fetch(`${base}/chat/test-session`, {
        method: 'GET',
        headers
      });

      const result = await response.text();
      console.log('Backend response:', response.status, result);
      alert(`Backend response: ${response.status} - ${result}`);
    } catch (error) {
      console.error('Backend call failed:', error);
      alert(`Backend call failed: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Authentication</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="text-lg font-semibold mb-2">All Cookies:</h2>
          <pre className="text-sm overflow-auto">{cookieInfo}</pre>
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h2 className="text-lg font-semibold mb-2">JWT Token:</h2>
          <pre className="text-sm overflow-auto">{jwtToken || 'No JWT token found'}</pre>
        </div>

        <div className="space-x-4">
          <button 
            onClick={testBackendCall}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Backend Call
          </button>
          
          <a 
            href="/login" 
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 inline-block"
          >
            Go to Login
          </a>
          
          <a 
            href="/chat" 
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 inline-block"
          >
            Go to Chat
          </a>
        </div>
      </div>
    </div>
  );
}
