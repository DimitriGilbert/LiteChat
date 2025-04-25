import React from 'react';
import { useInteractionStore } from '@/store/interaction.store';
import { useShallow } from 'zustand/react/shallow';

const SingleStreamingInteraction: React.FC<{ interactionId: string }> = ({ interactionId }) => {
   const interaction = useInteractionStore(useShallow(state => state.interactions.find(i => i.id === interactionId)));
   if (!interaction || interaction.status !== 'STREAMING') return null;
   return (
     <div key={interaction.id} className='p-3 my-2 border rounded-md shadow-sm bg-card border-dashed animate-pulse'>
       <div className='text-xs text-muted-foreground mb-1'>Idx:{interaction.index} | {interaction.type} | Streaming...</div>
       <pre className='text-sm whitespace-pre-wrap'>{interaction.response || ''}</pre>
     </div>
   );
};
interface StreamingInteractionRendererProps { interactionIds: string[]; }
export const StreamingInteractionRenderer: React.FC<StreamingInteractionRendererProps> = ({ interactionIds }) => {
  if (!interactionIds || interactionIds.length === 0) return null;
  return <>{interactionIds.map(id => <SingleStreamingInteraction key={id} interactionId={id} />)}</>;
};
