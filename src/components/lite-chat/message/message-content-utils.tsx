// src/components/lite-chat/message/message-content-utils.tsx
import React from "react";
import { CodeBlock } from "@/components/lite-chat/code-block";

// Custom component renderer for paragraphs to handle potential block children
export const ParagraphRenderer = ({ children, ...props }: any) => {
  const containsBlockElement = React.Children.toArray(children).some(
    (child: any) =>
      React.isValidElement(child) &&
      (child.type === CodeBlock || child.type === "div"),
  );

  if (containsBlockElement) {
    return (
      <div
        {...props}
        className="my-3 leading-relaxed text-[15px] max-w-full overflow-x-auto"
      >
        {children}
      </div>
    );
  }

  return (
    <p
      {...props}
      className="my-3 leading-relaxed text-[15px] overflow-wrap-break-word"
    >
      {children}
    </p>
  );
};

// Define common markdown components
export const markdownComponents = {
  code: CodeBlock,
  p: ParagraphRenderer,
  pre: ({ children, ...props }: any) => (
    <pre {...props} className="my-3 overflow-x-auto w-full">
      {children}
    </pre>
  ),
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
