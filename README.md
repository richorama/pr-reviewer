# AI-Powered PR Reviewer

An AI-powered CLI tool that uses **GitHub Copilot SDK** to perform intelligent code reviews on **GitHub** and **Azure DevOps** pull requests. This tool applies customizable business-specific rules to check for naming conventions, deleted code blocks, security issues, and more.

## Features

- 🤖 **AI-Powered Reviews**: Leverages GitHub Copilot's advanced language models for intelligent code analysis
- 🔧 **Customizable Checks**: Define your own business rules in JSON configuration
- 📊 **Detailed Reports**: Get comprehensive reports in console, markdown, or posted directly to your PR
- ⚡ **Multi-Platform**: Works with both GitHub and Azure DevOps repositories
- 🎯 **Multiple Check Types**: Built-in checks for naming conventions, deleted code, security, and more

## Prerequisites

1. **Node.js** >= 18.0.0
2. **GitHub Copilot CLI** installed and configured
   - Install: Follow the [GitHub Copilot CLI installation guide](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli)
   - Ensure `copilot` is available in your PATH
3. **Platform-specific access token**:
   - **GitHub**: Personal Access Token with `repo` scope
   - **Azure DevOps**: Personal Access Token with Code (Read) and Pull Request Threads (Read & Write)

## Installation

This tool lives in your repository and is not published to npm.

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### 1. Environment Variables

Create a `.env` file in your project root or set environment variables:

```bash
# Platform Selection (github or azdo)
PLATFORM=github

# GitHub Configuration
GITHUB_TOKEN=ghp_your_github_token
GITHUB_OWNER=your-username-or-org

# Azure DevOps Configuration
AZDO_ORG_URL=https://dev.azure.com/your-organization
AZDO_PAT=your-personal-access-token
AZDO_PROJECT=YourProject

# Common Configuration
REPOSITORY=YourRepo
PR_ID=123

# Optional: Custom Copilot CLI path
# COPILOT_CLI_PATH=/custom/path/to/copilot
```

### 2. Review Configuration

Create a `review-config.json` file to define your custom checks. See [review-config.json](./review-config.json) for a complete example.

Example configuration:

```json
{
  "checks": [
    {
      "name": "naming-conventions",
      "description": "Verify that file and variable names follow naming conventions",
      "enabled": true,
      "severity": "warning",
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

The tool includes these pre-configured checks:

1. **Naming Conventions** - Validates file and variable naming standards
2. **Deleted Code Blocks** - Flags large code deletions
3. **Console Log Check** - Detects console.log statements
4. **Hardcoded Credentials** - Finds potential security issues
5. **Missing Error Handling** - Ensures async operations have proper error handling
6. **TODO Comments** - Flags TODO/FIXME comments
7. **Code Duplication** - Identifies potential duplicate code
8. **Missing Tests** - Checks if new features include tests

## Usage

### GitHub Usage

```bash
# Review a GitHub PR
pr-review review \
  --platform github \
  --github-token $GITHUB_TOKEN \
  --owner your-username \
  --repository your-repo \
  --pr-id 123

# Using environment variables from .env
pr-review review \
  --platform github \
  --github-token $GITHUB_TOKEN \
  --owner $GITHUB_OWNER \
  --repository $REPOSITORY \
  --pr-id $PR_ID
```

### Azure DevOps Usage

```bash
# Review an Azure DevOps PR
pr-review review \
  --platform azdo \
  --org-url https://dev.azure.com/your-org \
  --azdo-pat $AZDO_PAT \
  --project YourProject \
  --repository YourRepo \
  --pr-id 123
```

### Post Results to PR

```bash
# GitHub
pr-review review \
  --platform github \
  --github-token $GITHUB_TOKEN \
  --owner $GITHUB_OWNER \
  --repository $REPOSITORY \
  --pr-id $PR_ID \
  --post-comment

# Azure DevOps
pr-review review \
  --platform azdo \
  --org-url $AZDO_ORG_URL \
  --azdo-pat $AZDO_PAT \
  --project $AZDO_PROJECT \
  --repository $REPOSITORY \
  --pr-id $PR_ID \
  --post-comment
```

### Save Report to File

```bash
pr-review review \
  --platform github \
  --github-token $GITHUB_TOKEN \
  --owner $GITHUB_OWNER \
  --repository $REPOSITORY \
  --pr-id $PR_ID \
  --output review-report.md
