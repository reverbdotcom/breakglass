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
}

export function getInput(): Input {
  return {
    githubToken: core.getInput('github_token', {
      required: true,
    }),
    instructions: core.getInput('instructions'),
    requiredChecks: core.getInput('required_checks', {
      required: true,
    }).split(','),
    skipApprovalLabel: core.getInput('skip_approval_label'),
    skipCILabel: core.getInput('skip_ci_label'),
    slackHook: core.getInput('slack_hook', {
      required: true,
    }),
    posthocApprovalLabel: core.getInput('retroactive_approval_label'),
    verifiedCILabel: core.getInput('verified_ci_label'),
  };
}
