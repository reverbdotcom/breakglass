// see action.yml for more details
import * as core from '@actions/core';

export interface Input {
  githubToken: string;
  instructions: string;
  requiredChecks: string[];
  skipApprovalLabel: string;
  skipCILabel: string;
  posthocApprovalLabel?: string;
  slackHook: string;
  verifiedCILabel: string;
  branch: string;
}

export function getInput(): Input {
  return {
    githubToken: core.getInput('github_token'),
    instructions: core.getInput('instructions'),
    requiredChecks: core.getInput('required_checks').split(','),
    skipApprovalLabel: core.getInput('skip_approval_label') || 'emergency-approval',
    skipCILabel: core.getInput('skip_ci_label') || 'emergency-ci',
    slackHook: core.getInput('slack_hook'),
    posthocApprovalLabel: core.getInput('posthoc_approval_label') || 'posthoc-approval',
    verifiedCILabel: core.getInput('verified_ci_label') || 'verified-ci',
    branch: core.getInput('branch'),
  };
}
