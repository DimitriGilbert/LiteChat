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
- **Smart Color Attribution:** The parser automatically assigns consistent colors to data series. Same labels get consistent colors across datasets, while different values with the same labels get color variations to distinguish them.
- **Bar/Line/Area/Radar/Scatter:** Colors are auto-generated from \`chartConfig\` or by the smart parser for simple arrays.
- **Pie:** Each slice can have its own \`color\` property, or will use smart color attribution if not provided.
- **Duplicate Prevention:** Adjacent data points with the same labels are intelligently handled to avoid visual confusion.
- Unsupported types will display an error message.

**Full Format Example:**
\`\`\`chart
{
  "chartType": "bar",
  "chartData": [
    { "month": "January", "desktop": 186, "mobile": 80 },
    { "month": "February", "desktop": 305, "mobile": 200 }
  ],
  "chartConfig": {
    "desktop": { "label": "Desktop", "color": "var(--chart-1)" },
    "mobile": { "label": "Mobile", "color": "var(--chart-2)" }
  },
  "title": "Monthly Visitors",
  "description": "A breakdown of visitors by device."
}
\`\`\`

**Pie Example (per-slice color):**
\`\`\`chart
{
  "chartType": "pie",
  "title": "Vehicle Proportion in a Standard American City",
  "description": "Estimated distribution of vehicle types on city roads.",
  "chartData": [
    { "name": "Cars", "proportion": 70, "color": "hsl(210, 90%, 50%)" },
    { "name": "SUVs/Crossovers", "proportion": 15, "color": "hsl(160, 70%, 50%)" },
    { "name": "Trucks/Vans", "proportion": 10, "color": "hsl(30, 80%, 50%)" },
    { "name": "Motorcycles", "proportion": 3, "color": "hsl(270, 70%, 50%)" },
    { "name": "Buses/Public Transit", "proportion": 1.5, "color": "hsl(0, 80%, 50%)" },
    { "name": "Other (e.g., Emergency Vehicles)", "proportion": 0.5, "color": "hsl(230, 60%, 50%)" }
  ],
  "chartConfig": {
    "proportion": {
      "label": "Proportion (%)",
      "color": "var(--chart-1)"
    }
  }
}
\`\`\`

**Scatter Example:**
\`\`\`chart
{
  "chartType": "scatter",
  "chartData": [
    { "x": 10, "y": 20, "groupA": 5 },
    { "x": 15, "y": 25, "groupA": 8 },
    { "x": 20, "y": 30, "groupA": 12 }
  ],
  "chartConfig": {
    "groupA": { "label": "Group A", "color": "var(--chart-1)" }
  },
  "title": "Scatter Example",
  "description": "A simple scatter plot."
}
\`\`\`

**Smart Color Attribution Examples:**

**Same Labels, Different Values (gets color variations):**
\`\`\`chart
[
  { "category": "Sales", "value": 100, "region": "North" },
  { "category": "Sales", "value": 150, "region": "South" },
  { "category": "Marketing", "value": 80, "region": "North" },
  { "category": "Marketing", "value": 120, "region": "South" }
]
\`\`\`

**Simple Array Format (auto-generated smart colors):**
The parser can also accept a simple array of objects. It will auto-generate smart color configuration.
\`\`\`chart
[
  { "name": "Product A", "sales": 4000 },
  { "name": "Product B", "sales": 3000 }
]
\`\`\`

**Pie Chart with Smart Colors:**
\`\`\`chart
[
  { "name": "Cars", "proportion": 70 },
  { "name": "SUVs", "proportion": 15 },
  { "name": "Trucks", "proportion": 10 },
  { "name": "Motorcycles", "proportion": 3 },
  { "name": "Buses", "proportion": 1.5 },
  { "name": "Other", "proportion": 0.5 }
]
\`\`\`
`;

export class ChartBlockRendererModule implements ControlModule {
    readonly id = "core-block-renderer-chart";

    private unregisterCallback?: () => void;
    private unregisterRuleCallback?: () => void;

    async initialize(_modApi: LiteChatModApi): Promise<void> {
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
            description: "Enables AI to generate charts and visualizations using Chart.js",
            type: "control",
            alwaysOn: true,
            moduleId: this.id,
        };

        this.unregisterRuleCallback = modApi.registerRule(controlRule);
    }

    destroy(_modApi: LiteChatModApi): void {
        this.unregisterCallback?.();
        this.unregisterRuleCallback?.();
    }
} 