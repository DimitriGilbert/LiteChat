import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

const SettingsRunnableBlocksComponent: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Runnable Code Blocks</CardTitle>
          <CardDescription>
            Control the execution and security validation of JavaScript and Python code blocks.
            This is an advanced feature that allows granular control over which block types can be executed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              <strong>Granular Runnable Blocks System</strong>
              <br />
              This new system follows the control rule pattern, allowing you to:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Enable/disable each block type individually (JavaScript, Python, etc.)</li>
                <li>Configure security settings per block type</li>
                <li>Off by default as it's an advanced feature</li>
                <li>Future-extensible for additional block types without hardcoding</li>
              </ul>
              <br />
              <span className="text-muted-foreground">
                Implementation in progress... This replaces the previous hardcoded system with a flexible control rule-based approach.
              </span>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export const SettingsRunnableBlocks = SettingsRunnableBlocksComponent; 