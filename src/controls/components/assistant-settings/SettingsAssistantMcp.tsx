import React, { useState } from "react";
import { useMcpStore, type McpServerConfig } from "@/store/mcp.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { PlusIcon, EditIcon, TrashIcon, ServerIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

const mcpServerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  headers: z.string().optional(),
  enabled: z.boolean(),
});

type McpServerFormData = z.infer<typeof mcpServerSchema>;

const SettingsAssistantMcpComponent: React.FC = () => {
  const { servers, addServer, updateServer, deleteServer } = useMcpStore(
    useShallow((state) => ({
      servers: state.servers,
      addServer: state.addServer,
      updateServer: state.updateServer,
      deleteServer: state.deleteServer,
    }))
  );

  const { 
    mcpRetryAttempts, 
    mcpRetryDelay, 
    mcpConnectionTimeout,
    setMcpRetryAttempts,
    setMcpRetryDelay,
    setMcpConnectionTimeout
  } = useSettingsStore(
    useShallow((state) => ({
      mcpRetryAttempts: state.mcpRetryAttempts,
      mcpRetryDelay: state.mcpRetryDelay,
      mcpConnectionTimeout: state.mcpConnectionTimeout,
      setMcpRetryAttempts: state.setMcpRetryAttempts,
      setMcpRetryDelay: state.setMcpRetryDelay,
      setMcpConnectionTimeout: state.setMcpConnectionTimeout,
    }))
  );

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null);

  const addForm = useForm({
    defaultValues: {
      name: "",
      url: "",
      description: "",
      headers: "",
      enabled: true,
    } as McpServerFormData,
    onSubmit: async ({ value }) => {
      try {
        const headers = value.headers ? JSON.parse(value.headers) : undefined;
        addServer({
          name: value.name,
          url: value.url,
          description: value.description,
          headers,
          enabled: value.enabled,
        });
        setIsAddDialogOpen(false);
        addForm.reset();
      } catch (error) {
        console.error("Invalid headers JSON:", error);
      }
    },
  });

  const editForm = useForm({
    defaultValues: {
      name: "",
      url: "",
      description: "",
      headers: "",
      enabled: true,
    } as McpServerFormData,
    onSubmit: async ({ value }) => {
      if (!editingServer) return;
      
      try {
        const headers = value.headers ? JSON.parse(value.headers) : undefined;
        updateServer(editingServer.id, {
          name: value.name,
          url: value.url,
          description: value.description,
          headers,
          enabled: value.enabled,
        });
        setEditingServer(null);
        editForm.reset();
      } catch (error) {
        console.error("Invalid headers JSON:", error);
      }
    },
  });

  const handleEdit = (server: McpServerConfig) => {
    setEditingServer(server);
    editForm.setFieldValue("name", server.name);
    editForm.setFieldValue("url", server.url);
    editForm.setFieldValue("description", server.description || "");
    editForm.setFieldValue("headers", server.headers ? JSON.stringify(server.headers, null, 2) : "");
    editForm.setFieldValue("enabled", server.enabled);
  };

  const handleDelete = (serverId: string) => {
    if (window.confirm("Are you sure you want to delete this MCP server?")) {
      deleteServer(serverId);
    }
  };

  const handleToggleEnabled = (server: McpServerConfig) => {
    updateServer(server.id, { enabled: !server.enabled });
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">MCP Servers</h3>
          <p className="text-sm text-muted-foreground">
            Configure HTTP-based Model Context Protocol servers for additional tools and capabilities.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add MCP Server
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add MCP Server</DialogTitle>
              <DialogDescription>
                Add a new HTTP-based MCP server to extend LiteChat with additional tools.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <addForm.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="My MCP Server"
                    />
                  </div>
                )}
              </addForm.Field>

              <addForm.Field name="url">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>URL</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="https://api.example.com/mcp"
                    />
                  </div>
                )}
              </addForm.Field>

              <addForm.Field name="description">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Description (Optional)</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Brief description of this server"
                    />
                  </div>
                )}
              </addForm.Field>

              <addForm.Field name="headers">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>HTTP Headers (Optional)</Label>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder='{"Authorization": "Bearer your-token", "X-API-Key": "your-key"}'
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      JSON format for authentication headers
                    </p>
                  </div>
                )}
              </addForm.Field>

              <addForm.Field name="enabled">
                {(field) => (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                    <Label htmlFor={field.name}>Enable this server</Label>
                  </div>
                )}
              </addForm.Field>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Server</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Retry Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Settings</CardTitle>
          <CardDescription>
            Configure retry behavior and timeouts for MCP server connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retry-attempts">Retry Attempts</Label>
              <Input
                id="retry-attempts"
                type="number"
                min="0"
                max="10"
                value={mcpRetryAttempts}
                onChange={(e) => setMcpRetryAttempts(parseInt(e.target.value) || 0)}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">
                Number of retry attempts (0-10)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="retry-delay">Retry Delay (ms)</Label>
              <Input
                id="retry-delay"
                type="number"
                min="500"
                max="30000"
                step="500"
                value={mcpRetryDelay}
                onChange={(e) => setMcpRetryDelay(parseInt(e.target.value) || 2000)}
                placeholder="2000"
              />
              <p className="text-xs text-muted-foreground">
                Initial delay between retries (500-30000ms)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="connection-timeout">Connection Timeout (ms)</Label>
              <Input
                id="connection-timeout"
                type="number"
                min="1000"
                max="60000"
                step="1000"
                value={mcpConnectionTimeout}
                onChange={(e) => setMcpConnectionTimeout(parseInt(e.target.value) || 10000)}
                placeholder="10000"
              />
              <p className="text-xs text-muted-foreground">
                Connection timeout (1000-60000ms)
              </p>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Failed connections will be retried automatically with exponential backoff</li>
              <li>Toast notifications will show connection status and retry progress</li>
              <li>Servers that fail all retry attempts will be marked as disconnected</li>
              <li>You can manually retry connections from the server cards below</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <ScrollArea className="h-[400px]">
        {servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ServerIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No MCP Servers</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Add HTTP-based MCP servers to extend LiteChat with additional tools and capabilities.
              MCP (Model Context Protocol) allows AI models to securely access external tools and data sources.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Your First MCP Server
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {servers.map((server) => (
              <Card key={server.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-base">{server.name}</CardTitle>
                      <Badge variant={server.enabled ? "default" : "secondary"}>
                        {server.enabled ? (
                          <>
                            <CheckCircleIcon className="mr-1 h-3 w-3" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="mr-1 h-3 w-3" />
                            Disabled
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={server.enabled}
                        onCheckedChange={() => handleToggleEnabled(server)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(server)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(server.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {server.description && (
                    <CardDescription>{server.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground">
                    <strong>URL:</strong> {server.url}
                  </div>
                  {server.headers && Object.keys(server.headers).length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      <strong>Headers:</strong> {Object.keys(server.headers).join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!editingServer} onOpenChange={(open) => !open && setEditingServer(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit MCP Server</DialogTitle>
            <DialogDescription>
              Update the configuration for this MCP server.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <editForm.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="My MCP Server"
                  />
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="url">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>URL</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="https://api.example.com/mcp"
                  />
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Description (Optional)</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Brief description of this server"
                  />
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="headers">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>HTTP Headers (Optional)</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder='{"Authorization": "Bearer your-token", "X-API-Key": "your-key"}'
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    JSON format for authentication headers
                  </p>
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="enabled">
              {(field) => (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                  <Label htmlFor={field.name}>Enable this server</Label>
                </div>
              )}
            </editForm.Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingServer(null)}>
                Cancel
              </Button>
              <Button type="submit">Update Server</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const SettingsAssistantMcp = React.memo(SettingsAssistantMcpComponent); 