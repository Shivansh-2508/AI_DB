"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, AlertTriangle, X } from "lucide-react";

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

  return (
    <div className="border-t border-gray-800/40">
      {/* Confirmation banner */}
      {awaitingConfirmation && (
        <div className="max-w-screen-xl mx-auto px-4 py-2 border-b border-gray-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-400/90">
              <AlertTriangle className="h-4 w-4" />
              <span>Confirm write operation</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickConfirm("yes")}
                className="px-3 py-1.5 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-md transition"
                disabled={disabled}
              >
                Confirm
              </button>
              <button
                onClick={() => handleQuickConfirm("no")}
                className="px-3 py-1.5 text-xs bg-gray-800/40 text-gray-400 hover:bg-gray-700/40 rounded-md transition"
                disabled={disabled}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-end px-4 py-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              disabled={disabled || !sessionActive}
              rows={1}
              className={`w-full resize-none bg-gray-900/50 text-gray-100 rounded-lg px-4 py-3 text-sm placeholder-gray-500 
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-shadow
                ${disabled || !sessionActive ? 'cursor-not-allowed opacity-50' : ''}
                ${awaitingConfirmation ? 'focus:ring-amber-500/30 text-amber-400/90 placeholder-amber-500/50' : ''}`}
            />
          </div>

          {/* Send button */}
          {value.trim() && sessionActive && (
            <button
              type="submit"
              disabled={disabled}
              className={`ml-3 p-2.5 rounded-lg transition-all duration-200 
                ${disabled 
                  ? 'bg-gray-800/40 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-emerald-500/80 to-sky-500/80 text-gray-100 hover:from-emerald-500/90 hover:to-sky-500/90 hover:scale-105'
                }`}
            >
              {disabled ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          )}
        </form>
      </div>

      {/* Session status footer */}
      {!sessionActive && (
        <div className="max-w-screen-xl mx-auto px-4 py-2 border-t border-gray-800/40">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <X className="h-3.5 w-3.5" />
            <span>Session inactive. Refresh to continue.</span>
          </div>
        </div>
      )}
    </div>
  );
}
