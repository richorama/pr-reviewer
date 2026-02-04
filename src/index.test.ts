import * as fs from 'fs/promises';
import * as path from 'path';
import { reviewPullRequest, ReviewOptions } from './index';

// Mock the file system
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock the clients
jest.mock('./github/client');
jest.mock('./azure-devops/client');
jest.mock('./review/copilot-api-engine');

import { GitHubClient } from './github/client';
import { AzureDevOpsClient } from './azure-devops/client';
import { CopilotAPIEngine } from './review/copilot-api-engine';

describe('Config Discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverConfigFile', () => {
    it('should find pr-review.config.json first', async () => {
      mockFs.access.mockImplementation((path: any) => {
        if (path === './pr-review.config.json') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify({
        checks: [
          { name: 'test', description: 'Test', enabled: true, severity: 'error', rule: 'Test rule' }
        ]
      }));

      const mockClient = {
        getPullRequest: jest.fn().mockResolvedValue({
          id: 1,
          title: 'Test',
          sourceRefName: 'feature',
          targetRefName: 'main',
          status: 'active',
          createdBy: 'user',
          creationDate: '2026-02-04',
          url: 'http://test.com'
        }),
        getPullRequestChanges: jest.fn().mockResolvedValue([]),
      };

      (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

      const mockEngine = {
        initialize: jest.fn().mockResolvedValue(undefined),
        reviewChanges: jest.fn().mockResolvedValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };

      (CopilotAPIEngine as jest.MockedClass<typeof CopilotAPIEngine>).mockImplementation(() => mockEngine as any);

      const options: ReviewOptions = {
        platform: 'github',
        githubToken: 'test-token',
        owner: 'test-owner',
        repository: 'test-repo',
        prId: 1,
      };

      await reviewPullRequest(options);

      expect(mockFs.access).toHaveBeenCalledWith('./pr-review.config.json');
      expect(mockFs.readFile).toHaveBeenCalledWith('./pr-review.config.json', 'utf-8');
    });

    it('should fall back to .pr-review.json', async () => {
      let accessCallCount = 0;
      mockFs.access.mockImplementation((path: any) => {
        accessCallCount++;
        if (path === './.pr-review.json') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify({
        checks: [
          { name: 'test', description: 'Test', enabled: true, severity: 'error', rule: 'Test rule' }
        ]
      }));

      const mockClient = {
        getPullRequest: jest.fn().mockResolvedValue({
          id: 1,
          title: 'Test',
          sourceRefName: 'feature',
          targetRefName: 'main',
          status: 'active',
          createdBy: 'user',
          creationDate: '2026-02-04',
          url: 'http://test.com'
        }),
        getPullRequestChanges: jest.fn().mockResolvedValue([]),
      };

      (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

      const mockEngine = {
        initialize: jest.fn().mockResolvedValue(undefined),
        reviewChanges: jest.fn().mockResolvedValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };

      (CopilotAPIEngine as jest.MockedClass<typeof CopilotAPIEngine>).mockImplementation(() => mockEngine as any);

      const options: ReviewOptions = {
        platform: 'github',
        githubToken: 'test-token',
        owner: 'test-owner',
        repository: 'test-repo',
        prId: 1,
      };

      await reviewPullRequest(options);

      expect(mockFs.access).toHaveBeenCalledWith('./.pr-review.json');
      expect(mockFs.readFile).toHaveBeenCalledWith('./.pr-review.json', 'utf-8');
    });

    it('should throw error when no config file found', async () => {
      mockFs.access.mockRejectedValue(new Error('Not found'));

      const mockClient = {
        getPullRequest: jest.fn().mockResolvedValue({
          id: 1,
          title: 'Test',
          sourceRefName: 'feature',
          targetRefName: 'main',
          status: 'active',
          createdBy: 'user',
          creationDate: '2026-02-04',
          url: 'http://test.com'
        }),
        getPullRequestChanges: jest.fn().mockResolvedValue([]),
      };

      (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

      const options: ReviewOptions = {
        platform: 'github',
        githubToken: 'test-token',
        owner: 'test-owner',
        repository: 'test-repo',
        prId: 1,
      };

      await expect(reviewPullRequest(options)).rejects.toThrow(
        'No review configuration file found'
      );
    });

    it('should use provided configPath if specified', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        checks: [
          { name: 'test', description: 'Test', enabled: true, severity: 'error', rule: 'Test rule' }
        ]
      }));

      const mockClient = {
        getPullRequest: jest.fn().mockResolvedValue({
          id: 1,
          title: 'Test',
          sourceRefName: 'feature',
          targetRefName: 'main',
          status: 'active',
          createdBy: 'user',
          creationDate: '2026-02-04',
          url: 'http://test.com'
        }),
        getPullRequestChanges: jest.fn().mockResolvedValue([]),
      };

      (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

      const mockEngine = {
        initialize: jest.fn().mockResolvedValue(undefined),
        reviewChanges: jest.fn().mockResolvedValue([]),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };

      (CopilotAPIEngine as jest.MockedClass<typeof CopilotAPIEngine>).mockImplementation(() => mockEngine as any);

      const options: ReviewOptions = {
        platform: 'github',
        githubToken: 'test-token',
        owner: 'test-owner',
        repository: 'test-repo',
        prId: 1,
        configPath: './custom-config.json',
      };

      await reviewPullRequest(options);

      expect(mockFs.access).not.toHaveBeenCalled();
      expect(mockFs.readFile).toHaveBeenCalledWith('./custom-config.json', 'utf-8');
    });
  });

  describe('loadConfig', () => {
    it('should throw error if config has no checks array', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ invalid: 'config' }));

      const mockClient = {
        getPullRequest: jest.fn().mockResolvedValue({
          id: 1,
          title: 'Test',
          sourceRefName: 'feature',
          targetRefName: 'main',
          status: 'active',
          createdBy: 'user',
          creationDate: '2026-02-04',
          url: 'http://test.com'
        }),
        getPullRequestChanges: jest.fn().mockResolvedValue([]),
      };

      (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

      const options: ReviewOptions = {
        platform: 'github',
        githubToken: 'test-token',
        owner: 'test-owner',
        repository: 'test-repo',
        prId: 1,
        configPath: './invalid-config.json',
      };

      await expect(reviewPullRequest(options)).rejects.toThrow(
        "Configuration must have a 'checks' array"
      );
    });

    it('should parse valid config successfully', async () => {
      const validConfig = {
        checks: [
          { name: 'test1', description: 'Test 1', enabled: true, severity: 'error', rule: 'Rule 1' },
          { name: 'test2', description: 'Test 2', enabled: false, severity: 'warning', rule: 'Rule 2' },
        ]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

      const mockClient = {
        getPullRequest: jest.fn().mockResolvedValue({
          id: 1,
          title: 'Test',
          sourceRefName: 'feature',
          targetRefName: 'main',
          status: 'active',
          createdBy: 'user',
          creationDate: '2026-02-04',
          url: 'http://test.com'
        }),
        getPullRequestChanges: jest.fn().mockResolvedValue([
          {
            path: 'test.ts',
            changeType: 'edit',
            content: 'test content',
            diffContent: 'diff',
          }
        ]),
      };

      (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

      const mockEngine = {
        initialize: jest.fn().mockResolvedValue(undefined),
        reviewChanges: jest.fn().mockResolvedValue([
          {
            check: validConfig.checks[0],
            findings: [],
            passed: true,
          }
        ]),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };

      (CopilotAPIEngine as jest.MockedClass<typeof CopilotAPIEngine>).mockImplementation(() => mockEngine as any);

      const options: ReviewOptions = {
        platform: 'github',
        githubToken: 'test-token',
        owner: 'test-owner',
        repository: 'test-repo',
        prId: 1,
        configPath: './valid-config.json',
      };

      const report = await reviewPullRequest(options);

      expect(report).toBeDefined();
      expect(mockEngine.reviewChanges).toHaveBeenCalledWith(
        [validConfig.checks[0]], // Only enabled checks
        expect.any(Array)
      );
    });
  });
});

