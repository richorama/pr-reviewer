export interface ReviewCheckConfig {
  name: string;
  description: string;
  enabled: boolean;
  severity: "error" | "warning" | "info";
  rule: string;
}

export interface ReviewConfig {
  checks: ReviewCheckConfig[];
}

export interface PullRequestInfo {
  pullRequestId: number;
  repository: string;
  project: string;
  title: string;
  description: string;
  sourceRefName: string;
  targetRefName: string;
  createdBy: string;
}

export interface FileChange {
  path: string;
  changeType: "add" | "edit" | "delete";
  content?: string;
  diffContent?: string;
}

export interface ReviewResult {
  checkName: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  message: string;
  details?: string;
  file?: string;
  line?: number;
}

export interface ReviewReport {
  pullRequest: PullRequestInfo;
  timestamp: string;
  results: ReviewResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    warnings: number;
    info: number;
  };
}
