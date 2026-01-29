import { Octokit } from "@octokit/rest";
import { PullRequestInfo, FileChange } from "../types/index.js";

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequest(prNumber: number): Promise<PullRequestInfo> {
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return {
      pullRequestId: pr.number,
      repository: this.repo,
      project: this.owner,
      title: pr.title,
      description: pr.body || "",
      sourceRefName: pr.head.ref,
      targetRefName: pr.base.ref,
      createdBy: pr.user?.login || "Unknown",
    };
  }

  async getPullRequestChanges(prNumber: number): Promise<FileChange[]> {
    // Get the list of files changed in the PR
    const { data: files } = await this.octokit.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      per_page: 100,
    });

    const fileChanges: FileChange[] = [];

    for (const file of files) {
      let changeType: "add" | "edit" | "delete";
      
      if (file.status === "removed") {
        changeType = "delete";
      } else if (file.status === "added") {
        changeType = "add";
      } else {
        changeType = "edit";
      }

      let content: string | undefined;
      let diffContent: string | undefined = file.patch;

      // Get file content for added/modified files
      if (changeType !== "delete" && file.sha) {
        try {
          const { data: blob } = await this.octokit.git.getBlob({
            owner: this.owner,
            repo: this.repo,
            file_sha: file.sha,
          });

          if (blob.encoding === "base64") {
            content = Buffer.from(blob.content, "base64").toString("utf-8");
          } else {
            content = blob.content;
          }
        } catch (error) {
          console.warn(`Could not fetch content for ${file.filename}:`, error);
        }
      }

      fileChanges.push({
        path: file.filename,
        changeType,
        content,
        diffContent,
      });
    }

    return fileChanges;
  }

  async createPullRequestComment(
    prNumber: number,
    comment: string
  ): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body: comment,
    });
  }

  async createReviewComment(
    prNumber: number,
    body: string,
    commitId: string,
    path: string,
    line: number
  ): Promise<void> {
    await this.octokit.pulls.createReviewComment({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      body,
      commit_id: commitId,
      path,
      line,
    });
  }

  async updatePullRequestDescription(
    prNumber: number,
    newDescription: string
  ): Promise<void> {
    await this.octokit.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      body: newDescription,
    });
  }
}
