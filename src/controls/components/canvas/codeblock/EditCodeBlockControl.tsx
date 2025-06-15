import React, { useState, useCallback } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { NotebookPenIcon, SaveIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { toast } from "sonner";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-go";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";

interface EditCodeBlockControlProps {
  interactionId?: string;
  codeBlockId?: string;
  language?: string;
  originalContent: string;
  editedContent: string;
  filepath?: string;
  disabled?: boolean;
  onEditModeChange?: (isEditing: boolean) => void;
}

export const EditCodeBlockControl: React.FC<EditCodeBlockControlProps> = ({
  interactionId,
  codeBlockId,
  language,
  originalContent,
  editedContent,
  filepath,
  disabled,
  onEditModeChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !originalContent || !interactionId || !codeBlockId) {
      toast.info("Code editing is currently disabled.");
      return;
    }
    
    setIsEditing(true);
    onEditModeChange?.(true);
  }, [disabled, originalContent, interactionId, codeBlockId, onEditModeChange]);

  const handleSave = useCallback(() => {
    if (!interactionId || !codeBlockId) {
      toast.error("Missing interaction or code block ID");
      return;
    }

    if (editedContent.trim() === "") {
      toast.error("Code cannot be empty");
      return;
    }

    // Emit event to handle the code block edit
    emitter.emit(canvasEvent.editCodeBlockRequest, {
      interactionId,
      codeBlockId,
      language,
      filepath,
      originalContent: originalContent,
      newContent: editedContent
    });

    setIsEditing(false);
    onEditModeChange?.(false);
    toast.success("Code block edited successfully");
  }, [interactionId, codeBlockId, language, filepath, originalContent, editedContent, onEditModeChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    onEditModeChange?.(false);
  }, [onEditModeChange]);

  // Get the appropriate Prism language for highlighting
  const getPrismLanguage = useCallback((lang?: string) => {
    if (!lang) return Prism.languages.plaintext || Prism.languages.text;
    
    const langMap: Record<string, any> = {
      'javascript': Prism.languages.javascript,
      'js': Prism.languages.javascript,
      'typescript': Prism.languages.typescript,
      'ts': Prism.languages.typescript,
      'python': Prism.languages.python,
      'py': Prism.languages.python,
      'bash': Prism.languages.bash,
      'sh': Prism.languages.bash,
      'json': Prism.languages.json,
      'markdown': Prism.languages.markdown,
      'md': Prism.languages.markdown,
      'diff': Prism.languages.diff,
      'go': Prism.languages.go,
      'yaml': Prism.languages.yaml,
      'yml': Prism.languages.yaml,
      'rust': Prism.languages.rust,
      'rs': Prism.languages.rust,
      'sql': Prism.languages.sql,
    };
    
    return langMap[lang.toLowerCase()] || Prism.languages.plaintext || Prism.languages.text;
  }, []);

  const highlightCode = useCallback((code: string) => {
    try {
      const prismLang = getPrismLanguage(language);
      return Prism.highlight(code, prismLang, language || 'text');
    } catch (error) {
      console.error('Syntax highlighting error:', error);
      return code;
    }
  }, [language, getPrismLanguage]);

  // Only show edit button if there's substantial code content
  const shouldShow = originalContent && originalContent.trim().length > 0 && interactionId && codeBlockId;
  
  if (!shouldShow) {
    return null;
  }

  // If editing, return the editor controls
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          onClick={handleSave}
          className="h-6 px-2 text-xs"
        >
          <SaveIcon className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          className="h-6 px-2 text-xs"
        >
          <XIcon className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    );
  }

  // If not editing, return the edit button
  return (
    <ActionTooltipButton
      tooltipText="Edit Code"
      onClick={handleStartEdit}
      aria-label="Edit code block"
      disabled={disabled || !originalContent || !interactionId || !codeBlockId}
      icon={<NotebookPenIcon />}
      iconClassName="h-3.5 w-3.5"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
    />
  );
};

// Export the editor component for use in the code block renderer
export const InlineCodeEditor: React.FC<{
  code: string;
  language?: string;
  onChange: (code: string) => void;
}> = ({ code, language, onChange }) => {
  const getPrismLanguage = useCallback((lang?: string) => {
    if (!lang) return Prism.languages.plaintext || Prism.languages.text;
    
    const langMap: Record<string, any> = {
      'javascript': Prism.languages.javascript,
      'js': Prism.languages.javascript,
      'typescript': Prism.languages.typescript,
      'ts': Prism.languages.typescript,
      'python': Prism.languages.python,
      'py': Prism.languages.python,
      'bash': Prism.languages.bash,
      'sh': Prism.languages.bash,
      'json': Prism.languages.json,
      'markdown': Prism.languages.markdown,
      'md': Prism.languages.markdown,
      'diff': Prism.languages.diff,
      'go': Prism.languages.go,
      'yaml': Prism.languages.yaml,
      'yml': Prism.languages.yaml,
      'rust': Prism.languages.rust,
      'rs': Prism.languages.rust,
      'sql': Prism.languages.sql,
    };
    
    return langMap[lang.toLowerCase()] || Prism.languages.plaintext || Prism.languages.text;
  }, []);

  const highlightCode = useCallback((code: string) => {
    try {
      const prismLang = getPrismLanguage(language);
      return Prism.highlight(code, prismLang, language || 'text');
    } catch (error) {
      console.error('Syntax highlighting error:', error);
      return code;
    }
  }, [language, getPrismLanguage]);

  return (
    <Editor
      value={code}
      onValueChange={onChange}
      highlight={highlightCode}
      padding={16}
      tabSize={2}
      insertSpaces={true}
      style={{
        fontFamily: '"Fira Code", "Fira Mono", "Consolas", "Monaco", monospace',
        fontSize: 14,
        lineHeight: 1.5,
        minHeight: '100px',
        backgroundColor: 'transparent',
        outline: 'none',
      }}
    />
  );
}; 