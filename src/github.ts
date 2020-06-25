import * as github from '@actions/github';
import { getContext } from './context';
import { getInput } from './input';

const {
  githubToken,
  skipCILabel,
  verifiedCILabel,
  skipApprovalLabel,
  posthocApprovalLabel,
} = getInput();

const context = getContext();
const { owner, repo } = context.repo;

const CLOSED = 'closed';
const MASTER = 'master';
const SEARCH_PER_PAGE = 30;

export const client = new github.GitHub(githubToken);
export const REPO_SLUG = `${owner}/${repo}`;

export async function getStatusOfMaster() {
  const { data } = await client.repos.getCombinedStatusForRef({
    owner,
    repo,
    ref: MASTER,
  });
  return data;
}

export async function tagCIChecksOnPR(number: number) {
  return labelIssue(number, verifiedCILabel);
}

export async function getIssuesMissingReview() {
  const { data } = await client.search.issuesAndPullRequests({
    q: [
      `repo:${REPO_SLUG}`,
      `label:${skipApprovalLabel}`,
      `-label:${posthocApprovalLabel}`,
      `state:${CLOSED}`, // merged or closed
    ].join('+'),
  });

  return data.items;
}

export async function getClosedInPastWeek() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const since = date.toISOString().substr(0, 10);
  return getClosedIssues(since);
}

async function getClosedIssues(since, previousIssues = [], page = 1) {
  const { data: { items, total_count } } = await client.search.issuesAndPullRequests({
    page,
    q: [
      `repo:${REPO_SLUG}`,
      `state:${CLOSED}`,
      `closed:>${since}`,
    ].join('+'),
  });

  const issues = [...previousIssues, ...items];
  return (total_count > page * SEARCH_PER_PAGE) ? getClosedIssues(since, issues, page + 1) : issues;
}

export async function getDetailedIssue(number) {
  const { data } = await client.issues.get({
    owner,
    repo,
    issue_number: number,
  });
  return data;
}

export async function getDetailedPR(number) {
  const { data } = await client.pulls.get({
    owner,
    repo,
    pull_number: number,
  });
  return data;
}

export async function getPRsMissingCIChecks() {
  const { data } = await client.search.issuesAndPullRequests({
    q: [
      `repo:${REPO_SLUG}`,
      `label:${skipCILabel}`,
      `-label:${verifiedCILabel}`,
      `state:${CLOSED}`, // merged
    ].join('+'),
  });

  return data.items.filter(i => i.pull_request);
}

export async function labelIssue(number: number, label: string) {
  return client.issues.addLabels({
    owner,
    repo,
    issue_number: number,
    labels: [
      label,
    ],
  });
}


export async function addCommentToIssue(number: number, body: string) {
  return client.issues.createComment({
    owner,
    repo,
    issue_number: number,
    body: formatComment(body),
  });
}

export function formatComment(body: string): string {
  const now = new Date().toString();
  return `${body}\n\n---\n${now}`;
}
