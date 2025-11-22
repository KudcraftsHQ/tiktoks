#!/usr/bin/env bun

/**
 * Conductor Workspace Cleanup Script
 *
 * Cleans up resources when a workspace is archived:
 * 1. Drops the PostgreSQL database for this workspace
 * 2. Flushes the Redis logical database for this workspace
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import * as path from "path";
import Redis from "ioredis";

interface EnvVars {
  DATABASE_URL?: string;
  REDIS_URL?: string;
  CONDUCTOR_PORT?: string;
  CONDUCTOR_WORKSPACE_NAME?: string;
}

function loadEnv(): EnvVars {
  const envPath = path.join(process.cwd(), ".env");

  // Check if .env exists
  try {
    const envContent = readFileSync(envPath, "utf-8");

    const env: EnvVars = {};
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          env[key as keyof EnvVars] = valueParts.join("=");
        }
      }
    });

    // Add Conductor env vars
    env.CONDUCTOR_PORT = process.env.CONDUCTOR_PORT;
    env.CONDUCTOR_WORKSPACE_NAME = process.env.CONDUCTOR_WORKSPACE_NAME;

    return env;
  } catch (error) {
    console.warn("⚠️  Warning: Could not read .env file, using Conductor env vars only");
    return {
      CONDUCTOR_PORT: process.env.CONDUCTOR_PORT,
      CONDUCTOR_WORKSPACE_NAME: process.env.CONDUCTOR_WORKSPACE_NAME,
    };
  }
}

function exec(command: string, description: string): boolean {
  console.log(`  ⏳ ${description}...`);

  try {
    execSync(command, {
      stdio: ["inherit", "pipe", "pipe"],
      encoding: "utf-8",
    });
    console.log(`  ✓ ${description}`);
    return true;
  } catch (error: any) {
    console.error(`  ✗ ${description} failed`);
    if (error.stderr) {
      console.error(`  Error: ${error.stderr.toString().trim()}`);
    }
    return false;
  }
}

async function flushRedisLogicalDB(redisUrl: string): Promise<boolean> {
  console.log(`  ⏳ Flushing Redis logical database...`);

  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      redis!.once("ready", resolve);
      redis!.once("error", reject);
      setTimeout(() => reject(new Error("Connection timeout")), 5000);
    });

    // Flush the current logical database
    await redis.flushdb();
    console.log(`  ✓ Flushed Redis logical database`);
    return true;
  } catch (error: any) {
    console.error(`  ✗ Failed to flush Redis: ${error.message}`);
    return false;
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }
}

async function main() {
  console.log("🧹 Conductor Workspace Cleanup");
  console.log("─".repeat(50));

  const env = loadEnv();

  const conductorPort = env.CONDUCTOR_PORT || "unknown";
  const workspaceName = env.CONDUCTOR_WORKSPACE_NAME || "unknown";
  const dbName = `carousel-master-db-${conductorPort}`;

  console.log(`📍 Workspace: ${workspaceName}`);
  console.log(`🔢 Port: ${conductorPort}`);
  console.log("");

  let allSuccess = true;

  // Step 1: Drop PostgreSQL database
  console.log("🗄️  Cleaning up PostgreSQL database...");
  const dropSuccess = exec(
    `dropdb --if-exists "${dbName}"`,
    `Dropping database: ${dbName}`
  );
  allSuccess = allSuccess && dropSuccess;

  console.log("");

  // Step 2: Flush Redis logical database
  if (env.REDIS_URL) {
    console.log("🔴 Cleaning up Redis logical database...");
    const redisSuccess = await flushRedisLogicalDB(env.REDIS_URL);
    allSuccess = allSuccess && redisSuccess;
  } else {
    console.warn("⚠️  Warning: REDIS_URL not found, skipping Redis cleanup");
    console.log("");
  }

  console.log("");
  console.log("─".repeat(50));

  if (allSuccess) {
    console.log("✅ Cleanup complete!");
    console.log("");
    console.log("🗑️  Removed:");
    console.log(`   • PostgreSQL database: ${dbName}`);
    if (env.REDIS_URL) {
      const redisDb = parseInt(conductorPort) - 3000;
      console.log(`   • Redis logical DB: ${redisDb}`);
    }
    console.log("");
  } else {
    console.warn("⚠️  Cleanup completed with errors");
    console.log("");
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
