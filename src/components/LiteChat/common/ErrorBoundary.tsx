// src/components/LiteChat/common/ErrorBoundary.tsx
// NEW FILE
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, CopyIcon, CodeIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Define package version (replace with actual dynamic injection if possible)
const LITECHAT_VERSION = "0.1.0-dev";

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private getGitHubIssueUrl(): string {
    const repoUrl = "https://github.com/YOUR_GITHUB_USERNAME/litechat/issues";
    const title = encodeURIComponent(
      `Crash Report: ${this.state.error?.message.substring(0, 50) ?? "Unknown Error"}`,
    );
    const body = encodeURIComponent(this.generateErrorReport(true));
    return `${repoUrl}/new?title=${title}&body=${body}`;
  }

  private generateErrorReport(forGithub: boolean = false): string {
    const { error, errorInfo } = this.state;
    const nl = forGithub
      ? "\n"
      : `
`;
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

  private copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard!`);
    } catch (err) {
      toast.error(`Failed to copy ${type.toLowerCase()}.`);
      console.error(`Clipboard copy failed for ${type}:`, err);
    }
  };

  public render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback
      ) : (
        <div
          role="alert"
          className="flex flex-col items-center justify-center h-screen w-screen p-4 bg-background text-foreground"
        >
          <div className="max-w-2xl w-full border border-destructive bg-destructive/10 rounded-lg p-6 text-center shadow-lg">
            <AlertTriangleIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-destructive mb-2">
              Oops! Something went wrong.
            </h1>
            <p className="text-destructive/90 mb-4">
              LiteChat encountered an unexpected error. Please try refreshing
              the page. If the problem persists, consider reporting the issue.
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
              <Button
                variant="outline"
                onClick={() =>
                  this.copyToClipboard(
                    this.generateErrorReport(),
                    "Error Details",
                  )
                }
              >
                <CopyIcon className="mr-2 h-4 w-4" /> Copy Details
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  this.copyToClipboard(this.generateAIPrompt(), "AI Prompt")
                }
              >
                <CopyIcon className="mr-2 h-4 w-4" /> Copy AI Debug Prompt
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={this.getGitHubIssueUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CodeIcon className="mr-2 h-4 w-4" /> Report on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
