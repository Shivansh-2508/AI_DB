"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value.trim());
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-800 p-4">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask your database…"
        disabled={disabled}
        className="flex-1 bg-zinc-900 text-zinc-100 placeholder-zinc-500"
      />
      <Button
        type="submit"
        disabled={disabled || !value.trim()}
        className="bg-indigo-600 hover:bg-indigo-500"
      >
        Send
      </Button>
    </form>
  );
}
