import ChatContainer from "@/components/chat/ChatContainer";

export default function ChatPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <ChatContainer />
      <footer className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        AI Conversational DB System © 2025
      </footer>
    </main>
  );
}
