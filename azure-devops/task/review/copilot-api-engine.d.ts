import { ReviewCheckConfig, FileChange, ReviewResult } from "../types/index.js";
/**
 * CopilotAPIEngine - Uses the GitHub Copilot REST API directly
 * This works in CI/CD environments with just a PAT that has 'copilot' scope
 */
export declare class CopilotAPIEngine {
    private token;
    private baseUrl;
    private model;
    constructor();
    initialize(): Promise<void>;
    reviewChanges(checks: ReviewCheckConfig[], fileChanges: FileChange[]): Promise<ReviewResult[]>;
    private runCheck;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=copilot-api-engine.d.ts.map