"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      await api.signup(email, password);
      setMessage("Account created successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMessage(`Signup error: ${err.message}`);
      } else {
        setMessage("Signup error: Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ backgroundColor: '#FEFCF6' }}>
      {/* Background geometric elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-16 h-16 opacity-10 animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }}>
          <div className="w-full h-full rounded-full" style={{ backgroundColor: '#162A2C' }}></div>
        </div>
        <div className="absolute top-32 left-16 w-12 h-12 opacity-15 animate-pulse" style={{ animationDelay: '1s', animationDuration: '3s' }}>
          <div className="w-full h-full" style={{ backgroundColor: '#D3C3B9', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
        </div>
        <div className="absolute bottom-20 right-1/4 w-10 h-10 opacity-10 animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }}>
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
            Create Account
          </CardTitle>
          <p className="text-sm opacity-80 mt-2" style={{ color: '#162A2C' }}>
            Join AiDb to start querying your database with AI
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium" style={{ color: '#162A2C' }}>
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
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
                message.includes('error') || message.includes("don't match") || message.includes('must be')
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
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </Button>

            <div className="text-center pt-4 border-t" style={{ borderColor: '#D3C3B9' }}>
              <p className="text-sm opacity-70" style={{ color: '#162A2C' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="font-medium hover:underline transition-colors"
                  style={{ color: '#162A2C' }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
