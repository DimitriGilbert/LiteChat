# Runnable Code Blocks - Granular Control System

LiteChat's runnable JavaScript and Python blocks now implement a flexible, extensible control system that follows the "control rule" pattern for maximum granularity and future extensibility.

## Granular Control Architecture

The new system replaces hardcoded settings with a flexible configuration approach:

### Key Features

- **Per-Block Type Configuration**: Enable/disable each block type individually (JavaScript, Python, future types)
- **Individual Security Settings**: Configure security validation per block type 
- **Off by Default**: Advanced feature that requires explicit activation
- **Future-Extensible**: No hardcoding - new block types can be added without code changes
- **Advanced Settings Integration**: Only visible when advanced settings are enabled

### Control Pattern

Following the established control rule system pattern:

```typescript
// Settings structure (similar to controlRuleAlwaysOn)
runnableBlockConfig: Record<string, { enabled: boolean; securityEnabled: boolean }>

// Example configuration
{
  "javascript": { enabled: true, securityEnabled: true },
  "python": { enabled: false, securityEnabled: true },
  "future-language": { enabled: true, securityEnabled: false }
}
```

### Tab Visibility

The Runnable Blocks settings tab follows the AssistantSettingsModule pattern:
- Only visible when `enableAdvancedSettings` is true
- Automatically registers/unregisters based on advanced settings state
- Clean event-driven visibility management

## Enhanced Context API

When code is executed in runnable blocks, a `litechat` object is available globally with the following structure:

```javascript
// Available in both JavaScript and Python blocks
litechat = {
  // ModApi access for full LiteChat integration
  modApi: LiteChatModApi,
  
  // Context snapshot for current state
  context: {
    selectedConversationId: string | null,
    selectedModelId: string,
    theme: string,
    // ... other context properties
  },
  
  // VFS access for file operations
  vfs: {
    getInstance: (vfsKey: string) => Promise<fs>,
    getCurrentVfsKey: () => string
  },
  
  // Utilities for common operations
  utils: {
    log: (level, ...args) => void,
    toast: (type, message) => void,
    generateId: () => string,
    emit: (eventName, payload) => void,
    on: (eventName, callback) => function
  },
  
  // Preview management for graphical output
  preview: {
    createTarget: (id?) => {
      id: string,
      render: (content) => void,
      clear: () => void,
      remove: () => void
    }
  }
}
```

## Security Validation System

### AI-Powered Analysis

The security system provides granular, AI-powered code analysis:

- **Risk Scoring**: 0-100 scale with clear risk categories
- **Color-Coded UI**: Visual risk indication with smooth color transitions
- **Multi-Click Confirmation**: Progressive confirmation based on risk level
- **Configurable Models**: Use any available AI model for security analysis
- **Custom Prompts**: Fully customizable security analysis prompts

### Security Levels

```
0-30:   Safe (green) - Basic operations, calculations, simple DOM manipulation
31-60:  Moderate (yellow) - File operations, network requests, eval usage (requires 1 confirmation)
61-90:  High (orange-red) - System commands, dangerous APIs (requires 3 clicks)
91-100: Extreme (bright red) - Malware, destructive operations (requires 3 clicks + alert)
```

### Implementation Status

#### ✅ Completed Components

1. **Settings System Integration**
   - New granular settings events and store structure
   - Per-block configuration support
   - Global security model and prompt settings

2. **Settings UI Module**
   - Advanced settings visibility integration
   - Dynamic tab registration/unregistration
   - Clean event-driven architecture

3. **Security Validation Service**
   - AI-powered risk analysis following RulesControlModule pattern
   - Color interpolation system (green → yellow → red)
   - Progressive confirmation logic
   - Proper interaction logging

4. **Enhanced Block Renderers**
   - Security-aware JavaScript and Python renderers
   - Color-coded run buttons with dynamic styling
   - Multi-click confirmation system
   - Real-time security status display

#### 🚧 In Progress

- Store type system updates for full granular support
- Complete event system integration
- Migration from hardcoded to per-block configuration

#### 🔮 Future Enhancements

- Additional language support (R, SQL, etc.)
- Custom execution environments per language
- Advanced security policies
- Block-specific timeout and resource limits

## Migration Path

The system is designed for backward compatibility:

1. **Phase 1**: Advanced settings visibility (✅ Complete)
2. **Phase 2**: Security system integration (✅ Complete) 
3. **Phase 3**: Full granular configuration (🚧 In Progress)
4. **Phase 4**: Additional language support (🔮 Future)

## Configuration Examples

### Basic Enable/Disable

```typescript
// Enable JavaScript blocks with security
setRunnableBlockConfig("javascript", { enabled: true, securityEnabled: true });

// Disable Python blocks
setRunnableBlockConfig("python", { enabled: false, securityEnabled: true });
```

### Security Model Configuration

```typescript
// Set global security model for all blocks
setRunnableBlocksGlobalSecurityModelId("anthropic/claude-3-5-sonnet-20241022");

// Customize security analysis prompt
setRunnableBlocksGlobalSecurityPrompt(`
Analyze this code for security risks. Rate 0-100:
- 0-30: Safe operations
- 31-60: Moderate risk  
- 61-90: High risk
- 91-100: Dangerous

