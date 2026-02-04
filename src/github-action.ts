import * as core from "@actions/core";
import * as github from "@actions/github";
import { reviewPullRequest } from "./index.js";

async function run(): Promise<void> {
  try {
    // Validate we're in a pull request context
    if (!github.context.payload.pull_request) {
      throw new Error("This action can only be run on pull_request events");
    }

    const prNumber = github.context.payload.pull_request.number;
    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;

    // Get inputs
    const copilotToken = core.getInput("copilot-token", { required: true });
    const githubToken = core.getInput("github-token", { required: true });
    const configPath = core.getInput("config-path") || undefined; // Will auto-discover if not provided
    const postComment = core.getBooleanInput("post-comment");
    const failOnError = core.getBooleanInput("fail-on-error");

    core.info(`🚀 Starting PR Review for ${owner}/${repo}#${prNumber}`);
    core.info(`📋 Config path: ${configPath || "auto-discover"}`);
    core.info(`💬 Post comment: ${postComment}`);
    core.info(`❌ Fail on error: ${failOnError}`);

    // Set Copilot token in environment (used by CopilotAPIEngine)
    process.env.COPILOT_TOKEN = copilotToken;
    process.env.GH_TOKEN = copilotToken;

    // Run the review
    const report = await reviewPullRequest({
      platform: "github",
      githubToken,
      owner,
      repository: repo,
      prId: prNumber,
      configPath,
      postComment,
    });

    // Set outputs
    core.setOutput("report", JSON.stringify(report));
    core.setOutput("errors", report.summary.errors.toString());
    core.setOutput("warnings", report.summary.warnings.toString());
    core.setOutput("info", report.summary.info.toString());

    // Log summary
    core.info(`\n📊 Review Summary:`);
    core.info(`   ❌ Errors: ${report.summary.errors}`);
    core.info(`   ⚠️  Warnings: ${report.summary.warnings}`);
    core.info(`   ℹ️  Info: ${report.summary.info}`);
    core.info(`   ✅ Passed: ${report.summary.passed}`);

    // Fail if errors found and failOnError is enabled
    if (failOnError && report.summary.errors > 0) {
      core.setFailed(
        `Review found ${report.summary.errors} error(s). See PR comments for details.`
      );
    } else {
      core.info(`\n✅ Review completed successfully`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`PR Review failed: ${message}`);
  }
}

run();
