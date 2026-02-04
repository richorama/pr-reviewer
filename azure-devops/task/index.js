import * as fs from "fs/promises";
import { AzureDevOpsClient } from "./azure-devops/client.js";
import { GitHubClient } from "./github/client.js";
import { CopilotAPIEngine } from "./review/copilot-api-engine.js";
import { ReviewReporter } from "./review/reporter.js";
/**
 * Discover review configuration file using convention-based paths
 */
async function discoverConfigFile() {
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
        }
        catch {
            // File doesn't exist, try next
        }
    }
    return null;
}
/**
 * Load review configuration from file
 */
async function loadConfig(configPath) {
    let finalConfigPath = configPath;
    if (!finalConfigPath) {
        const discovered = await discoverConfigFile();
        if (!discovered) {
            throw new Error("No review configuration file found. Expected one of: " +
                "pr-review.config.json, .pr-review.json, .github/pr-review.json");
        }
        finalConfigPath = discovered;
    }
    const configContent = await fs.readFile(finalConfigPath, "utf-8");
    const config = JSON.parse(configContent);
    if (!config.checks || !Array.isArray(config.checks)) {
        throw new Error("Configuration must have a 'checks' array");
    }
    return config;
}
/**
 * Review a pull request with AI-powered analysis
 *
 * @param options Review options including platform, credentials, and PR details
 * @returns Review report with findings and summary
 *
 * @example
 * ```typescript
 * const report = await reviewPullRequest({
 *   platform: "github",
 *   githubToken: process.env.GITHUB_TOKEN,
 *   owner: "myorg",
 *   repository: "myrepo",
 *   prId: 123,
 *   postComment: true,
 *   failOnError: true,
 * });
 * ```
 */
export async function reviewPullRequest(options) {
    // Load configuration
    const reviewConfig = await loadConfig(options.configPath);
    const enabledChecks = reviewConfig.checks.filter((c) => c.enabled);
    if (enabledChecks.length === 0) {
        throw new Error("No enabled checks found in configuration");
    }
    // Initialize platform client and fetch PR data
    let prInfo;
    let fileChanges;
    let postCommentFn;
    if (options.platform === "github") {
        if (!options.githubToken || !options.owner) {
            throw new Error("GitHub platform requires 'githubToken' and 'owner' options");
        }
        const client = new GitHubClient(options.githubToken, options.owner, options.repository);
        prInfo = await client.getPullRequest(options.prId);
        fileChanges = await client.getPullRequestChanges(options.prId);
        if (options.postComment) {
            postCommentFn = (comment) => client.createPullRequestComment(options.prId, comment);
        }
    }
    else if (options.platform === "azdo") {
        if (!options.orgUrl || !options.azdoPat || !options.project) {
            throw new Error("Azure DevOps platform requires 'orgUrl', 'azdoPat', and 'project' options");
        }
        const client = new AzureDevOpsClient(options.orgUrl, options.azdoPat, options.project);
        prInfo = await client.getPullRequest(options.repository, options.prId);
        fileChanges = await client.getPullRequestChanges(options.repository, options.prId);
        if (options.postComment) {
            postCommentFn = (comment) => client.createPullRequestThread(options.repository, options.prId, comment, "active");
        }
    }
    else {
        throw new Error(`Invalid platform: ${options.platform}. Must be 'github' or 'azdo'`);
    }
    if (fileChanges.length === 0) {
        // No changes to review, return empty report
        const reporter = new ReviewReporter();
        return {
            pullRequest: prInfo,
            timestamp: new Date().toISOString(),
            results: [],
            summary: reporter.generateSummary([]),
        };
    }
    // Initialize Copilot review engine (REST API mode)
    const reviewEngine = new CopilotAPIEngine();
    await reviewEngine.initialize();
    try {
        // Run reviews
        const results = await reviewEngine.reviewChanges(enabledChecks, fileChanges);
        // Generate report
        const reporter = new ReviewReporter();
        const summary = reporter.generateSummary(results);
        const report = {
            pullRequest: prInfo,
            timestamp: new Date().toISOString(),
            results,
            summary,
        };
        // Save to file if requested
        if (options.outputPath) {
            const markdownReport = reporter.formatMarkdownReport(report);
            await fs.writeFile(options.outputPath, markdownReport, "utf-8");
        }
        // Post comment to PR if requested
        if (postCommentFn) {
            const markdownReport = reporter.formatMarkdownReport(report);
            await postCommentFn(markdownReport);
        }
        return report;
    }
    finally {
        // Always cleanup
        await reviewEngine.cleanup();
    }
}
// Export types and clients for advanced usage
export * from "./types/index.js";
export { GitHubClient } from "./github/client.js";
export { AzureDevOpsClient } from "./azure-devops/client.js";
export { CopilotAPIEngine } from "./review/copilot-api-engine.js";
export { ReviewReporter } from "./review/reporter.js";
//# sourceMappingURL=index.js.map