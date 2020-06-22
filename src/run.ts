import * as core from '@actions/core';
import * as github from '@actions/github';
import { onPullRequest } from './on_pull_request';
import { onIssue } from './on_issue';
import { getInput } from './input';
import { getContext } from './context';
import { retroactivelyMarkPRsWithGreenBuilds } from './retroactively_mark_prs_with_green_builds';
import { checkForReview } from './check_for_review';

const PULL_REQUEST_EVENT_NAME = 'pull_request';
const ISSUE_EVENT_NAME = 'issues';
const SCHEDULE = 'schedule';
const UNSUPPORTED_EVENT = 'Workflow triggered by an unsupported event';

function onCron(cronSchedule) {
  return (callback) => {
    const { payload } = getContext();
    const { schedule } = payload;
    if (cronSchedule === schedule) callback();
  };
}

const onDaily = onCron('0 0 * * *');

// Entry point for any GitHub Actions
export async function run(): Promise<void> {
  try {
    const octokit = new github.GitHub(core.getInput('github_token', {
      required: true,
    }));

    const input = getInput();
    const context = getContext();

    switch (context.eventName) {
      case SCHEDULE:
        onDaily(retroactivelyMarkPRsWithGreenBuilds);
        onDaily(checkForReview);
        break;
      case PULL_REQUEST_EVENT_NAME:
        onPullRequest(octokit, context, input);
        break;
      case ISSUE_EVENT_NAME:
        onIssue(context);
        break;
      default:
        core.setFailed(UNSUPPORTED_EVENT);
    }
  } catch (error) {
    core.setFailed(error.message);
    core.debug(error.stack);
  }
}
