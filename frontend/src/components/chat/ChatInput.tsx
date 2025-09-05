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
    <div className="relative">
      {/* Gradient fade effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F16] via-[#0A0F16]/95 to-transparent pointer-events-none"></div>

      <div className="relative backdrop-blur-xl border-t border-gray-800/30">
        {/* Confirmation banner with premium blur effect */}
        {awaitingConfirmation && (
          <div className="border-b border-gray-800/30 bg-black/20 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400/90">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-amber-400/90">Confirm write operation</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleQuickConfirm("yes")}
                    className="px-4 py-2 text-xs font-medium bg-indigo-600/20 text-white/90 hover:bg-indigo-600/30 rounded-lg transition-all duration-200 ring-1 ring-indigo-500/20 hover:ring-indigo-500/30"
                    disabled={disabled}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => handleQuickConfirm("no")}
                    className="px-4 py-2 text-xs font-medium bg-gray-800/40 text-gray-300 hover:bg-gray-700/50 rounded-lg transition-all duration-200 ring-1 ring-white/5"
                    disabled={disabled}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative px-4 py-4 sm:px-6">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-violet-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    disabled={disabled || !sessionActive}
                    rows={1}
                    className={`w-full resize-none bg-[#0A0F16]/80 text-gray-100 rounded-xl px-4 py-3 text-sm sm:text-base placeholder-gray-500/70
                      border border-gray-800/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30
                      backdrop-blur-xl shadow-lg transition-all duration-200 ring-1 ring-white/5
                      ${disabled || !sessionActive ? 'cursor-not-allowed opacity-50' : ''}
                      ${awaitingConfirmation ? 'focus:ring-amber-500/30 focus:border-amber-500/30 text-amber-200 placeholder-amber-200/70' : ''}`}
                  />
                  {/* Keyboard shortcut hint */}
                  <div className="hidden sm:block absolute right-3 bottom-3 pointer-events-none">
                    <kbd className="text-xs px-1.5 py-0.5 rounded bg-gray-800/50 text-gray-500 ring-1 ring-gray-700/50">
                      ⌘ + ↵
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Send button with premium look */}
              {value.trim() && sessionActive && (
                <button
                  type="submit"
                  disabled={disabled}
                  className={`p-3 sm:p-4 rounded-xl transition-all duration-200 shadow-lg backdrop-blur-xl group
                    ${disabled 
                      ? 'bg-gray-800/40 text-gray-500 cursor-not-allowed ring-1 ring-white/5' 
                      : 'bg-gradient-to-br from-indigo-600/90 via-violet-600/90 to-purple-600/90 text-white/90 hover:shadow-indigo-500/20 hover:scale-105 active:scale-95 ring-1 ring-white/10'
                    }`}
                >
                  {disabled ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  )}
                </button>
              )}
            </div>
            
            {/* Mobile hint */}
            <div className="mt-2 text-center sm:hidden">
              <span className="text-xs text-gray-500">Tap twice to send</span>
            </div>
          </form>
        </div>

        {/* Session status footer with premium styling */}
        {!sessionActive && (
          <div className="border-t border-gray-800/30 bg-black/20 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto px-6 py-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-lg bg-red-500/10 text-red-400/90">
                  <X className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-red-400/90">Session inactive. Refresh to continue.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
