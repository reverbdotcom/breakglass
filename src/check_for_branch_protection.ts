import * as core from '@actions/core';
import { client } from './github';
import { getContext } from './context';

async function fetchCurrentSettings(owner: string, repo: string) {
  try {
    return await client.repos.getBranch({
      owner,
      repo,
      branch: 'master',
    });
  } catch (e) {
    core.debug(`could not check for branch protection: ${e}`);
    throw e;
  }
}

export async function checkForBranchProtection() {
  core.debug('checking for branch protection');

  const context = getContext();
  const { owner, repo } = context.repo;
  const resp = await fetchCurrentSettings(owner, repo);

  const { data } = resp;

  const errors = [];
  if (!data.protected) {
    errors.push('❌ - branch protection is not enabled');
  }

  if (!data?.protection?.required_status_checks?.contexts?.length) {
    errors.push('❌ - required status checks are not enforced');
  }

  if (data?.protection?.required_status_checks?.enforcement_level !== 'everyone') {
    errors.push('❌ - not enabled for admins');
  }

  if (errors.length > 0) {
    core.debug('branch protection is missing or incomplete');
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
