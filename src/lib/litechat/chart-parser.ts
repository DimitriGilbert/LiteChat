import type { ChartParser, ChartData, ParseResult } from "@/types/litechat/chart";
import { type ChartConfig } from "@/components/ui/chart";

export class JSONChartParser implements ChartParser {
  async parse(code: string): Promise<ParseResult> {
    try {
      const trimmedCode = code.trim();
      if (!trimmedCode) {
        return { success: false, error: "Empty chart content" };
      }

      let parsed: any;
      try {
        // Just parse the JSON. No smart logic.
        parsed = JSON.parse(trimmedCode);
      } catch (jsonError) {
        return { 
          success: false, 
          error: `Invalid JSON format: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}` 
        };
      }
      
      return this._validateParsed(parsed);

    } catch (error) {
      return { 
        success: false, 
        error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async validate(code: string): Promise<ParseResult> {
    try {
      const parsed = JSON.parse(code.trim());
      return this._validateParsed(parsed);
    } catch (error) {
      return { 
        success: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private _validateParsed(parsed: any): ParseResult {
    if (Array.isArray(parsed)) {
      return this.validateSimpleArray(parsed);
    } else if (parsed && typeof parsed === 'object') {
      if (parsed.chartData && parsed.chartConfig) {
        return this.validateShadcnFormat(parsed);
      }
    }
    return { success: false, error: "Invalid chart format. Expected an array or an object with 'chartData' and 'chartConfig'." };
  }

  serialize(chartData: ChartData): string {
    return JSON.stringify(chartData, null, 2);
  }

  private validateSimpleArray(data: any[]): ParseResult {
    if (data.length === 0) {
      return { success: false, error: "Chart data array cannot be empty" };
    }

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (typeof item !== 'object' || item === null) {
        return { success: false, error: `Data item at index ${i} must be an object` };
      }
      const hasNumericValue = Object.values(item).some(val => typeof val === 'number');
      if (!hasNumericValue) {
        return { success: false, error: `Data item at index ${i} must have at least one numeric value` };
      }
    }
    
    const chartData: ChartData = {
      chartData: data,
      chartConfig: this.generateDefaultConfig(data),
      chartType: 'bar',
    }
    return { success: true, data: chartData };
  }

  private validateShadcnFormat(parsed: any): ParseResult {
    if (!Array.isArray(parsed.chartData)) {
      return { success: false, error: "'chartData' must be an array" };
    }
    if (typeof parsed.chartConfig !== 'object' || parsed.chartConfig === null) {
      return { success: false, error: "'chartConfig' must be an object" };
    }
    const validTypes = ['bar', 'line', 'area', 'pie', 'radar', 'scatter'];
    if (parsed.chartType && !validTypes.includes(parsed.chartType)) {
      return { success: false, error: `Invalid chartType '${parsed.chartType}'. Must be one of: ${validTypes.join(', ')}` };
    }
    
    // If chartConfig doesn't match the data structure, regenerate it
    const needsRegeneration = this.shouldRegenerateConfig(parsed.chartData, parsed.chartConfig);
    if (needsRegeneration) {
        parsed.chartConfig = this.generateDefaultConfig(parsed.chartData);
    }

    return { success: true, data: parsed as ChartData };
  }

  private shouldRegenerateConfig(chartData: any[], chartConfig: any): boolean {
    if (!chartData || chartData.length === 0) return false;
    if (!chartConfig || Object.keys(chartConfig).length === 0) return true;
    
    // Check if the config keys match the numeric data keys
    const firstItem = chartData[0];
    const numericKeys = Object.keys(firstItem).filter(key => 
      typeof firstItem[key] === 'number' && !['id', 'index'].includes(key.toLowerCase())
    );
    
    // If no numeric keys match config keys, regenerate
    const hasMatchingKeys = numericKeys.some(key => chartConfig[key]);
    return !hasMatchingKeys;
  }

  private generateDefaultConfig(data: any[]): ChartConfig {
    if (!data || data.length === 0) return {};
    
    const config: ChartConfig = {};
    const firstItem = data[0];
    let colorIndex = 1; // Start from 1 for --chart-1
    
    Object.keys(firstItem).forEach((key) => {
        if (typeof firstItem[key] === 'number' && !['id', 'index'].includes(key.toLowerCase())) {
            config[key] = {
                label: key.charAt(0).toUpperCase() + key.slice(1),
                color: `var(--chart-${colorIndex})`,
            };
            colorIndex++;
            if (colorIndex > 5) {
                colorIndex = 1; // Reset to 1 when we exceed 5 colors
            }
        }
    });
    
    return config;
  }
} 