"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import ChatContainer from "@/components/chat/ChatContainer";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FEFCF6' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ 
            borderColor: '#162A2C', 
            borderTopColor: 'transparent' 
          }}></div>
          <p className="text-lg font-medium" style={{ color: '#162A2C' }}>Loading your AI assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#FEFCF6' }}>
      {/* Geometric Background Elements - matching homepage */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-4 left-4 w-8 h-8 opacity-5">
          <div className="w-full h-full rounded-full" style={{ backgroundColor: '#162A2C' }}></div>
        </div>
        <div className="absolute top-8 right-4 w-6 h-6 opacity-10">
          <div className="w-full h-full" style={{ backgroundColor: '#D3C3B9', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
        </div>
        <div className="absolute bottom-16 left-1/4 w-7 h-7 opacity-5">
          <div className="w-full h-full transform rotate-45" style={{ backgroundColor: '#162A2C' }}></div>
        </div>
        <div className="absolute bottom-4 right-4 w-6 h-6 opacity-10">
          <div className="w-full h-full rounded-full" style={{ backgroundColor: '#D3C3B9' }}></div>
        </div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-3" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #162A2C 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }}></div>
      </div>

      {/* Header - matching homepage style */}
      <header className="relative z-20 flex justify-between items-center px-4 sm:px-6 py-4 border-b" style={{ borderColor: '#D3C3B9' }}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#162A2C' }}>
            <span className="text-lg sm:text-xl font-bold" style={{ color: '#FEFCF6' }}>A</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: '#162A2C' }}>AiDb Assistant</h1>
            <p className="text-xs sm:text-sm opacity-70" style={{ color: '#162A2C' }}>AI-Powered Database Chat</p>
          </div>
        </div>
        
        <Button
          onClick={handleLogout}
          className="flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105"
          style={{ 
            backgroundColor: '#D3C3B9',
            color: '#162A2C',
            border: '2px solid #D3C3B9'
          }}
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-8xl">
          <div className="rounded-xl shadow-xl border overflow-hidden" style={{ 
            backgroundColor: '#162A2C',
            borderColor: '#D3C3B9'
          }}>
            <ChatContainer />
          </div>
        </div>
      </main>

      {/* Footer - matching homepage */}
      <footer className="relative z-20 p-4 text-center border-t" style={{ borderColor: '#D3C3B9' }}>
        <p className="text-xs opacity-60" style={{ color: '#162A2C' }}>
          AI Conversational Database System © 2025 • Powered by AiDb
        </p>
      </footer>
    </div>
  );
}
