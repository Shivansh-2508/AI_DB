"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LogoutPage() {
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    logout();
    if (typeof document !== 'undefined') {
      document.cookie = 'jwt=; path=/; max-age=0; samesite=strict';
    }
    router.replace('/');
  }, [logout, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FEFCF6' }}>
      <p className="text-sm" style={{ color: '#162A2C' }}>Logging you out...</p>
    </div>
  );
}
