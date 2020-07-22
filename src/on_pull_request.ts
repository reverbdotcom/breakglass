import * as core from '@actions/core';
import * as github from '@actions/github';
import { Input } from './input';
import { postMessage } from './slack';
import { formatComment } from './github';

type GitHubClient = ReturnType<typeof github.getOctokit>;
type Context = typeof github.context;

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
export async function onPullRequest(octokit: GitHubClient, context: Context, input: Input) {
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
async function onOpen(octokit: GitHubClient, context: Context, input: Input) {
  const body = input.instructions;
  await comment(
    octokit,
    context.issue,
    body
  );
}

async function byPassChecks(octokit: GitHubClient, issue, sha, checks) {
  const reqs = checks.map(async (context) => {
    core.debug(`bypassing check - ${context}`);
    return octokit.repos.createCommitStatus({
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
async function onLabel(octokit: GitHubClient, context: Context, input: Input) {
  const { issue, pull_request, label } = context.payload;
  const { owner, repo, number } = context.issue;

  core.debug(`label event received: ${pp(context.issue)}`);

  if (label.name === input.skipCILabel && pull_request) {
    core.debug(`skip_ci_label applied`);

    await postMessage(`Bypassing CI checks for <${pull_request.html_url}|#${number}>`);

    await comment(
      octokit,
      context.issue,
      `Bypassing CI checks - ${label.name} applied`
    );

    await byPassChecks(
      octokit,
      context.issue,
      pull_request.head.sha,
      input.requiredChecks,
    );
  }

  if (label.name === input.skipApprovalLabel && pull_request) {
    core.debug(`skip_approval applied`);

    await postMessage(`Bypassing peer approval for <${pull_request.html_url}|#${number}>`);

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: number,
      body: `Skipping approval check - ${label.name} applied`,
      event: 'APPROVE',
    });
  }

  if (label.name === input.posthocApprovalLabel) {
    const author = (issue?.user?.id || pull_request?.user?.id);

    if (context.payload.sender.id == author) {
      await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: number,
        name: input.posthocApprovalLabel,
      });
    }
  }
}

async function comment(octokit: GitHubClient, issue, body: string) {
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
