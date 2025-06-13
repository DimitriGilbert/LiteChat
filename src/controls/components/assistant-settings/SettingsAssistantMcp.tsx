import React, { useState, useEffect } from "react";
import { useMcpStore, type McpServerConfig } from "@/store/mcp.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, EditIcon, TrashIcon, ServerIcon, CheckCircleIcon, XCircleIcon, SaveIcon, XIcon, SettingsIcon, RotateCcwIcon } from "lucide-react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { cn } from "@/lib/utils";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// Schemas for form validation - single source of truth
const mcpServerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  description: z.string(),
  headers: z.string(), // JSON string in form, will be parsed to Record<string, string>
  enabled: z.boolean(),
});

const bridgeConfigFormSchema = z.object({
  url: z.string(),
  host: z.string(),
  port: z.number().min(1, "Port must be > 0").max(65535, "Port must be < 65535").optional(),
});

const connectionConfigFormSchema = z.object({
  retryAttempts: z.number().min(0, "Min 0 attempts").max(10, "Max 10 attempts"),
  retryDelay: z.number().min(500, "Min 500ms").max(30000, "Max 30000ms"),
  connectionTimeout: z.number().min(1000, "Min 1000ms").max(60000, "Max 60000ms"),
});

// Type inference from schemas
type BridgeConfigFormData = z.infer<typeof bridgeConfigFormSchema>;
type ConnectionConfigFormData = z.infer<typeof connectionConfigFormSchema>;

type McpServerFormData = z.infer<typeof mcpServerFormSchema>;

// Utility component for field validation messages
function FieldMetaMessages({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <em className="text-xs text-destructive mt-1 block">
          {field.state.meta.errors.join(", ")}
        </em>
      ) : null}
    </>
  );
}

