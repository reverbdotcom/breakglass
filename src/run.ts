import * as core from '@actions/core';
import * as github from '@actions/github';

import { onIssueOrPR } from './on_pull_request';
import { getInput } from './input';
import { getContext } from './context';
import { retroactivelyMarkPRsWithGreenBuilds } from './retroactively_mark_prs_with_green_builds';
import { checkForReview } from './check_for_review';

const PULL_REQUEST_EVENT_NAME = 'pull_request';
const ISSUE_EVENT_NAME = 'issues';
const SCHEDULE = 'schedule';
const UNSUPPORTED_EVENT = 'Workflow triggered by an unsupported event';

export async function run(): Promise<void> {
  try {
    const input = getInput();
    const octokit = github.getOctokit(input.githubToken);

    const context = getContext();
    switch (context.eventName) {
      case SCHEDULE:
        await Promise.all([
          checkForReview(),
          retroactivelyMarkPRsWithGreenBuilds(),
        ]);
        break;
      case PULL_REQUEST_EVENT_NAME:
        await onIssueOrPR(octokit, context, input);
        break;
      case ISSUE_EVENT_NAME:
        await onIssueOrPR(octokit, context, input);
        break;
      default:
        core.setFailed(UNSUPPORTED_EVENT);
    }
  } catch (error) {
    core.setFailed(error.message);
    core.debug(error.stack);
  }
}
