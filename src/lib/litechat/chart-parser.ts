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
    
    if (Object.keys(parsed.chartConfig).length === 0 && parsed.chartData.length > 0) {
        parsed.chartConfig = this.generateDefaultConfig(parsed.chartData);
    }

    return { success: true, data: parsed as ChartData };
  }

  private generateDefaultConfig(data: any[]): ChartConfig {
    if (!data || data.length === 0) return {};
    
    const config: ChartConfig = {};
    const firstItem = data[0];
    let colorIndex = 1;
    
    Object.keys(firstItem).forEach((key) => {
        if (typeof firstItem[key] === 'number' && !['id', 'index'].includes(key.toLowerCase())) {
            config[key] = {
                label: key.charAt(0).toUpperCase() + key.slice(1),
                color: `hsl(var(--chart-${colorIndex}))`,
            };
            colorIndex = (colorIndex % 5) + 1;
        }
    });

    // Pie charts often use 'value'
    if (firstItem.hasOwnProperty('value') && typeof firstItem.value === 'number') {
        config['value'] = {
            label: 'Value',
            color: 'hsl(var(--chart-1))',
        };
    }
     // and pie charts can use proportion
     if (firstItem.hasOwnProperty('proportion') && typeof firstItem.proportion === 'number') {
      config['proportion'] = {
          label: 'Proportion',
          color: 'hsl(var(--chart-1))',
      };
    }
    
    return config;
  }
} 