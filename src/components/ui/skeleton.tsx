import * as React from "react";

import { cn } from "@/lib/utils";

/** Skeleton — shimmering placeholder for loading views. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-cocoa/10", className)}
      {...props}
    />
  );
}
