"use client";
import { cn } from "@/lib/utils";

export interface MessageBubbleProps {
  text: string;
  isUser?: boolean;
  isError?: boolean;
}

export default function MessageBubble({
  text,
  isUser = false,
  isError = false,
}: MessageBubbleProps) {
  return (
    <div className={cn("flex w-full mb-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[72%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap shadow transition-colors",
          isUser
            ? "bg-indigo-600 text-white"
            : isError
            ? "bg-red-800/40 text-red-200"
            : "bg-zinc-800 text-zinc-100"
        )}
      >
        {text}
      </div>
    </div>
  );
}
