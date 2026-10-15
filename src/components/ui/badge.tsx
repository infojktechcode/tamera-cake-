import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Badge — pill chip for statuses, tags and price labels. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-blush text-cocoa",
        strawberry: "bg-strawberry/15 text-strawberry-deep",
        caramel: "bg-caramel/15 text-[#8a5a1b]",
        pistachio: "bg-pistachio/20 text-[#3f6b4d]",
        outline: "border border-cocoa/20 text-cocoa",
        muted: "bg-vanilla text-ink-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