// Bridge Configuration Component
function BridgeConfigurationTab() {
  const { bridgeConfig, setBridgeConfig } = useMcpStore(
    useShallow((state) => ({
      bridgeConfig: state.bridgeConfig,
      setBridgeConfig: state.setBridgeConfig,
    }))
  );

  const form = useForm({
    defaultValues: {
      url: bridgeConfig.url || "",
      host: bridgeConfig.host || "",
      port: bridgeConfig.port || undefined,
    },
    onSubmit: async ({ value }) => {
      setBridgeConfig({
        url: value.url || undefined,
        host: value.host || undefined,
        port: value.port,
      });
    },
  });

  // Update form when store changes
  useEffect(() => {
    form.reset({
      url: bridgeConfig.url || "",
      host: bridgeConfig.host || "",
      port: bridgeConfig.port || undefined,
    });
  }, [bridgeConfig, form]);

  const handleReset = () => {
    if (window.confirm("Reset bridge configuration to defaults?")) {
      setBridgeConfig({});
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-medium">Stdio Bridge Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure where LiteChat looks for the MCP bridge service (required for stdio:// servers)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Bridge Location
          </CardTitle>
          <CardDescription>
            Specify where your MCP bridge service is running
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="url">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Full Bridge URL (highest priority)</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="http://192.168.1.100:3001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Complete URL with protocol and port
                  </p>
                  <FieldMetaMessages field={field} />
                </div>
              )}
            </form.Field>
            
            <div className="space-y-2">
              <Label>Or configure Host + Port</Label>
              <div className="flex gap-2">
                <form.Field name="host">
                  {(field) => (
                    <div className="flex-1">
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="localhost"
                      />
                      <FieldMetaMessages field={field} />
                    </div>
                  )}
                </form.Field>
                <form.Field name="port">
                  {(field) => (
                    <div className="w-20">
                      <Input
                        type="number"
                        value={field.state.value || ""}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || undefined)}
                        onBlur={field.handleBlur}
                        placeholder="3001"
                      />
                      <FieldMetaMessages field={field} />
                    </div>
                  )}
                </form.Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Host and port (uses HTTP by default)
              </p>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-medium mb-1">Bridge Detection Priority:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Full URL (if specified above)</li>
              <li>Host + Port combination (if specified above)</li>
              <li>Auto-detection fallback: localhost:3001</li>
            </ol>
            <p className="mt-2 text-xs">
              Leave empty for auto-detection. For remote bridges, use full URL or configure host binding.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bridge Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p className="font-medium">To use stdio MCP servers, install and run the bridge:</p>
            <div className="bg-muted p-3 rounded font-mono text-xs">
              <p># Start the bridge (from LiteChat project directory)</p>
              <p>node bin/mcp-bridge.js</p>
              <p></p>
              <p># Or with custom settings</p>
              <p>node bin/mcp-bridge.js --host 0.0.0.0 --port 3001</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-3 border-t">
        <form.Subscribe>
          {(state) => (
            <div className="flex items-center space-x-2">
              <Button
                type="submit"
                size="sm"
                disabled={!state.canSubmit || state.isSubmitting || state.isValidating || !state.isValid}
              >
                {state.isSubmitting
                  ? "Saving..."
                  : state.isValidating
                  ? "Validating..."
                  : "Save Bridge Config"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                type="button"
              >
                <RotateCcwIcon className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

// Connection Settings Component
function ConnectionSettingsTab() {
  const {
    retryAttempts,
    retryDelay,
    connectionTimeout,
    setRetryAttempts,
    setRetryDelay,
    setConnectionTimeout,
  } = useMcpStore(
    useShallow((state) => ({
      retryAttempts: state.retryAttempts,
      retryDelay: state.retryDelay,
      connectionTimeout: state.connectionTimeout,
      setRetryAttempts: state.setRetryAttempts,
      setRetryDelay: state.setRetryDelay,
      setConnectionTimeout: state.setConnectionTimeout,
    }))
  );

  const form = useForm({
    defaultValues: {
      retryAttempts: retryAttempts,
      retryDelay: retryDelay,
      connectionTimeout: connectionTimeout,
    },
    validators: {
      onChangeAsync: connectionConfigFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      setRetryAttempts(value.retryAttempts);
      setRetryDelay(value.retryDelay);
      setConnectionTimeout(value.connectionTimeout);
    },
  });

  // Update form when store changes
  useEffect(() => {
    form.reset({
      retryAttempts: retryAttempts,
      retryDelay: retryDelay,
      connectionTimeout: connectionTimeout,
    });
  }, [retryAttempts, retryDelay, connectionTimeout, form]);

  const handleReset = () => {
    if (window.confirm("Reset connection settings to defaults?")) {
      setRetryAttempts(3);
      setRetryDelay(2000);
      setConnectionTimeout(10000);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-medium">Connection Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure retry behavior and timeouts for MCP server connections
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retry Configuration</CardTitle>
          <CardDescription>
            How LiteChat handles failed connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <form.Field name="retryAttempts">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Retry Attempts</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="0"
                    max="10"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                    onBlur={field.handleBlur}
                    placeholder="3"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    Number of retry attempts (0-10)
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="retryDelay">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Retry Delay (ms)</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="500"
                    max="30000"
                    step="500"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 2000)}
                    onBlur={field.handleBlur}
                    placeholder="2000"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    Initial delay between retries (500-30000ms)
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="connectionTimeout">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Connection Timeout (ms)</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="1000"
                    max="60000"
                    step="1000"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 10000)}
                    onBlur={field.handleBlur}
                    placeholder="10000"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    Connection timeout (1000-60000ms)
                  </p>
                </div>
              )}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <ul className="list-disc list-inside space-y-1">
              <li>Failed connections will be retried automatically with exponential backoff</li>
              <li>Toast notifications will show connection status and retry progress</li>
              <li>Servers that fail all retry attempts will be marked as disconnected</li>
              <li>You can manually retry connections from the server cards in the Servers tab</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-3 border-t">
        <form.Subscribe>
          {(state) => (
            <div className="flex items-center space-x-2">
              <Button
                type="submit"
                size="sm"
                disabled={!state.canSubmit || state.isSubmitting || state.isValidating || !state.isValid}
              >
                {state.isSubmitting
                  ? "Saving..."
                  : state.isValidating
                  ? "Validating..."
                  : "Save Connection Settings"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                type="button"
              >
                <RotateCcwIcon className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

// Server Form Component
function ServerForm({
  server,
  onSubmit,
  onCancel,
}: {
  server?: McpServerConfig;
  onSubmit: (data: McpServerFormData) => void;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      name: server?.name || "",
      url: server?.url || "",
      description: server?.description || "",
      headers: server?.headers ? JSON.stringify(server.headers, null, 2) : "",
      enabled: server?.enabled ?? true,
    },
    validators: {
      onChangeAsync: mcpServerFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });

  useEffect(() => {
    form.reset({
      name: server?.name || "",
      url: server?.url || "",
      description: server?.description || "",
      headers: server?.headers ? JSON.stringify(server.headers, null, 2) : "",
      enabled: server?.enabled ?? true,
    });
  }, [server, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-medium">
          {server ? "Edit MCP Server" : "Add New MCP Server"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {server
            ? "Modify the server configuration below."
            : "Configure a new MCP server to connect to."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <ServerIcon className="mr-2 h-4 w-4" />
            Server Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Server Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="My MCP Server"
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="url">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Server URL</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="https://api.example.com/mcp or stdio://npx?args=-y,@modelcontextprotocol/server-filesystem,/path"
                />
                <FieldMetaMessages field={field} />
                <p className="text-xs text-muted-foreground">
                  HTTP/HTTPS URLs for remote servers, or stdio:// URLs for local servers via bridge
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Description (Optional)</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Brief description of this server's purpose"
                  rows={2}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="headers">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Authentication Headers (Optional)</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder='{"Authorization": "Bearer your-token-here"}'
                  rows={3}
                />
                <FieldMetaMessages field={field} />
                <p className="text-xs text-muted-foreground">
                  JSON object with authentication headers (not applicable for stdio servers)
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="enabled">
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
          </form.Field>
        </CardContent>
        <CardFooter className="flex gap-2">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting
                  ? (server ? "Updating..." : "Adding...")
                  : (server ? "Update Server" : "Add Server")}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

// Servers List Component
function ServersTab({
  onNewServer,
  onEditServer,
}: {
  onNewServer: () => void;
  onEditServer: (server: McpServerConfig) => void;
}) {
  const { servers, deleteServer, updateServer } = useMcpStore(
    useShallow((state) => ({
      servers: state.servers,
      deleteServer: state.deleteServer,
      updateServer: state.updateServer,
    }))
  );

  const handleDelete = (serverId: string) => {
    if (window.confirm("Are you sure you want to delete this MCP server?")) {
      deleteServer(serverId);
    }
  };

  const handleToggleEnabled = (server: McpServerConfig) => {
    updateServer(server.id, { enabled: !server.enabled });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">MCP Servers</h3>
          <p className="text-sm text-muted-foreground">
            Manage your Model Context Protocol servers
          </p>
        </div>
        <Button onClick={onNewServer}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Server
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ServerIcon className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
          <h4 className="font-medium text-muted-foreground">No MCP Servers</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add HTTP-based MCP servers to extend LiteChat with additional tools and capabilities
          </p>
          <Button onClick={onNewServer}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Your First Server
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map((server) => (
              <TableRow key={server.id}>
                <TableCell className="font-medium">{server.name}</TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs">
                  {server.url}
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {server.description || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={() => handleToggleEnabled(server)}
                      className="scale-75"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditServer(server)}
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export const SettingsAssistantMcp: React.FC = () => {
  const [activeTab, setActiveTab] = useState("servers");
  const [editingServer, setEditingServer] = useState<McpServerConfig | undefined>();

  const { addServer, updateServer } = useMcpStore(
    useShallow((state) => ({
      addServer: state.addServer,
      updateServer: state.updateServer,
    }))
  );

  const handleCreateServer = async (data: McpServerFormData) => {
    try {
      const headers = data.headers ? JSON.parse(data.headers) : undefined;
      addServer({
        name: data.name,
        url: data.url,
        description: data.description,
        headers,
        enabled: data.enabled,
      });
      setActiveTab("servers");
    } catch (error) {
      console.error("Invalid headers JSON:", error);
      toast.error("Invalid JSON in headers field");
    }
  };

  const handleUpdateServer = async (data: McpServerFormData) => {
    if (!editingServer) return;
    try {
      const headers = data.headers ? JSON.parse(data.headers) : undefined;
      updateServer(editingServer.id, {
        name: data.name,
        url: data.url,
        description: data.description,
        headers,
        enabled: data.enabled,
      });
      setActiveTab("servers");
      setEditingServer(undefined);
    } catch (error) {
      console.error("Invalid headers JSON:", error);
      toast.error("Invalid JSON in headers field");
    }
  };

  const handleNewServer = () => {
    setEditingServer(undefined);
    setActiveTab("new");
  };

  const handleEditServer = (server: McpServerConfig) => {
    setEditingServer(server);
    setActiveTab("edit");
  };

  const handleFormCancel = () => {
    setActiveTab("servers");
    setEditingServer(undefined);
  };

  const tabs: TabDefinition[] = [
    {
      value: "servers",
      label: "Servers",
      content: (
        <ServersTab
          onNewServer={handleNewServer}
          onEditServer={handleEditServer}
        />
      ),
    },
    {
      value: "bridge",
      label: "Bridge Config",
      content: <BridgeConfigurationTab />,
    },
    {
      value: "connection",
      label: "Connection",
      content: <ConnectionSettingsTab />,
    },
    {
      value: "new",
      label: "Add Server",
      content: (
        <ServerForm
          key="new-server-form"
          onSubmit={handleCreateServer}
          onCancel={handleFormCancel}
        />
      ),
    },
  ];

  // Add edit tab dynamically when editing
  if (editingServer) {
    tabs.push({
      value: "edit",
      label: `Edit: ${editingServer.name}`,
      content: (
        <ServerForm
          key={`edit-server-form-${editingServer.id}`}
          server={editingServer}
          onSubmit={handleUpdateServer}
          onCancel={handleFormCancel}
        />
      ),
    });
  }

  return (
    <TabbedLayout
      tabs={tabs}
      initialValue={activeTab}
      onValueChange={setActiveTab}
      defaultValue="servers"
      contentContainerClassName="pb-2 sm:pb-6 pr-1 sm:pr-2 -mr-1 sm:-mr-2"
      scrollable={false}
    />
  );
};
