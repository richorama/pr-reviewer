import { ReviewReporter } from './reporter';
import { ReviewReport, ReviewResult } from '../types/index';

describe('ReviewReporter', () => {
  let reporter: ReviewReporter;

  beforeEach(() => {
    reporter = new ReviewReporter();
  });

  describe('generateSummary', () => {
    it('should count results by severity', () => {
      const results: ReviewResult[] = [
        {
          checkName: 'test1',
          passed: false,
          severity: 'error',
          message: 'Finding 1',
        },
        {
          checkName: 'test2',
          passed: false,
          severity: 'warning',
          message: 'Finding 2',
        },
        {
          checkName: 'test2',
          passed: false,
          severity: 'warning',
          message: 'Finding 3',
        },
        {
          checkName: 'test3',
          passed: false,
          severity: 'info',
          message: 'Finding 4',
        },
        {
          checkName: 'test4',
          passed: true,
          severity: 'info',
          message: 'Passed',
        },
      ];

      const summary = reporter.generateSummary(results);

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.errors).toBeGreaterThan(0);
      expect(summary.warnings).toBeGreaterThan(0);
    });

    it('should handle empty results', () => {
      const summary = reporter.generateSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
    });

    it('should handle all passed checks', () => {
      const results: ReviewResult[] = [
        {
          checkName: 'test1',
          passed: true,
          severity: 'error',
          message: 'Passed',
        },
        {
          checkName: 'test2',
          passed: true,
          severity: 'warning',
          message: 'Passed',
        },
      ];

      const summary = reporter.generateSummary(results);

      expect(summary.passed).toBeGreaterThan(0);
      expect(summary.failed).toBe(0);
    });
  });

  describe('formatConsoleReport', () => {
    it('should format a complete report for console', () => {
      const report: ReviewReport = {
        pullRequest: {
          pullRequestId: 123,
          repository: 'test-repo',
          project: 'test-project',
          title: 'Test PR',
          description: 'Test description',
          sourceRefName: 'feature/test',
          targetRefName: 'main',
          createdBy: 'test-user',
        },
        timestamp: '2026-02-04T12:00:00Z',
        results: [
          {
            checkName: 'test-check',
            passed: false,
            severity: 'error',
            message: 'Issue 1',
          },
          {
            checkName: 'test-check',
            passed: false,
            severity: 'error',
            message: 'Issue 2',
          },
        ],
        summary: {
          total: 2,
          passed: 0,
          failed: 2,
          errors: 2,
          warnings: 0,
          info: 0,
        },
      };

      const output = reporter.formatConsoleReport(report);

      expect(output).toContain('test-check');
      expect(output).toContain('Issue 1');
    });

    it('should handle report with no failures', () => {
      const report: ReviewReport = {
        pullRequest: {
          pullRequestId: 123,
          repository: 'test-repo',
          project: 'test-project',
          title: 'Test PR',
          description: 'Test description',
          sourceRefName: 'feature/test',
          targetRefName: 'main',
          createdBy: 'test-user',
        },
        timestamp: '2026-02-04T12:00:00Z',
        results: [
          {
            checkName: 'test-check',
            passed: true,
            severity: 'error',
            message: 'Passed',
          },
        ],
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          errors: 0,
          warnings: 0,
          info: 0,
        },
      };

      const output = reporter.formatConsoleReport(report);

      expect(output).toContain('test-check');
    });
  });

  describe('formatMarkdownReport', () => {
    it('should format a complete report as markdown', () => {
      const report: ReviewReport = {
        pullRequest: {
          pullRequestId: 123,
          repository: 'test-repo',
          project: 'test-project',
          title: 'Test PR',
          description: 'Test description',
          sourceRefName: 'feature/test',
          targetRefName: 'main',
          createdBy: 'test-user',
        },
        timestamp: '2026-02-04T12:00:00Z',
        results: [
          {
            checkName: 'security',
            passed: false,
            severity: 'error',
            message: 'Hardcoded password detected',
          },
          {
            checkName: 'style',
            passed: false,
            severity: 'warning',
            message: 'Naming convention issue',
          },
        ],
        summary: {
          total: 2,
          passed: 0,
          failed: 2,
          errors: 1,
          warnings: 1,
          info: 0,
        },
      };

      const output = reporter.formatMarkdownReport(report);

      expect(output).toContain('# 🤖 AI Code Review Report');
      expect(output).toContain('Test PR');
      expect(output).toContain('## 📊 Summary');
      expect(output).toContain('security');
      expect(output).toContain('Hardcoded password detected');
      expect(output).toContain('style');
      expect(output).toContain('Naming convention issue');
    });

    it('should show success message when all checks pass', () => {
      const report: ReviewReport = {
        pullRequest: {
          pullRequestId: 123,
          repository: 'test-repo',
          project: 'test-project',
          title: 'Test PR',
          description: 'Test description',
          sourceRefName: 'feature/test',
          targetRefName: 'main',
          createdBy: 'test-user',
        },
        timestamp: '2026-02-04T12:00:00Z',
        results: [
          {
            checkName: 'test',
            passed: true,
            severity: 'error',
            message: 'Passed',
          },
        ],
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          errors: 0,
          warnings: 0,
          info: 0,
        },
      };

      const output = reporter.formatMarkdownReport(report);

      expect(output).toContain('All');
      expect(output).toContain('passed');
    });

    it('should handle multiple findings per check', () => {
      const report: ReviewReport = {
        pullRequest: {
          pullRequestId: 123,
          repository: 'test-repo',
          project: 'test-project',
          title: 'Test PR',
          description: 'Test description',
          sourceRefName: 'feature/test',
          targetRefName: 'main',
          createdBy: 'test-user',
        },
        timestamp: '2026-02-04T12:00:00Z',
        results: [
          {
            checkName: 'test',
            passed: false,
            severity: 'info',
            message: 'Finding 1',
          },
          {
            checkName: 'test',
            passed: false,
            severity: 'info',
            message: 'Finding 2',
          },
          {
            checkName: 'test',
            passed: false,
            severity: 'info',
            message: 'Finding 3',
          },
        ],
        summary: {
          total: 3,
          passed: 0,
          failed: 3,
          errors: 0,
          warnings: 0,
          info: 3,
        },
      };

      const output = reporter.formatMarkdownReport(report);

      expect(output).toContain('Finding 1');
      expect(output).toContain('Finding 2');
      expect(output).toContain('Finding 3');
    });
  });
});
