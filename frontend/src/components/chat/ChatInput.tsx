"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, AlertTriangle, CheckCircle, X } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  awaitingConfirmation?: boolean;
  sessionActive?: boolean;
}

export default function ChatInput({ 
  onSend, 
  disabled, 
  placeholder,
  awaitingConfirmation = false,
  sessionActive = true 
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled || !sessionActive) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Quick confirmation buttons for write operations
  const handleQuickConfirm = (decision: "yes" | "no") => {
    onSend(decision);
    setValue("");
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  // Phase 3: Dynamic placeholder based on state
  const getPlaceholder = () => {
    if (!sessionActive) return "Session inactive. Please refresh to continue.";
    if (awaitingConfirmation) return "Type 'yes' to confirm or 'no' to cancel...";
    return placeholder || "Ask about your data... (Press Enter to send, Shift+Enter for new line)";
  };

  // Phase 3: Dynamic styling based on state
  const getInputClassName = () => {
    const baseClass = "w-full resize-none border rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 transition-all duration-200";
    
    if (!sessionActive) {
      return `${baseClass} bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 placeholder-slate-400 cursor-not-allowed`;
    }
    
    if (awaitingConfirmation) {
      return `${baseClass} bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600 text-slate-900 dark:text-slate-100 placeholder-yellow-600 dark:placeholder-yellow-400 focus:ring-yellow-500/50 focus:border-yellow-500`;
    }
    
    return `${baseClass} bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-blue-500/50 focus:border-blue-500`;
  };

  return (
    <div className="border-t border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur">
      {/* Phase 3: Confirmation quick actions */}
      {awaitingConfirmation && (
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span>Waiting for confirmation on write operation</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleQuickConfirm("yes")}
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300 hover:border-green-400"
                disabled={disabled}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Yes
              </Button>
              <Button
                onClick={() => handleQuickConfirm("no")}
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-300 hover:border-red-400"
                disabled={disabled}
              >
                <X className="h-3 w-3 mr-1" />
                No
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={disabled || !sessionActive}
            rows={1}
            className={getInputClassName()}
          />
          
          {/* Phase 3: Input state indicator */}
          {awaitingConfirmation && (
            <div className="absolute right-3 top-3 text-yellow-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Phase 3: Enhanced submit button */}
        <Button
          type="submit"
          disabled={disabled || !value.trim() || !sessionActive}
          size="sm"
          className={`border-0 rounded-xl px-4 py-3 h-auto shadow-lg hover:shadow-xl transition-all duration-200 disabled:text-slate-500 ${
            awaitingConfirmation
              ? "bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-yellow-300 dark:disabled:bg-yellow-800"
              : sessionActive
                ? "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 dark:disabled:bg-slate-700"
                : "bg-slate-400 text-slate-200 cursor-not-allowed"
          }`}
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : awaitingConfirmation ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Phase 3: Session status footer */}
      {!sessionActive && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg py-2">
            <X className="h-3 w-3" />
            <span>Session expired due to inactivity. Refresh the page to start a new session.</span>
          </div>
        </div>
      )}
    </div>
  );
}