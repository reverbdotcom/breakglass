import { ExportToCsv } from 'export-to-csv';
import { postMessage } from './slack';

import {
  getClosedInPastWeek,
  getDetailedPR,
  getDetailedIssue,
  REPO_SLUG,
} from './github';

const ACCESS_REQUEST = 'access-request';
const BLANK = '';
const NEWLINE = '\n';
const CODE_CHANGES = 'code-change';
const FAILED = 'Summary report creation failed! 🔥';
const SEPARATOR = ',';
const WEEKLY_REPORT = ':rolled_up_newspaper: Weekly Report';

const OPTIONS = {
  fieldSeparator: ',',
  quoteStrings: '"',
  decimalSeparator: '.',
  showLabels: true,
  useTextFile: false,
  useBom: true,
  useKeysAsHeaders: true,
};

const csvExporter = new ExportToCsv(OPTIONS);

// all pull requests are issues, but not all issues are pull requests
function isPullRequest(prOrIssue) {
  return !!prOrIssue.pull_request;
}

export async function summaryReport() {
  try {
    const rows = [];
    let issueCount = 0;
    let prCount = 0;

    const data = await getClosedInPastWeek();
    for (const issue of data) {
      let row;

      if (isPullRequest(issue)) {
        const pullRequest = await getDetailedPR(issue.number);
        if (!pullRequest.merged) continue;
        row = createRow(true, pullRequest);
        prCount++;
      } else {
        const detailedIssue = await getDetailedIssue(issue.number);
        row = createRow(false, detailedIssue);
        issueCount++;
      }

      rows.push(row);
    };

    await postMessage(`${WEEKLY_REPORT} ${prCount} ${CODE_CHANGES}s, ${issueCount} ${ACCESS_REQUEST}s`);

    if (rows.length) {
      const csv = csvExporter.generateCsv(rows, true);
      const report = csv.split(NEWLINE).map(line => `> ${line}`).join(NEWLINE);
      await postMessage(report);
    }
  } catch (error) {
    await postMessage(FAILED);
    throw error;
  }
}

function createRow(isPR, issue) {
  const issueDetail = `<${issue.html_url}|${issue.number}>`;

  return removeUndefines({
    type: (isPR) ? CODE_CHANGES : ACCESS_REQUEST,
    project: REPO_SLUG,
    issue: issueDetail,
    merge_commit_sha: issue.merge_commit_sha,
    merged_by: issue.merged_by?.login,
    closed_at: issue.closed_at,
    labels: issue.labels.map(l => l.name).join(SEPARATOR),
    review_comments: issue.review_comments,
    creator: issue.user.login,
    title: issue.title,
  });
}

function removeUndefines(rows) {
  for (const key in rows) {
    if (typeof rows[key] === 'undefined') rows[key] = BLANK;
  }
  return rows;
}
