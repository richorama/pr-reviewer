import { PullRequestInfo, FileChange } from "../types/index.js";
export declare class GitHubClient {
    private octokit;
    private owner;
    private repo;
    constructor(token: string, owner: string, repo: string);
    getPullRequest(prNumber: number): Promise<PullRequestInfo>;
    getPullRequestChanges(prNumber: number): Promise<FileChange[]>;
    createPullRequestComment(prNumber: number, comment: string): Promise<void>;
    createReviewComment(prNumber: number, body: string, commitId: string, path: string, line: number): Promise<void>;
    updatePullRequestDescription(prNumber: number, newDescription: string): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map