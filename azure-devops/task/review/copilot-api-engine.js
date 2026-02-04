/**
 * CopilotAPIEngine - Uses the GitHub Copilot REST API directly
 * This works in CI/CD environments with just a PAT that has 'copilot' scope
 */
export class CopilotAPIEngine {
    token;
    baseUrl = "https://api.githubcopilot.com";
    model = "gpt-4o"; // Default Copilot model
    constructor() {
        const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.COPILOT_TOKEN;
        if (!token) {
            throw new Error("No authentication token found. Set GH_TOKEN, GITHUB_TOKEN, or COPILOT_TOKEN environment variable.");
        }
        this.token = token;
        console.log("Copilot API Engine initialized with token");
    }
    async initialize() {
        console.log("Verifying Copilot API access...");
        try {
            // Test the API with a simple request
            const response = await fetch(`${this.baseUrl}/models`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.token}`,
                    "Content-Type": "application/json",
                    "Copilot-Integration-Id": "vscode-chat",
                },
            });
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 401) {
                    throw new Error(`Authentication failed. Ensure your token has 'copilot' scope. Status: ${response.status}, Error: ${errorText}`);
                }
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }
            const models = await response.json();
            console.log("Available models:", JSON.stringify(models, null, 2));
            console.log("✅ Copilot API access verified");
        }
        catch (error) {
            if (error instanceof TypeError && error.message.includes("fetch")) {
                throw new Error("Network error connecting to Copilot API");
            }
            throw error;
        }
    }
    async reviewChanges(checks, fileChanges) {
        const results = [];
        const enabledChecks = checks.filter((c) => c.enabled);
        for (const check of enabledChecks) {
            console.log(`Running check: ${check.name}...`);
            try {
                const checkResults = await this.runCheck(check, fileChanges);
                results.push(...checkResults);
            }
            catch (error) {
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
    async runCheck(check, fileChanges) {
        // Prepare file changes summary
        const changesContext = fileChanges
            .slice(0, 5)
            .map((fc) => `- ${fc.changeType.toUpperCase()}: ${fc.path}`)
            .join("\n");
        // Prepare content sample
        const contentSample = fileChanges
            .filter((fc) => fc.content)
            .slice(0, 3)
            .map((fc) => {
            const lines = fc.content?.split("\n").slice(0, 50).join("\n") || "";
            return `=== ${fc.path} ===\n${lines}`;
        })
            .join("\n\n");
        const systemPrompt = `You are an expert code reviewer. Respond with JSON only. No explanations outside JSON.`;
        const userPrompt = `Review these code changes for: ${check.name}

Rule: ${check.description}

Files changed:
${changesContext}

Sample content:
${contentSample.substring(0, 2000)}

Return JSON array: [{"passed": true/false, "message": "finding", "file": "optional filename", "line": optional_line_number}]
If no issues found: [{"passed": true, "message": "Check passed"}]

Respond with ONLY the JSON array, no markdown, no explanation:`;
        console.log(`  Sending request to Copilot API (${userPrompt.length} chars)...`);
        const startTime = Date.now();
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.token}`,
                    "Content-Type": "application/json",
                    "Copilot-Integration-Id": "vscode-chat",
                    "Editor-Version": "vscode/1.85.0",
                    "Editor-Plugin-Version": "copilot-chat/0.12.0",
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature: 0.1,
                    max_tokens: 1000,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`  Response received in ${duration}s`);
            const content = data.choices?.[0]?.message?.content?.trim();
            if (!content) {
                console.log(`  Warning: Empty response from Copilot`);
                return [{
                        checkName: check.name,
                        passed: false,
                        severity: check.severity,
                        message: "No response from Copilot",
                    }];
            }
            console.log(`  Response content (first 200 chars): ${content.substring(0, 200)}`);
            // Parse JSON from response
            let jsonStr = content;
            const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }
            const findings = JSON.parse(jsonStr);
            if (!Array.isArray(findings)) {
                throw new Error("Response is not an array");
            }
            return findings.map((finding) => ({
                checkName: check.name,
                passed: finding.passed === true,
                severity: check.severity,
                message: finding.message || "No message provided",
                details: finding.details,
                file: finding.file,
                line: finding.line,
            }));
        }
        catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.error(`  Failed after ${duration}s:`, error instanceof Error ? error.message : error);
            return [{
                    checkName: check.name,
                    passed: false,
                    severity: check.severity,
                    message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
                }];
        }
    }
    async cleanup() {
        // No cleanup needed for REST API
        console.log("Copilot API Engine cleanup complete");
    }
}
//# sourceMappingURL=copilot-api-engine.js.map