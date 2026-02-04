import * as tl from "azure-pipelines-task-lib/task";
import { reviewPullRequest } from "./index.js";

async function run(): Promise<void> {
  try {
    // Get PR ID from pipeline variables
    const prIdStr = tl.getVariable("System.PullRequest.PullRequestId");
    if (!prIdStr) {
      throw new Error("Not running in a pull request context. System.PullRequest.PullRequestId is not set.");
    }

    const prId = parseInt(prIdStr, 10);
    if (isNaN(prId)) {
      throw new Error(`Invalid PR ID: ${prIdStr}`);
    }

    // Get pipeline context
    const orgUrl = tl.getVariable("System.CollectionUri");
    const project = tl.getVariable("System.TeamProject");
    const repository = tl.getVariable("Build.Repository.Name");
    const accessToken = tl.getVariable("System.AccessToken");

    if (!orgUrl || !project || !repository) {
      throw new Error("Missing required pipeline variables: System.CollectionUri, System.TeamProject, or Build.Repository.Name");
    }

    if (!accessToken) {
      throw new Error("System.AccessToken is not available. Ensure the pipeline has access to the OAuth token.");
    }

    // Get task inputs
    const copilotToken = tl.getInput("copilotToken", true);
    const configPath = tl.getInput("configPath", false) || undefined; // Will auto-discover if not provided
    const postComment = tl.getBoolInput("postComment", false);
    const failOnError = tl.getBoolInput("failOnError", false);

    console.log(`🚀 Starting PR Review for ${project}/${repository}#${prId}`);
    console.log(`📋 Config path: ${configPath || "auto-discover"}`);
    console.log(`💬 Post comment: ${postComment}`);
    console.log(`❌ Fail on error: ${failOnError}`);

    // Set Copilot token in environment (used by CopilotAPIEngine)
    process.env.COPILOT_TOKEN = copilotToken!;
    process.env.GH_TOKEN = copilotToken!;

    // Run the review
    const report = await reviewPullRequest({
      platform: "azdo",
      orgUrl,
      azdoPat: accessToken,
      project,
      repository,
      prId,
      configPath,
      postComment,
    });

    // Set output variables
    tl.setVariable("reviewReport", JSON.stringify(report));
    tl.setVariable("reviewErrors", report.summary.errors.toString());
    tl.setVariable("reviewWarnings", report.summary.warnings.toString());
    tl.setVariable("reviewInfo", report.summary.info.toString());

    // Log summary
    console.log(`\n📊 Review Summary:`);
    console.log(`   ❌ Errors: ${report.summary.errors}`);
    console.log(`   ⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`   ℹ️  Info: ${report.summary.info}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);

    // Determine task result
    if (failOnError && report.summary.errors > 0) {
      tl.setResult(
        tl.TaskResult.Failed,
        `Review found ${report.summary.errors} error(s). See PR comments for details.`
      );
    } else {
      tl.setResult(tl.TaskResult.Succeeded, "Review completed successfully");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    tl.setResult(tl.TaskResult.Failed, `PR Review failed: ${message}`);
  }
}

run();
