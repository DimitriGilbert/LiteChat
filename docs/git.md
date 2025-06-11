# Git Integration

LiteChat provides comprehensive Git integration enabling version control workflows, conversation synchronization, and collaborative development directly within the browser. All Git operations are performed using `isomorphic-git` on the Virtual File System.

## Architecture Overview

### Core Components

- **Git Tools Module** ([`src/controls/modules/GitToolsModule.ts`](../src/controls/modules/GitToolsModule.ts)) - AI tools for Git operations
- **VFS Git Operations** ([`src/lib/litechat/vfs-git-operations.ts`](../src/lib/litechat/vfs-git-operations.ts)) - Git operations on VFS
- **Conversation Sync** - Links conversations to Git repositories
- **Sync VFS** - Dedicated `sync_repos` Virtual File System for Git operations

### Git Library Integration

LiteChat uses `isomorphic-git` for browser-based Git operations:

```typescript
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

// All operations work directly on the VFS filesystem
await git.clone({
  fs,
  http,
  dir: '/repo',
  url: 'https://github.com/user/repo.git'
});
```

## Sync Repositories

### Repository Configuration

Git repositories are configured in Settings → Git → Sync Repositories:

```typescript
interface SyncRepo {
  id: string;
  name: string;
  url: string;              // HTTPS Git URL
  username?: string;        // Git username (optional)
  password?: string;        // Personal access token
  createdAt: Date;
}
```

### Supported Authentication

- **Public Repositories**: No authentication required
- **Private Repositories**: Username/password or username/token
- **Personal Access Tokens**: Recommended for private repositories
- **GitHub**: Use personal access tokens instead of passwords

### Repository Management

```typescript
// Add sync repository
emitter.emit(conversationEvent.addSyncRepoRequest, {
  name: "My Project",
  url: "https://github.com/user/project.git",
  username: "user",
  password: "ghp_token123"
});

// Update repository
emitter.emit(conversationEvent.updateSyncRepoRequest, {
  id: "repo-id",
  updates: { password: "new-token" }
});

// Delete repository
emitter.emit(conversationEvent.deleteSyncRepoRequest, {
  id: "repo-id"
});
```

## Conversation Sync

### Linking Conversations

Conversations can be linked to configured sync repositories:

```typescript
// Link conversation to repository
emitter.emit(conversationEvent.linkConversationToRepoRequest, {
  conversationId: "conv-id",
  repoId: "repo-id"
});

// Unlink conversation
emitter.emit(conversationEvent.unlinkConversationFromRepoRequest, {
  conversationId: "conv-id"
});
```

### Sync Directory Structure

Conversations are synchronized as JSON files within the repository:

```
repository/
├── .litechat/
│   └── conversations/
│       ├── conv-123.json
│       ├── conv-456.json
│       └── metadata.json
├── src/
├── docs/
└── README.md
```

### Conversation JSON Format

```json
{
  "id": "conv-123",
  "title": "Implement user authentication",
  "projectId": "project-abc",
  "metadata": {
    "tags": ["feature", "auth"],
    "syncedAt": "2024-01-01T12:00:00Z"
  },
  "interactions": [
    {
      "id": "int-1",
      "type": "message.user_assistant",
      "prompt": {
        "text": "How should I implement authentication?",
        "metadata": {}
      },
      "response": "Here's how you can implement authentication...",
      "status": "COMPLETED",
      "startedAt": "2024-01-01T12:00:00Z",
      "endedAt": "2024-01-01T12:01:30Z"
    }
  ]
}
```

### Sync Operations

```typescript
// Sync specific conversation
emitter.emit(conversationEvent.syncConversationRequest, {
  conversationId: "conv-id"
});

// Sync all linked conversations for a repository
emitter.emit(conversationEvent.syncAllConversationsRequest, {
  repoId: "repo-id"
});
```

## Git Tools for AI

### Available Tools

The Git Tools Module provides AI-accessible Git operations:

#### Repository Status
```typescript
// git_status tool
{
  "name": "git_status",
  "description": "Get the current status of the Git repository",
  "parameters": {
    "type": "object",
    "properties": {
      "detailed": {
        "type": "boolean",
        "description": "Include detailed file status"
      }
    }
  }
}
```

#### File Staging
```typescript
// git_add tool
{
  "name": "git_add", 
  "description": "Stage files for commit",
  "parameters": {
    "type": "object",
    "properties": {
      "files": {
        "type": "array",
        "items": { "type": "string" },
        "description": "File paths to stage"
      }
    },
    "required": ["files"]
  }
}
```

