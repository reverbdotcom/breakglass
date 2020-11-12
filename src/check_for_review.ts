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

const MISSING_MESSAGE = `
This issue is missing verification by a peer!
When an issue is marked with emergency-approval as this issue did, a peer needs to review these changes afterwards and add the ${posthocApprovalLabel} label to document that this code or change was eventually reviewed.
`;

export async function checkForReview() {
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

    core.debug(`marking issue as needs review: ${issue.html_url} ${MISSING_MESSAGE}`);
    await addCommentToIssue(
      issue.number,
      MISSING_MESSAGE,
    );

    return postMessage(`${MISSING_MESSAGE} - ${issue.html_url}`);
  }));
}
