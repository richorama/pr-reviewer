# AI-Powered PR Reviewer

> 🚀 Automate your code reviews with AI-powered analysis

AI-powered pull request review tool using **GitHub Copilot** for intelligent code analysis on **GitHub** and **Azure DevOps**. Distributed as a GitHub Action and Azure DevOps Marketplace Extension for easy consumption.

## Features

- 🤖 **AI-Powered Reviews**: Leverages GitHub Copilot's language models for intelligent code analysis
- 🔧 **Customizable Checks**: Define your own business rules with natural language
- 📊 **PR Comments**: Posts detailed review findings directly to your pull requests
- ⚡ **Multi-Platform**: GitHub Actions and Azure DevOps Pipelines
- 🎯 **Convention-Based**: Auto-discovers config files, no setup required
- ✅ **CI/CD Integration**: Fails builds on errors, warns on issues

## Quick Start

### GitHub Actions

Add to `.github/workflows/pr-review.yml`:

```yaml
name: AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - uses: richorama/pr-reviewer@v1
        with:
          copilot-token: ${{ secrets.COPILOT_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Azure DevOps

Install the extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com), then add to your pipeline:

```yaml
steps:
  - task: PRReviewer@1
    inputs:
      copilotToken: $(COPILOT_TOKEN)
```

## Configuration

### Convention-Based Config Discovery

Create one of these files in your repo (checked in order):

1. `pr-review.config.json`
2. `.pr-review.json`
3. `.github/pr-review.json`
4. `review-config.json` (legacy)

### Example Configuration

```json
{
  "checks": [
    {
      "name": "naming-conventions",
      "description": "Verify file and variable names follow camelCase/PascalCase",
      "enabled": true,
      "severity": "warning",
      "rule": "Check that files use camelCase or kebab-case, classes use PascalCase..."
    },
    {
      "name": "security-check",
      "description": "Detect hardcoded credentials and security issues",
      "enabled": true,
      "severity": "error",
      "rule": "Identify hardcoded API keys, passwords, tokens, or secrets..."
    }
  ]
}
```

See [review-config.json](./review-config.json) for complete examples.
      "rule": "Check that files use camelCase or kebab-case, classes use PascalCase..."
    },
    {
      "name": "deleted-code-blocks",
      "description": "Detect large blocks of deleted code",
      "enabled": true,
      "severity": "error",
      "rule": "Identify deletions of more than 50 consecutive lines or entire functions..."
    }
  ]
}
```

### Built-in Checks

The tool includes these pre-configured checks in [review-config.json](./review-config.json):

1. **Naming Conventions** - Validates file and variable naming standards
2. **Deleted Code Blocks** - Flags large code deletions
3. **Console Log Check** - Detects console.log statements
4. **Hardcoded Credentials** - Finds potential security issues
5. **Missing Error Handling** - Ensures async operations have proper error handling
6. **TODO Comments** - Flags TODO/FIXME comments
7. **Code Duplication** - Identifies potential duplicate code
8. **Missing Tests** - Checks if new features include tests

## Setup

### Prerequisites

1. **GitHub Copilot subscription** - Required for AI-powered analysis
2. **Personal Access Token** with Copilot access:
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `copilot` scope
   - Store as `COPILOT_TOKEN` secret in your repository/pipeline

### GitHub Actions Setup

1. Add `COPILOT_TOKEN` secret:
   - Repository → Settings → Secrets and variables → Actions
   - New repository secret: `COPILOT_TOKEN`
   - Value: Your PAT with Copilot access

2. The `GITHUB_TOKEN` is automatically provided by GitHub Actions

### Azure DevOps Setup

1. Add `COPILOT_TOKEN` as a pipeline variable:
   - Pipeline → Edit → Variables
   - Name: `COPILOT_TOKEN`
   - Value: Your PAT with Copilot access
   - ✅ Keep this value secret

2. Enable OAuth token access in pipeline YAML:
   ```yaml
   jobs:
     - job: review
       pool:
         vmImage: 'ubuntu-latest'
       steps:
         - task: PRReviewer@1
           inputs:
             copilotToken: $(COPILOT_TOKEN)
   ```

## Advanced Configuration

### Custom Config Path

Specify a custom config file location:

**GitHub Actions:**
```yaml
- uses: richorama/pr-reviewer@v1
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    config-path: './custom/path/review-config.json'
```

**Azure DevOps:**
```yaml
- task: PRReviewer@1
  inputs:
    copilotToken: $(COPILOT_TOKEN)
    configPath: './custom/path/review-config.json'
```

### Disable Fail on Error

By default, the tool fails the build when errors are found. To disable:

**GitHub Actions:**
```yaml
- uses: richorama/pr-reviewer@v1
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fail-on-error: false
```

**Azure DevOps:**
```yaml
- task: PRReviewer@1
  inputs:
    copilotToken: $(COPILOT_TOKEN)
    failOnError: false
```

### Disable PR Comments

To only run checks without posting comments:

**GitHub Actions:**
```yaml
- uses: richorama/pr-reviewer@v1
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    post-comment: false
```