#### Commit Creation
```typescript
// git_commit tool
{
  "name": "git_commit",
  "description": "Create a commit with staged changes",
  "parameters": {
    "type": "object", 
    "properties": {
      "message": {
        "type": "string",
        "description": "Commit message"
      },
      "author": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "email": { "type": "string" }
        }
      }
    },
    "required": ["message"]
  }
}
```

#### Remote Operations
```typescript
// git_push tool
{
  "name": "git_push",
  "description": "Push commits to remote repository",
  "parameters": {
    "type": "object",
    "properties": {
      "remote": {
        "type": "string", 
        "default": "origin"
      },
      "branch": {
        "type": "string",
        "default": "main"
      }
    }
  }
}

// git_pull tool  
{
  "name": "git_pull",
  "description": "Pull changes from remote repository",
  "parameters": {
    "type": "object",
    "properties": {
      "remote": { "type": "string", "default": "origin" },
      "branch": { "type": "string", "default": "main" }
    }
  }
}
```

### Tool Implementation Example

```typescript
// Git status tool implementation
const gitStatusImplementation = async (
  { detailed = false }: { detailed?: boolean },
  context: ToolContext
) => {
  try {
    const fs = await VfsOps.initializeFsOp("sync_repos");
    if (!fs) throw new Error("VFS not available");

    const status = await git.statusMatrix({
      fs,
      dir: "/repository",
    });

    const result = status.map(([filepath, headStatus, workdirStatus, stageStatus]) => ({
      file: filepath,
      status: getFileStatus(headStatus, workdirStatus, stageStatus),
      staged: stageStatus !== 0,
      modified: workdirStatus !== headStatus
    }));

    return {
      success: true,
      files: result,
      summary: `${result.length} files tracked`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

## VFS Git Operations

### Low-Level Git Operations

Core Git operations are implemented in `vfs-git-operations.ts`:

```typescript
// Clone repository
export const cloneRepositoryOp = async (
  url: string,
  targetDir: string,
  auth?: { username: string; password: string },
  options?: { fsInstance?: typeof fs }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  
  await git.clone({
    fs: fsToUse,
    http,
    dir: targetDir,
    url,
    ...(auth && {
      onAuth: () => auth
    })
  });
};

// Get repository status
export const getStatusOp = async (
  repoDir: string,
  options?: { fsInstance?: typeof fs }
): Promise<GitFileStatus[]> => {
  const fsToUse = options?.fsInstance ?? fs;
  
  const status = await git.statusMatrix({
    fs: fsToUse,
    dir: repoDir
  });
  
  return status.map(parseFileStatus);
};

// Create commit
export const commitOp = async (
  repoDir: string,
  message: string,
  author: { name: string; email: string },
  options?: { fsInstance?: typeof fs }
): Promise<string> => {
  const fsToUse = options?.fsInstance ?? fs;
  
  const sha = await git.commit({
    fs: fsToUse,
    dir: repoDir,
    message,
    author
  });
  
  return sha;
};
```

### Authentication Handling

```typescript
// Authentication for private repositories
const authCallback = (url: string, auth: AuthInfo) => {
  return {
    username: auth.username,
    password: auth.password // Personal access token
  };
};

// Used in Git operations
await git.push({
  fs,
  http,
  dir: repoDir,
  remote: "origin",
  ref: "main",
  onAuth: () => authCallback(repoUrl, authInfo)
});
```

## User Interface

### Git Settings Panel

Settings → Git provides:

- **User Configuration**: Git user name and email for commits
- **Sync Repositories**: Add, edit, and delete sync repositories
- **Repository Status**: View sync status and last sync times

### Conversation Sync UI

In conversation settings:

- **Link Repository**: Dropdown to select configured sync repository
- **Sync Status**: Visual indicator of sync state
- **Manual Sync**: Button to trigger immediate sync
- **Sync History**: Log of sync operations and results

### Project Integration

Projects can be configured with default sync repositories:

```typescript
interface ProjectSettings {
  defaultSyncRepoId?: string;   // Auto-link new conversations
  autoSync?: boolean;           // Automatic sync on conversation updates
  syncBranch?: string;          // Target branch for syncing
}
```

## Sync Status Management

### Status Types

```typescript
type SyncStatus = 
  | "not_synced"     // Never synced
  | "synced"         // Up to date  
  | "pending"        // Sync in progress
  | "conflict"       // Merge conflict
  | "error";         // Sync failed

