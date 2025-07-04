import React from "react";
import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { ListIcon } from "lucide-react";
import { useInteractionStore } from "@/store/interaction.store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export class TableOfContentsControlModule implements ControlModule {
  readonly id = "canvas-control-toc";

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    modApi.registerCanvasControl({
      id: this.id,
      type: "interaction",
      targetSlot: "header-actions",
      renderer: (context: CanvasControlRenderContext) => {
        if (!context.interactionId || !context.interaction) {
          return null;
        }

        const interactionStore = useInteractionStore.getState();
        
        // Don't show ToC during streaming - prevents conflicts with auto-scroll
        if (interactionStore.status === "streaming" || interactionStore.streamingInteractionIds.length > 0) {
          return null;
        }

        const interactions = interactionStore.interactions
          .filter(
            (i) =>
              i.conversationId === context.interaction!.conversationId &&
              i.parentId === null && // Only main conversation interactions
              (i.type === "message.user_assistant" ||
                i.type === "message.assistant_regen")
          )
          .sort((a, b) => a.index - b.index);

        if (interactions.length <= 1) {
          return null; // Don't show if there's only one or no interactions
        }

        const scrollToInteraction = (interactionId: string) => {
          const element = document.querySelector(
            `[data-interaction-id="${interactionId}"]`
          ) as HTMLElement;

          if (!element) {
            console.warn(`ToC: Element not found for interaction ${interactionId}`);
            return;
          }

          const scrollViewport = context.scrollViewport;
          
          if (!scrollViewport) {
            console.log(`ToC: No viewport, using fallback scrollIntoView for ${interactionId}`);
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            addHighlight(element);
            return;
          }

          // Mark as ToC scrolling to prevent ChatCanvas from detecting it as user scroll
          (scrollViewport as any)._isToCScrolling = true;

          // Calculate target position manually
          const elementRect = element.getBoundingClientRect();
          const viewportRect = scrollViewport.getBoundingClientRect();
          const currentScrollTop = scrollViewport.scrollTop;
          const elementTopRelativeToViewport = elementRect.top - viewportRect.top;
          const targetScrollTop = currentScrollTop + elementTopRelativeToViewport - 20; // 20px offset from top

          scrollViewport.scrollTo({
            top: targetScrollTop,
            behavior: "instant"
          });

          // Use IntersectionObserver to detect when element is visible
          const observer = new window.IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                addHighlight(element);
                obs.disconnect();
                // Clear ToC scrolling flag after highlight
                setTimeout(() => {
                  (scrollViewport as any)._isToCScrolling = false;
                }, 1000);
              }
            });
          }, {
            root: scrollViewport,
            threshold: 0.1 // 10% visible is enough
          });
          observer.observe(element);
        };

        const scrollToHeading = (headingText: string) => {
          // Find heading by text content
          const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
          const targetElement = headings.find(heading => 
            heading.textContent?.trim().includes(headingText.trim())
          ) as HTMLElement;

          if (!targetElement) {
            console.warn(`ToC: Heading not found: ${headingText}`);
            return;
          }

          const scrollViewport = context.scrollViewport;
          
          // Mark as ToC scrolling to prevent ChatCanvas from detecting it as user scroll
          if (scrollViewport) {
            (scrollViewport as any)._isToCScrolling = true;
            
            // Clean up the flag after scroll completes
            setTimeout(() => {
              (scrollViewport as any)._isToCScrolling = false;
            }, 1000);
          }

          // Use scrollIntoView which is more reliable than manual calculations
          targetElement.scrollIntoView({ 
            behavior: "smooth", 
            block: "start",
            inline: "nearest"
          });

          addHighlight(targetElement);
        };

        const addHighlight = (element: HTMLElement) => {
          element.style.outline = "2px solid #3b82f6";
          element.style.outlineOffset = "2px";
          setTimeout(() => {
            element.style.outline = "";
            element.style.outlineOffset = "";
          }, 2000);
        };

        const getInteractionPreview = (interaction: any): string => {
          if (interaction.type === "message.user_assistant") {
            return interaction.prompt?.content?.slice(0, 50) || "User message";
          } else {
            return interaction.response?.slice(0, 50) || "Assistant response";
          }
        };

                 const getInteractionTitle = (_interaction: any, index: number): string => {
           return `Turn ${index + 1}`;
         };

        // Extract headings from markdown content
        const extractHeadings = (content: string): Array<{ level: number; text: string }> => {
          if (!content) return [];

          const headings: Array<{ level: number; text: string }> = [];

          // Extract markdown headings (## and ###)
          const lines = content.split("\n");
          for (const line of lines) {
            const trimmedLine = line.trim();
            const markdownMatch = trimmedLine.match(/^(#{2,3})\s+(.+)$/);

            if (markdownMatch) {
              const level = markdownMatch[1].length;
              const text = markdownMatch[2].trim();
              headings.push({ level, text });
            }
          }

          return headings;
        };

        // Build ToC structure
        const tocItems: React.ReactNode[] = [];

        interactions.forEach((interaction, index) => {
          // Add interaction item
          tocItems.push(
            React.createElement(
              DropdownMenuItem,
              {
                key: interaction.id,
                onSelect: () => scrollToInteraction(interaction.id),
                className: "cursor-pointer font-medium border-l-2 border-blue-500 pl-2 mb-1",
              },
              React.createElement(
                "div",
                { className: "flex flex-col w-full" },
                React.createElement(
                  "span",
                  { className: "font-semibold text-sm text-blue-700 dark:text-blue-300" },
                  getInteractionTitle(interaction, index)
                ),
                React.createElement(
                  "span",
                  { className: "text-xs text-muted-foreground truncate" },
                  getInteractionPreview(interaction)
                )
              )
            )
          );

          // Add headings only for the last interaction (current response)
          if (
            interaction.response &&
            typeof interaction.response === "string" &&
            index === interactions.length - 1
          ) {
            const headings = extractHeadings(interaction.response);

            headings.forEach((heading, headingIndex) => {
              const indent = heading.level === 2 ? "ml-4" : "ml-8";
              const icon = heading.level === 2 ? "▸" : "▪";

              tocItems.push(
                React.createElement(
                  DropdownMenuItem,
                  {
                    key: `${interaction.id}-heading-${headingIndex}`,
                    onSelect: () => scrollToHeading(heading.text),
                    className: `cursor-pointer ${indent} py-1`,
                  },
                  React.createElement(
                    "div",
                    { className: "flex items-center w-full text-xs" },
                    React.createElement(
                      "span",
                      { className: "text-muted-foreground mr-2" },
                      icon
                    ),
                    React.createElement(
                      "span",
                      { className: "text-sm truncate" },
                      heading.text
                    )
                  )
                )
              );
            });
          }
        });

        return React.createElement(
          DropdownMenu,
          null,
          React.createElement(
            DropdownMenuTrigger,
            { asChild: true },
            React.createElement(ActionTooltipButton, {
              icon: React.createElement(ListIcon),
              tooltipText: "Table of Contents - Navigate conversation & headings",
              className: "text-muted-foreground hover:text-foreground",
            })
          ),
          React.createElement(
            DropdownMenuContent,
            {
              className: "w-80 max-h-96 overflow-y-auto",
            },
            React.createElement(
              "div",
              {
                className: "px-2 py-1 text-xs font-semibold text-muted-foreground border-b mb-1",
              },
              "Table of Contents"
            ),
            ...tocItems
          )
        );
      },
    });
  }

  destroy(_modApi: LiteChatModApi): void {}
}
