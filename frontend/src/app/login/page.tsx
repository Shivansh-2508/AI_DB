"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
      
      // Small delay to show success message
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
      
    } catch (err: any) {
      console.error("Login failed:", err);
      setMessage(`Login error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="bg-zinc-900 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-zinc-100">Login</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Email" 
              required
              className="w-full p-3 rounded bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Password" 
              required
              className="w-full p-3 rounded bg-zinc-800 text-zinc-100 border border-zinc-700 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
          {message && (
            <p className={`text-center ${message.includes('error') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
