import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi, type ModControlRule } from "@/types/litechat/modding";
import { type BlockRenderer, type BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { ChartBlockRenderer } from "@/components/LiteChat/common/ChartBlockRenderer";
import React from "react";

const CHART_CONTROL_PROMPT = `You can generate rich, interactive charts for data visualization. Use the \`chart\` language identifier with a JSON object.

**Functionality:**
- Supported types: \`bar\`, \`line\`, \`area\`, \`pie\`, \`radar\`, \`scatter\`.
- Based on Recharts and shadcn/ui.
- Interactive tooltips and legends.
- On-the-fly chart type switching.

**Full Format Example:**
\`\`\`chart
{
  "chartType": "bar",
  "chartData": [
    { "month": "January", "desktop": 186, "mobile": 80 },
    { "month": "February", "desktop": 305, "mobile": 200 }
  ],
  "chartConfig": {
    "desktop": { "label": "Desktop", "color": "hsl(var(--chart-1))" },
    "mobile": { "label": "Mobile", "color": "hsl(var(--chart-2))" }
  },
  "title": "Monthly Visitors",
  "description": "A breakdown of visitors by device."
}
\`\`\`

**Simple Array Format:**
The parser can also accept a simple array of objects. It will auto-generate a basic configuration.
\`\`\`chart
[
  { "name": "Product A", "sales": 4000 },
  { "name": "Product B", "sales": 3000 }
]
\`\`\`
`;

export class ChartBlockRendererModule implements ControlModule {
    readonly id = "core-block-renderer-chart";

    private unregisterCallback?: () => void;
    private unregisterRuleCallback?: () => void;

    async initialize(modApi: LiteChatModApi): Promise<void> {
        // No async initialization needed
    }

    register(modApi: LiteChatModApi): void {
        const chartRenderer: BlockRenderer = {
            id: this.id,
            supportedLanguages: ["chart", "charts", "graph", "data"],
            priority: 20, // Higher priority to override generic code blocks
            renderer: (context: BlockRendererContext) => {
                return React.createElement(ChartBlockRenderer, {
                    code: context.code,
                    isStreaming: context.isStreaming ?? false,
                });
            },
        };

        this.unregisterCallback = modApi.registerBlockRenderer(chartRenderer);

        const controlRule: ModControlRule = {
            id: `${this.id}-control-rule`,
            name: "Chart Generation",
            content: CHART_CONTROL_PROMPT,
            type: "control",
            alwaysOn: true,
            moduleId: this.id,
        };

        this.unregisterRuleCallback = modApi.registerRule(controlRule);
    }

    destroy(modApi: LiteChatModApi): void {
        this.unregisterCallback?.();
        this.unregisterRuleCallback?.();
    }
} 