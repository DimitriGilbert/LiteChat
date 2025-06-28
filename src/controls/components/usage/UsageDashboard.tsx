// src/controls/components/usage/UsageDashboard.tsx
// Usage dashboard component showing cost and token analytics

import React, { useState, useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { PersistenceService } from "@/services/persistence.service";
import { calculateTokenCost } from "@/lib/litechat/prompt-util";
import { formatTokenCost } from "@/lib/litechat/ai-helpers";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import type { ChartConfig } from "@/components/ui/chart";
import type { Interaction } from "@/types/litechat/interaction";

// Chart configuration for consistent styling
const chartConfig: ChartConfig = {
  cost: {
    label: "Cost",
    color: "var(--chart-1)",
  },
  tokens: {
    label: "Tokens",
    color: "var(--chart-2)",
  },
  interactions: {
    label: "Interactions",
    color: "var(--chart-3)",
  },
};

interface DailyUsage {
  date: string;
  cost: number;
  tokens: number;
  interactions: number;
}

interface ModelUsage {
  modelName: string;
  cost: number;
  tokens: number;
  interactions: number;
  fill: string;
}

export const UsageDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState(30); // days
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(false);

  const { dbProviderConfigs } = useProviderStore();

  // Create price lookup map
  const priceMap = useMemo(() => {
    const map = new Map<string, { prompt: number; completion: number }>();
    
    dbProviderConfigs.forEach(config => {
      if (config.fetchedModels) {
        config.fetchedModels.forEach(model => {
          const combinedId = `${config.id}:${model.id}`;
          map.set(combinedId, {
            prompt: parseFloat(model.pricing?.prompt || "0"),
            completion: parseFloat(model.pricing?.completion || "0"),
          });
        });
      }
    });
    
    return map;
  }, [dbProviderConfigs]);

  // Load interactions for the selected date range
  const loadUsageData = async () => {
    setLoading(true);
    try {
      const endDate = endOfDay(new Date());
      const startDate = startOfDay(subDays(endDate, dateRange));
      
      const data = await PersistenceService.getInteractionsByDateRange(startDate, endDate);
      const completedInteractions = data.filter(i => 
        i.status === "COMPLETED" && 
        (i.metadata?.promptTokens || i.metadata?.completionTokens) &&
        i.prompt?.metadata?.modelId
      );
      
      setInteractions(completedInteractions);
    } catch (error) {
      console.error("Error loading usage data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and when date range changes
  React.useEffect(() => {
    loadUsageData();
  }, [dateRange]);

  // Process data for daily usage chart
  const dailyUsageData = useMemo((): DailyUsage[] => {
    const dailyMap = new Map<string, DailyUsage>();
    
    // Initialize all days in range
    for (let i = 0; i < dateRange; i++) {
      const date = format(subDays(new Date(), dateRange - 1 - i), "yyyy-MM-dd");
      dailyMap.set(date, {
        date,
        cost: 0,
        tokens: 0,
        interactions: 0,
      });
    }
    
    // Aggregate interaction data by day
    interactions.forEach(interaction => {
      if (!interaction.startedAt || !interaction.metadata?.modelId) return;
      const date = format(new Date(interaction.startedAt), "yyyy-MM-dd");
      const existing = dailyMap.get(date);
      if (!existing) return;
      const modelId = interaction.metadata.modelId;
      if (!modelId || !modelId.includes(":")) {
        console.warn(`[UsageDashboard] Skipping interaction with missing or malformed modelId:`, interaction);
        return;
      }
      // Look up model pricing from dbProviderConfigs
      const [providerId, specificModelId] = modelId.split(":");
      const config = dbProviderConfigs.find(c => c.id === providerId);
      const modelDef = config?.fetchedModels?.find(m => m.id === specificModelId);
      const pricing = modelDef?.pricing;
      const promptPrice = pricing?.prompt ? parseFloat(pricing.prompt) : null;
      const completionPrice = pricing?.completion ? parseFloat(pricing.completion) : null;
      if (promptPrice === null || completionPrice === null) {
        console.warn(`[UsageDashboard] Missing pricing for modelId: ${modelId}`);
        return;
      }
      const promptTokens = interaction.metadata?.promptTokens || 0;
      const completionTokens = interaction.metadata?.completionTokens || 0;
      const totalTokens = promptTokens + completionTokens;
      const totalCost = calculateTokenCost(promptTokens, completionTokens, promptPrice, completionPrice).cost;
      existing.cost += totalCost;
      existing.tokens += totalTokens;
      existing.interactions += 1;
    });
    
    return Array.from(dailyMap.values());
  }, [interactions, dateRange, dbProviderConfigs]);

  // Process data for model usage pie chart
  const modelUsageData = useMemo((): ModelUsage[] => {
    const modelMap = new Map<string, ModelUsage>();
    const colors = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ];
    
    interactions.forEach(interaction => {
      if (!interaction.metadata?.modelId) return;
      const modelId = interaction.metadata.modelId;
      if (!modelId || !modelId.includes(":")) {
        return;
      }
      // Look up model pricing from dbProviderConfigs
      const [providerId, specificModelId] = modelId.split(":");
      const config = dbProviderConfigs.find(c => c.id === providerId);
      const modelDef = config?.fetchedModels?.find(m => m.id === specificModelId);
      const pricing = modelDef?.pricing;
      const promptPrice = pricing?.prompt ? parseFloat(pricing.prompt) : null;
      const completionPrice = pricing?.completion ? parseFloat(pricing.completion) : null;
      if (promptPrice === null || completionPrice === null) {
        return;
      }
      // Get model name for display
      const modelName = modelDef?.name || specificModelId || "Unknown";
      const promptTokens = interaction.metadata?.promptTokens || 0;
      const completionTokens = interaction.metadata?.completionTokens || 0;
      const totalTokens = promptTokens + completionTokens;
      const totalCost = calculateTokenCost(promptTokens, completionTokens, promptPrice, completionPrice).cost;
      
      const existing = modelMap.get(modelId);
      if (existing) {
        existing.cost += totalCost;
        existing.tokens += totalTokens;
        existing.interactions += 1;
      } else {
        modelMap.set(modelId, {
          modelName,
          cost: totalCost,
          tokens: totalTokens,
          interactions: 1,
          fill: colors[modelMap.size % colors.length],
        });
      }
    });
    
    return Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost);
  }, [interactions, dbProviderConfigs]);

  // Calculate totals
  const totals = useMemo(() => {
    return dailyUsageData.reduce(
      (acc, day) => ({
        cost: acc.cost + day.cost,
        tokens: acc.tokens + day.tokens,
        interactions: acc.interactions + day.interactions,
      }),
      { cost: 0, tokens: 0, interactions: 0 }
    );
  }, [dailyUsageData]);

  // Build chartConfig and data for Pie chart properly
  const modelPieConfig = useMemo(() => {
    const config: ChartConfig = {};
    
    modelUsageData.forEach((model, idx) => {
      // Create a safe key from model name
      const key = model.modelName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      config[key] = {
        label: model.modelName,
        color: `var(--chart-${(idx % 5) + 1})`,
      };
    });
    
    return config;
  }, [modelUsageData]);

  const modelPieData = useMemo(() => {
    return modelUsageData.map((model) => {
      const key = model.modelName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      return {
        ...model,
        key,
        fill: `var(--color-${key})`,
      };
    });
  }, [modelUsageData]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Dashboard</h2>
          <p className="text-muted-foreground">
            Track your AI model usage, costs, and token consumption
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={dateRange === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(7)}
          >
            7 days
          </Button>
          <Button
            variant={dateRange === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(30)}
          >
            30 days
          </Button>
          <Button
            variant={dateRange === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(90)}
          >
            90 days
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totals.cost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.tokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Interactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.interactions}</div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage</CardTitle>
          <CardDescription>
            Cost and token usage over the last {dateRange} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="min-h-[200px] max-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUsageData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), "MMM dd")}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="cost" 
                  orientation="left"
                  tickFormatter={formatTokenCost}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="tokens" 
                  orientation="right"
                  tickFormatter={(v) => v.toLocaleString()}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent formatter={(value, name) => name === "cost" ? formatTokenCost(Number(value)) : Number(value).toLocaleString()} />} 
                />
                <Bar 
                  yAxisId="cost" 
                  dataKey="cost" 
                  fill="var(--color-cost)"
                />
                <Bar 
                  yAxisId="tokens" 
                  dataKey="tokens" 
                  fill="var(--color-tokens)"
                />
                <ChartLegend content={<ChartLegendContent payload={[]} verticalAlign="bottom" />} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Model Usage Distribution */}
      {modelUsageData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
            <CardDescription>
              Cost distribution across different models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={modelPieConfig} className="min-h-[400px] max-w-2xl mx-auto">
              <PieChart>
                <Pie
                  data={modelPieData}
                  dataKey="cost"
                  nameKey="modelName"
                  cx="50%"
                  cy="50%"
                  outerRadius={140}
                  label={({ modelName, cost }) =>
                    typeof modelName === "string" && typeof cost === "number"
                      ? `${modelName}: ${formatTokenCost(cost)}`
                      : ""
                  }
                />
                <ChartTooltip 
                  content={<ChartTooltipContent formatter={(value) => formatTokenCost(Number(value))} />} 
                />
              </PieChart>
            </ChartContainer>
            <ChartLegend content={<ChartLegendContent payload={[]} />} />
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading usage data...</p>
        </div>
      )}
    </div>
  );
};