import React from 'react';
import type { InputAreaProps } from '@/types/litechat/prompt.types';
import { Textarea } from '@/components/ui/textarea';

export const InputArea: React.FC<InputAreaProps> = ({ value, onChange, onSubmit, disabled }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      onSubmit();
    }
  };
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`;
     onChange(e.target.value);
  };
  return (
    <Textarea value={value} onInput={handleInput} onChange={onChange} onKeyDown={handleKeyDown}
      disabled={disabled} placeholder='Type message... (Shift+Enter for new line)' rows={1}
      className='w-full p-2 border rounded bg-input text-foreground resize-none focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 overflow-y-hidden min-h-[40px] max-h-[200px]'
    />
  );
};
