"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const LoginLogoutButton = () => {
  const router = useRouter();
  const { token, user, logout } = useAuth();

  if (token && user) {
    return (
      <Button
        onClick={() => {
          logout();
          router.push('/');
        }}
      >
        Log out
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => router.push('/login')}
    >
      Login
    </Button>
  );
};

export default LoginLogoutButton;
