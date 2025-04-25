import React from 'react';
import { useProviderStore } from '@/store/provider.store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Example import

// Example PromptControl implementation
export const ModelProviderControlComponent: React.FC = () => {
  const {
    selectedProviderId,
    selectedModelId,
    selectProvider,
    selectModel,
    getActiveProviders, // Use selector function
    // getSelectedProvider, // Use selector function
  } = useProviderStore();

  const activeProviders = getActiveProviders(); // Get active providers list
  // TODO: Get models for the selected provider
  const modelsForSelectedProvider = useProviderStore(state =>
     state.dbProviderConfigs.find(p => p.id === state.selectedProviderId)?.enabledModels ?? // Use enabled first
     state.dbProviderConfigs.find(p => p.id === state.selectedProviderId)?.fetchedModels ?? // Fallback to fetched
     [] // Fallback to empty
  );


  const handleProviderChange = (value: string) => {
    selectProvider(value || null);
  };

  const handleModelChange = (value: string) => {
    selectModel(value || null);
  };

  return (
    <div className='flex items-center gap-1'>
      <Select value={selectedProviderId ?? ''} onValueChange={handleProviderChange}>
        <SelectTrigger className='h-8 text-xs w-[120px]'>
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          {activeProviders.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
       <Select value={selectedModelId ?? ''} onValueChange={handleModelChange} disabled={!selectedProviderId}>
        <SelectTrigger className='h-8 text-xs w-[150px]'>
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
           {modelsForSelectedProvider.map(m => <SelectItem key={m.id} value={m.id}>{m.name || m.id}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};

// TODO: Register this component as a PromptControl
// Example registration (would happen elsewhere, e.g., in LiteChat component or a mod):
/*
import { useControlRegistryStore } from '@/store/control.store';
import { useProviderStore } from '@/store/provider.store';

const ModelProviderControlRegistration = () => {
  const register = useControlRegistryStore(state => state.registerPromptControl);
  const providerState = useProviderStore(); // Get state for status/show logic

  React.useEffect(() => {
    const control: PromptControl = {
      id: 'core-model-provider',
      status: () => providerState.isLoading ? 'loading' : 'ready',
      trigger: () => <ModelProviderControlComponent />, // Render the component
      show: () => true, // Always show for now
      // Return selected IDs for metadata
      getMetadata: () => ({
         providerId: providerState.selectedProviderId,
         modelId: providerState.selectedModelId,
      }),
      order: 10, // Example order
    };
    const unregister = register(control);
    return unregister;
  }, [register, providerState]); // Re-register if state affecting status/show changes

  return null; // This component doesn't render anything itself
}
*/
