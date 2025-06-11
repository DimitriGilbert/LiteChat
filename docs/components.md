# UI Component Development Guide

This guide covers LiteChat's UI component architecture, patterns, and development practices. LiteChat uses React with TypeScript, shadcn/ui components, and Tailwind CSS for styling.

## Component Architecture

### UI Component Library

LiteChat uses **shadcn/ui** as its foundational component library, providing:

- **Consistent Design System**: Based on Radix UI primitives with Tailwind CSS styling
- **Accessibility**: Built-in ARIA attributes and keyboard navigation
- **Customization**: CSS variables for theming and visual consistency
- **Type Safety**: Full TypeScript support with proper component typing

#### Configuration

The shadcn/ui setup is configured in `components.json`:

```json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### Component Organization

```
src/components/
├── ui/                          # shadcn/ui base components
│   ├── button.tsx              # Button variants and styling
│   ├── input.tsx               # Form input components
│   ├── dialog.tsx              # Modal dialogs
│   ├── dropdown-menu.tsx       # Dropdown menus
│   ├── select.tsx              # Select components
│   ├── card.tsx                # Card layouts
│   ├── badge.tsx               # Status badges
│   ├── alert.tsx               # Alert notifications
│   └── ...                     # Other UI primitives
├── LiteChat/                    # Application-specific components
│   ├── canvas/                 # Canvas and interaction area
│   ├── chat/                   # Chat interface components
│   ├── common/                 # Shared components
│   ├── file-manager/           # VFS file management
│   └── prompt/                 # Prompt engineering UI
└── controls/components/         # Control module UI components
    ├── assistant-settings/
    ├── conversation-list/
    ├── provider-settings/
    ├── prompt/                 # Prompt-related components
    │   ├── PromptLibraryControl.tsx    # Main prompt library dialog
    │   └── ...
    └── ...
```

## Component Patterns

### 1. Base UI Components

All base UI components use the shadcn/ui pattern with:

#### Variant System
```typescript
// Example: Button component variants
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
```

#### Data Slots
Components use `data-slot` attributes for semantic identification:
```typescript
function Button({ className, variant, size, ...props }) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

### 2. Form Components

#### Input Components
```typescript
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}
```

#### Form Validation
Components support ARIA validation attributes:
- `aria-invalid`: Applied automatically for validation states
- Focus rings change color based on validation state
- Error states use destructive color variants

### 3. Layout Components

#### Card System
```typescript
function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}
```

#### Grid and Flexbox Patterns
- Use CSS Grid for complex layouts
- Flexbox for simple alignment
- Container queries with `@container` for responsive design

### 4. Interactive Components

#### Dropdown Menus
```typescript
// Usage pattern for dropdown menus
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Action 1</DropdownMenuItem>
    <DropdownMenuItem>Action 2</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### Dialog Pattern
```typescript
// Modal dialog usage
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

## Development Patterns

### 1. TypeScript Component Props

#### Extending HTML Elements
```typescript
// Extend native element props
interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}
```

#### Compound Components
```typescript
// Component with sub-components
interface SelectProps extends React.ComponentProps<typeof SelectPrimitive.Root> {
  // Select-specific props
}

interface SelectTriggerProps extends React.ComponentProps<typeof SelectPrimitive.Trigger> {
  size?: "sm" | "default"
}
```

### 2. Styling Patterns

#### CSS Variables for Theming
```css
:root {
  --primary: 222.2 84% 4.9%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 84% 4.9%;
  /* ... */
}
```

#### Conditional Styling
```typescript
// Using class-variance-authority for conditional classes
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive: "text-destructive bg-card [&>svg]:text-current"
      }
    }
  }
)
```

#### State-Based Styling
```typescript
// Data attributes for component state
className={cn(
  "transition-colors",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[variant=destructive]:text-destructive",
  "disabled:pointer-events-none disabled:opacity-50"
)}
```

### 3. Component Composition

#### Compound Component Pattern
```typescript
// Export main component and sub-components
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction
}
```

#### AsChild Pattern (Radix)
```typescript
// Allow component to merge with child element
function Button({ asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button"
  return <Comp {...props} />
}

// Usage
<Button asChild>
  <Link to="/dashboard">Go to Dashboard</Link>
</Button>
```

### 4. Event Handling

#### Form Events
```typescript
// Proper form event typing
function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const formData = new FormData(event.currentTarget)
  // Process form data
}
```

#### Custom Events
```typescript
// Use proper event emitter patterns
interface ComponentProps {
  onValueChange?: (value: string) => void
  onError?: (error: Error) => void
}
```

## Best Practices

### 1. Component Design

#### Single Responsibility
- Each component should have one clear purpose
- Break complex components into smaller, focused pieces
- Use composition over inheritance

#### Props Interface Design
```typescript
// Good: Clear, specific props
interface FileUploaderProps {
  acceptedTypes: string[]
  maxFileSize: number
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

// Avoid: Overly generic props
interface GenericComponentProps {
  data: any
  options: Record<string, any>
}
```

### 2. Performance

#### Memoization
```typescript
// Memoize expensive computations
const ExpensiveComponent = React.memo(({ data }: { data: ComplexData[] }) => {
  const processedData = useMemo(() => {
    return data.map(item => expensiveTransform(item))
  }, [data])

  return <div>{/* Render processed data */}</div>
})
```

#### Event Handler Optimization
```typescript
// Use useCallback for event handlers passed to children
const handleItemClick = useCallback((id: string) => {
  // Handle click
}, [])
```

