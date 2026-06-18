-- 渠道表全局化：移除 userId 维度，仅保留组织级配置行

DELETE FROM "agent_profile" WHERE "userId" IS NOT NULL;
DELETE FROM "route_rule" WHERE "userId" IS NOT NULL;

CREATE TABLE "agent_profile_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "mcpServerIds" JSONB NOT NULL DEFAULT '[]',
    "toolPrompt" TEXT,
    "tenantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "agent_profile_new" (
    "id", "profileId", "displayName", "vendor", "defaultModel", "temperature", "maxTokens",
    "enableTools", "enablePrompts", "maxToolCallRounds", "permissionMode", "enableAutoCompact",
    "compactModel", "mcpServerIds", "toolPrompt", "tenantId", "createdAt", "updatedAt"
)
SELECT
    "id", "profileId", "displayName", "vendor", "defaultModel", "temperature", "maxTokens",
    "enableTools", "enablePrompts", "maxToolCallRounds", "permissionMode", "enableAutoCompact",
    "compactModel", "mcpServerIds", "toolPrompt", "tenantId", "createdAt", "updatedAt"
FROM "agent_profile";

DROP TABLE "agent_profile";
ALTER TABLE "agent_profile_new" RENAME TO "agent_profile";
CREATE UNIQUE INDEX "agent_profile_profileId_key" ON "agent_profile"("profileId");

CREATE TABLE "route_rule_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

INSERT INTO "route_rule_new" (
    "id", "boundUserId", "channel", "matchKey", "profileId", "priority", "enabled",
    "tenantId", "createdAt", "updatedAt"
)
SELECT
    "id", "boundUserId", "channel", "matchKey", "profileId", "priority", "enabled",
    "tenantId", "createdAt", "updatedAt"
FROM "route_rule";

DROP TABLE "route_rule";
ALTER TABLE "route_rule_new" RENAME TO "route_rule";
CREATE UNIQUE INDEX "route_rule_channel_matchKey_key" ON "route_rule"("channel", "matchKey");
CREATE INDEX "route_rule_channel_enabled_priority_idx" ON "route_rule"("channel", "enabled", "priority");
