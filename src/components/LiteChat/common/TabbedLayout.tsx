// src/components/LiteChat/common/TabbedLayout.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface TabDefinition {
  value: string;
  label: string | React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
  order?: number; // Added order property
}

interface TabbedLayoutProps {
  tabs: TabDefinition[];
  defaultValue?: string;
  initialValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  listClassName?: string;
  contentContainerClassName?: string;
  scrollable?: boolean;
}

export const TabbedLayout: React.FC<TabbedLayoutProps> = ({
  tabs,
  defaultValue,
  initialValue,
  onValueChange,
  className,
  listClassName,
  contentContainerClassName,
  scrollable,
}) => {
  const [internalValue, setInternalValue] = useState(
    initialValue ?? defaultValue ?? tabs[0]?.value
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
    "px-1 py-0.25 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-medium rounded-md",
    "text-muted-foreground",
    "border border-transparent",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
    "data-[state=active]:border-primary",
    "dark:data-[state=active]:bg-primary/20 dark:data-[state=active]:text-primary",
    "dark:data-[state=active]:border-primary/70",
    "hover:bg-muted/50 hover:text-primary/80"
  );

  const CntWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const baseClasses = scrollable 
      ? "flex-grow overflow-y-auto pb-2 sm:pb-6 pr-1 sm:pr-2 -mr-1 sm:-mr-2"
      : "flex-grow pb-2 sm:pb-6 pr-1 sm:pr-2 -mr-1 sm:-mr-2";
    
    const clnm = cn(baseClasses, contentContainerClassName);
    
    if (scrollable) {
      return <ScrollArea className={clnm}>{children}</ScrollArea>;
    }

    return <div className={clnm}>{children}</div>;
  };

  return (
    <Tabs
      value={internalValue}
      onValueChange={handleValueChange}
      defaultValue={defaultValue}
      className={cn("flex flex-col h-full", className)}
    >
      <TabsList
        className={cn(
          "flex-shrink-0 sticky top-0 bg-background z-10 flex-wrap h-auto justify-start border-b gap-0.5 sm:gap-1 p-0.5 sm:p-1 px-2 sm:px-6",
          listClassName
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
      <CntWrap>
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
      </CntWrap>
    </Tabs>
  );
};
