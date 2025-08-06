"use client";
import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface FormAccordionProps {
  children?: React.ReactNode;
  sections: {
    id: string;
    title: string;
    content: React.ReactNode;
    defaultOpen?: boolean;
  }[];
  type?: 'single' | 'multiple';
  className?: string;
}

export const FormAccordion: React.FC<FormAccordionProps> = ({
  children,
  sections,
  type = 'single',
  className,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {children}
      
      {type === 'single' ? (
        <Accordion 
          type="single" 
          defaultValue={sections.find(s => s.defaultOpen)?.id}
          collapsible
        >
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger>{section.title}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {section.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Accordion 
          type="multiple" 
          defaultValue={sections.filter(s => s.defaultOpen).map(s => s.id)}
        >
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger>{section.title}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {section.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};