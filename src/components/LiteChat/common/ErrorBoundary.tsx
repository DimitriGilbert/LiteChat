// src/components/LiteChat/common/ErrorBoundary.tsx
// FULL FILE
import React, { Component, ErrorInfo, ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, CodeIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";
import LCErrorIcon from "./icons/LCError";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const LITECHAT_VERSION = "0.1.0-dev";
const GITHUB_REPO_URL = "https://github.com/DimitriGilbert/LiteChat";

const CopyButton: React.FC<{
  textToCopy: string;
  label: string;
  className?: string;
}> = ({ textToCopy, label, className }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error(`Failed to copy ${label.toLowerCase()}.`);
      console.error(`Clipboard copy failed for ${label}:`, err);
    }
  };

  return (
    <Button variant="outline" onClick={handleCopy} className={className}>
      {isCopied ? (
        <CheckIcon className="mr-2 h-4 w-4 text-green-500" />
      ) : (
        <CopyIcon className="mr-2 h-4 w-4" />
      )}
      {isCopied ? "Copied!" : `Copy ${label}`}
    </Button>
  );
};

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private getGitHubIssueTitle(): string {
    const { error, errorInfo } = this.state;
    let title = "Crash Report: ";

    if (errorInfo?.componentStack) {
      const firstComponent = errorInfo.componentStack
        .trim()
        .split(/\s+at\s+/)[1]
        ?.split(" ")[0];
      if (firstComponent) {
        title += `Error in <${firstComponent}> - `;
      }
    }

    title += error?.message.substring(0, 70) ?? "Unknown Error";
    if (error && error.message.length > 70) {
      title += "...";
    }
    return title;
  }

  private generateErrorReport(forGithub: boolean = false): string {
    const { error, errorInfo } = this.state;
    const nl = forGithub
      ? `
`
      : `
`; // Use markdown line breaks for GitHub
    const codeBlock = forGithub ? "```" : "";

    let report = `## LiteChat Error Report${nl}${nl}`;
    report += `**Version:** ${LITECHAT_VERSION}${nl}`;
    report += `**Timestamp:** ${new Date().toISOString()}${nl}`;
    report += `**User Agent:** ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}${nl}${nl}`;

    if (error) {
      report += `**Error Message:**${nl}${codeBlock}${nl}${error.message}${nl}${codeBlock}${nl}${nl}`;
    } else {
      report += `**Error Message:** Unknown Error${nl}${nl}`;
    }

    if (errorInfo?.componentStack) {
      report += `**Component Stack:**${nl}${codeBlock}text${nl}${errorInfo.componentStack.trim()}${nl}${codeBlock}${nl}${nl}`;
    }

    if (error?.stack) {
      report += `**Error Stack Trace:**${nl}${codeBlock}text${nl}${error.stack.trim()}${nl}${codeBlock}${nl}${nl}`;
    }

    report += `**Steps to Reproduce (Please Describe):**${nl}1. ...${nl}2. ...${nl}${nl}`;
    report += `**Expected Behavior:**${nl}...${nl}${nl}`;
    report += `**Actual Behavior:**${nl}...${nl}`;

    return report;
  }

  private generateAIPrompt(): string {
    const { error, errorInfo } = this.state;
    let prompt = `I encountered an error in a React application (LiteChat v${LITECHAT_VERSION}). Please help me debug it.

Error Message:
\`\`\`
${error?.message ?? "Unknown Error"}
\`\`\`

Component Stack (if available):
\`\`\`
${errorInfo?.componentStack?.trim() ?? "Not available"}
\`\`\`

Error Stack Trace (if available):
\`\`\`
${error?.stack?.trim() ?? "Not available"}
\`\`\`

Based on this information, what are the likely causes and potential solutions? Focus on React-specific issues if the component stack is present.`;

    return prompt;
  }

  private handleReportOnGitHub = async () => {
    const reportBody = this.generateErrorReport(true);
    try {
      await navigator.clipboard.writeText(reportBody);
      toast.success(
        "Error report copied to clipboard. Paste it into the GitHub issue body.",
      );
      const issueUrl = `${GITHUB_REPO_URL}/issues/new?title=${encodeURIComponent(this.getGitHubIssueTitle())}`;
      window.open(issueUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Failed to copy error report. Please copy manually.");
      console.error("Clipboard copy failed for GitHub report:", err);
      // Still open the link even if copy fails
      const issueUrl = `${GITHUB_REPO_URL}/issues/new?title=${encodeURIComponent(this.getGitHubIssueTitle())}`;
      window.open(issueUrl, "_blank", "noopener,noreferrer");
    }
  };

  public render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback
      ) : (
        <div
          role="alert"
          className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground z-[9999]"
        >
          <div className="max-w-2xl w-full border border-destructive bg-destructive/10 rounded-lg p-6 text-center shadow-lg">
            <LCErrorIcon className="h-24 w-24 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-destructive mb-2">
              Oops! Something went wrong.
            </h1>
            <p className="text-destructive/90 mb-4">
              LiteChat encountered an unexpected error. Please try refreshing
              the page. If the problem persists, consider reporting the issue.
              Copy the details and paste them into the GitHub issue.
            </p>
            <pre className="text-left text-xs bg-destructive/10 border border-destructive/30 rounded p-3 max-h-32 overflow-auto mb-4 font-mono text-destructive/80">
              {this.state.error?.message ?? "Unknown Error"}
            </pre>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="destructive"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
              <CopyButton
                textToCopy={this.generateErrorReport()}
                label="Details"
              />
              <CopyButton
                textToCopy={this.generateAIPrompt()}
                label="AI Debug Prompt"
              />
              <Button variant="outline" onClick={this.handleReportOnGitHub}>
                <CodeIcon className="mr-2 h-4 w-4" /> Report on GitHub
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
