# Publishing Guide

This guide walks you through publishing the PR Reviewer as both a GitHub Action and an Azure DevOps Marketplace Extension.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git repository with the code
- GitHub account with Copilot access
- Azure DevOps account (for Azure DevOps Marketplace)

## Publishing to GitHub Actions

GitHub Actions don't require a separate publishing step - users reference your action directly from your repository.

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Refactor as GitHub Action and Azure DevOps Extension"
git push origin main
```

### 2. Create a Release

Users typically reference actions by version tag (e.g., `@v1`). Create a release:

```bash
# Tag the release
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0

# Also create a major version tag that auto-updates
git tag -a v1 -m "Version 1"
git push origin v1 --force
```

### 3. Update Version Tags (for future releases)

```bash
# For new releases, update both specific and major version tags
git tag -a v1.0.1 -m "Bug fixes"
git push origin v1.0.1

# Move the v1 tag to latest
git tag -a v1 -m "Version 1" --force
git push origin v1 --force
```

### 4. Users Reference Your Action

Users add this to their `.github/workflows/pr-review.yml`:

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
      - name: AI PR Review
        uses: YOUR_USERNAME/pr-reviewer@v1
        with:
          copilot-token: ${{ secrets.COPILOT_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          post-comment: true
          fail-on-error: true
```

### 5. Optional: Publish to GitHub Marketplace

To make your action discoverable in GitHub Marketplace:

1. Go to your repository on GitHub
2. Click "Releases" → "Draft a new release"
3. Choose your tag (e.g., `v1.0.0`)
4. Check "Publish this Action to the GitHub Marketplace"
5. Choose primary category (e.g., "Code Quality")
6. Add release notes
7. Click "Publish release"

**Note:** Your repository must be public to publish to GitHub Marketplace.

---

## Publishing to Azure DevOps Marketplace

This is your first time publishing to Azure DevOps Marketplace - exciting! Here's the complete walkthrough.

### Step 1: Create Publisher Account

