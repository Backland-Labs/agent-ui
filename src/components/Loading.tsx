"use client";

import { Loader2 } from "lucide-react";

interface LoadingProps {
  message?: string;
}

export function Loading({ message = "Loading..." }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
      <p className="text-xs text-muted-foreground/80">{message}</p>
    </div>
  );
}

export function FullPageLoading({ message }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
      {message && <p className="text-sm text-muted-foreground/80">{message}</p>}
    </div>
  );
}
