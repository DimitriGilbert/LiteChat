// src/components/LiteChat/common/SettingsSection.tsx
import React from "react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  contentClassName?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  className,
  titleClassName,
  descriptionClassName,
  contentClassName,
}) => {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h3 className={cn("text-lg font-medium", titleClassName)}>{title}</h3>
        {description && (
          <p
            className={cn(
              "text-sm text-muted-foreground",
              descriptionClassName,
            )}
          >
            {description}
          </p>
        )}
      </div>
      <div className={cn(contentClassName)}>{children}</div>
    </div>
  );
};
