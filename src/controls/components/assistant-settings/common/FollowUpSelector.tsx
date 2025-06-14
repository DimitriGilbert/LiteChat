import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, ChevronDown } from "lucide-react";
import type { PromptTemplate } from "@/types/litechat/prompt-template";

interface FollowUpSelectorProps {
  selectedFollowUps: string[];
  onFollowUpsChange: (followUps: string[]) => void;
  followUpOptions: PromptTemplate[];
  templateId?: string;
}

export const FollowUpSelector: React.FC<FollowUpSelectorProps> = ({
  selectedFollowUps,
  onFollowUpsChange,
  followUpOptions,
  templateId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableOptions = followUpOptions.filter(t => 
    t.id !== templateId && // Don't include self
    !selectedFollowUps.includes(t.id) // Don't include already selected
  );

  const filteredOptions = availableOptions.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddFollowUp = (templateIdToAdd: string) => {
    if (templateIdToAdd && !selectedFollowUps.includes(templateIdToAdd)) {
      onFollowUpsChange([...selectedFollowUps, templateIdToAdd]);
      setSearchTerm("");
      setIsOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRemoveFollowUp = (templateIdToRemove: string) => {
    onFollowUpsChange(selectedFollowUps.filter(id => id !== templateIdToRemove));
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">Follow-up Templates</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Select templates that can be suggested as follow-ups after this template is used.
        </p>
        
        <div className="space-y-3">
          {/* Selected Follow-ups Display */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selected Follow-ups:</Label>
            {selectedFollowUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedFollowUps.map((followUpId) => {
                  const followUpTemplate = followUpOptions.find(t => t.id === followUpId);
                  if (!followUpTemplate) {
                    return (
                      <Badge key={followUpId} variant="destructive" className="flex items-center gap-1">
                        Unknown Template ({followUpId})
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleRemoveFollowUp(followUpId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  }
                  return (
                    <Badge key={followUpId} variant="secondary" className="flex items-center gap-1">
                      {followUpTemplate.name}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveFollowUp(followUpId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Follow-up Custom Dropdown */}
          {availableOptions.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <Label className="text-sm">Add Follow-up Template:</Label>
              <div className="relative">
                <div
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm cursor-pointer hover:bg-accent"
                  onClick={() => setIsOpen(!isOpen)}
                >
                  <span className="text-muted-foreground">
                    {searchTerm || "Select a template to add as follow-up"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </div>
                
                {isOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                    <div className="p-2">
                      <Input
                        placeholder="Search templates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-48 overflow-auto">
                      {filteredOptions.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No templates found.
                        </div>
                      ) : (
                        filteredOptions.map((template) => (
                          <div
                            key={template.id}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => handleAddFollowUp(template.id)}
                          >
                            {template.name} - {template.description}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {availableOptions.length === 0 && selectedFollowUps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No templates available for follow-ups. Create more templates first.
            </p>
          )}

          {availableOptions.length === 0 && selectedFollowUps.length > 0 && (
            <p className="text-sm text-muted-foreground">
              All available templates have been selected as follow-ups.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}; 