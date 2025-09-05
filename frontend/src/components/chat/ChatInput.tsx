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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
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

      <div className="relative">
        {/* Confirmation banner - Minimal */}
        {awaitingConfirmation && (
          <div className="border-b border-gray-800/30 bg-amber-500/5">
            <div className="max-w-6xl mx-auto px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-amber-400">Confirm write operation</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickConfirm("yes")}
                    className="px-3 py-1 text-xs bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 rounded transition-colors ring-1 ring-white/5"
                    disabled={disabled}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => handleQuickConfirm("no")}
                    className="px-3 py-1 text-xs bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 rounded transition-colors ring-1 ring-white/5"
                    disabled={disabled}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

  <div className="max-w-6xl mx-auto">
          <form onSubmit={handleSubmit} className="relative px-4 py-6">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    disabled={disabled || !sessionActive}
                    rows={1}
                    className={`w-full resize-none bg-gray-800/50 text-gray-100 rounded px-4 py-3 text-sm placeholder-gray-500
                      ring-1 ring-gray-700/30 focus:outline-none focus:ring-1 focus:ring-gray-600
                      transition-colors
                      ${disabled || !sessionActive ? 'cursor-not-allowed opacity-50' : ''}
                      ${awaitingConfirmation ? 'text-amber-200 placeholder-amber-200/50 ring-amber-500/30' : ''}`}
                  />
                  {/* Keyboard shortcut hint */}
                  <div className="hidden sm:block absolute right-3 bottom-3 pointer-events-none">
                    <kbd className="text-s px-1.5 py-0.5 rounded bg-gray-900/50 text-gray-500">
                      ↵
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Send button - Minimal */}
              {value.trim() && sessionActive && (
                <button
                  type="submit"
                  disabled={disabled}
                  className={`p-2 rounded transition-colors
                    ${disabled 
                      ? 'bg-gray-800/40 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
            
          </form>
        </div>

        {/* Session status footer - Minimal */}
        {!sessionActive && (
          <div className="border-t border-gray-800/30 bg-red-500/5">
            <div className="max-w-4xl mx-auto px-4 py-2">
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-400">Session inactive. Refresh to continue.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
