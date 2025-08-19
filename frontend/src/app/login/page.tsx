"use client";
import { useState } from "react";
import { LoginForm } from "@/components/login/loginForm";
import { SignUpForm } from "@/components/signup/SignUpForm";

export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl shadow-2xl p-8">
          <div className="flex justify-center mb-6">
            <button
              className={`px-6 py-2 rounded-l-2xl font-semibold transition-colors ${showLogin ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              onClick={() => setShowLogin(true)}
            >
              Login
            </button>
            <button
              className={`px-6 py-2 rounded-r-2xl font-semibold transition-colors ${!showLogin ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              onClick={() => setShowLogin(false)}
            >
              Sign Up
            </button>
          </div>
          <div>
            {showLogin ? <LoginForm /> : <SignUpForm />}
          </div>
        </div>
      </div>
    </div>
  );
}
