'use client';
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, Phone } from 'lucide-react';
import type { BaseFieldProps } from '@/lib/formedible/types';
import { FieldWrapper } from './base-field-wrapper';

export interface PhoneFieldSpecificProps extends BaseFieldProps {
  phoneConfig?: {
    defaultCountry?: string;
    format?: 'national' | 'international';
    allowedCountries?: string[];
    placeholder?: string;
  };
}

// Common country codes and their formatting
const COUNTRY_CODES = {
  US: { code: '+1', name: 'United States', flag: '🇺🇸', format: '(###) ###-####' },
  CA: { code: '+1', name: 'Canada', flag: '🇨🇦', format: '(###) ###-####' },
  GB: { code: '+44', name: 'United Kingdom', flag: '🇬🇧', format: '#### ### ####' },
  FR: { code: '+33', name: 'France', flag: '🇫🇷', format: '## ## ## ## ##' },
  DE: { code: '+49', name: 'Germany', flag: '🇩🇪', format: '### ### ####' },
  IT: { code: '+39', name: 'Italy', flag: '🇮🇹', format: '### ### ####' },
  ES: { code: '+34', name: 'Spain', flag: '🇪🇸', format: '### ### ###' },
  AU: { code: '+61', name: 'Australia', flag: '🇦🇺', format: '#### ### ###' },
  JP: { code: '+81', name: 'Japan', flag: '🇯🇵', format: '##-####-####' },
  CN: { code: '+86', name: 'China', flag: '🇨🇳', format: '### #### ####' },
  IN: { code: '+91', name: 'India', flag: '🇮🇳', format: '##### #####' },
  BR: { code: '+55', name: 'Brazil', flag: '🇧🇷', format: '(##) #####-####' },
  MX: { code: '+52', name: 'Mexico', flag: '🇲🇽', format: '## #### ####' },
  RU: { code: '+7', name: 'Russia', flag: '🇷🇺', format: '### ###-##-##' },
  KR: { code: '+82', name: 'South Korea', flag: '🇰🇷', format: '##-####-####' },
};

const formatPhoneNumber = (value: string, format: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Apply format pattern
  let formatted = '';
  let digitIndex = 0;
  
  for (const char of format) {
    if (char === '#' && digitIndex < digits.length) {
      formatted += digits[digitIndex];
      digitIndex++;
    } else if (char !== '#') {
      formatted += char;
    } else {
      break;
    }
  }
  
  return formatted;
};

const extractDigits = (value: string): string => {
  return value.replace(/\D/g, '');
};

export const PhoneField: React.FC<PhoneFieldSpecificProps> = ({
  fieldApi,
  label,
  description,
  placeholder: fieldPlaceholder,
  inputClassName,
  labelClassName,
  wrapperClassName,
  phoneConfig = {},
}) => {
  const {
    defaultCountry = 'US',
    format = 'national',
    allowedCountries,
    placeholder,
  } = phoneConfig;

  const name = fieldApi.name;
  const value = (fieldApi.state?.value as string) || '';
  const isDisabled = fieldApi.form?.state?.isSubmitting ?? false;
  const hasErrors = fieldApi.state?.meta?.isTouched && fieldApi.state?.meta?.errors?.length > 0;
  
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const availableCountries = allowedCountries 
    ? Object.entries(COUNTRY_CODES).filter(([code]) => allowedCountries.includes(code))
    : Object.entries(COUNTRY_CODES);

  const currentCountry = COUNTRY_CODES[selectedCountry as keyof typeof COUNTRY_CODES];

  // Parse existing value on mount
  useEffect(() => {
    if (value) {
      // Try to extract country code and phone number
      const digits = extractDigits(value);
      
      // Find matching country code
      const matchingCountry = Object.entries(COUNTRY_CODES).find(([_, country]) => {
        const countryDigits = extractDigits(country.code);
        return digits.startsWith(countryDigits);
      });

      if (matchingCountry) {
        const [countryCode, countryData] = matchingCountry;
        setSelectedCountry(countryCode);
        
        const countryCodeDigits = extractDigits(countryData.code);
        const phoneDigits = digits.slice(countryCodeDigits.length);
        setPhoneNumber(formatPhoneNumber(phoneDigits, countryData.format));
      } else {
        setPhoneNumber(value);
      }
    }
  }, [value]);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const digits = extractDigits(inputValue);
    
    // Format the phone number according to country format
    const formatted = formatPhoneNumber(digits, currentCountry.format);
    setPhoneNumber(formatted);
    
    // Create the final value based on format preference
    const finalValue = format === 'international' 
      ? `${currentCountry.code} ${formatted}`.trim()
      : formatted;
    
    fieldApi.handleChange(finalValue);
  };

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setIsCountryDropdownOpen(false);
    
    // Update the value with new country code
    const newCountry = COUNTRY_CODES[countryCode as keyof typeof COUNTRY_CODES];
    const digits = extractDigits(phoneNumber);
    const formatted = formatPhoneNumber(digits, newCountry.format);
    
    const finalValue = format === 'international' 
      ? `${newCountry.code} ${formatted}`.trim()
      : formatted;
    
    fieldApi.handleChange(finalValue);
  };

  const getPlaceholder = (): string => {
    if (placeholder) return placeholder;
    
    const exampleNumber = formatPhoneNumber('1234567890', currentCountry.format);
    return format === 'international' 
      ? `${currentCountry.code} ${exampleNumber}`
      : exampleNumber;
  };

  return (
    <FieldWrapper
      fieldApi={fieldApi}
      label={label}
      description={description}
      inputClassName={inputClassName}
      labelClassName={labelClassName}
      wrapperClassName={wrapperClassName}
    >
      <div className="space-y-2">
        <div className="flex">
          {/* Country selector */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "rounded-r-none border-r-0 px-3 h-10 min-w-[80px]",
                hasErrors ? "border-destructive" : ""
              )}
              onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
              disabled={isDisabled}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{currentCountry.flag}</span>
                {format === 'international' && (
                  <span className="text-xs text-muted-foreground">
                    {currentCountry.code}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </span>
            </Button>

            {/* Country dropdown */}
            {isCountryDropdownOpen && (
              <div className="absolute z-50 top-full left-0 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto min-w-[200px]">
                {availableCountries.map(([code, country]) => (
                  <button
                    key={code}
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      "flex items-center gap-3",
                      selectedCountry === code ? "bg-accent" : ""
                    )}
                    onClick={() => handleCountryChange(code)}
                  >
                    <span className="text-base">{country.flag}</span>
                    <div className="flex-1">
                      <div className="font-medium">{country.name}</div>
                      <div className="text-xs text-muted-foreground">{country.code}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Phone number input */}
          <Input
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            onBlur={() => fieldApi.handleBlur()}
            placeholder={getPlaceholder()}
            className={cn(
              "rounded-l-none flex-1",
              hasErrors ? "border-destructive" : "",
              inputClassName
            )}
            disabled={isDisabled}
          />
        </div>

        {/* Format hint */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          <span>
            Format: {currentCountry.format.replace(/#/g, '0')}
            {format === 'international' && ` (${currentCountry.code})`}
          </span>
        </div>
      </div>
    </FieldWrapper>
  );
}; 