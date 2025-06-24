import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import {
  Bar, BarChart, Line, LineChart, Area, AreaChart, Pie, PieChart, Radar, RadarChart,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PolarAngleAxis, PolarGrid
} from "recharts";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircleIcon, Loader2Icon, DownloadIcon, CodeIcon, ImageIcon, BarChart3Icon } from "lucide-react";
import { JSONChartParser } from "@/lib/litechat/chart-parser";
import type { ChartData } from "@/types/litechat/chart";
import { toast } from "sonner";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { useControlRegistryStore } from "@/store/control.store";
import type { CanvasControlRenderContext } from "@/types/litechat/canvas/control";

interface ChartBlockProps {
  code: string;
  isStreaming: boolean;
}

const ChartBlockRendererComponent: React.FC<ChartBlockProps> = ({ code, isStreaming }) => {
  const { foldStreamingCodeBlocks } = useSettingsStore(
    useShallow((state) => ({
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
    }))
  );

  const [isFolded, setIsFolded] = useState(
    isStreaming ? foldStreamingCodeBlocks : false
  );
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parserRef = useRef(new JSONChartParser());

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const parseChart = useCallback(async () => {
    if (!code.trim() || isFolded) return;

    // In streaming, we only attempt to parse if the JSON looks mostly complete.
    if (isStreaming) {
      const trimmedCode = code.trim();
      const isLikelyJson = (trimmedCode.startsWith('{') && trimmedCode.endsWith('}'));
      const isLikelyArray = (trimmedCode.startsWith('[') && trimmedCode.endsWith(']'));
      if (!isLikelyJson && !isLikelyArray) {
        return; 
      }
    }
    
    setIsLoading(true);
    try {
      const parseResult = await parserRef.current.parse(code.trim());
      if (parseResult.success && parseResult.data) {
        setChartData(parseResult.data);
        setError(null);
      } else {
        // Only show errors when not streaming, to avoid flicker.
        if (!isStreaming) {
          setError(parseResult.error || "Failed to parse chart data");
        }
        setChartData(null);
      }
    } catch (e) {
      if (!isStreaming) {
        setError(e instanceof Error ? e.message : "An unknown error occurred during parsing.");
      }
      setChartData(null);
    } finally {
      setIsLoading(false);
    }
  }, [code, isStreaming, isFolded]);

  useEffect(() => {
    // Debounce parsing during streaming to avoid excessive re-renders.
    const handle = setTimeout(() => {
        parseChart();
    }, isStreaming ? 300 : 0);
    return () => clearTimeout(handle);
  }, [code, isStreaming, parseChart]);
  
  const toggleFold = () => {
    const unfolding = isFolded;
    setIsFolded((prev) => !prev);
    if (unfolding && !showCode) {
      setTimeout(parseChart, 0);
    }
  };

  const toggleView = useCallback(() => {
    setShowCode((prev) => !prev);
  }, []);

  const handleDownloadSvg = useCallback(async () => {
    if (!containerRef.current) {
      toast.error("Chart container not found.");
      return;
    }
    try {
      const svg = containerRef.current.querySelector("svg");
      if (!svg) {
        toast.error("No chart SVG found to download.");
        return;
      }
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${chartData?.title?.replace(/ /g, '_') || 'chart'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Chart downloaded as SVG.");
    } catch (err) {
      toast.error("Failed to download chart.");
      console.error(err);
    }
  }, [chartData]);

  const renderSlotForCodeBlock = useCallback(
    (
      targetSlotName: CanvasControl["targetSlot"],
      currentCode: string,
      currentLang?: string,
      currentIsFolded?: boolean,
      currentToggleFold?: () => void
    ): React.ReactNode[] => {
      return canvasControls
        .filter(
          (c) =>
            c.type === "codeblock" &&
            c.targetSlot === targetSlotName &&
            c.renderer
        )
        .map((control) => {
          if (control.renderer) {
            const context: CanvasControlRenderContext = {
              codeBlockContent: currentCode,
              codeBlockLang: currentLang,
              isFolded: currentIsFolded,
              toggleFold: currentToggleFold,
              canvasContextType: "codeblock",
            };
            return (
              <React.Fragment key={control.id}>
                {control.renderer(context)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean);
    },
    [canvasControls]
  );

  const foldedPreviewText = useMemo(() => {
    if (!code) return "";
    return code
      .split("\n")
      .slice(0, 3)
      .join("\n");
  }, [code]);

  const codeBlockHeaderActions = renderSlotForCodeBlock(
    "codeblock-header-actions",
    code,
    "chart",
    isFolded,
    toggleFold
  );

  return (
    <div className="code-block-container group/codeblock my-4 max-w-full">
      <div className="code-block-header sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="text-sm font-medium">CHART</div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
            {codeBlockHeaderActions}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={toggleView}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title={showCode ? "Show Chart" : "Show Code"}
          >
            {showCode ? <ImageIcon className="h-4 w-4" /> : <CodeIcon className="h-4 w-4" />}
          </button>
          
          {chartData && !showCode && !error && (
            <button
              onClick={handleDownloadSvg}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
              title="Download SVG"
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!isFolded && (
        <div className="overflow-hidden w-full">
          {showCode ? (
            <CodeBlockRenderer lang="json" code={code} isStreaming={isStreaming} />
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center justify-center p-8 h-96">
                  <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {error && !isStreaming && (
                <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-md">
                  <div className="flex items-center gap-2 text-destructive">
                      <AlertCircleIcon className="h-5 w-5 flex-shrink-0" />
                      <div className="font-medium">Chart Parse Error</div>
                  </div>
                  <pre className="text-xs mt-2 p-2 bg-black/20 rounded font-mono whitespace-pre-wrap">{error}</pre>
                </div>
              )}
              
              {chartData && !isLoading && (
                <div ref={containerRef}>
                  <ChartContent chartData={chartData} />
                </div>
              )}

              {!chartData && !isLoading && !error && (
                  <div className="flex items-center justify-center h-48 border-2 border-dashed border-border rounded-lg">
                      <div className="text-center text-muted-foreground">
                          <BarChart3Icon className="h-10 w-10 mx-auto mb-2"/>
                          <p>No valid chart data to display.</p>
                          {isStreaming && <p className="text-xs">(Waiting for complete data...)</p>}
                      </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {isFolded && (
        <div
          className="folded-content-preview p-4 cursor-pointer w-full box-border"
          onClick={toggleFold}
        >
          <pre className="whitespace-pre-wrap break-words text-muted-foreground font-mono text-sm">
            {foldedPreviewText}
          </pre>
        </div>
      )}
    </div>
  );
};

const supportedTypes = ['bar', 'line', 'area', 'pie', 'radar'] as const;
type SupportedChartType = typeof supportedTypes[number];

const ChartContent: React.FC<{ chartData: ChartData }> = ({ chartData }) => {
  const [currentChartType, setCurrentChartType] = useState<SupportedChartType>(() => {
    const initialType = chartData.chartType;
    if (initialType && supportedTypes.includes(initialType as any)) {
        return initialType as SupportedChartType;
    }
    return 'bar';
  });

  useEffect(() => {
    const newType = chartData.chartType;
    if (newType && supportedTypes.includes(newType as any)) {
      setCurrentChartType(newType as SupportedChartType);
    }
  }, [chartData.chartType]);
  
  const axisKey = useMemo(() => {
    if (!chartData.chartData || chartData.chartData.length === 0) return "name";
    const firstItem = chartData.chartData[0];
    if ('date' in firstItem) return 'date';
    if ('month' in firstItem) return 'month';
    if ('name' in firstItem) return 'name';
    if ('label' in firstItem) return 'label';
    // Fallback to the first non-numeric key
    return Object.keys(firstItem).find(k => typeof firstItem[k] === 'string') || 'name';
  }, [chartData.chartData]);
  
  const pieDataKey = useMemo(() => {
    if (!chartData.chartData || chartData.chartData.length === 0) return "value";
    const firstItem = chartData.chartData[0];
    if ('value' in firstItem) return 'value';
    if ('proportion' in firstItem) return 'proportion';
    if ('visitors' in firstItem) return 'visitors';
    // Fallback to the first numeric key
    return Object.keys(firstItem).find(k => typeof firstItem[k] === 'number') || 'value';
  }, [chartData.chartData]);

  const renderChart = () => {
    switch (currentChartType) {
      case 'bar':
        return (
          <BarChart data={chartData.chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={axisKey} tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend />
            {Object.keys(chartData.chartConfig).map(key => (
              <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chartData.chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={axisKey} tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend />
            {Object.keys(chartData.chartConfig).map(key => (
              <Line key={key} dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={false} type="monotone" />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={chartData.chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={axisKey} tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend />
            {Object.keys(chartData.chartConfig).map(key => (
              <Area key={key} dataKey={key} type="monotone" fill={`var(--color-${key})`} fillOpacity={0.4} stroke={`var(--color-${key})`} stackId="a" />
            ))}
          </AreaChart>
        );
      case 'pie':
        const pieDataWithFill = chartData.chartData.map(entry => ({
            ...entry,
            fill: entry.color,
        }));
        return (
            <PieChart>
                <Tooltip cursor={false} content={<ChartTooltipContent />} />
                <Pie data={pieDataWithFill} dataKey={pieDataKey} nameKey={axisKey} cx="50%" cy="50%" outerRadius={120} />
                <ChartLegend />
            </PieChart>
        );
      case 'radar':
        return (
          <RadarChart data={chartData.chartData}>
            <CartesianGrid />
            <PolarAngleAxis dataKey={axisKey} />
            <PolarGrid />
            <Tooltip cursor={false} content={<ChartTooltipContent />} />
            <ChartLegend />
            {Object.keys(chartData.chartConfig).map(key => (
              <Radar key={key} dataKey={key} fill={`var(--color-${key})`} fillOpacity={0.6} stroke={`var(--color-${key})`} />
            ))}
          </RadarChart>
        );
      default:
        return <div className="text-center text-muted-foreground">Unsupported chart type: {currentChartType}</div>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex-1">
              <CardTitle>{chartData.title || 'Chart'}</CardTitle>
              {chartData.description && <CardDescription className="mt-1">{chartData.description}</CardDescription>}
          </div>
          <Select value={currentChartType} onValueChange={(type) => setCurrentChartType(type as SupportedChartType)}>
              <SelectTrigger className="w-[140px] flex-shrink-0">
                  <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="line">Line</SelectItem>
                  <SelectItem value="area">Area</SelectItem>
                  <SelectItem value="pie">Pie</SelectItem>
                  <SelectItem value="radar">Radar</SelectItem>
              </SelectContent>
          </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartData.chartConfig as ChartConfig} className="h-[400px] w-full">
          <ResponsiveContainer>
            {renderChart()}
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export const ChartBlockRenderer = memo(ChartBlockRendererComponent);
