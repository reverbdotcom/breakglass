import * as core from '@actions/core';
import * as github from '@actions/github';
import { Input } from './input';
import { postMessage } from './slack';
import { formatComment } from './github';

/**
 * Main entry point for all pullRequest actions.
 * We've split these up for easier unit testing.
 *
 * This action is responsible for removing PR checks that
 * otherwise lock the merge button in the case of an emergency.
 *
 * While removing these checks it does so through explicit labels
 * and will notify any specified slack rooms.
 */
export async function onPullRequest(octokit: github.GitHub, context, input: Input) {
  const { payload } = context;

  if (payload.action === 'labeled') {
    await onLabel(octokit, context, input);
    return;
  }

  if (payload.action === 'opened') {
    await onOpen(octokit, context, input);
    return;
  }
}

/**
 * onLabel sets up the PR with a basic checklist
 */
async function onOpen(octokit: github.GitHub, context, input: Input) {
  const body = input.instructions;
  await comment(
    octokit,
    context.issue,
    body
  );
}

async function byPassChecks(octokit, issue, sha, checks) {
  const reqs = checks.map(async (context) => {
    core.debug(`bypassing check - ${context}`);
    return octokit.repos.createStatus({
      owner: issue.owner,
      repo: issue.repo,
      sha: sha,
      context,
      state: 'success',
    });
  });

  await Promise.all(reqs);
}

/**
 * onLabel event checks to see if the emergency-ci or emergency-approval
 * label has been applied. In the case that either have, the corresponding
 * check will be removed and recorded.
 */
async function onLabel(octokit: github.GitHub, context, input: Input) {
  const { issue, payload } = context;
  const { number } = issue;
  const { html_url } = payload.pull_request;

  core.debug(`label event received: ${pp(payload)}`);
  if (payload.label.name === input.skipCILabel) {
    core.debug(`skip_ci_label applied`);

    await postMessage(`Bypassing CI checks for <${html_url}|#${number}>`);

    await comment(
      octokit,
      issue,
      `Bypassing CI checks - ${payload.label.name} applied`
    );

    await byPassChecks(
      octokit,
      issue,
      payload.pull_request.head.sha,
      input.requiredChecks,
    );
  }

  if (payload.label.name === input.skipApprovalLabel) {
    core.debug(`skip_approval applied`);

    await postMessage(`Bypassing peer approval for <${html_url}|#${number}>`);

    await octokit.pulls.createReview({
      owner: issue.owner,
      repo: issue.repo,
      pull_number: issue.number,
      body: `Skipping approval check - ${payload.label.name} applied`,
      event: 'APPROVE',
    });
  }
}

async function comment(octokit: github.GitHub, issue, body: string) {
  await octokit.issues.createComment({
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number,
    body: formatComment(body),
  });
}

function pp(obj: Record<string, any>): string {
  return JSON.stringify(obj, undefined, 2);
}