### 3. Accessibility

#### ARIA Attributes
```typescript
// Proper ARIA labeling
<button
  aria-label="Close dialog"
  aria-expanded={isOpen}
  aria-controls="dialog-content"
>
  <XIcon />
</button>
```

#### Keyboard Navigation
```typescript
// Handle keyboard events
function handleKeyDown(event: React.KeyboardEvent) {
  if (event.key === 'Escape') {
    onClose()
  }
  if (event.key === 'Enter' || event.key === ' ') {
    onActivate()
  }
}
```

### 4. Error Handling

#### Error Boundaries
```typescript
// Use error boundaries for component error handling
class ComponentErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Component error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
```

#### Graceful Degradation
```typescript
// Handle loading and error states
function DataComponent({ dataId }: { dataId: string }) {
  const { data, loading, error } = useData(dataId)

  if (loading) return <Skeleton />
  if (error) return <Alert variant="destructive">{error.message}</Alert>
  if (!data) return <div>No data available</div>

  return <div>{/* Render data */}</div>
}
```

## Testing Components

### 1. Unit Testing

#### Component Testing Pattern
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  it('renders with correct variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toHaveClass('bg-destructive')
  })

  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
  })
})
```

### 2. Visual Testing

#### Storybook Integration
```typescript
// Component stories for visual testing
export default {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
}

export const Default = {
  args: {
    children: 'Button',
  },
}

export const Variants = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
    </div>
  ),
}
```

## Integration with LiteChat Architecture

### 1. Control Module Components

Components within control modules should:
- Use the event system for communication
- Access state through Zustand stores
- Follow the module's lifecycle patterns

### 2. Event-Driven Updates

```typescript
// Component responding to events
function ProviderStatus() {
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    const handler = (payload: { status: string }) => {
      setStatus(payload.status)
    }

    eventEmitter.on(providerEvent.fetchStatusChanged, handler)
    return () => eventEmitter.off(providerEvent.fetchStatusChanged, handler)
  }, [])

  return <Badge variant={status === 'error' ? 'destructive' : 'default'}>{status}</Badge>
}
```

### 3. Store Integration

```typescript
// Using Zustand stores in components
function ConversationList() {
  const { conversations, selectedId } = useConversationStore(useShallow(state => ({
    conversations: state.conversations,
    selectedId: state.selectedConversationId
  })))

  return (
    <div>
      {conversations.map(conv => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isSelected={conv.id === selectedId}
        />
      ))}
    </div>
  )
}
```

### Prompt Library Components

The prompt library system provides components for managing and applying reusable prompt templates:

#### PromptLibraryControl
Main component that renders the prompt library interface.

```typescript
interface PromptLibraryControlProps {
  module: PromptLibraryControlModule;
}

export const PromptLibraryControl: React.FC<PromptLibraryControlProps> = ({ module }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);

  const handleFormSubmit = async (formData: PromptFormData) => {
    if (!selectedTemplate) return;
    
    try {
      await module.applyTemplate(selectedTemplate.id, formData);
      setIsModalOpen(false);
      toast.success("Template applied to input area!");
    } catch (error) {
      toast.error("Failed to apply template");
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(true)}>
        <BookOpenText className="h-4 w-4" />
      </Button>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {/* Template selection and form UI */}
      </Dialog>
    </>
  );
};
```

#### PromptTemplateSelector
Browse and filter available templates.

```typescript
function PromptTemplateSelector({ 
  templates, 
  onSelect 
}: { 
  templates: PromptTemplate[]; 
  onSelect: (template: PromptTemplate) => void; 
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, description, or tags..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div className="grid gap-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} onClick={() => onSelect(template)}>
            <CardHeader>
              <CardTitle className="text-sm">{template.name}</CardTitle>
              <CardDescription className="text-xs">{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {template.tags.map(tag => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

#### PromptTemplateForm
Dynamic form generation based on template variables.

```typescript
function PromptTemplateForm({ 
  template, 
  onSubmit, 
  onBack 
}: { 
  template: PromptTemplate; 
  onSubmit: (data: PromptFormData) => void; 
  onBack: () => void; 
}) {
  // Create field configs from template variables
  const fieldConfigs = template.variables.map(variable => ({
    name: variable.name,
    type: variable.type === "boolean" ? "switch" : 
          variable.type === "number" ? "number" : 
          variable.type === "array" ? "textarea" : "text",
    label: variable.name,
    placeholder: variable.default || `Enter ${variable.name}`,
    description: variable.description || variable.instructions,
    required: variable.required,
  }));

  const { Form } = useFormedible({
    fields: fieldConfigs,
    formOptions: {
      defaultValues: getDefaultValues(template),
      onSubmit: async ({ value }) => onSubmit(value)
    }
  });

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <Label className="text-sm font-medium">Template Preview</Label>
        <div className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap">
          {template.prompt}
        </div>
      </div>
      <Form className="space-y-4">
        <Button type="submit" className="w-full">Apply Template</Button>
      </Form>
    </div>
  );
}
```

**Key Features**:
- **Modal Interface**: Uses Dialog component for template selection
- **Search and Filter**: Real-time filtering by name, description, and tags
- **Dynamic Forms**: Auto-generated forms based on template variable definitions
- **Template Preview**: Shows the template structure before variable input
- **Responsive Design**: Adapts to different screen sizes with appropriate modal sizing

This component development guide ensures consistency, maintainability, and integration with LiteChat's broader architecture while leveraging modern React and TypeScript patterns. 