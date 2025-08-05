"use client";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble, { MessageBubbleProps } from "./MessageBubble";

export interface Message extends MessageBubbleProps {
  id: string;
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <ScrollArea className="flex-1 p-4">
      {messages.map(({ id, ...rest }) => (
        <MessageBubble key={id} {...rest} />
      ))}

      {isLoading && (
        <MessageBubble text="Thinking…" isUser={false} isError={false} />
      )}

      <div ref={bottomRef} />
    </ScrollArea>
  );
}
