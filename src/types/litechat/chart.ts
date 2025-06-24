export interface ChartData {
  chartType?: 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter';
  chartData: any[];
  chartConfig: Record<string, any>;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ParseResult {
  success: boolean;
  data?: ChartData;
  error?: string;
}

export interface ChartParser {
  parse(code: string): Promise<ParseResult>;
  validate(code: string): Promise<ParseResult>;
  serialize(chartData: ChartData): string;
} 