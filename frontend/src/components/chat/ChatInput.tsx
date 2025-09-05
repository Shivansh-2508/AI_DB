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
    return placeholder || "Ask about your data...";
  };

  // Clean minimal styling based on state - Mobile Optimized
  const getInputClassName = () => {
    const baseClass = "w-full resize-none bg-transparent border-0 px-3 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed focus:outline-none focus:ring-1 transition-colors duration-200";
    
    if (!sessionActive) {
      return `${baseClass} cursor-not-allowed`;
    }
    
    if (awaitingConfirmation) {
      return `${baseClass} text-yellow-300 placeholder-yellow-400/50 focus:ring-yellow-500/30`;
    }
    
    return `${baseClass} focus:ring-2 focus:ring-opacity-50`;
  };

  return (
    <div>
      {/* Clean confirmation banner - Mobile Optimized */}
      {awaitingConfirmation && (
        <div className="px-3 sm:px-6 py-2 sm:py-3 border-b" style={{ 
          backgroundColor: 'rgba(22, 42, 44, 0.8)',
          borderColor: 'rgba(211, 195, 185, 0.3)'
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 text-sm font-mono text-yellow-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Confirm write operation</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => handleQuickConfirm("yes")}
                className="text-xs font-mono text-green-400 hover:text-green-300 transition-colors duration-200 px-2 py-1 rounded"
                disabled={disabled}
              >
                yes
              </button>
              <button
                onClick={() => handleQuickConfirm("no")}
                className="text-xs font-mono opacity-70 hover:opacity-100 transition-opacity duration-200 px-2 py-1 rounded"
                style={{ color: '#D3C3B9' }}
                disabled={disabled}
              >
                no
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end p-3 sm:p-4 gap-2 sm:gap-3">
        <div className="flex-1 relative min-w-0">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={disabled || !sessionActive}
            rows={1}
            className={getInputClassName()}
            style={{ 
              color: '#FEFCF6',
              backgroundColor: 'rgba(22, 42, 44, 0.6)',
              borderRadius: '6px',
              border: '1px solid rgba(211, 195, 185, 0.3)',
              maxHeight: '100px'
            }}
          />
        </div>

        {/* Send button with homepage gradient colors - Mobile Optimized */}
        {value.trim() && sessionActive && (
          <button
            type="submit"
            disabled={disabled}
            className="p-2 sm:p-2.5 rounded-lg transition-all duration-200 hover:scale-105 flex-shrink-0"
            style={{ 
              background: disabled ? 'rgba(211, 195, 185, 0.3)' : 'linear-gradient(135deg, #E91E63 0%, #14B8A6 100%)'
            }}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Send className="h-4 w-4 text-white" />
            )}
          </button>
        )}
      </form>

      {/* Session status footer - Mobile Optimized */}
      {!sessionActive && (
        <div className="px-3 sm:px-6 py-2 sm:py-3 border-t" style={{ 
          backgroundColor: 'rgba(22, 42, 44, 0.8)',
          borderColor: 'rgba(211, 195, 185, 0.3)'
        }}>
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: '#D3C3B9' }}>
            <X className="h-3 w-3 flex-shrink-0" />
            <span>Session inactive. Refresh to continue.</span>
          </div>
        </div>
      )}
    </div>
  );
}