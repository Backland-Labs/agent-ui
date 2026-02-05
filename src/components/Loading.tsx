"use client";

import { Loader2 } from "lucide-react";

interface LoadingProps {
  message?: string;
}

export function Loading({ message = "Loading..." }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function FullPageLoading({ message }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
