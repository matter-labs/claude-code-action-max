#!/usr/bin/env bun

import { writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';

// Module constants
const OAUTH_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

// Types
interface ClaudeOAuthData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  isMax: boolean;
}

interface Credentials {
  claudeAiOauth: ClaudeOAuthData;
}

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

function loadCredentials(credentialsPath: string): Credentials | null {
  if (!existsSync(credentialsPath)) {
    console.log(`❌ Credentials file not found: ${credentialsPath}`);
    return null;
  }

  try {
    const content = readFileSync(credentialsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log(`❌ Error parsing credentials file: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function tokenExpired(expiresAtMs: number): boolean {
  // Add 60 minutes buffer to refresh before actual expiry
  const bufferMs = 60 * 60 * 1000;
  const currentTimeMs = Date.now();
  return currentTimeMs >= (expiresAtMs - bufferMs);
}

async function performRefresh(refreshToken: string): Promise<ClaudeOAuthData | null> {
  try {
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    if (response.ok) {
      const data: TokenRefreshResponse = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: (Math.floor(Date.now() / 1000) + data.expires_in) * 1000,
        scopes: data.scope ? data.scope.split(' ') : ['user:inference', 'user:profile'],
        isMax: true,
      };
    } else {
      const errorBody = await response.text();
      console.log(`❌ Token refresh failed: ${response.status} - ${errorBody}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Error making refresh request: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Main function - simplified to take credentials path as argument
async function refreshTokenIfNeeded(credentialsPath: string): Promise<{ success: boolean; refreshed: boolean }> {
  const credentials = loadCredentials(credentialsPath);

  if (!credentials || !credentials.claudeAiOauth) {
    console.log('❌ No OAuth credentials found');
    return { success: false, refreshed: false };
  }

  const { accessToken, refreshToken, expiresAt } = credentials.claudeAiOauth;

  console.log(`📅 Token expires at: ${formatTime(expiresAt)}`);
  console.log(`⏰ Current time: ${formatTime(Date.now())}`);

  if (!tokenExpired(expiresAt)) {
    console.log('✅ Token is still valid, no refresh needed');
    return { success: true, refreshed: false };
  }

  console.log('🔄 Token expired or expiring soon, refreshing...');

  const newTokenData = await performRefresh(refreshToken);

  if (!newTokenData) {
    console.log('❌ Failed to refresh token');
    return { success: false, refreshed: false };
  }

  // Update credentials with new token data
  credentials.claudeAiOauth = newTokenData;

  try {
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log('✅ Token refreshed successfully');
    console.log(`📅 New token expires at: ${formatTime(newTokenData.expiresAt)}`);

    // Set output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const output = [
        `token_refreshed=true`,
        `claude_access_token=${newTokenData.accessToken}`,
        `claude_refresh_token=${newTokenData.refreshToken}`,
        `claude_expires_at=${newTokenData.expiresAt}`,
      ].join('\n');

      await writeFile(process.env.GITHUB_OUTPUT, output);
    }

    return { success: true, refreshed: true };
  } catch (error) {
    console.log(`❌ Error saving refreshed credentials: ${error instanceof Error ? error.message : error}`);
    return { success: false, refreshed: true };
  }
}

// Entry point
const credentialsPath = process.argv[2];

if (!credentialsPath) {
  console.log('❌ Usage: bun claude_token_refresh.ts <path-to-credentials.json>');
  process.exit(1);
}

refreshTokenIfNeeded(credentialsPath).then(result => {
  process.exit(result.success ? 0 : 1);
});
