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
    const baseClass = "w-full resize-none border rounded-2xl px-6 py-4 text-sm leading-relaxed focus:outline-none focus:ring-2 transition-all duration-300 backdrop-blur-sm";
    
    if (!sessionActive) {
      return `${baseClass} bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 text-slate-400 dark:text-slate-500 placeholder-slate-400 cursor-not-allowed`;
    }
    
    if (awaitingConfirmation) {
      return `${baseClass} bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border-amber-300/50 dark:border-amber-600/50 text-slate-900 dark:text-slate-100 placeholder-amber-600 dark:placeholder-amber-400 focus:ring-amber-500/30 focus:border-amber-500 shadow-lg shadow-amber-500/10`;
    }
    
    return `${baseClass} bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-700 border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-lg shadow-slate-500/10 hover:shadow-lg hover:shadow-indigo-500/10`;
  };

  return (
    <div className="border-t border-slate-200/30 dark:border-slate-700/30 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
      {/* Enhanced confirmation quick actions */}
      {awaitingConfirmation && (
        <div className="px-6 pt-4 pb-3">
          <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border border-amber-200/50 dark:border-amber-600/50 rounded-2xl px-4 py-3 backdrop-blur-sm shadow-lg shadow-amber-500/10">
            <div className="flex items-center gap-3 text-sm font-medium text-amber-800 dark:text-amber-200">
              <div className="p-1.5 bg-amber-200/50 dark:bg-amber-700/50 rounded-xl">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <span>Waiting for confirmation on write operation</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleQuickConfirm("yes")}
                size="sm"
                variant="outline"
                className="h-8 px-4 text-xs font-medium bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 text-emerald-700 border-emerald-300/50 hover:border-emerald-400/50 shadow-lg shadow-emerald-500/10 transition-all duration-300"
                disabled={disabled}
              >
                <CheckCircle className="h-3 w-3 mr-1.5" />
                Confirm
              </Button>
              <Button
                onClick={() => handleQuickConfirm("no")}
                size="sm"
                variant="outline"
                className="h-8 px-4 text-xs font-medium bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 text-red-700 border-red-300/50 hover:border-red-400/50 shadow-lg shadow-red-500/10 transition-all duration-300"
                disabled={disabled}
              >
                <X className="h-3 w-3 mr-1.5" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-4 p-6">
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
          
          {/* Enhanced input state indicator */}
          {awaitingConfirmation && (
            <div className="absolute right-4 top-4 text-amber-500">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
          )}
        </div>

        {/* Premium submit button */}
        <Button
          type="submit"
          disabled={disabled || !value.trim() || !sessionActive}
          size="sm"
          className={`border-0 rounded-2xl px-6 py-4 h-auto shadow-lg hover:shadow-xl transition-all duration-300 font-medium disabled:text-slate-500 ${
            awaitingConfirmation
              ? "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white disabled:from-amber-300 disabled:to-yellow-300 dark:disabled:from-amber-800 dark:disabled:to-yellow-800 shadow-amber-500/25 hover:shadow-amber-500/40"
              : sessionActive
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-600 shadow-indigo-500/25 hover:shadow-indigo-500/40"
                : "bg-slate-400 text-slate-200 cursor-not-allowed"
          }`}
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : awaitingConfirmation ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </form>

      {/* Enhanced session status footer */}
      {!sessionActive && (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl py-3 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm shadow-lg shadow-slate-500/10">
            <div className="p-1.5 bg-slate-200/50 dark:bg-slate-600/50 rounded-xl">
              <X className="h-4 w-4" />
            </div>
            <span>Session expired due to inactivity. Refresh the page to start a new session.</span>
          </div>
        </div>
      )}
    </div>
  );
}