1. Go to [Visual Studio Marketplace Publishing Portal](https://marketplace.visualstudio.com/manage)
2. Sign in with your Azure DevOps account
3. Click "Create Publisher"
4. Fill in:
   - **Publisher ID**: Unique identifier (e.g., `yourname` or `yourorg`)
   - **Display Name**: Public name (e.g., "Your Name" or "Your Org")
   - **Description**: Brief description of your publisher profile
5. Click "Create"

**Important:** Save your Publisher ID - you'll need it for the extension manifest.

### Step 2: Generate Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com)
2. Click your profile picture → Security
3. Click "+ New Token"
4. Configure:
   - **Name**: "Marketplace Publishing"
   - **Organization**: Select "All accessible organizations"
   - **Expiration**: Choose expiration (90 days, 1 year, or custom)
   - **Scopes**: Click "Show all scopes" and select:
     - ✅ **Marketplace** → **Manage** (critical!)
5. Click "Create"
6. **Copy the token immediately** (you won't see it again)

```bash
# Store the token securely
export AZURE_DEVOPS_PAT="your-personal-access-token"
```

### Step 3: Update Extension Manifest

Update `azure-devops/vss-extension.json` with your details:

```json
{
  "manifestVersion": 1,
  "id": "pr-reviewer",
  "name": "AI PR Reviewer",
  "version": "1.0.0",
  "publisher": "YOUR_PUBLISHER_ID",  // ← Replace with your Publisher ID from Step 1
  "description": "AI-powered pull request review using GitHub Copilot",
  ...
}
```

Also update the repository URLs and task ID:

1. Replace `YOUR_USERNAME` with your GitHub username
2. Generate a unique GUID for the task:

```bash
# On Linux/macOS
uuidgen
# On Windows PowerShell
[guid]::NewGuid()
```

Update `azure-devops/task/task.json`:

```json
{
  "id": "YOUR-GENERATED-GUID-HERE",  // ← Replace with generated GUID
  ...
}
```

### Step 4: Create Extension Icon

Create a 128x128 PNG icon at `azure-devops/icon.png`. You can:

- Design in Figma/Canva and export as PNG
- Use an AI image generator
- Convert from SVG: `convert icon.svg -resize 128x128 icon.png`

### Step 5: Build and Package Extension

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Package the Azure DevOps extension (creates .vsix file)
npm run package:azdo
```

This creates `azure-devops/YOUR_PUBLISHER_ID.pr-reviewer-1.0.0.vsix`

### Step 6: Publish Extension

#### Option A: Using Command Line (Recommended)

```bash
# Install tfx-cli globally (if not already installed)
npm install -g tfx-cli

# Login with your PAT
tfx login

# When prompted:
# - Service URL: https://marketplace.visualstudio.com
# - Personal Access Token: [paste your PAT from Step 2]

# Publish the extension
tfx extension publish --manifest-globs azure-devops/vss-extension.json --token $AZURE_DEVOPS_PAT
```

#### Option B: Using Web Portal

1. Go to [Marketplace Publishing Portal](https://marketplace.visualstudio.com/manage)
2. Click your publisher name
3. Click "+ New extension" → "Azure DevOps"
4. Upload the `.vsix` file from Step 5
5. Click "Upload"

### Step 7: Share Extension (Private Testing)

Your extension starts as **private**. Share it with your organization to test:

1. In the [Publishing Portal](https://marketplace.visualstudio.com/manage), click your extension
2. Click "Share/Unshare"
3. Enter your Azure DevOps organization name
4. Click "Share"

### Step 8: Install Extension in Your Organization

1. Go to your Azure DevOps organization (e.g., `https://dev.azure.com/yourorg`)
2. Click "Organization settings" (bottom left)
3. Click "Extensions" under General
4. Click "Shared" tab
5. Find "AI PR Reviewer" and click "Install"
6. Select which projects to enable it for

### Step 9: Test the Extension

Create a test pipeline in Azure Pipelines:

```yaml
trigger: none

pr:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: PRReviewer@1
    inputs:
      copilotToken: $(COPILOT_TOKEN)
      postComment: true
      failOnError: true
```

Add `COPILOT_TOKEN` as a secret pipeline variable:

1. Edit pipeline → Variables
2. Add variable:
   - **Name**: `COPILOT_TOKEN`
   - **Value**: Your GitHub PAT with Copilot access
   - ✅ **Keep this value secret**

### Step 10: Make Extension Public (Optional)

Once tested and ready for public release:

1. In the [Publishing Portal](https://marketplace.visualstudio.com/manage), click your extension
2. Click "Make public"
3. Confirm the action

**Note:** Public extensions are reviewed by Microsoft and must meet marketplace guidelines.

---

## Updating Extensions

### GitHub Action Updates

```bash
# Make your changes
git add .
git commit -m "Update feature"

# Create new version tag
git tag -a v1.0.1 -m "Version 1.0.1"
git push origin v1.0.1

# Update major version tag
git tag -a v1 -m "Version 1" --force
git push origin v1 --force
```

Users referencing `@v1` automatically get updates. Users referencing `@v1.0.0` stay pinned.

### Azure DevOps Extension Updates

1. Update version in `azure-devops/vss-extension.json`:

```json
{
  "version": "1.0.1",  // ← Increment version
  ...
}
```

2. Update version in `azure-devops/task/task.json`:

```json
{
  "version": {
    "Major": 1,
    "Minor": 0,
    "Patch": 1  // ← Increment patch
  },
  ...
}
```

3. Rebuild and republish:

```bash
npm run build
npm run package:azdo
tfx extension publish --manifest-globs azure-devops/vss-extension.json --token $AZURE_DEVOPS_PAT
```

**Semantic Versioning:**
- **Patch** (1.0.X): Bug fixes, no breaking changes
- **Minor** (1.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking changes

---

## Troubleshooting

### GitHub Action Issues

**"Action not found"**
- Ensure repository is public OR users have access to private repo
- Check tag exists: `git tag -l`
- Verify action.yml is in repository root

**"Required input not provided"**
- Ensure users set `copilot-token` in workflow
- Check input names match action.yml exactly (case-sensitive)

### Azure DevOps Extension Issues

**"TF401019: The Git repository with name or identifier does not exist"**
- Update repository URLs in vss-extension.json with your actual GitHub repo

**"Extension version already exists"**
- Increment version number in both vss-extension.json and task.json
- Can't republish same version

**"Task GUID conflict"**
- Generate a new unique GUID for task.json
- Each task needs globally unique identifier

**"Extension not showing in organization"**
- Ensure extension is shared with your organization
- Check organization settings → Extensions → Shared tab

**"Pipeline can't find task"**
- Verify extension is installed in the project
- Use correct task name: `PRReviewer@1` (matches task.json name field)

---

## Distribution Checklist

### Before Publishing

- [ ] Update version numbers in all manifests
- [ ] Update URLs and repository links with your details
- [ ] Generate unique GUID for Azure DevOps task
- [ ] Update Publisher ID in vss-extension.json
- [ ] Create 128x128 icon.png
- [ ] Test locally with `npm run build`
- [ ] Update README.md with usage examples
- [ ] Add proper LICENSE file

### GitHub Action

- [ ] Code pushed to GitHub
- [ ] Version tags created (e.g., v1.0.0, v1)
- [ ] Action tested in test repository
- [ ] README includes usage example
- [ ] (Optional) Published to GitHub Marketplace

### Azure DevOps Extension

- [ ] Publisher account created
- [ ] Personal Access Token generated (with Marketplace → Manage scope)
- [ ] Extension manifest updated with publisher ID
- [ ] Task GUID generated and added
- [ ] Icon created (128x128 PNG)
- [ ] Extension packaged (.vsix created)
- [ ] Extension published to marketplace
- [ ] Extension shared with test organization
- [ ] Extension tested in pipeline
- [ ] (Optional) Extension made public

---

## Resources

### GitHub Actions
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Creating Actions](https://docs.github.com/en/actions/creating-actions)
- [Publishing Actions](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)

### Azure DevOps Extensions
- [Extension Quickstart](https://learn.microsoft.com/en-us/azure/devops/extend/get-started/node)
- [Package/Publish Extensions](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview)
- [Extension Manifest Reference](https://learn.microsoft.com/en-us/azure/devops/extend/develop/manifest)
- [Task Schema Reference](https://learn.microsoft.com/en-us/azure/devops/extend/develop/build-task-schema)

### Tools
- [tfx-cli Documentation](https://github.com/microsoft/tfs-cli)
- [Marketplace Publishing Portal](https://marketplace.visualstudio.com/manage)

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review extension logs in Azure DevOps pipeline runs
3. Check GitHub Actions workflow logs
4. Open an issue on GitHub: `https://github.com/YOUR_USERNAME/pr-reviewer/issues`

Happy publishing! 🚀
