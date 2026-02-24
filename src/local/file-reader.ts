import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { FileChange } from "../types/index.js";

const execAsync = promisify(exec);

export interface GitInfo {
  currentBranch: string;
  isMainBranch: boolean;
  baseBranch: string;
}

/**
 * LocalFileReader - Reads file changes from a local git repository
 */
export class LocalFileReader {
  private workingDirectory: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Get information about the current git branch
   */
  async getGitInfo(): Promise<GitInfo> {
    try {
      // Get current branch
      const { stdout: branchOutput } = await execAsync("git rev-parse --abbrev-ref HEAD", {
        cwd: this.workingDirectory,
      });
      const currentBranch = branchOutput.trim();

      // Check if we're on a main branch (main, master, develop)
      const mainBranches = ["main", "master", "develop"];
      const isMainBranch = mainBranches.includes(currentBranch);

      // Determine base branch for comparison
      let baseBranch = "main";
      if (!isMainBranch) {
        // Try to find the actual base branch
        for (const branch of mainBranches) {
          try {
            await execAsync(`git rev-parse --verify ${branch}`, {
              cwd: this.workingDirectory,
            });
            baseBranch = branch;
            break;
          } catch {
            // Branch doesn't exist, try next
          }
        }
      }

      return {
        currentBranch,
        isMainBranch,
        baseBranch,
      };
    } catch (error) {
      throw new Error(
        `Failed to get git info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get file changes based on the current branch
   */
  async getFileChanges(): Promise<FileChange[]> {
    const gitInfo = await this.getGitInfo();

    if (gitInfo.isMainBranch) {
      return this.getAllFiles();
    } else {
      return this.getChangedFiles(gitInfo.baseBranch);
    }
  }

  /**
   * Get all files in the repository (for main branch review)
   */
  private async getAllFiles(): Promise<FileChange[]> {
    try {
      // Get all tracked files, excluding common ignore patterns
      const { stdout } = await execAsync(
        "git ls-files | grep -v -E '(node_modules/|dist/|build/|coverage/|\\.min\\.js$|\\.map$)'",
        { cwd: this.workingDirectory, shell: "/bin/bash" }
      );

      const files = stdout
        .trim()
        .split("\n")
        .filter((f) => f.length > 0);

      const fileChanges: FileChange[] = [];

      for (const file of files) {
        const fullPath = path.join(this.workingDirectory, file);
        
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          fileChanges.push({
            path: file,
            changeType: "edit",
            content,
          });
        } catch (error) {
          // Skip files that can't be read (binary, etc.)
        }
      }
      return fileChanges;
    } catch (error) {
      throw new Error(
        `Failed to get all files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get changed files compared to base branch
   */
  private async getChangedFiles(baseBranch: string): Promise<FileChange[]> {
    try {
      // Get merge-base to find where the branch diverged
      const { stdout: mergeBase } = await execAsync(
        `git merge-base ${baseBranch} HEAD`,
        { cwd: this.workingDirectory }
      );
      const baseCommit = mergeBase.trim();

      // Get list of changed files with their status
      const { stdout: diffOutput } = await execAsync(
        `git diff --name-status ${baseCommit}..HEAD`,
        { cwd: this.workingDirectory }
      );

      const lines = diffOutput
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      const fileChanges: FileChange[] = [];

      for (const line of lines) {
        const [status, ...pathParts] = line.split("\t");
        const filePath = pathParts.join("\t"); // Handle paths with tabs

        // Skip node_modules, dist, build, coverage, and minified files
        if (
          filePath.includes("node_modules/") ||
          filePath.includes("dist/") ||
          filePath.includes("build/") ||
          filePath.includes("coverage/") ||
          filePath.endsWith(".min.js") ||
          filePath.endsWith(".map")
        ) {
          continue;
        }

        let changeType: "add" | "edit" | "delete";
        if (status === "A") {
          changeType = "add";
        } else if (status === "D") {
          changeType = "delete";
        } else {
          changeType = "edit";
        }

        let content: string | undefined;
        let diffContent: string | undefined;

        if (changeType !== "delete") {
          // Read current file content
          const fullPath = path.join(this.workingDirectory, filePath);
          try {
            content = await fs.readFile(fullPath, "utf-8");
          } catch (error) {
            // Skip files that can't be read
            continue;
          }

          // Get diff for context
          try {
            const { stdout: diff } = await execAsync(
              `git diff ${baseCommit}..HEAD -- "${filePath}"`,
              { cwd: this.workingDirectory }
            );
            diffContent = diff;
          } catch {
            // Diff not available, continue without it
          }
        }

        fileChanges.push({
          path: filePath,
          changeType,
          content,
          diffContent,
        });
      }

      return fileChanges;
    } catch (error) {
      throw new Error(
        `Failed to get changed files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate that the working directory is a git repository
   */
  async validateGitRepository(): Promise<void> {
    try {
      await execAsync("git rev-parse --git-dir", {
        cwd: this.workingDirectory,
      });
    } catch {
      throw new Error(
        `Directory is not a git repository: ${this.workingDirectory}`
      );
    }
  }
}
