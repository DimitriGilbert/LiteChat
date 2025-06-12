import { useState, useCallback } from 'react';
import { usePromptTemplateStore } from '@/store/prompt-template.store';
import type { PromptFormData, CompiledPrompt } from '@/types/litechat/prompt-template';

interface UsePromptCompilationOptions {
  onCompilationError?: (error: Error) => void;
  defaultErrorMessage?: string;
}

export function usePromptCompilation(options: UsePromptCompilationOptions = {}) {
  const { onCompilationError, defaultErrorMessage = 'Failed to compile template' } = options;
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastCompiledContent, setLastCompiledContent] = useState<string>('');
  const [compilationError, setCompilationError] = useState<string | null>(null);

  const { compilePromptTemplate } = usePromptTemplateStore();

  const compileTemplate = useCallback(async (
    templateId: string, 
    formData: PromptFormData
  ): Promise<CompiledPrompt | null> => {
    setIsCompiling(true);
    setCompilationError(null);

    try {
      const compiled = await compilePromptTemplate(templateId, formData);
      setLastCompiledContent(compiled.content);
      return compiled;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : defaultErrorMessage;
      setCompilationError(errorMessage);
      setLastCompiledContent(`Error: ${errorMessage}`);
      
      if (onCompilationError && error instanceof Error) {
        onCompilationError(error);
      }
      
      return null;
    } finally {
      setIsCompiling(false);
    }
  }, [compilePromptTemplate, onCompilationError, defaultErrorMessage]);

  const clearError = useCallback(() => {
    setCompilationError(null);
  }, []);

  const reset = useCallback(() => {
    setLastCompiledContent('');
    setCompilationError(null);
    setIsCompiling(false);
  }, []);

  return {
    compileTemplate,
    isCompiling,
    lastCompiledContent,
    compilationError,
    clearError,
    reset,
  };
} 