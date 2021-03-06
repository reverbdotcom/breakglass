import * as core from '@actions/core';
import {
  client,
  fetchCurrentSettings,
} from './github';
import { getContext } from './context';
import { getInput } from './input';

export async function checkForBranchProtection() {
  core.debug('checking for branch protection');

  const context = getContext();
  const { owner, repo } = context.repo;
  const input = getInput();
  const data = await fetchCurrentSettings();

  const errors = [];
  if (!data.protected) {
    errors.push('❌ - branch protection is not enabled');
  }

  const checks = data?.protection?.required_status_checks;
  if (!checks?.contexts?.length && input.requiredChecks.length) {
    errors.push('❌ - required status checks are not enforced');
  }

  if (checks?.enforcement_level !== 'everyone') {
    errors.push('❌ - not enabled for admins');
  }

  if (errors.length > 0) {
    core.debug('branch protection is missing or incomplete');
    await client.issues.create({
      owner,
      repo,
      labels: ['branch-protection-alert'],
      title: 'Branch Protection Missing or Incomplete',
      body: `
## Branch Protection Missing or Incomplete

The following errors were found when checking the branch protection settings for this repository.

${errors.join('\n')}

Please notify the repository admin and resolve immediately.`,
    });
  }
}
