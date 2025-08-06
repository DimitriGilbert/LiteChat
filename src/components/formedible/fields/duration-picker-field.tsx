"use client";
import React, { useState } from "react";
import type { BaseFieldProps } from "@/lib/formedible/types";
import { FieldWrapper } from "./base-field-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DurationValue {
  hours?: number;
  minutes?: number;
  seconds?: number;
  totalSeconds?: number;
}

interface DurationConfig {
  format?: 'hms' | 'hm' | 'ms' | 'hours' | 'minutes' | 'seconds';
  maxHours?: number;
  maxMinutes?: number;
  maxSeconds?: number;
  showLabels?: boolean;
  allowNegative?: boolean;
}

interface DurationPickerFieldProps extends BaseFieldProps {
  durationConfig?: DurationConfig;
}

const parseDuration = (value: any, format: string) => {
  if (!value) return { hours: 0, minutes: 0, seconds: 0 };
  
  if (typeof value === 'number') {
    const totalSeconds = Math.abs(value);
    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
  }
  
  if (typeof value === 'object') {
    return {
      hours: value.hours || 0,
      minutes: value.minutes || 0,
      seconds: value.seconds || 0
    };
  }
  
  return { hours: 0, minutes: 0, seconds: 0 };
};

const formatOutput = (hours: number, minutes: number, seconds: number, format: string) => {
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  
  switch (format) {
    case 'hours': return hours + minutes / 60 + seconds / 3600;
    case 'minutes': return hours * 60 + minutes + seconds / 60;
    case 'seconds': return totalSeconds;
    default: return { hours, minutes, seconds, totalSeconds };
  }
};

export const DurationPickerField: React.FC<DurationPickerFieldProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  wrapperClassName,
  labelClassName,
  inputClassName,
  durationConfig,
}) => {
  const name = fieldApi.name;
  const format = durationConfig?.format || 'hms';
  const maxHours = durationConfig?.maxHours || 23;
  const maxMinutes = durationConfig?.maxMinutes || 59;
  const maxSeconds = durationConfig?.maxSeconds || 59;
  const showLabels = durationConfig?.showLabels !== false;

  const currentValue = parseDuration(fieldApi.state?.value, format);
  const [hours, setHours] = useState(currentValue.hours);
  const [minutes, setMinutes] = useState(currentValue.minutes);
  const [seconds, setSeconds] = useState(currentValue.seconds);

  const updateField = (h: number, m: number, s: number) => {
    const output = formatOutput(h, m, s, format);
    fieldApi.handleChange(output);
  };

  const handleHoursChange = (h: number) => {
    setHours(h);
    updateField(h, minutes, seconds);
  };

  const handleMinutesChange = (m: number) => {
    setMinutes(m);
    updateField(hours, m, seconds);
  };

  const handleSecondsChange = (s: number) => {
    setSeconds(s);
    updateField(hours, minutes, s);
  };

  const formatDuration = () => {
    const parts = [];
    if (format.includes('h') && hours > 0) parts.push(`${hours}h`);
    if (format.includes('m') && minutes > 0) parts.push(`${minutes}m`);
    if (format.includes('s') && seconds > 0) parts.push(`${seconds}s`);
    return parts.join(' ') || '0';
  };

  const renderTimeInput = (value: number, onChange: (value: number) => void, max: number, unit: string, show: boolean) => {
    if (!show) return null;

    return (
      <div className="flex flex-col space-y-1">
        {showLabels && (
          <Label className="text-xs text-muted-foreground capitalize">
            {unit}
          </Label>
        )}
        <Select value={value.toString()} onValueChange={(val) => onChange(parseInt(val))}>
          <SelectTrigger className={cn("w-20", inputClassName)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: max + 1 }, (_, i) => (
              <SelectItem key={i} value={i.toString()}>
                {i.toString().padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const handleManualInput = (input: string) => {
    const hourMatch = input.match(/(\d+)h/i);
    const minuteMatch = input.match(/(\d+)m(?!s)/i);
    const secondMatch = input.match(/(\d+)s/i);
    
    const newHours = hourMatch ? Math.min(Math.max(0, parseInt(hourMatch[1], 10)), maxHours) : 0;
    const newMinutes = minuteMatch ? Math.min(Math.max(0, parseInt(minuteMatch[1], 10)), maxMinutes) : 0;
    const newSeconds = secondMatch ? Math.min(Math.max(0, parseInt(secondMatch[1], 10)), maxSeconds) : 0;
    
    setHours(newHours);
    setMinutes(newMinutes);
    setSeconds(newSeconds);
    updateField(newHours, newMinutes, newSeconds);
  };

  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      {label && (
        <Label htmlFor={name} className={labelClassName}>
          {label}
        </Label>
      )}
      
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <div className="space-y-3">
        {/* Dropdown selectors */}
        <div className="flex gap-3">
          {renderTimeInput(hours, handleHoursChange, maxHours, 'hours', format.includes('h'))}
          {renderTimeInput(minutes, handleMinutesChange, maxMinutes, 'minutes', format.includes('m'))}
          {renderTimeInput(seconds, handleSecondsChange, maxSeconds, 'seconds', format.includes('s'))}
        </div>

        {/* Manual input alternative */}
        <div className="space-y-2">
          <Input
            id={name}
            value={formatDuration()}
            placeholder={placeholder || "Enter duration (e.g., 1h 30m 45s)"}
            className={inputClassName}
            onChange={(e) => handleManualInput(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            Format: {format === 'hms' ? '1h 30m 45s' : format === 'hm' ? '1h 30m' : format === 'ms' ? '30m 45s' : `${format} only`}
          </div>
        </div>

        {/* Duration display */}
        <div className="text-sm text-muted-foreground">
          Total: {formatDuration()}
          {format !== 'seconds' && ` (${hours * 3600 + minutes * 60 + seconds} seconds)`}
        </div>
      </div>

      {fieldApi.state?.meta?.errors && fieldApi.state?.meta?.errors.length > 0 && (
        <p className="text-sm text-destructive">
          {fieldApi.state?.meta?.errors[0]}
        </p>
      )}
    </div>
  );
};