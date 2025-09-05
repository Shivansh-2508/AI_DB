// app/dashboard/page.tsx
"use client";


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api, { ProtectedResponse } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const [me, setMe] = useState<ProtectedResponse | null>(null);
  const [err, setErr] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<string | object | null>(null);
  const { token, user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!token) {
      setErr("No access token found. Please login.");
      setIsLoading(false);
      router.push("/login");
      return;
    }

    // First, try the normal API call
    console.log("Dashboard: Making protected API call...");
    api.getProtected(token)
      .then((data) => {
        console.log("Dashboard: Protected data received:", data);
        setMe(data);
        setErr("");
      })
      .catch((e) => {
        console.error("Dashboard: Protected API call failed:", e);
        setErr(e.message);
        
        // Don't redirect immediately - let's debug first
        if (e.message.includes('401') || e.message.includes('403')) {
          console.log("🔧 Auth error detected, but staying for debugging...");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token, authLoading, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const testDifferentHeaders = async () => {
    if (!token) return;
    
    console.log("🧪 Starting header format tests...");
    setTestResults("Testing...");
    
    try {
      const result = await api.testProtectedWithDifferentHeaders(token);
      setTestResults(result);
    } catch (error) {
      if (error instanceof Error) {
        setTestResults({ error: error.message });
      } else {
        setTestResults({ error: String(error) });
      }
    }
  };

  const makeRawRequest = async () => {
    if (!token) return;

    console.log("🔧 Making raw request to debug...");
    
    try {
      // Updated URL to match backend routes
  const response = await fetch((process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000") + "/api/auth/protected", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Raw response status:", response.status);
      console.log("Raw response headers:", Object.fromEntries(response.headers.entries()));
      
      const text = await response.text();
      console.log("Raw response body:", text);
      
      // Try to parse as JSON
      try {
        const json = JSON.parse(text);
        console.log("Parsed JSON:", json);
      } catch {
        console.log("Response is not JSON");
      }
      
    } catch (error) {
      console.error("Raw request error:", error);
    }
  };

  const testEndpointAvailability = async () => {
    console.log("🌐 Testing endpoint availability...");
    
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000";
    const endpoints = [
      `${base}/`,
      `${base}/api/auth/signup`,
      `${base}/api/auth/login`,
      `${base}/api/auth/protected`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        console.log(`${endpoint} - Status: ${response.status}`);
        
        if (endpoint.includes("protected") && token) {
          // Try with auth header for protected route
          const authResponse = await fetch(endpoint, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
          });
          console.log(`${endpoint} (with auth) - Status: ${authResponse.status}`);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.log(`${endpoint} - Error: ${error.message}`);
        } else {
          console.log(`${endpoint} - Error: ${String(error)}`);
        }
      }
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-100">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Dashboard (Debug Mode)</h1>
          <div className="space-x-4">
            <span className="text-zinc-300">Welcome, {user?.email}</span>
            <button 
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
        
        {/* Error Display */}
        {err && (
          <div className="bg-red-900 border border-red-700 p-4 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-2 text-red-100">API Error:</h2>
            <p className="text-red-200">{err}</p>
          </div>
        )}

        {/* Token Info */}
        <div className="bg-zinc-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-100">Token Information:</h2>
          <div className="space-y-2 text-sm">
            <p className="text-zinc-300">
              <span className="font-semibold">Token Present:</span> {token ? "✅ Yes" : "❌ No"}
            </p>
            {token && (
              <>
                <p className="text-zinc-300">
                  <span className="font-semibold">Token Preview:</span> 
                  <code className="ml-2 bg-zinc-800 px-2 py-1 rounded">
                    {token.substring(0, 50)}...
                  </code>
                </p>
                <p className="text-zinc-300">
                  <span className="font-semibold">Token Length:</span> {token.length} characters
                </p>
              </>
            )}
            <p className="text-zinc-300">
              <span className="font-semibold">User Data:</span> {user ? "✅ Available" : "❌ Missing"}
            </p>
          </div>
        </div>

        {/* Debug Controls */}
        <div className="bg-zinc-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-100">Debug Tools:</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={testDifferentHeaders}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              disabled={!token}
            >
              Test Different Header Formats
            </button>
            <button
              onClick={makeRawRequest}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              disabled={!token}
            >
              Make Raw Request
            </button>
            <button
              onClick={testEndpointAvailability}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Test Endpoint Availability
            </button>
          </div>
          
          {testResults && (
            <div className="mt-4 p-4 bg-zinc-800 rounded">
              <h3 className="font-semibold text-zinc-100 mb-2">Test Results:</h3>
              <pre className="text-zinc-300 text-sm overflow-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* API Response */}
        <div className="bg-zinc-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-zinc-100">API Response:</h2>
          {me ? (
            <pre className="bg-zinc-800 p-4 rounded text-zinc-100 overflow-auto text-sm">
              {JSON.stringify(me, null, 2)}
            </pre>
          ) : (
            <p className="text-zinc-400">No data received from protected endpoint</p>
          )}
        </div>
      </div>
    </div>
  );
}