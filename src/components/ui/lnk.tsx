// src/components/ui/lnk.tsx
// FULL FILE
import React from "react";
import { cn } from "@/lib/utils";

export interface LnkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

const Lnk = React.forwardRef<HTMLAnchorElement, LnkProps>(
  ({ className, href, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank" // Ensure links open in a new tab
        rel="noopener noreferrer" // Security best practice for target="_blank"
        className={cn(
          "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        {children}
      </a>
    );
  },
);
Lnk.displayName = "Lnk";

export { Lnk };
