#!/usr/bin/env bun

/**
 * Conductor Production Data Sync Script
 *
 * Syncs all data from production database to the current workspace database.
 * Logs timing information for each step to help understand sync duration.
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import * as path from "path";

interface EnvVars {
  PRODUCTION_DATABASE_URL?: string;
  DATABASE_URL?: string;
  CONDUCTOR_PORT?: string;
  CONDUCTOR_WORKSPACE_NAME?: string;
}

function loadEnv(): EnvVars {
  const envPath = path.join(process.cwd(), ".env");
  const envContent = readFileSync(envPath, "utf-8");

  const env: EnvVars = {};
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        let value = valueParts.join("=");
        // Strip surrounding quotes (both single and double)
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key as keyof EnvVars] = value;
      }
    }
  });

  // Add Conductor env vars
  env.CONDUCTOR_PORT = process.env.CONDUCTOR_PORT;
  env.CONDUCTOR_WORKSPACE_NAME = process.env.CONDUCTOR_WORKSPACE_NAME;

  return env;
}

function stripQueryParams(url: string): string {
  // Remove query parameters from DATABASE_URL for psql compatibility
  return url.split('?')[0];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function exec(command: string, description: string, env?: NodeJS.ProcessEnv): void {
  const start = Date.now();
  console.log(`  ⏳ ${description}...`);

  try {
    execSync(command, {
      stdio: ["inherit", "pipe", "pipe"],
      encoding: "utf-8",
      env: env || process.env,
    });
    const duration = Date.now() - start;
    console.log(`  ✓ ${description} (${formatDuration(duration)})`);
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error(`  ✗ ${description} failed after ${formatDuration(duration)}`);
    if (error.stderr) {
      console.error(`  Error: ${error.stderr.toString()}`);
    }
    throw error;
  }
}

async function main() {
  const totalStart = Date.now();
  console.log("📦 Production Data Sync");
  console.log("─".repeat(50));

  const env = loadEnv();

  // Validate required env vars
  if (!env.PRODUCTION_DATABASE_URL) {
    console.error("❌ Error: PRODUCTION_DATABASE_URL not found in .env");
    console.error("   Please add your production database URL to .env");
    process.exit(1);
  }

  if (!env.DATABASE_URL) {
    console.error("❌ Error: DATABASE_URL not found in .env");
    process.exit(1);
  }

  const conductorPort = env.CONDUCTOR_PORT || "unknown";
  const workspaceName = env.CONDUCTOR_WORKSPACE_NAME || "unknown";

  console.log(`📍 Workspace: ${workspaceName}`);
  console.log(`🔢 Port: ${conductorPort}`);
  console.log(`🗄️  Target DB: carousel-master-db-${conductorPort}`);
  console.log("");

  // Create temporary dump file path
  const tmpDir = process.env.TMPDIR || "/tmp";
  const dumpFile = path.join(tmpDir, `conductor_dump_${conductorPort}_${Date.now()}.sql`);

  try {
    console.log("📦 Syncing production data...");
    console.log("");

    // Clean URLs (remove query params for psql)
    const cleanDbUrl = stripQueryParams(env.DATABASE_URL!);
    const cleanProdUrl = stripQueryParams(env.PRODUCTION_DATABASE_URL!);

    // Step 1: Dump all data (no schema - Prisma migrations already created tables)
    const dumpCommand = `pg_dump "$PRODUCTION_DATABASE_URL" --no-owner --no-acl --data-only \
      --file="${dumpFile}"`;

    exec(dumpCommand, "Dumping all production data", {
      ...process.env,
      PRODUCTION_DATABASE_URL: cleanProdUrl,
    });

    // Step 2: Restore all data to workspace
    const restoreCommand = `psql "$DATABASE_URL" -f "${dumpFile}"`;
    exec(restoreCommand, "Restoring all data to workspace", {
      ...process.env,
      DATABASE_URL: cleanDbUrl,
    });

    // Step 3: Clean up dump files
    exec(`rm -f "${dumpFile}"`, "Cleaning up temporary files");

    const totalDuration = Date.now() - totalStart;
    console.log("");
    console.log("─".repeat(50));
    console.log(`✅ Sync complete! Total time: ${formatDuration(totalDuration)}`);
    console.log("");
    console.log("📊 Synced data:");
    console.log("   • All tables from production database");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("❌ Sync failed!");
    console.error("");

    // Try to clean up dump file if it exists
    try {
      execSync(`rm -f "${dumpFile}"`, { stdio: "ignore" });
    } catch {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
