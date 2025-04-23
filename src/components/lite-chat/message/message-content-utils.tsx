import React, { PropsWithChildren } from "react";
import { CodeBlock } from "@/components/lite-chat/code-block";

type ParagraphRendererProps = PropsWithChildren<
  React.HTMLAttributes<HTMLParagraphElement>
>;

export const ParagraphRenderer: React.FC<ParagraphRendererProps> = ({
  children,
  ...props
}) => {
  const containsBlockElement = React.Children.toArray(children).some(
    (child) =>
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

type PreRendererProps = PropsWithChildren<React.HTMLAttributes<HTMLPreElement>>;
type UlRendererProps = PropsWithChildren<
  React.HTMLAttributes<HTMLUListElement>
>;
type OlRendererProps = PropsWithChildren<
  React.HTMLAttributes<HTMLOListElement>
>;
type LiRendererProps = PropsWithChildren<React.HTMLAttributes<HTMLLIElement>>;

export const markdownComponents = {
  code: CodeBlock,
  p: ParagraphRenderer,
  pre: ({ children, ...props }: PreRendererProps) => (
    <pre {...props} className="my-3 overflow-x-auto w-full">
      {children}
    </pre>
  ),
  ul: ({ children, ...props }: UlRendererProps) => (
    <ul {...props} className="my-3 list-disc list-inside pl-4">
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: OlRendererProps) => (
    <ol {...props} className="my-3 list-decimal list-inside pl-4">
      {children}
    </ol>
  ),
  li: ({ children, ...props }: LiRendererProps) => (
    <li {...props} className="my-1">
      {children}
    </li>
  ),
};
