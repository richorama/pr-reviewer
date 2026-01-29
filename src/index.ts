#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import * as fs from "fs/promises";
import * as path from "path";
import { AzureDevOpsClient } from "./azure-devops/client.js";
import { GitHubClient } from "./github/client.js";
import { CopilotReviewEngine } from "./review/copilot-engine.js";
import { ReviewReporter } from "./review/reporter.js";
import { ReviewConfig, ReviewReport, PullRequestInfo, FileChange } from "./types/index.js";

// Load environment variables
config();

const program = new Command();

program
  .name("pr-review")
  .description("AI-powered Pull Request reviewer for Azure DevOps and GitHub using GitHub Copilot")
  .version("1.0.0");

program
  .command("review")
  .description("Review a pull request")
  .option("--platform <platform>", "Platform: 'azdo' or 'github'", process.env.PLATFORM || "github")
  // Azure DevOps options
  .option("--org-url <url>", "Azure DevOps organization URL", process.env.AZDO_ORG_URL)
  .option("--azdo-pat <token>", "Azure DevOps Personal Access Token", process.env.AZDO_PAT)
  .option("--project <name>", "Azure DevOps project name", process.env.AZDO_PROJECT)
  // GitHub options
  .option("--github-token <token>", "GitHub Personal Access Token", process.env.GITHUB_TOKEN)
  .option("--owner <name>", "GitHub repository owner", process.env.GITHUB_OWNER)
  // Common options
  .requiredOption("--repository <name>", "Repository name", process.env.REPOSITORY || process.env.AZDO_REPOSITORY)
  .requiredOption("--pr-id <number>", "Pull Request ID", process.env.PR_ID || process.env.AZDO_PR_ID)
  .option("--config <path>", "Path to review configuration file", process.env.REVIEW_CONFIG_PATH || "./review-config.json")
  .option("--post-comment", "Post review results as a PR comment", false)
  .option("--output <path>", "Save report to a file")
  .option("--copilot-cli <path>", "Path to Copilot CLI executable", process.env.COPILOT_CLI_PATH)
  .action(async (options) => {
    try {
      console.log(`🚀 Starting ${options.platform.toUpperCase()} PR Review...\n`);

      const prId = parseInt(options.prId, 10);
      if (isNaN(prId)) {
        console.error("❌ Error: Invalid PR ID. Must be a number.");
        process.exit(1);
      }

      // Validate platform-specific options
      if (options.platform === "azdo") {
        if (!options.orgUrl || !options.azdoPat || !options.project) {
          console.error("❌ Error: For Azure DevOps, --org-url, --azdo-pat, and --project are required.");
          process.exit(1);
        }
      } else if (options.platform === "github") {
        if (!options.githubToken || !options.owner) {
          console.error("❌ Error: For GitHub, --github-token and --owner are required.");
          process.exit(1);
        }
      } else {
        console.error("❌ Error: Invalid platform. Must be 'azdo' or 'github'.");
        process.exit(1);
      }

      if (!options.repository) {
        console.error("❌ Error: --repository is required.");
        process.exit(1);
      }

      // Load review configuration
      console.log(`📋 Loading review configuration from ${options.config}...`);
      let reviewConfig: ReviewConfig;
      try {
        const configContent = await fs.readFile(options.config, "utf-8");
        reviewConfig = JSON.parse(configContent);
      } catch (error) {
        console.error(`❌ Error loading configuration file: ${error}`);
        process.exit(1);
      }

      const enabledChecks = reviewConfig.checks.filter((c) => c.enabled);
      console.log(`✅ Loaded ${enabledChecks.length} enabled checks\n`);

      // Initialize platform client and fetch PR data
      let prInfo: PullRequestInfo;
      let fileChanges: FileChange[];
      let postComment: (comment: string) => Promise<void>;

      if (options.platform === "azdo") {
        console.log("🔗 Connecting to Azure DevOps...");
        const azdoClient = new AzureDevOpsClient(
          options.orgUrl,
          options.azdoPat,
          options.project
        );

        console.log(`📥 Fetching PR #${prId} details...`);
        prInfo = await azdoClient.getPullRequest(options.repository, prId);
        console.log(`   Title: ${prInfo.title}`);
        console.log(`   Branch: ${prInfo.sourceRefName} → ${prInfo.targetRefName}\n`);

        console.log("📂 Fetching file changes...");
        fileChanges = await azdoClient.getPullRequestChanges(options.repository, prId);
        console.log(`   Found ${fileChanges.length} changed files\n`);

        postComment = (comment: string) => 
          azdoClient.createPullRequestThread(options.repository, prId, comment, "active");

      } else {
        console.log("🔗 Connecting to GitHub...");
        const githubClient = new GitHubClient(
          options.githubToken,
          options.owner,
          options.repository
        );

        console.log(`📥 Fetching PR #${prId} details...`);
        prInfo = await githubClient.getPullRequest(prId);
        console.log(`   Title: ${prInfo.title}`);
        console.log(`   Branch: ${prInfo.sourceRefName} → ${prInfo.targetRefName}\n`);

        console.log("📂 Fetching file changes...");
        fileChanges = await githubClient.getPullRequestChanges(prId);
        console.log(`   Found ${fileChanges.length} changed files\n`);

        postComment = (comment: string) =>
          githubClient.createPullRequestComment(prId, comment);
      }

      if (fileChanges.length === 0) {
        console.log("⚠️  No file changes to review. Exiting.");
        process.exit(0);
      }

      // Initialize Copilot review engine
      console.log("🤖 Initializing GitHub Copilot...");
      const reviewEngine = new CopilotReviewEngine(options.copilotCli);
      await reviewEngine.initialize();
      console.log("   ✅ Copilot ready\n");

      // Run reviews
      console.log("🔍 Running code review checks...\n");
      const results = await reviewEngine.reviewChanges(reviewConfig.checks, fileChanges);

      // Cleanup
      await reviewEngine.cleanup();

      // Generate report
      console.log("\n📊 Generating review report...\n");
      const reporter = new ReviewReporter();
      const summary = reporter.generateSummary(results);

      const report: ReviewReport = {
        pullRequest: prInfo,
        timestamp: new Date().toISOString(),
        results,
        summary,
      };

      // Display console report
      console.log(reporter.formatConsoleReport(report));

      // Save to file if requested
      if (options.output) {
        const markdownReport = reporter.formatMarkdownReport(report);
        await fs.writeFile(options.output, markdownReport, "utf-8");
        console.log(`💾 Report saved to: ${options.output}\n`);
      }

      // Post comment to PR if requested
      if (options.postComment) {
        console.log(`💬 Posting review results to ${options.platform.toUpperCase()} PR...`);
        const markdownReport = reporter.formatMarkdownReport(report);
        await postComment(markdownReport);
        console.log("   ✅ Comment posted successfully\n");
      }

      // Exit with error code if there are failures
      const hasErrors = summary.errors > 0;
      if (hasErrors) {
        console.log("❌ Review completed with errors");
        process.exit(1);
      } else {
        console.log("✅ Review completed successfully");
        process.exit(0);
      }
    } catch (error) {
      console.error("\n❌ Error during review:", error);
      process.exit(1);
    }
  });

program
  .command("validate-config")
  .description("Validate the review configuration file")
  .option("--config <path>", "Path to review configuration file", "./review-config.json")
  .action(async (options) => {
    try {
      console.log(`📋 Validating configuration file: ${options.config}\n`);
      
      const configContent = await fs.readFile(options.config, "utf-8");
      const config: ReviewConfig = JSON.parse(configContent);

      if (!config.checks || !Array.isArray(config.checks)) {
        throw new Error("Configuration must have a 'checks' array");
      }

      console.log(`✅ Configuration is valid`);
      console.log(`   Total checks: ${config.checks.length}`);
      console.log(`   Enabled checks: ${config.checks.filter((c) => c.enabled).length}`);
      console.log(`   Disabled checks: ${config.checks.filter((c) => !c.enabled).length}\n`);

      console.log("Checks:");
      for (const check of config.checks) {
        const status = check.enabled ? "✓" : "✗";
        console.log(`  ${status} ${check.name} (${check.severity})`);
      }

      process.exit(0);
    } catch (error) {
      console.error(`❌ Configuration validation failed:`, error);
      process.exit(1);
    }
  });

program.parse();
