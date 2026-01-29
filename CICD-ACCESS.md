# CI/CD Access Requirements

## TL;DR: Yes, but with one caveat

✅ **The tool CAN access everything it needs** when running in GitHub Actions or Azure Pipelines for that PR.

⚠️ **BUT** you need to provide a **GitHub Personal Access Token from a Copilot-enabled account** as a secret.

## What Gets Accessed Automatically

### GitHub Actions (reviewing GitHub PRs)
| Resource | Token | Access |
|----------|-------|--------|
| PR metadata (title, description, author) | `GITHUB_TOKEN` (auto-provided) | ✅ Yes |
| PR file changes and diffs | `GITHUB_TOKEN` (auto-provided) | ✅ Yes |
| Post review comments | `GITHUB_TOKEN` (auto-provided) | ✅ Yes |
| **GitHub Copilot API** | ❌ **Needs manual setup** | See below |

### Azure DevOps Pipeline (reviewing Azure DevOps PRs)
| Resource | Token | Access |
|----------|-------|--------|
| PR metadata (title, description, author) | `System.AccessToken` (auto-provided) | ✅ Yes |
| PR file changes and diffs | `System.AccessToken` (auto-provided) | ✅ Yes |
| Post review comments | `System.AccessToken` (auto-provided) | ✅ Yes |
| **GitHub Copilot API** | ❌ **Needs manual setup** | See below |

## The One Manual Requirement: Copilot Authentication

### Why is this needed?

The GitHub Copilot CLI (which powers the AI analysis) needs to authenticate with GitHub's Copilot service. The automatic tokens provided by CI/CD platforms (`GITHUB_TOKEN`, `System.AccessToken`) **do not** include Copilot API access.

### What you need to do:

1. **Get a GitHub Personal Access Token**
   - From a GitHub account that has an active Copilot subscription
   - Scope: Just basic access is needed (the token is used for Copilot CLI auth, not repo access)
   
2. **Add it as a secret:**
   - **GitHub Actions**: Repository Settings → Secrets → Add `COPILOT_TOKEN`
   - **Azure Pipelines**: Pipeline → Variables → Add `COPILOT_TOKEN` (mark as secret)

3. **The workflow handles the rest**
   - Installs `gh` CLI
   - Runs `gh auth login` with your token
   - Copilot CLI now has access to the AI service

## Complete Access Flow

### GitHub Actions Example:
```yaml
# PR opened → GitHub Actions workflow triggered
steps:
  - uses: actions/checkout@v4
    # Uses GITHUB_TOKEN (auto) to fetch code
    
  - name: Authenticate Copilot CLI
    run: echo ${{ secrets.COPILOT_TOKEN }} | gh auth login --with-token
    # Uses your manual secret to auth Copilot
    
  - name: Run Review
    run: |
      pr-review review \
        --platform github \
        --github-token ${{ secrets.GITHUB_TOKEN }} \    # PR access (auto)
        --owner ${{ github.repository_owner }} \
        --repository ${{ github.event.repository.name }} \
        --pr-id ${{ github.event.pull_request.number }}
    # Tool can now:
    # ✅ Fetch PR files (via GITHUB_TOKEN)
    # ✅ Analyze with Copilot AI (via authenticated CLI)
    # ✅ Post comments (via GITHUB_TOKEN)
```

### Azure DevOps Example:
```yaml
# PR opened → Azure Pipeline triggered
steps:
  - script: echo $(COPILOT_TOKEN) | gh auth login --with-token
    # Uses your manual secret to auth Copilot
    
  - script: |
      pr-review review \
        --platform azdo \
        --org-url $(System.CollectionUri) \          # PR access (auto)
        --azdo-pat $(System.AccessToken) \           # PR access (auto)
        --project $(System.TeamProject) \
        --repository $(Build.Repository.Name) \
        --pr-id $(System.PullRequest.PullRequestId)
    # Tool can now:
    # ✅ Fetch PR files (via System.AccessToken)
    # ✅ Analyze with Copilot AI (via authenticated CLI)
    # ✅ Post comments (via System.AccessToken)
```

## Security Notes

- The `COPILOT_GITHUB_TOKEN` is only used to authenticate the Copilot CLI with GitHub's AI service
- PR access uses the platform's built-in tokens (more secure, scoped to the specific PR)
- The Copilot token should be from a service account or dedicated CI account
- Token can be rotated independently of your repos

## Common Issues

### ❌ "Authentication required for Copilot"
**Cause**: Missing or invalid `COPILOT_TOKEN`
**Fix**: Add the secret with a valid PAT from a Copilot-enabled account

### ❌ "No Copilot subscription"
**Cause**: The GitHub account whose token you're using doesn't have Copilot access
**Fix**: Use a token from an account with an active Copilot subscription

### ❌ "Permission denied on PR"
**Cause**: The auto-provided token lacks permissions
**Fix**: 
- GitHub: Ensure workflow has `permissions: pull-requests: write`
- Azure: Ensure pipeline has "Contribute to pull requests" permission

## Summary

**Question**: Can it access everything it needs when running in CI/CD for that PR?

**Answer**: **Yes**, with proper setup:
- ✅ PR data: Accessed automatically via platform tokens
- ✅ File changes: Accessed automatically via platform tokens  
- ✅ Post comments: Accessed automatically via platform tokens
- ⚠️ Copilot AI: Requires a one-time setup of `COPILOT_TOKEN` secret

Once the secret is added (same name for both platforms!), it works seamlessly for all PRs! 🎉
