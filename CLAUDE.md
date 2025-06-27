# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Tools

- Runtime: Bun 1.2.11
- TypeScript with strict mode enabled
- Prettier for code formatting

## Common Development Tasks

```bash
# Testing
bun test                 # Run all tests
bun test <pattern>       # Run specific test files

# Formatting & Linting
bun run format           # Format code with prettier
bun run format:check     # Check code formatting
bun run typecheck        # TypeScript type checking (tsc --noEmit)

# Git hooks
bun run install-hooks    # Install git hooks for formatting
```

## Architecture Overview

This GitHub Action enables Claude AI to interact with GitHub PRs and issues through a structured workflow:

1. **Trigger Detection** (`src/github/validation/trigger.ts`): Validates if Claude should respond based on:
   - Comment triggers (@claude, /claude, or custom trigger phrase)
   - Issue assignment to Claude
   - Label triggers (specified in configuration)

2. **Context Gathering** (`src/github/data/`):
   - Fetches GitHub context using GraphQL API
   - Downloads and encodes images from issues/PRs
   - Formats data for Claude's consumption

3. **Prompt Generation** (`src/create-prompt/`):
   - Creates contextual prompts with GitHub data
   - Includes user instructions and system prompts
   - Handles different scenarios (issues vs PRs)

4. **AI Processing**: Supports multiple Claude providers:
   - Anthropic API (direct)
   - OAuth authentication (Claude Max subscribers)
   - AWS Bedrock
   - Google Vertex AI

5. **Action Execution** (`src/github/operations/`):
   - Creates/updates comments with progress tracking
   - Manages branches for issues
   - Handles authentication via OIDC

## Key Components

### Entry Points
- `src/entrypoints/prepare.ts`: Main script that validates triggers, creates initial comments, and sets up branches
- `src/entrypoints/update-comment-link.ts`: Updates Claude's comment with job links after processing

### Core Modules
- **GitHub Integration** (`src/github/`):
  - `api/`: GraphQL client and queries for GitHub data
  - `data/`: Data fetching and formatting logic
  - `operations/`: Branch creation, comment management
  - `validation/`: Permission and trigger validation

- **MCP Integration** (`src/mcp/`):
  - Configures MCP servers for GitHub and filesystem access
  - Enables Claude to perform GitHub operations directly

### Authentication Flow
1. OIDC token exchange for secure GitHub access
2. Supports both GitHub App and PAT authentication
3. Token permissions validated before operations
4. OAuth authentication for Claude Max subscribers:
   - Automatic token refresh when credentials expire
   - Secure credential caching via GitHub Actions cache
   - Token refresh handled by `.github/scripts/claude_token_refresh.ts`

## Testing

The codebase includes comprehensive tests in the `test/` directory:
- Unit tests for all major components
- Integration tests for sanitization and encoding
- Test files follow the pattern `*.test.ts`

Run a specific test:
```bash
bun test github-data-fetcher  # Run tests matching pattern
```

## Important Implementation Details

- The action creates feature branches from issues automatically
- For PRs, it pushes directly to the PR branch
- Comments are updated dynamically with checkboxes showing progress
- All file paths must be sanitized before use in operations
- Image URLs are downloaded and base64 encoded for Claude
- The action uses GitHub's GraphQL API for efficient data fetching

## OAuth Authentication Implementation

The action supports OAuth authentication for Claude Max subscribers.

**Note**: OAuth support currently uses `grll/claude-code-base-action` (a fork) instead of the official `anthropics/claude-code-base-action` until OAuth is officially supported.

### Key Files
- `.github/workflows/claude-oauth-login.yml`: OAuth login workflow for initial authentication
- `.github/scripts/claude_token_refresh.ts`: Handles automatic token refresh
- `action.yml`: OAuth parameters and credential loading logic

### OAuth Flow
1. **Initial Authentication**: Users run the OAuth login workflow to authenticate
2. **Credential Caching**: OAuth tokens are cached using GitHub Actions cache
3. **Automatic Refresh**: Tokens are refreshed automatically when they expire (60-minute buffer)
4. **Fallback Support**: Can use direct OAuth credentials from repository secrets

### Getting OAuth Credentials
```bash
# Linux/Ubuntu
cat ~/.claude/.credentials.json

# macOS
security find-generic-password -s "Claude Code-credentials" -w

# Windows
type %USERPROFILE%\.claude\.credentials.json
```
