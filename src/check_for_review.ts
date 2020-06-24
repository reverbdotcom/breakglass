import {
  addCommentToIssue,
  getIssuesMissingReview,
  getDetailedPR,
} from './github';

import { getInput } from './input';
import { postMessage } from './slack';

const {
  posthocApprovalLabel,
} = getInput();

export async function checkForReview() {
  const msg = `This issue is missing verification by a peer! Have a peer review this issue and apply the ${posthocApprovalLabel} to approve.`;
  const issues = await getIssuesMissingReview();

  return Promise.all(issues.map(async (issue) => {
    if (issue.pull_request) {
      const detail = await getDetailedPR(issue.number);
      if (!detail.merged) {
        return;
      }
    }

    await addCommentToIssue(
      issue.number,
      msg,
    );

    await postMessage(`${msg} - ${issue.html_url}`);
  }));
}
