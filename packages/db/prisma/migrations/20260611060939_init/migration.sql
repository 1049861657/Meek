-- CreateTable
CREATE TABLE "setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ai_provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ai_model" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    CONSTRAINT "ai_model_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mcp_server" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "connectionType" TEXT NOT NULL,
    "command" TEXT,
    "args" JSONB,
    "mcpUrl" TEXT,
    "headers" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "mcp_server_auth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "serverId" TEXT NOT NULL,
    "tokens" JSONB,
    "expiresAt" DATETIME,
    "clientInfo" JSONB,
    "codeVerifier" TEXT,
    "discoveryState" JSONB,
    "oauthState" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "agent_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "profileId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vendor" TEXT,
    "defaultModel" TEXT NOT NULL,
    "temperature" REAL,
    "maxTokens" INTEGER,
    "enableTools" BOOLEAN NOT NULL DEFAULT true,
    "enablePrompts" BOOLEAN NOT NULL DEFAULT true,
    "maxToolCallRounds" INTEGER NOT NULL DEFAULT 25,
    "permissionMode" TEXT NOT NULL DEFAULT 'locked',
    "enableAutoCompact" BOOLEAN,
    "compactModel" TEXT,
    "mcpServerIds" JSONB NOT NULL DEFAULT [],
    "toolPrompt" TEXT,
    "tenantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "route_rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "boundUserId" TEXT,
    "channel" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "quick_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sortId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '默认'
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" DATETIME
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chat_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "compactBaselineJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chat_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT,
    "toolCallsJson" JSONB,
    "reasoning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "setting_userId_key_key" ON "setting"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_userId_name_key" ON "ai_provider"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_providerId_value_key" ON "ai_model"("providerId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_server_userId_serverId_key" ON "mcp_server"("userId", "serverId");

-- CreateIndex
CREATE INDEX "mcp_server_auth_oauthState_idx" ON "mcp_server_auth"("oauthState");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_server_auth_userId_serverId_key" ON "mcp_server_auth"("userId", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_profile_userId_profileId_key" ON "agent_profile"("userId", "profileId");

-- CreateIndex
CREATE INDEX "route_rule_channel_enabled_priority_idx" ON "route_rule"("channel", "enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "route_rule_userId_channel_matchKey_key" ON "route_rule"("userId", "channel", "matchKey");

-- CreateIndex
CREATE UNIQUE INDEX "quick_message_sortId_key" ON "quick_message"("sortId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "chat_session_userId_idx" ON "chat_session"("userId");

-- CreateIndex
CREATE INDEX "chat_message_sessionId_createdAt_idx" ON "chat_message"("sessionId", "createdAt");
