import React from 'react';
import { useConversationStore } from '@/store/conversation.store';
import { ScrollArea } from '@/components/ui/scroll-area'; // Example import
import { Button } from '@/components/ui/button'; // Example import
import { PlusIcon } from 'lucide-react'; // Example import

export const ConversationListControlComponent: React.FC = () => {
  const { conversations, selectConversation, selectedConversationId, addConversation, deleteConversation } = useConversationStore();

  const handleNewChat = async () => {
     const newId = await addConversation({ title: 'New Chat' });
     selectConversation(newId);
  };

  // TODO: Add delete confirmation
  const handleDelete = (id: string) => {
     if (window.confirm('Delete this conversation?')) {
        deleteConversation(id);
     }
  };

  return (
    <div className='p-2 border rounded bg-card text-card-foreground h-full flex flex-col'>
      <div className='flex justify-between items-center mb-2'>
         <h3 className='text-sm font-semibold'>Conversations</h3>
         <Button size='sm' variant='ghost' onClick={handleNewChat} aria-label="New Chat">
            <PlusIcon className='h-4 w-4' />
         </Button>
      </div>
      <ScrollArea className='flex-grow'>
        {conversations.length === 0 && <p className='text-xs text-muted-foreground p-2'>No conversations yet.</p>}
        <ul className='space-y-1'>
          {conversations.map(c => (
            <li key={c.id}
                className={`flex justify-between items-center group p-1.5 text-xs rounded cursor-pointer hover:bg-muted ${c.id === selectedConversationId ? 'bg-muted font-medium' : ''}`}
                onClick={() => selectConversation(c.id)}>
              <span className='truncate pr-1'>{c.title || 'Untitled'}</span>
              {/* TODO: Add delete button */}
              {/* <Button variant='ghost' size='icon' className='h-5 w-5 opacity-0 group-hover:opacity-100' onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>X</Button> */}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
};

// TODO: Register as ChatControl with panel: 'sidebar'
