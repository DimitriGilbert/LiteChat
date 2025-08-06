'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HelpCircle, ExternalLink, Info } from 'lucide-react';

interface FieldHelpProps {
  help?: {
    text?: string;
    tooltip?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    link?: { url: string; text: string };
  };
  className?: string;
}

export const FieldHelp: React.FC<FieldHelpProps> = ({
  help,
  className,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!help || (!help.text && !help.tooltip && !help.link)) {
    return null;
  }

  const { text, tooltip, position = 'top', link } = help;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Help text */}
      {text && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>{text}</p>
        </div>
      )}

      {/* Tooltip trigger */}
      {tooltip && (
        <div className="relative inline-block">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <HelpCircle className="h-3 w-3" />
          </Button>

          {/* Tooltip */}
          {showTooltip && (
            <div
              className={cn(
                "absolute z-50 px-2 py-1 text-xs text-white bg-black rounded shadow-lg whitespace-nowrap",
                "pointer-events-none",
                {
                  'bottom-full left-1/2 -translate-x-1/2 mb-1': position === 'top',
                  'top-full left-1/2 -translate-x-1/2 mt-1': position === 'bottom',
                  'right-full top-1/2 -translate-y-1/2 mr-1': position === 'left',
                  'left-full top-1/2 -translate-y-1/2 ml-1': position === 'right',
                }
              )}
            >
              {tooltip}
              {/* Tooltip arrow */}
              <div
                className={cn(
                  "absolute w-0 h-0 border-2 border-transparent",
                  {
                    'top-full left-1/2 -translate-x-1/2 border-t-black border-b-0': position === 'top',
                    'bottom-full left-1/2 -translate-x-1/2 border-b-black border-t-0': position === 'bottom',
                    'top-1/2 left-full -translate-y-1/2 border-l-black border-r-0': position === 'left',
                    'top-1/2 right-full -translate-y-1/2 border-r-black border-l-0': position === 'right',
                  }
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* Help link */}
      {link && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs text-primary hover:text-primary/80"
            onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
          >
            {link.text}
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}; 