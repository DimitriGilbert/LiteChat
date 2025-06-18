import React, { useCallback, useState } from 'react';
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Save, AlertCircle } from "lucide-react";

// Import Prism languages
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-go";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
  error?: string;
  onSave?: (value: string) => void;
  showSaveButton?: boolean;
  saveButtonText?: string;
  disabled?: boolean;
  minHeight?: string;
  className?: string;
}

const getPrismLanguage = (lang?: string) => {
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
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'text',
  placeholder,
  error,
  onSave,
  showSaveButton = false,
  saveButtonText = "Save",
  disabled = false,
  minHeight = '200px',
  className = '',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const highlightCode = useCallback((code: string) => {
    try {
      const prismLang = getPrismLanguage(language);
      return Prism.highlight(code, prismLang, language || 'text');
    } catch (error) {
      console.error('Syntax highlighting error:', error);
      return code;
    }
  }, [language]);

  const handleSave = useCallback(async () => {
    if (!onSave || disabled || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSave(value);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSave, value, disabled, isSubmitting]);

  const canSave = showSaveButton && onSave && value.trim().length > 0 && !disabled;

  return (
    <div className={`space-y-2 ${className}`}>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="relative border rounded-md">
        <Editor
          value={value}
          onValueChange={onChange}
          highlight={highlightCode}
          padding={16}
          tabSize={2}
          insertSpaces={true}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            fontFamily: '"Fira Code", "Fira Mono", "Consolas", "Monaco", monospace',
            fontSize: 14,
            lineHeight: 1.5,
            minHeight,
            backgroundColor: 'transparent',
            outline: 'none',
          }}
          className="w-full bg-transparent resize-none"
          textareaClassName="focus:outline-none"
        />
      </div>

      {canSave && (
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={isSubmitting || !value.trim()}
            size="sm"
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : saveButtonText}
          </Button>
        </div>
      )}
    </div>
  );
};

// Simple inline editor without save functionality (for backward compatibility)
export const InlineCodeEditor: React.FC<{
  code: string;
  language?: string;
  onChange: (code: string) => void;
  minHeight?: string;
}> = ({ code, language, onChange, minHeight = '100px' }) => {
  return (
    <CodeEditor
      value={code}
      onChange={onChange}
      language={language}
      minHeight={minHeight}
      showSaveButton={false}
    />
  );
}; 