interface ConversationSyncStatus {
  conversationId: string;
  repoId: string;
  status: SyncStatus;
  lastSyncAt?: Date;
  lastError?: string;
  conflictDetails?: ConflictInfo;
}
```

### Conflict Resolution

When sync conflicts occur:

1. **Detection**: Compare local and remote conversation timestamps
2. **User Choice**: Present conflict resolution options
3. **Resolution Strategies**:
   - Keep local version
   - Use remote version  
   - Manual merge (show diff)
   - Create branch for local changes

### Automatic Sync

```typescript
// Configure automatic sync
const autoSyncSettings = {
  enabled: true,
  interval: 300, // 5 minutes
  onConversationUpdate: true,
  onInteractionComplete: true
};

// Trigger conditions
- New interaction completed
- Conversation title changed
- Conversation metadata updated
- Manual trigger from UI
```

## Error Handling

### Common Error Scenarios

```typescript
// Authentication errors
- Invalid credentials
- Token expired
- Repository access denied

// Network errors  
- No internet connection
- Repository server unavailable
- Timeout during operations

// Git errors
- Merge conflicts
- Repository not found
- Invalid Git URL
- File permission issues

// VFS errors
- Filesystem not initialized
- Insufficient storage space
- Corrupted repository state
```

### Error Recovery

```typescript
// Automatic retry logic
const retryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  retryableErrors: [
    "NetworkError",
    "TimeoutError",
    "TemporaryError"
  ]
};

// Manual recovery options
- Retry failed operation
- Reset repository state
- Re-clone repository
- Update authentication
```

## Security Considerations

### Credential Storage

- Credentials stored encrypted in IndexedDB
- No server-side credential storage
- Personal access tokens recommended over passwords
- Automatic credential validation

### Repository Access

- HTTPS-only repository URLs
- No SSH key support (browser limitation)
- Sandboxed Git operations within VFS
- No arbitrary command execution

### Data Privacy

- Conversations only synced to explicitly configured repositories
- No automatic cloud sync without user consent
- Local-first with optional remote sync
- Full user control over sync scope and timing

## Development Guide

### Adding Custom Git Tools

1. **Define Tool Schema**:
   ```typescript
   const customGitTool = z.object({
     operation: z.enum(["log", "diff", "branch"]),
     options: z.record(z.any()).optional()
   });
   ```

2. **Implement Tool Logic**:
   ```typescript
   const implementation = async (params, context) => {
     const fs = await VfsOps.initializeFsOp("sync_repos");
     // Implement Git operation
     return result;
   };
   ```

3. **Register Tool**:
   ```typescript
   modApi.registerTool("custom_git", schema, implementation);
   ```

### Extending Sync Functionality

```typescript
// Custom sync handlers
const customSyncHandler = {
  canHandle: (repoUrl: string) => repoUrl.includes("custom-git.com"),
  authenticate: (credentials) => customAuth(credentials),
  sync: (conversation, repoConfig) => customSyncLogic(conversation, repoConfig)
};

// Register custom handler
registerSyncHandler(customSyncHandler);
```

### Testing Git Operations

```typescript
// Mock Git operations for testing
const mockGitOps = {
  clone: jest.fn(),
  commit: jest.fn(), 
  push: jest.fn(),
  status: jest.fn()
};

// Test sync workflow
test("conversation sync workflow", async () => {
  const conversation = createTestConversation();
  const repo = createTestRepo();
  
  await syncConversation(conversation, repo);
  
  expect(mockGitOps.commit).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining(conversation.title)
    })
  );
});
```

## Configuration Examples

### Development Repository

```typescript
{
  "name": "Development Repo",
  "url": "https://github.com/user/litechat-dev.git",
  "username": "user",
  "password": "ghp_development_token",
  "autoSync": true,
  "branch": "conversations"
}
```

### Team Collaboration

```typescript
{
  "name": "Team Conversations", 
  "url": "https://github.com/team/project-conversations.git",
  "username": "bot-user",
  "password": "ghp_team_access_token",
  "autoSync": false, // Manual sync for review
  "conflictStrategy": "manual"
}
```

### Personal Backup

```typescript
{
  "name": "Personal Backup",
  "url": "https://github.com/user/litechat-backup.git", 
  "username": "user",
  "password": "ghp_backup_token",
  "autoSync": true,
  "syncInterval": 900, // 15 minutes
  "includeMetadata": true
}
``` 