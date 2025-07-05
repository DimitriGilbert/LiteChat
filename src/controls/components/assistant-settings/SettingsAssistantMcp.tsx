import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMcpStore, type McpServerConfig } from "@/store/mcp.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, EditIcon, TrashIcon, ServerIcon, CheckCircleIcon, XCircleIcon, SettingsIcon, RotateCcwIcon } from "lucide-react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";

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

// Bridge configuration uses inline validation

const connectionConfigFormSchema = z.object({
  retryAttempts: z.number().min(0, "Min 0 attempts").max(10, "Max 10 attempts"),
  retryDelay: z.number().min(500, "Min 500ms").max(30000, "Max 30000ms"),
  connectionTimeout: z.number().min(1000, "Min 1000ms").max(60000, "Max 60000ms"),
  maxResponseSize: z.number().min(1000, "Min 1KB").max(10000000, "Max 10MB"),
});

// Type inference from schemas
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
  const { t } = useTranslation('assistantSettings');
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
    if (window.confirm(t('mcp.bridge.resetConfirm'))) {
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
        <h3 className="font-medium">{t('mcp.bridge.dynamicConfiguration')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('mcp.bridge.configDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <SettingsIcon className="mr-2 h-4 w-4" />
            {t('mcp.bridge.location')}
          </CardTitle>
          <CardDescription>
            {t('mcp.bridge.locationDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="url">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.bridge.fullUrl')}</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="http://192.168.1.100:3001"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('mcp.bridge.fullUrlDescription')}
                  </p>
                  <FieldMetaMessages field={field} />
                </div>
              )}
            </form.Field>
            
            <div className="space-y-2">
              <Label>{t('mcp.bridge.hostPort')}</Label>
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
                {t('mcp.bridge.hostPortDescription')}
              </p>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-medium mb-1">{t('mcp.bridge.detectionPriority')}</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>{t('mcp.bridge.priority1')}</li>
              <li>{t('mcp.bridge.priority2')}</li>
              <li>{t('mcp.bridge.priority3')}</li>
            </ol>
            <p className="mt-2 text-xs">
              {t('mcp.bridge.priorityNote')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mcp.bridge.setupInstructions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p className="font-medium">{t('mcp.bridge.instructionsText')}</p>
            <div className="bg-muted p-3 rounded font-mono text-xs">
              <p># {t('mcp.bridge.startBridge')}</p>
              <p>node bin/mcp-bridge.js</p>
              <p></p>
              <p># {t('mcp.bridge.customSettings')}</p>
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
                  ? t('common.saving')
                  : state.isValidating
                  ? t('common.validating')
                  : t('mcp.bridge.saveConfig')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                type="button"
              >
                <RotateCcwIcon className="mr-2 h-4 w-4" />
                {t('common.reset')}
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
  const { t } = useTranslation('assistantSettings');
  const {
    retryAttempts,
    retryDelay,
    connectionTimeout,
    maxResponseSize,
    setRetryAttempts,
    setRetryDelay,
    setConnectionTimeout,
    setMaxResponseSize,
  } = useMcpStore(
    useShallow((state) => ({
      retryAttempts: state.retryAttempts,
      retryDelay: state.retryDelay,
      connectionTimeout: state.connectionTimeout,
      maxResponseSize: state.maxResponseSize,
      setRetryAttempts: state.setRetryAttempts,
      setRetryDelay: state.setRetryDelay,
      setConnectionTimeout: state.setConnectionTimeout,
      setMaxResponseSize: state.setMaxResponseSize,
    }))
  );

  const form = useForm({
    defaultValues: {
      retryAttempts: retryAttempts,
      retryDelay: retryDelay,
      connectionTimeout: connectionTimeout,
      maxResponseSize: maxResponseSize,
    },
    validators: {
      onChangeAsync: connectionConfigFormSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      setRetryAttempts(value.retryAttempts);
      setRetryDelay(value.retryDelay);
      setConnectionTimeout(value.connectionTimeout);
      setMaxResponseSize(value.maxResponseSize);
    },
  });

  // Update form when store changes
  useEffect(() => {
    form.reset({
      retryAttempts: retryAttempts,
      retryDelay: retryDelay,
      connectionTimeout: connectionTimeout,
      maxResponseSize: maxResponseSize,
    });
  }, [retryAttempts, retryDelay, connectionTimeout, maxResponseSize, form]);

  const handleReset = () => {
    if (window.confirm(t('mcp.connection.resetConfirm'))) {
      setRetryAttempts(3);
      setRetryDelay(2000);
      setConnectionTimeout(10000);
      setMaxResponseSize(128000); // 128KB default
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
        <h3 className="font-medium">{t('mcp.connection.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('mcp.connection.description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mcp.connection.retryConfiguration')}</CardTitle>
          <CardDescription>
            {t('mcp.connection.retryDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <form.Field name="retryAttempts">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.retryAttempts')}</Label>
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
                    {t('mcp.connection.retryAttemptsHelp')}
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="retryDelay">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.retryDelay')}</Label>
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
                    {t('mcp.connection.retryDelayHelp')}
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="connectionTimeout">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.timeout')}</Label>
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
                    {t('mcp.connection.timeoutHelp')}
                  </p>
                </div>
              )}
            </form.Field>
            
            <form.Field name="maxResponseSize">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('mcp.connection.maxResponseSize')}</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min="1000"
                    max="10000000"
                    step="1000"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(parseInt(e.target.value) || 128000)}
                    onBlur={field.handleBlur}
                    placeholder="128000"
                  />
                  <FieldMetaMessages field={field} />
                  <p className="text-xs text-muted-foreground">
                    {t('mcp.connection.maxResponseSizeHelp')}
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
              <li><strong>Max Response Size:</strong> Tool responses larger than this limit will be automatically truncated to prevent API errors</li>
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
                  ? t('common.saving')
                  : state.isValidating
                  ? t('common.validating')
                  : t('mcp.connection.saveSettings')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                type="button"
              >
                <RotateCcwIcon className="mr-2 h-4 w-4" />
                {t('common.reset')}
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
  const { t } = useTranslation('assistantSettings');
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
          {server ? t('mcp.server.editTitle') : t('mcp.server.addTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {server
            ? t('mcp.server.editDescription')
            : t('mcp.server.addDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <ServerIcon className="mr-2 h-4 w-4" />
            {t('mcp.server.details')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.nameLabel')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.namePlaceholder')}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="url">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.urlLabel')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.urlPlaceholder')}
                />
                <FieldMetaMessages field={field} />
                <p className="text-xs text-muted-foreground">
                  {t('mcp.server.urlHelp')}
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.descriptionLabel')}</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.descriptionPlaceholder')}
                  rows={2}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="headers">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('mcp.server.headersLabel')}</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('mcp.server.headersPlaceholder')}
                  rows={3}
                />
                <FieldMetaMessages field={field} />
                <p className="text-xs text-muted-foreground">
                  {t('mcp.server.headersHelp')}
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
                <Label htmlFor={field.name}>{t('mcp.server.enableLabel')}</Label>
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
                  ? (server ? t('mcp.server.updating') : t('mcp.server.adding'))
                  : (server ? t('mcp.server.updateButton') : t('mcp.server.addButton'))}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
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
  const { t } = useTranslation('assistantSettings');
  const { servers, deleteServer, updateServer } = useMcpStore(
    useShallow((state) => ({
      servers: state.servers,
      deleteServer: state.deleteServer,
      updateServer: state.updateServer,
    }))
  );

  const handleDelete = (serverId: string) => {
    if (window.confirm(t('mcp.server.deleteConfirm'))) {
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
          <h3 className="font-medium">{t('mcp.servers.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('mcp.servers.description')}
          </p>
        </div>
        <Button onClick={onNewServer}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {t('mcp.servers.addButton')}
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ServerIcon className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
          <h4 className="font-medium text-muted-foreground">{t('mcp.servers.noServers')}</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t('mcp.servers.noServersDescription')}
          </p>
          <Button onClick={onNewServer}>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('mcp.servers.addFirstButton')}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('mcp.servers.nameColumn')}</TableHead>
              <TableHead>{t('mcp.servers.urlColumn')}</TableHead>
              <TableHead>{t('mcp.servers.statusColumn')}</TableHead>
              <TableHead>{t('mcp.servers.descriptionColumn')}</TableHead>
              <TableHead className="text-right">{t('mcp.servers.actionsColumn')}</TableHead>
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
                        {t('mcp.servers.enabled')}
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="mr-1 h-3 w-3" />
                        {t('mcp.servers.disabled')}
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
  const { t } = useTranslation('assistantSettings');
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
      toast.error(t('mcp.server.invalidHeaders'));
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
      toast.error(t('mcp.server.invalidHeaders'));
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
      label: t('mcp.tabs.servers'),
      content: (
        <ServersTab
          onNewServer={handleNewServer}
          onEditServer={handleEditServer}
        />
      ),
    },
    {
      value: "bridge",
      label: t('mcp.tabs.bridge'),
      content: <BridgeConfigurationTab />,
    },
    {
      value: "connection",
      label: t('mcp.tabs.connection'),
      content: <ConnectionSettingsTab />,
    },
    {
      value: "new",
      label: t('mcp.tabs.addServer'),
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
      label: t('mcp.tabs.editServer', { name: editingServer.name }),
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
      scrollable={false}
    />
  );
};
