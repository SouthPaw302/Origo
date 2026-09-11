# Vercel Deployment Budget — Read First

This repository is connected to Vercel. Treat every push to any Vercel-tracked branch as a scarce deployment action.

## Mandatory deployment rule

- **Do not use repeated pushes to a Vercel-tracked branch as an edit/test loop.**
- Batch related work locally, in a sandbox, or on a non-deploy branch. Local commits are fine; remote pushes to a deploy-tracked branch are not a progress-report mechanism.
- Before pushing a Vercel-tracked branch, finish the intended batch and run the relevant tests, typecheck, and production build when available.
- Push a deploy-tracked branch only for a meaningful checkpoint, release candidate, completed feature/fix batch, or an explicit user request to deploy/push that checkpoint.
- If a deployment fails, diagnose and reproduce the fix locally first. Do not repeatedly push speculative fixes to discover whether they work on Vercel.
- When remote-only tooling requires GitHub commits, combine a coherent set of changes into the fewest practical pushes to the deploy-tracked branch.
- Prefer one validated Vercel deployment over many incremental deployments.
- Preserve the application's existing architecture and repository-specific instructions. This rule governs deployment cadence only.

**Rule of thumb:** if the main reason for a push is “see whether it works on Vercel,” test it locally first unless the behavior can only be validated in Vercel.
