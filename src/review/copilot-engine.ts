import { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import { ReviewCheckConfig, FileChange, ReviewResult } from "../types/index.js";
import path from "path";
import fs from "fs";
import os from "os";

export class CopilotReviewEngine {
  private client: CopilotClient;
  private session: CopilotSession | null = null;

  constructor(cliPath?: string) {
    console.log("Initializing Copilot client...");
    
    // Ensure required directories exist for Copilot CLI
    this.ensureCopilotDirectories();
    
    // Use the copilot CLI from PATH (installed globally) or custom path
    const resolvedCliPath = cliPath || 
      process.env.COPILOT_CLI_PATH || 
      'copilot'; // Default: look in PATH
    
    console.log("CLI Path:", resolvedCliPath);
    
    // Set working directory for Copilot CLI to avoid path issues
    const workDir = process.cwd();
    console.log("Working Directory:", workDir);
    
    this.client = new CopilotClient({
      cliPath: resolvedCliPath,
      cwd: workDir,
      logLevel: "error", // Use "error" to reduce noise, "info" for debugging
    });
  }

  private ensureCopilotDirectories(): void {
    try {
      // Ensure ~/.copilot directory exists
      const homeDir = os.homedir();
      const copilotDir = path.join(homeDir, '.copilot');
      
      if (!fs.existsSync(copilotDir)) {
        console.log(`Creating Copilot config directory: ${copilotDir}`);
        fs.mkdirSync(copilotDir, { recursive: true });
      }
    } catch (error) {
      console.warn("Warning: Could not create Copilot directories:", error);
      // Don't fail - let Copilot CLI handle it
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log("Starting Copilot client...");
      
      // Check authentication before starting
      if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
        throw new Error("No authentication token found. Set GH_TOKEN or GITHUB_TOKEN environment variable.");
      }
      
      console.log("Authentication token is set:", process.env.GH_TOKEN ? "GH_TOKEN" : "GITHUB_TOKEN");
      
      // Add timeout to prevent hanging
      const startPromise = this.client.start();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Copilot client start timed out after 30 seconds")), 30000)
      );
      
      await Promise.race([startPromise, timeoutPromise]);
      
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

    // Prepare a concise file changes summary (limit to avoid huge prompts)
    const changesContext = fileChanges
      .slice(0, 5) // Limit to first 5 files
      .map((fc) => `- ${fc.changeType.toUpperCase()}: ${fc.path}`)
      .join("\n");

    // Prepare a very limited content sample to keep prompt small
    const contentSample = fileChanges
      .filter((fc) => fc.content)
      .slice(0, 3) // Only first 3 files
      .map((fc) => {
        // Limit content to first 50 lines
        const lines = fc.content?.split("\\n").slice(0, 50).join("\\n") || "";
        return `=== ${fc.path} ===\\n${lines}`;
      })
      .join("\\n\\n");

    // Keep prompt concise
    const prompt = `Review these code changes for: ${check.name}

Rule: ${check.description}

Files changed:
${changesContext}

Sample content:
${contentSample.substring(0, 2000)}

Return JSON array: [{"passed": true/false, "message": "finding"}]
If no issues: [{"passed": true, "message": "Check passed"}]
JSON only:`;

    console.log(`  Sending prompt (${prompt.length} chars)...`);

    const response = await this.session.sendAndWait({
      prompt,
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
