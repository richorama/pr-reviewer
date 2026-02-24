import * as fs from "fs/promises";
import * as path from "path";
import { CopilotAPIEngine } from "./review/copilot-api-engine.js";
import { ReviewReporter } from "./review/reporter.js";
import { ReviewConfig, ReviewReport } from "./types/index.js";
import { LocalFileReader } from "./local/file-reader.js";

/**
 * Discover review configuration file using convention-based paths
 */
async function discoverConfigFile(): Promise<string | null> {
  const possiblePaths = [
    "./pr-review.config.json",
    "./.pr-review.json",
    "./.github/pr-review.json",
    "./review-config.json", // Legacy support
  ];

  for (const configPath of possiblePaths) {
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // File doesn't exist, try next
    }
  }

  return null;
}

/**
 * Load review configuration from file
 */
async function loadConfig(configPath?: string): Promise<ReviewConfig> {
  let finalConfigPath: string | undefined = configPath;
  
  if (!finalConfigPath) {
    const discovered = await discoverConfigFile();
    if (!discovered) {
      throw new Error(
        "No review configuration file found. Expected one of: " +
        "pr-review.config.json, .pr-review.json, .github/pr-review.json"
      );
    }
    finalConfigPath = discovered;
  }

  const configContent = await fs.readFile(finalConfigPath, "utf-8");
  const config: ReviewConfig = JSON.parse(configContent);

  if (!config.checks || !Array.isArray(config.checks)) {
    throw new Error("Configuration must have a 'checks' array");
  }

  return config;
}

/**
 * Options for reviewing local code changes
 */
export interface LocalReviewOptions {
  /** Working directory (git repository root) */
  workingDirectory: string;
  /** Path to review configuration file (optional, will auto-discover) */
  configPath?: string;
  /** Save report to a file */
  outputPath?: string;
}

/**
 * Review local code changes in a git repository
 * 
 * - If on main branch: reviews all files in the repository
 * - If on feature branch: reviews changes since branching from main/develop
 * 
 * @param options Local review options
 * @returns Review report with findings and summary
 * 
 * @example
 * ```typescript
 * const report = await reviewLocalChanges({
 *   workingDirectory: './my-project',
 *   outputPath: 'review-report.md',
 * });
 * ```
 */
export async function reviewLocalChanges(
  options: LocalReviewOptions
): Promise<ReviewReport> {
  // Change to working directory for config discovery
  const originalCwd = process.cwd();
  process.chdir(options.workingDirectory);

  try {
    // Load configuration
    const reviewConfig = await loadConfig(options.configPath);
    const enabledChecks = reviewConfig.checks.filter((c) => c.enabled);

    if (enabledChecks.length === 0) {
      throw new Error("No enabled checks found in configuration");
    }

    // Initialize local file reader
    const fileReader = new LocalFileReader(options.workingDirectory);
    await fileReader.validateGitRepository();

    // Get file changes based on current branch
    const fileChanges = await fileReader.getFileChanges();

    if (fileChanges.length === 0) {
      // No changes to review, return empty report
      const gitInfo = await fileReader.getGitInfo();
      const reporter = new ReviewReporter();
      return {
        pullRequest: {
          pullRequestId: 0,
          repository: path.basename(options.workingDirectory),
          project: "",
          title: `Local review on ${gitInfo.currentBranch}`,
          description: "Local code review",
          sourceRefName: gitInfo.currentBranch,
          targetRefName: gitInfo.isMainBranch ? gitInfo.currentBranch : gitInfo.baseBranch,
          createdBy: "local",
        },
        timestamp: new Date().toISOString(),
        results: [],
        summary: reporter.generateSummary([]),
      };
    }

    // Initialize Copilot review engine
    const reviewEngine = new CopilotAPIEngine();
    await reviewEngine.initialize();

    try {
      // Run reviews
      const results = await reviewEngine.reviewChanges(enabledChecks, fileChanges);

      // Generate report
      const reporter = new ReviewReporter();
      const summary = reporter.generateSummary(results);

      const gitInfo = await fileReader.getGitInfo();
      const report: ReviewReport = {
        pullRequest: {
          pullRequestId: 0,
          repository: path.basename(options.workingDirectory),
          project: "",
          title: `Local review on ${gitInfo.currentBranch}`,
          description: "Local code review",
          sourceRefName: gitInfo.currentBranch,
          targetRefName: gitInfo.isMainBranch ? gitInfo.currentBranch : gitInfo.baseBranch,
          createdBy: "local",
        },
        timestamp: new Date().toISOString(),
        results,
        summary,
      };

      // Save to file if requested
      if (options.outputPath) {
        const markdownReport = reporter.formatMarkdownReport(report);
        await fs.writeFile(options.outputPath, markdownReport, "utf-8");
      }

      return report;
    } finally {
      // Always cleanup
      await reviewEngine.cleanup();
    }
  } finally {
    // Restore original working directory
    process.chdir(originalCwd);
  }
}

// Export types and modules for advanced usage
export * from "./types/index.js";
export { CopilotAPIEngine } from "./review/copilot-api-engine.js";
export { ReviewReporter } from "./review/reporter.js";
export { LocalFileReader } from "./local/file-reader.js";