Code: {{code}}

Return only the numeric score.
`);
```

## JavaScript Examples

### Basic Context Access

```js
// Log current context information
console.log("Current conversation:", litechat.context.selectedConversationId);
console.log("Current model:", litechat.context.selectedModelId);
console.log("Current theme:", litechat.context.theme);

// Show a toast notification
litechat.utils.toast("success", "Hello from runnable JavaScript!");

// Generate a unique ID
const myId = litechat.utils.generateId();
console.log("Generated ID:", myId);
```

### VFS File Operations

```js
// Get current VFS instance
const vfsKey = litechat.vfs.getCurrentVfsKey();
console.log("Current VFS key:", vfsKey);

const fs = await litechat.vfs.getInstance(vfsKey);
if (fs) {
  // List files in current directory
  try {
    const files = await fs.promises.readdir("/");
    console.log("Files in root:", files);
  } catch (error) {
    console.error("Error reading files:", error);
  }
}
```

### Creating Interactive Previews

```js
// Create a preview target for dynamic content
const preview = litechat.preview.createTarget("my-chart");

// Generate some data visualization
const chartHtml = `
<div style="padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
  <h3>Sales Data Chart</h3>
  <div style="display: flex; gap: 10px; align-items: end; height: 200px;">
    <div style="background: #3b82f6; width: 30px; height: 80%; display: flex; align-items: end;">
      <span style="color: white; font-size: 12px; writing-mode: vertical-rl;">Q1</span>
    </div>
    <div style="background: #10b981; width: 30px; height: 60%; display: flex; align-items: end;">
      <span style="color: white; font-size: 12px; writing-mode: vertical-rl;">Q2</span>
    </div>
    <div style="background: #f59e0b; width: 30px; height: 90%; display: flex; align-items: end;">
      <span style="color: white; font-size: 12px; writing-mode: vertical-rl;">Q3</span>
    </div>
    <div style="background: #ef4444; width: 30px; height: 70%; display: flex; align-items: end;">
      <span style="color: white; font-size: 12px; writing-mode: vertical-rl;">Q4</span>
    </div>
  </div>
  <p style="margin-top: 10px; color: #666;">Revenue by Quarter (in thousands)</p>
</div>
`;

// Render the chart
preview.render(chartHtml);
```

### Event System Integration

```js
// Listen for conversation changes
const unsubscribe = litechat.utils.on('conversation.selected.item.changed', (payload) => {
  console.log('Conversation changed to:', payload.itemId);
  litechat.utils.toast("info", `Switched to conversation: ${payload.itemId}`);
});

// Emit custom events
litechat.utils.emit('custom.user.event', { message: "Hello from JavaScript!" });
```

## Python Examples

### Basic Context Access

```python
# Log current context information
print(f"Current conversation: {litechat.context.selectedConversationId}")
print(f"Current model: {litechat.context.selectedModelId}")
print(f"Current theme: {litechat.context.theme}")

# Show a toast notification
litechat.utils.toast("success", "Hello from runnable Python!")

# Generate a unique ID
my_id = litechat.utils.generateId()
print(f"Generated ID: {my_id}")
```

### Data Processing Example

```python
import json

# Create some sample data
data = {
    "timestamp": "2024-01-15T10:30:00Z",
    "metrics": {
        "cpu_usage": 75.2,
        "memory_usage": 62.8,
        "disk_usage": 45.1
    },
    "services": ["api", "database", "cache"],
    "alerts": []
}

# Process and display
print("System Metrics Report:")
print(f"Timestamp: {data['timestamp']}")
print("\nMetrics:")
for metric, value in data['metrics'].items():
    status = "⚠️ HIGH" if value > 70 else "✅ OK"
    print(f"  {metric}: {value}% {status}")

print(f"\nActive Services: {', '.join(data['services'])}")
print(f"Active Alerts: {len(data['alerts'])}")

# Create preview with results
preview = litechat.preview.createTarget("system-report")
preview.render(f"""
<div style="font-family: monospace; background: #f5f5f5; padding: 15px; border-radius: 8px;">
  <h3>System Status</h3>
  <p><strong>CPU:</strong> {data['metrics']['cpu_usage']}%</p>
  <p><strong>Memory:</strong> {data['metrics']['memory_usage']}%</p>
  <p><strong>Disk:</strong> {data['metrics']['disk_usage']}%</p>
</div>
""")
```

## Architecture Benefits

### Extensibility
- Add new languages without modifying core code
- Language-specific security policies
- Custom execution environments per language

### Maintainability  
- Clean separation of concerns
- Event-driven architecture
- Consistent with existing control patterns

### User Experience
- Progressive disclosure (advanced settings)
- Visual security feedback
- Granular control when needed

### Security
- Per-language security policies
- AI-powered risk analysis
- Progressive confirmation system
- Configurable security models and prompts

This system provides a solid foundation for future expansion while maintaining the clean, modular architecture that LiteChat is known for. 