describe('reviewPullRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.readFile.mockResolvedValue(JSON.stringify({
      checks: [
        { name: 'test', description: 'Test', enabled: true, severity: 'error', rule: 'Test rule' }
      ]
    }));
  });

  it('should throw error for GitHub platform without required options', async () => {
    const options: ReviewOptions = {
      platform: 'github',
      repository: 'test-repo',
      prId: 1,
      configPath: './config.json',
    };

    await expect(reviewPullRequest(options)).rejects.toThrow(
      "GitHub platform requires 'githubToken' and 'owner' options"
    );
  });

  it('should throw error for Azure DevOps platform without required options', async () => {
    const options: ReviewOptions = {
      platform: 'azdo',
      repository: 'test-repo',
      prId: 1,
      configPath: './config.json',
    };

    await expect(reviewPullRequest(options)).rejects.toThrow(
      "Azure DevOps platform requires 'orgUrl', 'azdoPat', and 'project' options"
    );
  });

  it('should handle GitHub review successfully', async () => {
    const mockClient = {
      getPullRequest: jest.fn().mockResolvedValue({
        id: 1,
        title: 'Test PR',
        sourceRefName: 'feature/test',
        targetRefName: 'main',
        status: 'active',
        createdBy: 'user',
        creationDate: '2026-02-04',
        url: 'http://github.com/test'
      }),
      getPullRequestChanges: jest.fn().mockResolvedValue([
        { path: 'test.ts', changeType: 'add', content: 'content', diffContent: 'diff' }
      ]),
      createPullRequestComment: jest.fn().mockResolvedValue(undefined),
    };

    (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

    const mockEngine = {
      initialize: jest.fn().mockResolvedValue(undefined),
      reviewChanges: jest.fn().mockResolvedValue([
        {
          check: { name: 'test', description: 'Test', enabled: true, severity: 'error', rule: 'Rule' },
          findings: ['Issue found'],
          passed: false,
        }
      ]),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    (CopilotAPIEngine as jest.MockedClass<typeof CopilotAPIEngine>).mockImplementation(() => mockEngine as any);

    const options: ReviewOptions = {
      platform: 'github',
      githubToken: 'test-token',
      owner: 'test-owner',
      repository: 'test-repo',
      prId: 1,
      configPath: './config.json',
      postComment: true,
    };

    const report = await reviewPullRequest(options);

    expect(report).toBeDefined();
    expect(report.pullRequest.title).toBe('Test PR');
    expect(report.results).toHaveLength(1);
    expect(mockClient.createPullRequestComment).toHaveBeenCalled();
    expect(mockEngine.cleanup).toHaveBeenCalled();
  });

  it('should handle empty file changes', async () => {
    const mockClient = {
      getPullRequest: jest.fn().mockResolvedValue({
        id: 1,
        title: 'Test PR',
        sourceRefName: 'feature/test',
        targetRefName: 'main',
        status: 'active',
        createdBy: 'user',
        creationDate: '2026-02-04',
        url: 'http://github.com/test'
      }),
      getPullRequestChanges: jest.fn().mockResolvedValue([]),
    };

    (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

    const options: ReviewOptions = {
      platform: 'github',
      githubToken: 'test-token',
      owner: 'test-owner',
      repository: 'test-repo',
      prId: 1,
      configPath: './config.json',
    };

    const report = await reviewPullRequest(options);

    expect(report).toBeDefined();
    expect(report.results).toHaveLength(0);
    expect(report.summary.total).toBe(0);
  });

  it('should save output file when outputPath is provided', async () => {
    mockFs.writeFile.mockResolvedValue(undefined);

    const mockClient = {
      getPullRequest: jest.fn().mockResolvedValue({
        id: 1,
        title: 'Test PR',
        sourceRefName: 'feature/test',
        targetRefName: 'main',
        status: 'active',
        createdBy: 'user',
        creationDate: '2026-02-04',
        url: 'http://github.com/test'
      }),
      getPullRequestChanges: jest.fn().mockResolvedValue([
        { path: 'test.ts', changeType: 'add', content: 'content', diffContent: 'diff' }
      ]),
    };

    (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

    const mockEngine = {
      initialize: jest.fn().mockResolvedValue(undefined),
      reviewChanges: jest.fn().mockResolvedValue([]),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    (CopilotAPIEngine as jest.MockedClass<typeof CopilotAPIEngine>).mockImplementation(() => mockEngine as any);

    const options: ReviewOptions = {
      platform: 'github',
      githubToken: 'test-token',
      owner: 'test-owner',
      repository: 'test-repo',
      prId: 1,
      configPath: './config.json',
      outputPath: './report.md',
    };

    await reviewPullRequest(options);

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      './report.md',
      expect.any(String),
      'utf-8'
    );
  });

  it('should cleanup engine even if review fails', async () => {
    const mockClient = {
      getPullRequest: jest.fn().mockResolvedValue({
        id: 1,
        title: 'Test PR',
        sourceRefName: 'feature/test',
        targetRefName: 'main',
        status: 'active',
        createdBy: 'user',
        creationDate: '2026-02-04',
        url: 'http://github.com/test'
      }),
      getPullRequestChanges: jest.fn().mockResolvedValue([
        { path: 'test.ts', changeType: 'add', content: 'content', diffContent: 'diff' }
      ]),
    };

    (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockClient as any);

    const mockEngine = {
      initialize: jest.fn().mockResolvedValue(undefined),
      reviewChanges: jest.fn().mockRejectedValue(new Error('Review failed')),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    (CopilotAPIEngine as jest.MockedClass<typeof CopilotAPIEngine>).mockImplementation(() => mockEngine as any);

    const options: ReviewOptions = {
      platform: 'github',
      githubToken: 'test-token',
      owner: 'test-owner',
      repository: 'test-repo',
      prId: 1,
      configPath: './config.json',
    };

    await expect(reviewPullRequest(options)).rejects.toThrow('Review failed');
    expect(mockEngine.cleanup).toHaveBeenCalled();
  });
});
