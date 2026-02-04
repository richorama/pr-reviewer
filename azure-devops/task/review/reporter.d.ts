import { ReviewReport, ReviewResult } from "../types/index.js";
export declare class ReviewReporter {
    formatMarkdownReport(report: ReviewReport): string;
    formatConsoleReport(report: ReviewReport): string;
    generateSummary(results: ReviewResult[]): ReviewReport["summary"];
}
//# sourceMappingURL=reporter.d.ts.map