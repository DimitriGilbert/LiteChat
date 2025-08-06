"use client";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface FormTabsProps {
  children?: React.ReactNode;
  tabs: {
    id: string;
    label: string;
    content: React.ReactNode;
  }[];
  activeTab: string; // CONTROLLED - NO INTERNAL STATE
  className?: string;
  onTabChange: (tabId: string) => void; // REQUIRED - PARENT CONTROLS STATE
}

// PURE DISPLAY COMPONENT - NO STATE, NO RERENDERS
export const FormTabs: React.FC<FormTabsProps> = ({
  children,
  tabs,
  activeTab,
  className,
  onTabChange,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
      
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};