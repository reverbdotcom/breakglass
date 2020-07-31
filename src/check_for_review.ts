import {
  addCommentToIssue,
  getIssuesMissingReview,
  getDetailedPR,
} from './github';

import { getInput } from './input';
import { postMessage } from './slack';
import * as core from '@actions/core';

const {
  posthocApprovalLabel,
} = getInput();

export async function checkForReview() {
  const msg = `This issue is missing verification by a peer! Have a peer review this issue and apply the ${posthocApprovalLabel} to approve.`;
  const issues = await getIssuesMissingReview();

  core.debug(`found ${issues.length}`);

  return Promise.all(issues.map(async (issue) => {
    if (issue.pull_request) {
      const detail = await getDetailedPR(issue.number);
      if (!detail.merged) {
        core.debug(`skipping pr: ${issue.html_url} -- never merged`);
        return;
      }
    }

    core.debug(`marking issue as needs review: ${issue.html_url} ${msg}`);
    await addCommentToIssue(
      issue.number,
      msg,
    );

    return postMessage(`${msg} - ${issue.html_url}`);
  }));
}
