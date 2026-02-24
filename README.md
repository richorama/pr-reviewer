# AI-Powered Code Review CLI

> 🚀 Review your code with AI before committing

AI-powered code review tool using **GitHub Copilot** for intelligent code analysis. Run locally on your codebase to catch issues before they reach pull requests.

## Features

- 🤖 **AI-Powered Reviews**: Leverages GitHub Copilot's language models for intelligent code analysis
- 💻 **Local First**: Review code changes directly in your development workflow
- 🌿 **Branch-Aware**: Automatically reviews changed files on feature branches, or entire repo on main
- 🔧 **Customizable Checks**: Define your own business rules with natural language
- 📊 **Detailed Reports**: Console output with optional markdown file export
- 🎯 **Convention-Based**: Auto-discovers config files, no setup required
- ⚡ **Fast & Easy**: Simple CLI with no external dependencies beyond Copilot API

## Quick Start

### Installation

1. **Clone and build:**
   ```bash
   git clone https://github.com/richorama/pr-reviewer.git
   cd pr-reviewer
   npm install
   npm run build
   ```

2. **Link globally (optional):**
   ```bash
   npm link
   # Now you can use 'pr-review' command anywhere
   ```

   Or just run directly:
   ```bash
   node dist/cli.js
   ```

### Setup

1. **Get a GitHub Copilot token:**
   - Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   - Generate new token (classic) with `copilot` scope
   - Copy the token

2. **Set your environment variable:**
   ```bash
   export COPILOT_TOKEN="ghp_your_token_here"
   ```
   
   Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to make it permanent:
   ```bash
   echo 'export COPILOT_TOKEN="ghp_your_token_here"' >> ~/.bashrc
   ```

### Usage

```bash
# Review current directory (if you used npm link)
pr-review

# Or run directly
node dist/cli.js

# Review specific directory
pr-review ./my-project

# Save report to file
pr-review --output review-report.md

# Fail on errors (useful for pre-commit hooks)
pr-review --fail-on-error

# Show all findings including info-level
pr-review --verbose
```

**How it works:**
- On **feature branches**: Reviews only the files changed since branching from main/develop
- On **main/master/develop**: Reviews all files in the repository

## CLI Options

```
pr-review [directory] [options]

Arguments:
  directory              Path to the git repository to review
                        (default: current directory)

Options:
  --config <path>        Path to review configuration file
                        (default: auto-discover)
  --output <path>        Save review report to markdown file
  --fail-on-error        Exit with code 1 if errors found
                        (useful for CI/CD and git hooks)
  --verbose, -v          Show detailed output including info-level findings
  --help, -h             Show help message

Environment Variables:
  COPILOT_TOKEN          GitHub Copilot API token (required)
  GH_TOKEN               Alternative name for COPILOT_TOKEN
  GITHUB_TOKEN           Alternative name for COPILOT_TOKEN
```

## Configuration

### Auto-Discovery

The tool automatically searches for a config file in this order:

1. `pr-review.config.json`
2. `.pr-review.json`
3. `.github/pr-review.json`
4. `review-config.json`

### Example Configuration

```json
{
  "checks": [
    {
      "name": "naming-conventions",
      "description": "Verify file and variable names follow conventions",
      "enabled": true,
      "severity": "warning",
      "rule": "Check that files use camelCase or kebab-case, classes use PascalCase, constants use UPPER_SNAKE_CASE"
    },
    {
      "name": "hardcoded-credentials",
      "description": "Detect hardcoded credentials and secrets",
      "enabled": true,
      "severity": "error",
      "rule": "Identify hardcoded API keys, passwords, tokens, or secrets. Ignore empty placeholder variables and environment variable names."
    },
    {
      "name": "missing-error-handling",
      "description": "Ensure async operations have error handling",
      "enabled": true,
      "severity": "warning",
      "rule": "Check that async functions have try-catch blocks or .catch() handlers, and Promise chains include error handling"
    }
  ]
}
```

See [review-config.json](./review-config.json) for a complete example with 8 pre-configured checks.

### Built-in Checks

The default [review-config.json](./review-config.json) includes:

