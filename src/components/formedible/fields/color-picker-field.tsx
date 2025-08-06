'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Palette, Check } from 'lucide-react';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

export interface ColorPickerFieldSpecificProps extends BaseFieldProps {
  colorConfig?: {
    format?: 'hex' | 'rgb' | 'hsl';
    showPreview?: boolean;
    presetColors?: string[];
    allowCustom?: boolean;
  };
}

const DEFAULT_PRESETS = [
  '#FF0000', '#FF8000', '#FFFF00', '#80FF00', '#00FF00', '#00FF80',
  '#00FFFF', '#0080FF', '#0000FF', '#8000FF', '#FF00FF', '#FF0080',
  '#000000', '#404040', '#808080', '#C0C0C0', '#FFFFFF', '#8B4513'
];

// Color conversion utilities
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};



const hexToHsl = (hex: string): { h: number; s: number; l: number } | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  
  const { r, g, b } = rgb;
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / diff + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / diff + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / diff + 4;
        break;
    }
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

const formatColor = (hex: string, format: 'hex' | 'rgb' | 'hsl'): string => {
  switch (format) {
    case 'rgb': {
      const rgb = hexToRgb(hex);
      return rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : hex;
    }
    case 'hsl': {
      const hsl = hexToHsl(hex);
      return hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : hex;
    }
    default:
      return hex;
  }
};

export const ColorPickerField: React.FC<ColorPickerFieldSpecificProps> = ({
  fieldApi,
  colorConfig = {},
  inputClassName,
  ...wrapperProps
}) => {
  const {
    format = 'hex',
    showPreview = true,
    presetColors = DEFAULT_PRESETS,
    allowCustom = true,
  } = colorConfig;

  const name = fieldApi.name;
  
  const value = (fieldApi.state?.value as string) || '#000000';
  
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Ensure value is always a valid hex color
  const normalizedValue = value.startsWith('#') ? value : `#${value}`;
  const displayValue = formatColor(normalizedValue, format);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleColorSelect = (color: string) => {
    const formattedColor = formatColor(color, format);
    fieldApi.handleChange(formattedColor);
    setCustomInput(color);
    setIsOpen(false);
    fieldApi.handleBlur();
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setCustomInput(inputValue);
    
    // Validate and update if it's a valid color
    if (inputValue.match(/^#[0-9A-Fa-f]{6}$/)) {
      const formattedColor = formatColor(inputValue, format);
      fieldApi.handleChange(formattedColor);
    }
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    const formattedColor = formatColor(color, format);
    fieldApi.handleChange(formattedColor);
    setCustomInput(color);
  };

  const isValidColor = (color: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  };

  const isDisabled = fieldApi.form.state.isSubmitting;

  return (
    <FieldWrapper fieldApi={fieldApi} {...wrapperProps}>
      <div className="relative space-y-2" ref={containerRef}>
        <div className="flex gap-2">
          {/* Color preview and trigger */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-12 h-10 p-0 border-2",
                fieldApi.state?.meta?.errors.length ? "border-destructive" : "",
                inputClassName
              )}
              onClick={() => setIsOpen(!isOpen)}
              disabled={isDisabled}
              style={{ backgroundColor: normalizedValue }}
            >
              {!showPreview && <Palette className="h-4 w-4" />}
            </Button>
            
            {/* Native color input (hidden) */}
            <input
              ref={colorInputRef}
              type="color"
              value={normalizedValue}
              onChange={handleNativeColorChange}
              onBlur={() => fieldApi.handleBlur()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isDisabled}
            />
          </div>

          {/* Color value input */}
          <Input
            value={displayValue}
            onChange={(e) => {
              const inputValue = e.target.value;
              fieldApi.handleChange(inputValue);
              // Try to extract hex value for internal use
              if (inputValue.startsWith('#')) {
                setCustomInput(inputValue);
              }
            }}
            onBlur={() => {
              fieldApi.handleBlur();
            }}
            placeholder={'#000000'}
            className={cn(
              "flex-1",
              fieldApi.state?.meta?.errors.length ? "border-destructive" : ""
            )}
            disabled={isDisabled}
          />
        </div>

        {/* Color picker dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 p-4 bg-popover border rounded-md shadow-lg w-64">
            {/* Preset colors */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Preset Colors</h4>
              <div className="grid grid-cols-6 gap-2">
                {presetColors.map((color, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded border-2 hover:scale-110 transition-transform",
                      normalizedValue.toLowerCase() === color.toLowerCase() 
                        ? "border-primary ring-2 ring-primary ring-offset-2" 
                        : "border-muted hover:border-primary"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                    title={color}
                  >
                    {normalizedValue.toLowerCase() === color.toLowerCase() && (
                      <Check className="h-4 w-4 text-white drop-shadow-lg" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom color input */}
            {allowCustom && (
              <div>
                <h4 className="text-sm font-medium mb-2">Custom Color</h4>
                <div className="flex gap-2">
                  <Input
                    value={customInput}
                    onChange={handleCustomInputChange}
                    placeholder="#000000"
                    className="flex-1 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleColorSelect(customInput)}
                    disabled={!isValidColor(customInput)}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};