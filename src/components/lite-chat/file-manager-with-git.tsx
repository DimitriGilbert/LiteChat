import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileManager } from './file-manager';
import { GitManager } from './git-manager';

export const FileManagerWithGit: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <Tabs defaultValue="files" className={className}>
      <TabsList className="grid grid-cols-2 mb-2">
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="git">Git</TabsTrigger>
      </TabsList>
      <TabsContent value="files">
        <FileManager />
      </TabsContent>
      <TabsContent value="git">
        <GitManager />
      </TabsContent>
    </Tabs>
  );
};