1. **Naming Conventions** - Validates file and variable naming standards
2. **Deleted Code Blocks** - Flags large code deletions that might indicate lost functionality
3. **Console Log Check** - Detects debug logging statements  
4. **Hardcoded Credentials** - Finds potential security issues
5. **Missing Error Handling** - Ensures async operations handle errors properly
6. **TODO Comments** - Flags TODO/FIXME comments for review
7. **Code Duplication** - Identifies potential duplicate code
8. **Missing Tests** - Checks if new features include test files

### Custom Checks

Add your own checks by defining them in natural language:

```json
{
  "checks": [
    {
      "name": "accessibility",
      "description": "Check for accessibility issues in React components",
      "enabled": true,
      "severity": "warning",
      "rule": "Verify that interactive elements have proper ARIA labels, images have alt text, and forms have associated labels"
    },
    {
      "name": "performance",
      "description": "Identify potential performance issues",
      "enabled": true,
      "severity": "info",
      "rule": "Look for unnecessary re-renders, missing memoization, large bundle imports, or N+1 query patterns"
    }
  ]
}
```

## Use Cases

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# If you used npm link:
pr-review --fail-on-error

# Or use direct path:
# node /path/to/pr-reviewer/dist/cli.js --fail-on-error
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### CI/CD Integration

```bash
# In your CI pipeline (after cloning the pr-reviewer repo)
cd pr-reviewer && npm install && npm run build
node dist/cli.js --fail-on-error --output review-report.md

# Or if you've made it available globally in your CI environment
pr-review --fail-on-error --output review-report.md
```

### Team Review Standards

Create a shared `pr-review.config.json` in your repository to enforce consistent code review standards across your team.

### Pre-Release Audit

Before releases, run on main branch to audit entire codebase:

```bash
git checkout main
pr-review --verbose --output audit-report.md
```

## Example Output

### Console

```
🤖 AI-Powered Code Review CLI

📂 Working directory: /home/user/my-project
🌿 Current branch: feature/new-api
🔍 Comparing against: main

📊 Found 5 changed files to review

Running check: hardcoded-credentials...
Running check: naming-conventions...
Running check: missing-error-handling...

============================================================
📊 Review Summary
============================================================
Total checks run: 8
✅ Passed: 6
❌ Failed: 2

  Errors:   1
  Warnings: 1
  Info:     0
============================================================

📋 Detailed Results:

❌ ERRORS:
  [hardcoded-credentials] Potential API key found in code
    File: src/config.ts:15

⚠️  WARNINGS:
  [naming-conventions] Variable should use camelCase
    File: src/user.ts:42

✅ Review completed successfully
```

## Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/richorama/pr-reviewer.git
cd pr-reviewer

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.js

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Project Structure

```
src/
├── cli.ts                     # CLI entry point
├── index.ts                   # Main review logic
├── local/
│   └── file-reader.ts        # Git file change detection
├── review/
│   ├── copilot-api-engine.ts # Copilot API integration
│   └── reporter.ts           # Report formatting
└── types/
    └── index.ts              # TypeScript type definitions
```

## Troubleshooting

### "No authentication token found"

Ensure you've set the `COPILOT_TOKEN` environment variable:
```bash
export COPILOT_TOKEN="ghp_your_token_here"
```

### "Directory is not a git repository"

Make sure you're running the command in a git repository:
```bash
git init  # If needed
```

### "No review configuration file found"

Either create a config file or use the `--config` option:
```bash
pr-review --config path/to/config.json
```

### "Authentication failed. Ensure your token has 'copilot' scope"

Your token needs the `copilot` scope. Generate a new token with the correct permissions at [https://github.com/settings/tokens](https://github.com/settings/tokens).

## Requirements

- **Node.js**: >= 18.0.0
- **GitHub Copilot subscription**: Required for AI-powered analysis
- **Git**: Must be run in a git repository

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run `npm test` to verify
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT

## Credits

Built with:
- [GitHub Copilot API](https://docs.github.com/en/copilot)
- [TypeScript](https://www.typescriptlang.org/)
- [Node.js](https://nodejs.org/)

---

**Made with ❤️ using AI-powered code review**
