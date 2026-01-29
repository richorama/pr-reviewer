import { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { ReviewCheckConfig, FileChange, ReviewResult } from "../types/index.js";

export class CopilotReviewEngine {
  private client: CopilotClient;
  private session: CopilotSession | null = null;

  constructor(cliPath?: string) {
    console.log("Initializing Copilot client...");
    
    // Use the copilot CLI from node_modules if no path provided
    const resolvedCliPath = cliPath || 
      process.env.COPILOT_CLI_PATH || 
      require('path').resolve(__dirname, '../../node_modules/@github/copilot/index.js');
    
    console.log("CLI Path:", resolvedCliPath);
    
    this.client = new CopilotClient({
      cliPath: resolvedCliPath,
      logLevel: "info", // Changed from "error" to "info" for debugging
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log("Starting Copilot client...");
      await this.client.start();
      console.log("Copilot client started successfully");
      
      console.log("Creating Copilot session...");
      this.session = await this.client.createSession({
        model: "gpt-5",
        systemMessage: {
          content: `You are an expert code reviewer analyzing pull request changes. 
Your job is to carefully review code changes and check them against specific business rules.
Be thorough but fair. Provide clear, actionable feedback.
Format your responses as structured JSON when requested.`,
        },
      });
      console.log("Copilot session created successfully");
    } catch (error) {
      console.error("Failed to initialize Copilot:", error);
      throw error;
    }
  }

  async reviewChanges(
    checks: ReviewCheckConfig[],
    fileChanges: FileChange[]
  ): Promise<ReviewResult[]> {
    if (!this.session) {
      throw new Error("Review engine not initialized. Call initialize() first.");
    }

    const results: ReviewResult[] = [];

    // Process checks in parallel batches to avoid overwhelming Copilot
    const enabledChecks = checks.filter((c) => c.enabled);
    
    for (const check of enabledChecks) {
      console.log(`Running check: ${check.name}...`);
      
      try {
        const checkResults = await this.runCheck(check, fileChanges);
        results.push(...checkResults);
      } catch (error) {
        console.error(`Error running check ${check.name}:`, error);
        results.push({
          checkName: check.name,
          passed: false,
          severity: "error",
          message: `Failed to run check: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  private async runCheck(
    check: ReviewCheckConfig,
    fileChanges: FileChange[]
  ): Promise<ReviewResult[]> {
    if (!this.session) {
      throw new Error("Session not available");
    }

    // Prepare file changes summary
    const changesContext = fileChanges
      .map((fc) => {
        const lines = fc.content ? `(${fc.content.split("\n").length} lines)` : "";
        return `- ${fc.changeType.toUpperCase()}: ${fc.path} ${lines}`;
      })
      .join("\n");

    // Prepare detailed content for analysis
    const detailedContent = fileChanges
      .filter((fc) => fc.content) // Only include files with content
      .slice(0, 10) // Limit to first 10 files to avoid token limits
      .map((fc) => {
        return `
=== File: ${fc.path} (${fc.changeType}) ===
${fc.content}
`;
      })
      .join("\n");

    const prompt = `
You are reviewing a pull request. Analyze the following code changes against this specific rule:

**Check Name:** ${check.name}
**Description:** ${check.description}
**Severity:** ${check.severity}

**Rule to Apply:**
${check.rule}

**Files Changed:**
${changesContext}

**Detailed File Contents (sample):**
${detailedContent || "No file contents available"}

Analyze the changes and return a JSON array of findings. Each finding should have:
{
  "passed": boolean (true if no issues found for this aspect),
  "message": "Brief description of the finding",
  "details": "Detailed explanation (optional)",
  "file": "File path where issue was found (optional)",
  "line": line number if applicable (optional)
}

If the check passes completely with no issues, return: [{"passed": true, "message": "Check passed"}]
If there are issues, return one object per issue found.

Return ONLY the JSON array, no other text.
`;

    const response = await this.session.sendAndWait({
      prompt,
      mode: "immediate",
    });

    if (!response || !response.data.content) {
      return [{
        checkName: check.name,
        passed: false,
        severity: check.severity,
        message: "No response from Copilot",
      }];
    }

    try {
      // Extract JSON from response
      const content = response.data.content.trim();
      let jsonStr = content;
      
      // Try to extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const findings = JSON.parse(jsonStr);

      if (!Array.isArray(findings)) {
        throw new Error("Response is not an array");
      }

      return findings.map((finding: any) => ({
        checkName: check.name,
        passed: finding.passed === true,
        severity: check.severity,
        message: finding.message || "No message provided",
        details: finding.details,
        file: finding.file,
        line: finding.line,
      }));
    } catch (error) {
      console.error(`Failed to parse Copilot response for ${check.name}:`, error);
      console.error("Response was:", response.data.content);
      
      // Fallback: interpret response as text
      return [{
        checkName: check.name,
        passed: false,
        severity: check.severity,
        message: "Could not parse review results",
        details: response.data.content,
      }];
    }
  }

  async cleanup(): Promise<void> {
    if (this.session) {
      await this.session.destroy();
      this.session = null;
    }
    await this.client.stop();
  }
}