```CI/CD Integration
The tool runs directly from the repository in your CI/CD pipeline. The workflows will check out the code, build the tool, and run it.
### Prerequisites for CI/CD

**IMPORTANT**: The GitHub Copilot CLI requires authentication in CI/CD environments. You need:

1. **A GitHub account with Copilot access** (the account running the reviews)
2. **A Personal Access Token (PAT)** from that account
3. **The PAT stored as a secret** in your CI/CD platform

The `GITHUB_TOKEN` provided by Actions/Pipelines **cannot** authenticate with Copilot - you need a separate PAT from a Copilot-enabled account.

### GitHub Actions

**Setup Steps:**
1. Get a PAT from a GitHub account with Copilot access
2. Add it as a repository secret named `GITHUB_COPILOT_TOKEN`
3. Use the workflow below:

Create `.github/workflows/pr-review.yml`:

```yaml
name: AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install GitHub Copilot CLI
        run: npm install -g @github/copilot-cli

      - name: Authenticate Copilot CLI
        run: |
          echo ${{ secrets.GITHUB_COPILOT_TOKEN }} | gh auth login --with-token
          gh auth setup-git
          copilot --version
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
3. Add a variable named `GITHUB_COPILOT_TOKEN` with your PAT value (check "Keep this value secret")
4. Use the pipeline below:

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
│   │   └── index.ts           # TypeScript type definitions
│   └── index.ts               # CLI entry point
├── review-config.json         # Default review configuration
├── .env.example               # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Customizing Checks

You can customize checks by modifying `review-config.json`:

```json
{
  "checks": [
    {
      "name": "your-custom-check",
      "description": "Description of what this check does",
      "enabled": true,
      "severity": "error",
      "rule": "Detailed instructions for what Copilot should check..."
    }
  ]
}
```

The `rule` field should contain clear, specific instructions for the AI to follow. The more detailed your rule, the better the analysis.

## Troubleshooting

### "Copilot CLI not found"

Make sure the Copilot CLI is installed and in your PATH:

```bash
copilot --version
```

If not installed, follow the [installation guide](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli).

### "Not authenticated with Copilot" in CI/CD

This is the most common issue. The Copilot CLI needs authentication separate from the pipeline's default tokens.

**Solution:**
1. Create a GitHub Personal Access Token from an account that has Copilot access
2. Add it as a secret to your CI/CD platform:
   - **GitHub Actions**: Add as `GITHUB_COPILOT_TOKEN` in repository secrets
   - **Azure Pipelines**: Add as `GITHUB_COPILOT_TOKEN` in pipeline variables (mark as secret)
3. The workflow will use this to authenticate via `gh auth login`

**Why is this needed?**
- GitHub Actions' `GITHUB_TOKEN` doesn't include Copilot API access
- Azure Pipelines' `System.AccessToken` is for Azure DevOps, not GitHub Copilot
- The Copilot CLI needs to authenticate with a GitHub account that has an active Copilot subscription

**For GitHub:**
- Ensure your GitHub token has the `repo` scope

**For Azure DevOps:**
- Ensure your PAT has Code (Read) and Pull Request Threads (Read & Write) permissionsess Token has the correct permissions:
- Code (Read)
- Pull Request Threads (Read & Write)

### "No file changes to review"

This can happen if:
- The PR has no actual code changes
- The API couldn't fetch the changes (check token permissions)

### CI/CD Access Summary

**What the tool needs access to:**

| Component | GitHub Actions | Azure Pipelines |
|-----------|---------------|-----------------|
| **PR Metadata** | ✅ `GITHUB_TOKEN` (auto) | ✅ `System.AccessToken` (auto) |
| **PR Files/Diffs** | ✅ `GITHUB_TOKEN` (auto) | ✅ `System.AccessToken` (auto) |
| **Post Comments** | ✅ `GITHUB_TOKEN` (auto) | ✅ `System.AccessToken` (auto) |
| **Copilot CLI Auth** | ❌ Need `COPILOT_GITHUB_TOKEN` (manual) | ❌ Need `GITHUB_COPILOT_TOKEN` (manual) |

**Yes, it can access everything needed** - with one caveat: you must provide a Copilot-enabled GitHub PAT for the AI analysis. The PR data itself is accessible via the platform's built-in tokens.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Credits

BuiOctokit (GitHub REST API)](https://github.com/octokit/rest.js)
- [Azure DevOps Node API](https://github.com/microsoft/azure-devops-node-api)
- [Commander.js](https://github.com/tj/commander.js)

---

**Note**: This tool requires a GitHub Copilot subscrip

**Note**: This tool requires a GitHub Copilot subscription and an active Azure DevOps organization.