**Azure DevOps:**
```yaml
- task: PRReviewer@1
  inputs:
    copilotToken: $(COPILOT_TOKEN)
    postComment: false
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Package Azure DevOps Extension

```bash
# Build and package extension
npm run package:azdo

# Output: azure-devops/YOUR_PUBLISHER_ID.pr-reviewer-1.0.0.vsix
```

See [PUBLISHING.md](./PUBLISHING.md) for complete publishing instructions.

## Architecture

- **Core Library** ([src/index.ts](src/index.ts)) - Main review logic with config discovery
- **GitHub Action Wrapper** ([src/github-action.ts](src/github-action.ts)) - GitHub Actions integration
- **Azure DevOps Wrapper** ([src/azure-pipelines-task.ts](src/azure-pipelines-task.ts)) - Azure Pipelines integration
- **Platform Clients** - GitHub ([src/github/client.ts](src/github/client.ts)) and Azure DevOps ([src/azure-devops/client.ts](src/azure-devops/client.ts)) API clients
- **Review Engine** ([src/review/copilot-api-engine.ts](src/review/copilot-api-engine.ts)) - GitHub Copilot API integration
- **Reporter** ([src/review/reporter.ts](src/review/reporter.ts)) - Markdown and console report formatting

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm test` to verify
5. Submit a pull request

## License

MIT
          echo ${{ secrets.GITHUB_COPILOT_TOKEN }} | gh auth login --with-token
          gh auth status
        env:
          GH_TOKEN: ${{ secrets.GITHUB_COPILOT_TOKEN }}

      - name: Install dependencies and build
        run: |
          npm ci
          npm run build

      - name: Run AI Code Review
        run: |
          node dist/index.js review \
            --platform github \
            --github-token ${{ secrets.GITHUB_TOKEN }} \
            --owner ${{ github.repository_owner }} \
            --repository ${{ github.event.repository.name }} \
            --pr-id ${{ github.event.pull_request.number }} \
            --post-comment \
            --output review-report.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Review Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: pr-review-report
          path: review-report.md
```

### Azure DevOps Pipeline

**Setup Steps:**
1. Get a GitHub PAT from an account with Copilot access (Settings → Developer settings → Personal access tokens)
2. In Azure DevOps, go to Pipelines → Library → Variable groups (or add directly to pipeline)
3. Add a variable named `COPILOT_TOKEN` with your PAT value (check "Keep this value secret")
4. **Grant Build Service permissions:**
   - Go to **Project Settings** → **Repositories** → Select your repo
   - Click the **Security** tab
   - Find **[Project Name] Build Service** (or **Project Collection Build Service**)
   - Set **Contribute to pull requests** to **Allow**
5. Use the pipeline below:

See [azure-pipelines.yml](./azure-pipelines.yml) for the complete pipeline configuration.

## Usage

### GitHub Usage
  --owner $GITHUB_OWNER \
  --repository $REPOSITORY \
  --pr-id $PR_ID
```

### Validate Configuration

```bash
pr-review validate-config --config ./review-config.json
```

## Output Examples

### Console Output

```
================================================================================
  AI CODE REVIEW REPORT
================================================================================

Summary: 6/8 checks passed
  - Errors:   1
  - Warnings: 1
  - Info:     0

✓ naming-conventions
  [WARN ] Consider using camelCase for variable 'user_name'
         File: src/user.ts:45

✗ deleted-code-blocks
  [ERROR] Large deletion detected: 120 lines removed from auth module
         File: src/auth/authenticate.ts

✓ console-log-check
✓ hardcoded-credentials
✓ missing-error-handling
✓ todo-comments
✓ code-duplication
✓ missing-tests
================================================================================
```

### Markdown Report (Posted to PR)

![Example Report](docs/example-report.png)

## Development

```bash
# Install dependencies
npm install

# Run in development mode (GitHub)
npm run dev -- review --platform github --github-token ... --owner ... --repository ... --pr-id ...

# Run in development mode (Azure DevOps)
npm run dev -- review --platform azdo --org-url ... --azdo-pat ... --project ... --repository ... --pr-id ...

# Build
npm run build

# Run the built version
node dist/index.js review --platform github ...

# Run tests
npm test
```

## Project Structure

```
.
├── src/github/
│   │   └── client.ts          # GitHub API client
│   ├── 
│   ├── azure-devops/
│   │   └── client.ts          # Azure DevOps API client
│   ├── review/
│   │   ├── copilot-engine.ts  # Copilot SDK integration
│   │   └── reporter.ts        # Report formatting
│   ├── types/
## License

MIT

## Credits

Built with:
- [GitHub Copilot API](https://docs.github.com/en/copilot)
- [Octokit (GitHub REST API)](https://github.com/octokit/rest.js)
- [Azure DevOps Node API](https://github.com/microsoft/azure-devops-node-api)
- [GitHub Actions Toolkit](https://github.com/actions/toolkit)

---

**Note**: This tool requires a GitHub Copilot subscription.
