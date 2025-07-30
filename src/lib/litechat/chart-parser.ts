import type { ChartParser, ChartData, ParseResult } from "@/types/litechat/chart";
import { type ChartConfig } from "@/components/ui/chart";

// Color palette for consistent color attribution
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)', 
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'hsl(210, 90%, 50%)',   // Blue
  'hsl(160, 70%, 50%)',   // Green
  'hsl(30, 80%, 50%)',    // Orange
  'hsl(270, 70%, 50%)',   // Purple
  'hsl(0, 80%, 50%)',     // Red
  'hsl(230, 60%, 50%)',   // Navy
  'hsl(120, 70%, 50%)',   // Lime
  'hsl(300, 70%, 50%)',   // Magenta
  'hsl(60, 80%, 50%)',    // Yellow
  'hsl(180, 70%, 50%)',   // Cyan
];

interface ColorMapping {
  label: string;
  color: string;
  valueHash?: string; // For distinguishing same labels with different values
}

export class JSONChartParser implements ChartParser {
  private colorMappings: Map<string, ColorMapping> = new Map();
  private colorIndex = 0;

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
    // Reset color mappings for each new chart
    this.colorMappings.clear();
    this.colorIndex = 0;

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
      chartConfig: this.generateSmartConfig(data),
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
        parsed.chartConfig = this.generateSmartConfig(parsed.chartData);
    } else {
        // Apply smart color attribution to existing config
        parsed.chartConfig = this.applySmartColors(parsed.chartData, parsed.chartConfig);
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
    if (!hasMatchingKeys) return true;
    
    // Check if any config entries are missing colors
    const hasMissingColors = Object.keys(chartConfig).some(key => {
      const configEntry = chartConfig[key];
      return !configEntry.color && !configEntry.theme;
    });
    
    return hasMissingColors;
  }

  private generateSmartConfig(data: any[]): ChartConfig {
    if (!data || data.length === 0) return {};
    
    const firstItem = data[0];
    
    // Get all numeric keys
    const numericKeys = Object.keys(firstItem).filter(key => 
      typeof firstItem[key] === 'number' && !['id', 'index'].includes(key.toLowerCase())
    );

    // Analyze data to understand the structure
    const dataStructure = this.analyzeDataStructure(data, numericKeys);
    
    if (dataStructure.isPieStyle) {
      // For pie charts, each row represents a category
      return this.generatePieConfig(data, numericKeys[0]);
    } else {
      // For other charts, each column represents a series
      return this.generateSeriesConfig(data, numericKeys);
    }
  }

  private analyzeDataStructure(data: any[], numericKeys: string[]): {
    isPieStyle: boolean;
    hasLabels: boolean;
    uniqueLabels: Set<string>;
  } {
    const uniqueLabels = new Set<string>();
    let hasLabels = false;

    // Check if this looks like pie chart data (each row is a category)
    if (numericKeys.length === 1) {
      // Look for label-like keys
      const labelKeys = Object.keys(data[0]).filter(key => 
        typeof data[0][key] === 'string' && 
        !['id', 'index', 'name', 'label', 'category'].includes(key.toLowerCase())
      );
      
      if (labelKeys.length > 0) {
        hasLabels = true;
        data.forEach(item => {
          const label = item[labelKeys[0]] || item.name || item.label || item.category;
          if (label) uniqueLabels.add(String(label));
        });
      }
    }

    // Determine if this is pie-style data
    const isPieStyle = numericKeys.length === 1 && (hasLabels || data.length <= 10);

    return { isPieStyle, hasLabels, uniqueLabels };
  }

  private generatePieConfig(data: any[], valueKey: string): ChartConfig {
    // For pie charts, we need to assign colors to each data point
    data.forEach((item, index) => {
      const label = item.name || item.label || item.category || `Item ${index + 1}`;
      const color = this.getSmartColor(label, item[valueKey]);
      
      // Add color to the data item for pie rendering
      item.color = color;
    });

    // Create config for the value key
    const config: ChartConfig = {
      [valueKey]: {
        label: this.getLabelForKey(valueKey),
        color: CHART_COLORS[0], // Default color for pie charts
      }
    };

    return config;
  }

  private generateSeriesConfig(_data: any[], numericKeys: string[]): ChartConfig {
    const config: ChartConfig = {};
    
    numericKeys.forEach(key => {
      const label = this.getLabelForKey(key);
      const color = this.getSmartColor(label);
      
      config[key] = {
        label,
        color,
      };
    });

    return config;
  }

  private applySmartColors(_data: any[], existingConfig: ChartConfig): ChartConfig {
    const config: ChartConfig = { ...existingConfig };
    
    Object.keys(config).forEach(key => {
      if (!config[key].color) {
        const label = typeof config[key].label === 'string' ? config[key].label : key;
        config[key].color = this.getSmartColor(label);
      }
    });

    return config;
  }

  private getSmartColor(label: string, value?: number): string {
    // Create a unique key for this label-value combination
    const valueHash = value !== undefined ? `_${value}` : '';
    const key = `${label}${valueHash}`;
    
    // Check if we already have a color for this label-value combination
    if (this.colorMappings.has(key)) {
      return this.colorMappings.get(key)!.color;
    }
    
    // Check if we have a color for just the label (without value)
    const labelOnlyKey = label;
    if (this.colorMappings.has(labelOnlyKey)) {
      const existingMapping = this.colorMappings.get(labelOnlyKey)!;
      
      // If this is the same label but different value, use a variation
      if (valueHash && existingMapping.valueHash !== valueHash) {
        const color = this.getColorVariation(existingMapping.color);
        this.colorMappings.set(key, { label, color, valueHash });
        return color;
      }
      
      return existingMapping.color;
    }
    
    // Assign a new color
    const color = CHART_COLORS[this.colorIndex % CHART_COLORS.length];
    this.colorIndex++;
    
    this.colorMappings.set(key, { label, color, valueHash });
    return color;
  }

  private getColorVariation(baseColor: string): string {
    // Create a variation of the base color by adjusting hue
    if (baseColor.startsWith('var(--chart-')) {
      // For CSS variables, cycle through the palette
      const match = baseColor.match(/var\(--chart-(\d+)\)/);
      if (match) {
        const num = parseInt(match[1]);
        const newNum = ((num + 2) % 5) + 1; // Skip one color for variation
        return `var(--chart-${newNum})`;
      }
    } else if (baseColor.startsWith('hsl(')) {
      // For HSL colors, adjust hue by 30 degrees
      const match = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        const h = (parseInt(match[1]) + 30) % 360;
        const s = parseInt(match[2]);
        const l = parseInt(match[3]);
        return `hsl(${h}, ${s}%, ${l}%)`;
      }
    }
    
    // Fallback: return next color in palette
    return CHART_COLORS[this.colorIndex % CHART_COLORS.length];
  }

  private getLabelForKey(key: string): string {
    // Convert key to a readable label
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/_/g, ' ') // Replace underscores with spaces
      .trim();
  }
} 