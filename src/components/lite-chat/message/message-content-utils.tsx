// src/components/lite-chat/message/message-content-utils.tsx
import React from "react";
import { CodeBlock } from "@/components/lite-chat/code-block";
import { FileContextBlock } from "./file-context-block"; // Keep if used by ParagraphRenderer

// Custom component renderer for paragraphs to handle potential block children
export const ParagraphRenderer = ({ children, ...props }: any) => {
  const containsBlockElement = React.Children.toArray(children).some(
    (child: any) =>
      React.isValidElement(child) &&
      (child.type === CodeBlock ||
        child.type === FileContextBlock || // Keep if needed
        child.type === "div"),
  );

  if (containsBlockElement) {
    return (
      <div {...props} className="my-3 leading-relaxed text-[15px]">
        {children}
      </div>
    );
  }

  return (
    <p {...props} className="my-3 leading-relaxed text-[15px]">
      {children}
    </p>
  );
};

// Define common markdown components
export const markdownComponents = {
  code: CodeBlock,
  p: ParagraphRenderer,
  ul: ({ children, ...props }: any) => (
    <ul {...props} className="my-3 list-disc list-inside pl-4">
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol {...props} className="my-3 list-decimal list-inside pl-4">
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => (
    <li {...props} className="my-1">
      {children}
    </li>
  ),
};
