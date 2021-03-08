import * as core from '@actions/core';
import * as github from '@actions/github';
import { Input } from './input';
import { postMessage } from './slack';
import { formatComment } from './github';
import {
  fetchCurrentSettings,
} from '../src/github';

type GitHubClient = ReturnType<typeof github.getOctokit>;
type Context = typeof github.context;

enum PayloadAction {
  LABELED = 'labeled',
  OPENED = 'opened',
}

async function getRequiredChecks(branch = 'master'): Promise<string[]> {
  const data = await fetchCurrentSettings(branch);
  return data.protection.required_status_checks.contexts;
}

/**
 * Main entry point for all input/pr actions.
 *
 * Ensures that the labels are applied appropriately, side effects applied,
 * and announcements made.
 */
export async function onIssueOrPR(octokit: GitHubClient, context: Context, input: Input) {
  const { payload } = context;

  switch(payload.action) {
    case PayloadAction.LABELED:
      await onLabel(octokit, context, input);
      break;
    case PayloadAction.OPENED:
      await onOpen(octokit, context, input);
      break;
    default:
      core.debug('skipping unknown issue action');
  }
}

async function onLabel(octokit: GitHubClient, context: Context, input: Input) {
  const { actor, repo } = context;
  const { label } = context.payload;

  const issue = context.payload.issue || context.payload.pull_request;
  const { number, html_url } = issue;

  core.debug(`label event received for ${number} - ${html_url}`);
  const alertLabelApplied = () => (
    postMessage(`<${html_url}|#${number}> (${repo.repo}) _*${label.name}*_ by ${actor}`)
  );

  switch(label.name) {
    case input.skipCILabel:
      if (!context.payload.pull_request) {
        core.debug('skipping ci label for non pull request');
        return;
      }

      await alertLabelApplied();
      await onSkipCILabel(
        octokit,
        context,
        label.name,
      );
      break;
    case input.skipApprovalLabel:
      await alertLabelApplied();
      await onEmergencyApprovalLabel(octokit, context, label.name);
      break;
    case input.posthocApprovalLabel:
      await alertLabelApplied();
      await onPosthocApprovalLabel(octokit, context, label.name);
      break;
    default:
      core.debug('skipping unknown label');
  }
}

async function onOpen(octokit: GitHubClient, context: Context, input: Input) {
  const { pull_request } = context.payload;
  if (!pull_request) {
    core.debug('no action needed when opening an issue');
  }

  const body = input.instructions;
  await comment(
    octokit,
    context.issue,
    body
  );
}

async function onSkipCILabel(
  octokit: GitHubClient,
  context: Context,
  labelName: string,
) {
  const requiredChecks = await getRequiredChecks();
  core.debug(`bypassing checks - ${requiredChecks}`);

  await comment(
    octokit,
    context.issue,
    `Bypassing CI checks - ${labelName} applied`
  );

  const { owner, repo } = context.issue;
  const { pull_request } = context.payload;

  const reqs = requiredChecks.map(async (check) => {
    return octokit.repos.createCommitStatus({
      owner,
      repo,
      sha: pull_request.head.sha,
      context: check,
      state: 'success',
    });
  });

  return Promise.all(reqs);
}

function isSenderPeer(sender, author) {
  return author.id !== sender.id;
}

async function onEmergencyApprovalLabel(octokit: GitHubClient, context: Context, labelName: string) {
  const { issue, pull_request } = context.payload;
  const { owner, repo, number } = context.issue;

  if (pull_request) {
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: number,
      body: `Skipping approval check - ${labelName} applied`,
      event: 'APPROVE',
    });

    return;
  }

  // implicitly an issue
  if (isSenderPeer(context.payload.sender, issue.user.id)) {
    await comment(
      octokit,
      context.issue,
      'Issue is marked as approved!',
    );

    return;
  }

  await comment(
    octokit,
    context.issue,
    'An issue cannot be marked approved by the owner. Please have a peer apply the label.',
  );
}

async function onPosthocApprovalLabel(octokit: GitHubClient, context: Context, labelName: string) {
  const { owner, repo, number } = context.issue;

  const author = (context.payload.issue?.user || context.payload.pull_request?.user);
  const isClosed = (context.payload.issue?.state || context.payload.pull_request?.state);
  const isPeer = isSenderPeer(context.payload.sender, author);

  if (isClosed && isPeer) {
    await comment(
      octokit,
      context.issue,
      `${labelName} successfully applied`
    );

    return;
  }

  const errors = [];
  if (!isPeer) {
    errors.push(`${labelName} cannot be applied by the original author. Please get approval from a peer.`);
  }

  if (!isClosed) {
    errors.push(`${labelName} cannot be applied by to an open issue. Please wait until the issue is resolved.`);
  }

  errors.push('Removing the label for now');

  await comment(
    octokit,
    context.issue,
    errors.join('\n'),
  );

  await octokit.issues.removeLabel({
    owner,
    repo,
    issue_number: number,
    name: labelName,
  });
}

async function comment(octokit: GitHubClient, issue, body: string) {
  await octokit.issues.createComment({
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number,
    body: formatComment(body),
  });
}
