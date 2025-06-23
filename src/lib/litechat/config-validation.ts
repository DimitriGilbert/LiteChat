/**
 * Configuration validation utilities for controls that require setup
 */

export interface ConfigValidationResult {
  isValid: boolean;
  missingConfig: string[];
  settingsTab?: string;
  settingsSubTab?: string;
  message?: string;
}

/**
 * Validate provider configuration
 */
export const validateProviderConfig = (): ConfigValidationResult => {
  // This would typically check if API keys are configured
  // For now, we'll return a basic validation
  const hasProviders = true; // Placeholder - would check actual provider store
  
  if (!hasProviders) {
    return {
      isValid: false,
      missingConfig: ['AI Provider'],
      settingsTab: 'providers',
      message: 'Please configure at least one AI provider to continue.'
    };
  }
  
  return { isValid: true, missingConfig: [] };
};

/**
 * Validate tool selector configuration
 */
export const validateToolSelectorConfig = (): ConfigValidationResult => {
  // Check if any tools are available/configured
  const hasTools = true; // Placeholder - would check actual tool availability
  
  if (!hasTools) {
    return {
      isValid: false,
      missingConfig: ['Tools'],
      settingsTab: 'tools',
      message: 'No tools are available. Please configure tool providers in settings.'
    };
  }
  
  return { isValid: true, missingConfig: [] };
};

/**
 * Validate image generation configuration
 */
export const validateImageGenerationConfig = (): ConfigValidationResult => {
  // Check if image generation providers are configured
  const hasImageProviders = true; // Placeholder - would check actual provider store
  
  if (!hasImageProviders) {
    return {
      isValid: false,
      missingConfig: ['Image Generation Provider'],
      settingsTab: 'providers',
      settingsSubTab: 'image-generation',
      message: 'Please configure an image generation provider (DALL-E, Midjourney, etc.) to use this feature.'
    };
  }
  
  return { isValid: true, missingConfig: [] };
};

/**
 * Validate web search configuration
 */
export const validateWebSearchConfig = (): ConfigValidationResult => {
  // Check if web search providers are configured
  const hasSearchProviders = true; // Placeholder - would check actual provider store
  
  if (!hasSearchProviders) {
    return {
      isValid: false,
      missingConfig: ['Web Search Provider'],
      settingsTab: 'providers',
      settingsSubTab: 'web-search',
      message: 'Please configure a web search provider (Google, Bing, etc.) to use this feature.'
    };
  }
  
  return { isValid: true, missingConfig: [] };
};

/**
 * Validate parameter control configuration
 */
export const validateParameterConfig = (): ConfigValidationResult => {
  // Check if model parameters are properly configured
  const hasValidParams = true; // Placeholder - would check parameter ranges/validity
  
  if (!hasValidParams) {
    return {
      isValid: false,
      missingConfig: ['Model Parameters'],
      settingsTab: 'assistant',
      settingsSubTab: 'parameters',
      message: 'Please configure model parameters in assistant settings.'
    };
  }
  
  return { isValid: true, missingConfig: [] };
};

/**
 * Generic configuration validator
 */
export const validateControlConfig = (controlType: string): ConfigValidationResult => {
  switch (controlType) {
    case 'provider-selector':
    case 'model-selector':
      return validateProviderConfig();
    
    case 'tool-selector':
      return validateToolSelectorConfig();
    
    case 'image-generation':
      return validateImageGenerationConfig();
    
    case 'web-search':
      return validateWebSearchConfig();
    
    case 'parameter':
      return validateParameterConfig();
    
    default:
      return { isValid: true, missingConfig: [] };
  }
};

/**
 * Open settings to specific tab/subtab
 */
export const openSettingsTab = (tab: string, subTab?: string) => {
  // This would emit an event to open settings
  // For now, just log what would happen
  console.log(`Would open settings tab: ${tab}${subTab ? ` > ${subTab}` : ''}`);
  
  // In the actual implementation, this would emit an event:
  // emitter.emit(uiEvent.openSettingsTab, { tab, subTab });
};

/**
 * Show configuration validation error
 */
export const showConfigValidationError = (result: ConfigValidationResult) => {
  if (result.isValid) return;
  
  const message = result.message || `Missing configuration: ${result.missingConfig.join(', ')}`;
  
  // This would show a toast with action to open settings
  console.log(`Config validation error: ${message}`);
  
  // In the actual implementation:
  // toast.error(message, {
  //   action: {
  //     label: 'Open Settings',
  //     onClick: () => openSettingsTab(result.settingsTab!, result.settingsSubTab)
  //   }
  // });
}; 