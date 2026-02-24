#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs/promises";
import { reviewLocalChanges } from "./index.js";
import { LocalFileReader } from "./local/file-reader.js";

interface CLIOptions {
  workingDirectory: string;
  configPath?: string;
  outputPath?: string;
  failOnError: boolean;
  verbose: boolean;
}

function printUsage(): void {
  console.log(`
AI-Powered Code Review CLI

Usage:
  pr-review [directory] [options]

Arguments:
  directory              Path to the git repository to review (default: current directory)

Options:
  --config <path>        Path to review configuration file (default: auto-discover)
  --output <path>        Save review report to file
  --fail-on-error        Exit with code 1 if errors are found (default: false)
  --verbose, -v          Show detailed output
  --help, -h             Show this help message

Examples:
  pr-review                           # Review current directory
  pr-review ./my-project              # Review specific directory
  pr-review --config ./my-config.json # Use custom config
  pr-review --output report.md        # Save report to file
  pr-review --fail-on-error           # Exit with error code if issues found

Environment Variables:
  COPILOT_TOKEN          GitHub Copilot API token (required)
  GH_TOKEN               Alternative name for COPILOT_TOKEN
  GITHUB_TOKEN           Alternative name for COPILOT_TOKEN

More info: https://github.com/richorama/pr-reviewer
`);
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    workingDirectory: process.cwd(),
    failOnError: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--config") {
      options.configPath = args[++i];
    } else if (arg === "--output") {
      options.outputPath = args[++i];
    } else if (arg === "--fail-on-error") {
      options.failOnError = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (!arg.startsWith("-")) {
      // Positional argument - working directory
      options.workingDirectory = path.resolve(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  return options;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  console.log("🤖 AI-Powered Code Review CLI\n");

  // Validate Copilot token
  const token =
    process.env.COPILOT_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    console.error(
      "❌ Error: No Copilot API token found. Set COPILOT_TOKEN, GH_TOKEN, or GITHUB_TOKEN environment variable.\n"
    );
    console.error("Get a token at: https://github.com/settings/tokens");
    console.error("Required scope: 'copilot'\n");
    process.exit(1);
  }

  try {
    // Validate working directory exists
    const stat = await fs.stat(options.workingDirectory);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${options.workingDirectory}`);
    }

    console.log(`📂 Working directory: ${options.workingDirectory}`);

    // Initialize file reader and validate git repo
    const fileReader = new LocalFileReader(options.workingDirectory);
    await fileReader.validateGitRepository();

    // Get git info
    const gitInfo = await fileReader.getGitInfo();
    console.log(`🌿 Current branch: ${gitInfo.currentBranch}`);
    
    if (!gitInfo.isMainBranch) {
      console.log(`🔍 Comparing against: ${gitInfo.baseBranch}`);
    }

    console.log();

    // Run the review
    const report = await reviewLocalChanges({
      workingDirectory: options.workingDirectory,
      configPath: options.configPath,
      outputPath: options.outputPath,
    });

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Review Summary");
    console.log("=".repeat(60));
    console.log(`Total checks run: ${report.summary.total}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log();
    console.log(`  Errors:   ${report.summary.errors}`);
    console.log(`  Warnings: ${report.summary.warnings}`);
    console.log(`  Info:     ${report.summary.info}`);
    console.log("=".repeat(60));

    // Print detailed results
    if (report.results.length > 0) {
      console.log("\n📋 Detailed Results:\n");
      
      const errors = report.results.filter((r) => !r.passed && r.severity === "error");
      const warnings = report.results.filter((r) => !r.passed && r.severity === "warning");
      const info = report.results.filter((r) => !r.passed && r.severity === "info");

      if (errors.length > 0) {
        console.log("❌ ERRORS:");
        errors.forEach((r) => {
          console.log(`  [${r.checkName}] ${r.message}`);
          if (r.file) console.log(`    File: ${r.file}${r.line ? `:${r.line}` : ""}`);
          if (r.details) console.log(`    ${r.details}`);
          console.log();
        });
      }

      if (warnings.length > 0) {
        console.log("⚠️  WARNINGS:");
        warnings.forEach((r) => {
          console.log(`  [${r.checkName}] ${r.message}`);
          if (r.file) console.log(`    File: ${r.file}${r.line ? `:${r.line}` : ""}`);
          if (r.details) console.log(`    ${r.details}`);
          console.log();
        });
      }

      if (info.length > 0 && options.verbose) {
        console.log("ℹ️  INFO:");
        info.forEach((r) => {
          console.log(`  [${r.checkName}] ${r.message}`);
          if (r.file) console.log(`    File: ${r.file}${r.line ? `:${r.line}` : ""}`);
          if (r.details) console.log(`    ${r.details}`);
          console.log();
        });
      }
    }

    if (options.outputPath) {
      console.log(`\n💾 Report saved to: ${options.outputPath}`);
    }

    // Exit with appropriate code
    if (options.failOnError && report.summary.errors > 0) {
      console.log("\n❌ Review failed due to errors (--fail-on-error is set)");
      process.exit(1);
    } else {
      console.log("\n✅ Review completed successfully");
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ Review failed:");
    console.error(error instanceof Error ? error.message : String(error));
    
    if (options.verbose && error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

main();
