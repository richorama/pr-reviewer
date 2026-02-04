import { PullRequestInfo, FileChange } from "../types/index.js";
export declare class AzureDevOpsClient {
    private connection;
    private orgUrl;
    private project;
    constructor(orgUrl: string, personalAccessToken: string, project: string);
    getPullRequest(repositoryId: string, pullRequestId: number): Promise<PullRequestInfo>;
    getPullRequestChanges(repositoryId: string, pullRequestId: number): Promise<FileChange[]>;
    createPullRequestThread(repositoryId: string, pullRequestId: number, comment: string, status?: "active" | "fixed" | "closed"): Promise<void>;
    updatePullRequestDescription(repositoryId: string, pullRequestId: number, newDescription: string): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map