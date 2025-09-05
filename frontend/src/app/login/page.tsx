"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { setAuthInfo } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);
    
    try {
      console.log("Starting login process...");
      const res = await api.login(email, password);
      
      if (!res.access_token) {
        throw new Error("No access token received from server");
      }
      
      if (!res.user) {
        throw new Error("No user data received from server");
      }
      
      setAuthInfo(res.access_token, res.user);
      setMessage(`Login successful! Welcome ${res.user.email}`);
      
      // Small delay to show success message then go to chat
      setTimeout(() => {
        router.push("/chat");
      }, 1000);
      
    } catch (err: unknown) {
      console.error("Login failed:", err);
      if (err instanceof Error) {
        setMessage(`Login error: ${err.message}`);
      } else {
        setMessage("Login error: Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ backgroundColor: '#FEFCF6' }}>
      {/* Background geometric elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-16 h-16 opacity-10 animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }}>
          <div className="w-full h-full rounded-full" style={{ backgroundColor: '#162A2C' }}></div>
        </div>
        <div className="absolute top-32 right-16 w-12 h-12 opacity-15 animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }}>
          <div className="w-full h-full transform rotate-45" style={{ backgroundColor: '#D3C3B9' }}></div>
        </div>
        <div className="absolute bottom-20 left-1/4 w-10 h-10 opacity-10 animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }}>
          <div className="w-full h-full transform rotate-45" style={{ backgroundColor: '#162A2C' }}></div>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-2" style={{ backgroundColor: '#FEFCF6', borderColor: '#D3C3B9' }}>
        <CardHeader className="text-center pb-6">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#162A2C' }}>
              <span className="text-lg font-bold" style={{ color: '#FEFCF6' }}>A</span>
            </div>
            <span className="text-xl font-bold" style={{ color: '#162A2C' }}>AiDb</span>
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: '#162A2C' }}>
            Welcome Back
          </CardTitle>
          <p className="text-sm opacity-80 mt-2" style={{ color: '#162A2C' }}>
            Sign in to access your database assistant
          </p>
        </CardHeader>
        
        <CardContent className="px-6 pb-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#162A2C' }}>
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="border-2 transition-all duration-300 focus:scale-[1.01] h-11"
                style={{ 
                  borderColor: '#D3C3B9',
                  backgroundColor: '#FEFCF6',
                  color: '#162A2C'
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium" style={{ color: '#162A2C' }}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="border-2 transition-all duration-300 focus:scale-[1.01] h-11"
                style={{ 
                  borderColor: '#D3C3B9',
                  backgroundColor: '#FEFCF6',
                  color: '#162A2C'
                }}
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg border text-center text-sm font-medium ${
                message.includes('error') 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : 'bg-green-50 border-green-200 text-green-700'
              }`}>
                {message}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 font-semibold border-2 transition-all duration-300 hover:scale-[1.02]"
              style={{
                backgroundColor: '#162A2C',
                borderColor: '#162A2C',
                color: '#FEFCF6'
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>

            <div className="text-center pt-4 border-t" style={{ borderColor: '#D3C3B9' }}>
              <p className="text-sm opacity-70" style={{ color: '#162A2C' }}>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => router.push('/signup')}
                  className="font-medium hover:underline transition-colors"
                  style={{ color: '#162A2C' }}
                >
                  Sign up
                </button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
