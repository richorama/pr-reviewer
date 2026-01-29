import * as azdev from "azure-devops-node-api";
import { GitPullRequest, GitPullRequestChange } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { PullRequestInfo, FileChange } from "../types/index.js";

export class AzureDevOpsClient {
  private connection: azdev.WebApi;
  private orgUrl: string;
  private project: string;

  constructor(orgUrl: string, personalAccessToken: string, project: string) {
    this.orgUrl = orgUrl;
    this.project = project;
    
    const authHandler = azdev.getPersonalAccessTokenHandler(personalAccessToken);
    this.connection = new azdev.WebApi(orgUrl, authHandler);
  }

  async getPullRequest(repositoryId: string, pullRequestId: number): Promise<PullRequestInfo> {
    const gitApi = await this.connection.getGitApi();
    const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, this.project);

    if (!pr) {
      throw new Error(`Pull request ${pullRequestId} not found`);
    }

    return {
      pullRequestId: pr.pullRequestId!,
      repository: repositoryId,
      project: this.project,
      title: pr.title || "",
      description: pr.description || "",
      sourceRefName: pr.sourceRefName || "",
      targetRefName: pr.targetRefName || "",
      createdBy: pr.createdBy?.displayName || "Unknown",
    };
  }

  async getPullRequestChanges(repositoryId: string, pullRequestId: number): Promise<FileChange[]> {
    const gitApi = await this.connection.getGitApi();
    
    // Get PR iterations to get the latest changes
    const iterations = await gitApi.getPullRequestIterations(repositoryId, pullRequestId, this.project);
    if (!iterations || iterations.length === 0) {
      return [];
    }

    // Get changes from the latest iteration
    const latestIteration = iterations[iterations.length - 1];
    const changes = await gitApi.getPullRequestIterationChanges(
      repositoryId,
      pullRequestId,
      latestIteration.id!,
      this.project
    );

    const fileChanges: FileChange[] = [];

    if (changes.changeEntries) {
      for (const change of changes.changeEntries) {
        if (!change.item?.path) continue;

        let changeType: "add" | "edit" | "delete";
        if (change.changeType && change.changeType.toString().includes("Delete")) {
          changeType = "delete";
        } else if (change.changeType && change.changeType.toString().includes("Add")) {
          changeType = "add";
        } else {
          changeType = "edit";
        }

        // Get file content for added/edited files
        let content: string | undefined;
        let diffContent: string | undefined;

        try {
          if (changeType !== "delete" && change.item.objectId) {
            const item = await gitApi.getBlobContent(
              repositoryId,
              change.item.objectId,
              this.project
            );
            if (item) {
              // getBlobContent returns a NodeJS.ReadableStream, convert to string
              const chunks: Buffer[] = [];
              for await (const chunk of item as any) {
                chunks.push(Buffer.from(chunk));
              }
              content = Buffer.concat(chunks).toString("utf-8");
            }
          }

          // Get diff for the change
          if (change.item.objectId) {
            // For simplicity, we'll use the full content as diff
            // In a production system, you'd want to get the actual diff
            diffContent = content;
          }
        } catch (error) {
          console.warn(`Could not fetch content for ${change.item.path}:`, error);
        }

        fileChanges.push({
          path: change.item.path,
          changeType,
          content,
          diffContent,
        });
      }
    }

    return fileChanges;
  }

  async createPullRequestThread(
    repositoryId: string,
    pullRequestId: number,
    comment: string,
    status: "active" | "fixed" | "closed" = "active"
  ): Promise<void> {
    const gitApi = await this.connection.getGitApi();

    const thread = {
      comments: [{
        content: comment,
        commentType: 1, // Text comment
      }],
      status: status === "active" ? 1 : status === "fixed" ? 2 : 4,
    };

    await gitApi.createThread(thread, repositoryId, pullRequestId, this.project);
  }

  async updatePullRequestDescription(
    repositoryId: string,
    pullRequestId: number,
    newDescription: string
  ): Promise<void> {
    const gitApi = await this.connection.getGitApi();
    
    const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, this.project);
    if (!pr) {
      throw new Error(`Pull request ${pullRequestId} not found`);
    }

    await gitApi.updatePullRequest(
      {
        description: newDescription,
      },
      repositoryId,
      pullRequestId,
      this.project
    );
  }
}
