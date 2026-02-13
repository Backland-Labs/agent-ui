"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  disabled,
  isLoading,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim() && !disabled && !isLoading) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-6 py-4">
      <div
        className={cn(
          "flex items-end gap-2.5 max-w-3xl mx-auto",
          "rounded-2xl border border-border/40 bg-accent/30 backdrop-blur-sm",
          "px-4 py-3 transition-all duration-300",
          "focus-within:border-primary/30 focus-within:shadow-[0_0_24px_-6px] focus-within:shadow-primary/15"
        )}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent border-0",
            "text-[13px] leading-relaxed placeholder:text-muted-foreground/30",
            "focus-visible:outline-none focus-visible:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[24px] max-h-[200px]"
          )}
        />
        {isLoading ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onStop}
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            <Square className="h-3 w-3" />
            <span className="sr-only">Stop generation</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={!message.trim() || disabled}
            className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-20 shadow-[0_0_12px_-2px] shadow-primary/30 transition-all"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span className="sr-only">Send message</span>
          </Button>
        )}
      </div>
    </div>
  );
}
