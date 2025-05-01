// src/components/LiteChat/common/TabbedLayout.tsx
import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface TabDefinition {
  value: string;
  label: string | React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabbedLayoutProps {
  tabs: TabDefinition[];
  defaultValue?: string;
  initialValue?: string
  onValueChange?: (value: string) => void;
  className?: string;
  listClassName?: string;
  contentContainerClassName?: string;
}

export const TabbedLayout: React.FC<TabbedLayoutProps> = ({
  tabs,
  defaultValue,
  initialValue,
  onValueChange,
  className,
  listClassName,
  contentContainerClassName,
}) => {
  const [internalValue, setInternalValue] = useState(
    initialValue ?? defaultValue ?? tabs[0]?.value,
  );

  // Effect to sync with external initialValue if provided
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== internalValue) {
      setInternalValue(initialValue);
    }
  }, [initialValue, internalValue]);

  const handleValueChange = (value: string) => {
    setInternalValue(value);
    if (onValueChange) {
      onValueChange(value);
    }
  };

  const tabTriggerClass = cn(
    "px-3 py-1.5 text-sm font-medium rounded-md",
    "text-muted-foreground",
    "border border-transparent",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
    "data-[state=active]:border-primary",
    "dark:data-[state=active]:bg-primary/20 dark:data-[state=active]:text-primary",
    "dark:data-[state=active]:border-primary/70",
    "hover:bg-muted/50 hover:text-primary/80",
  );

  return (
    <Tabs
      value={internalValue}
      onValueChange={handleValueChange}
      defaultValue={defaultValue}
      className={cn("flex flex-col h-full", className)}
    >
      <TabsList
        className={cn(
          "flex-shrink-0 sticky top-0 bg-background z-10 mb-4 flex-wrap h-auto justify-start border-b gap-1 p-1 -mx-6 px-6",
          listClassName,
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className={tabTriggerClass}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div
        className={cn(
          "flex-grow overflow-y-auto pb-6 pr-2 -mr-2",
          contentContainerClassName,
        )}
      >
        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            // Keep content mounted but hidden for better state preservation if needed
            // Or use forceMount on TabsContent if state reset on tab change is desired
            className="data-[state=inactive]:hidden h-full"
          >
            {tab.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
};
