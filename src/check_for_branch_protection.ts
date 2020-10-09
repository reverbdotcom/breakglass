import { client } from './github';
import { getContext } from './context';

export async function checkForBranchProtection() {
  const context = getContext();
  const { owner, repo } = context.repo;

  const resp = await client.repos.getBranchProtection({
    owner,
    repo,
    branch: 'master',
  });

  const { data } = resp;

  const errors = [];
  if (data.required_status_checks.contexts.length === 0) {
    errors.push('❌ - required status checks are not enforced');
  }

  if (!data.enforce_admins.enabled) {
    errors.push('❌ - not enabled for admins');
  }

  if (!data.required_pull_request_reviews) {
    errors.push('❌ - pull request reviews are not enforced');
  }

  if (!data.required_pull_request_reviews?.dismiss_stale_reviews) {
    errors.push('❌ - "dismiss stale reviews" is not enabled');
  }

  if (errors.length > 0) {
    await client.issues.create({
      owner,
      repo,
      title: 'Branch Protection Missing or Incomplete',
      body: `
## Branch Protection Missing or Incomplete

The following errors were found when checking the branch protection settings for this repository.

${errors.join('\n')}

Please notify the repository admin and resolve immediately.`,
    });
  }
}
