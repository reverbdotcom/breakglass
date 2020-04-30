import { getMergedEmergencyPRsMissingReview } from './github';
import { postMessage } from './slack';

export async function auditEmergencyMerges() {
  const pullRequests = await getMergedEmergencyPRsMissingReview();

  for(const pr of pullRequests) {
    await postMessage(generateMessage(pr));
  }
}

function generateMessage(pr) {
  return `Emergency merged PR needs still needs a review! ${pr.html_url}`;
}
