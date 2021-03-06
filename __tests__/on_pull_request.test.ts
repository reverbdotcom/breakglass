jest.mock('../src/input');
jest.mock('../src/context');
jest.mock('../src/slack');

import * as nock from 'nock';
import * as mockdate from 'mockdate'

import { postMessage } from '../src/slack';
import { onIssueOrPR } from '../src/on_pull_request';
import * as github from '@actions/github';
import * as core from '@actions/core';

nock.disableNetConnect();
nock('https://api.github.com').log(console.log);
mockdate.set('2000-1-1 00:00:00');

const mockContext = {
  eventName: 'foo-vent',
  sha: 'sha-cago',
  workflow: 'always',
  action: 'action!',
  actor: 'clark gable',
  job: 'the misfits',
  runNumber: 123,
  runId: 321,
  repo: { owner: 'repo', repo: 'man' },
  issue: { owner: 'repo', repo: 'man' },
}

const ghClient = github.getOctokit('foozles');
const requiredChecks = [
  'ci/circleci: fast_spec',
  'ci/circleci: js',
]
const input = {
  requiredChecks,
  githubToken: 'the-github-token',
  slackHook: '',
  instructions: 'this is how we pr',
  skipApprovalLabel: 'emergency-approval',
  skipCILabel: 'emergency-ci',
  posthocApprovalLabel: 'posthoc-approval',
  verifiedCILabel: 'the-verified-ci-label',
  branch: 'master',
};

describe('pull request actions', () => {
  afterEach(() => {
    expect(nock.isDone());
  });

  test('on open', async () => {
    let body;

    nock('https://api.github.com')
      .post('/repos/github/my-repo/issues/12/comments', (req) =>  {
        body = req;
        return true;
      }).reply(200, 'way to go');

    await onIssueOrPR(
      ghClient,
      {
        ...mockContext,
        payload: { action: 'opened' },
        issue: { owner: 'github', repo: 'my-repo', number: 12 },
        ref: 'f123',
      },
      input,
    );

    expect(body['body']).toContain('this is how we pr');
    expect(body['body']).toContain('Jan 01 2000 00:00:00');
  });

  describe('on label', () => {
    it('on label posthoc-approval for issue', async () => {
      let deleted = false;
      let commentBody;

      nock('https://api.github.com')
        .post('/repos/github/my-repo/issues/12/comments', (req) =>  {
          commentBody = req.body;
          return true;
        }).reply(200, 'way to go');

      nock('https://api.github.com')
        .delete('/repos/github/my-repo/issues/12/labels/posthoc-approval', (req) =>  {
          deleted = true;
          return true;
        }).reply(200, 'way to go');

      await onIssueOrPR(
        ghClient,
        {
          ...mockContext,
          payload: {
            sender: {
              type: 'user',
              id: 42,
            },
            action: 'labeled',
            label: {
              name: 'posthoc-approval'
            },
            issue: {
              html_url: "https://github.com/github/my-repo/pull/12",
              user: {
                id: 42,
              },
              number: 1,
            },
          },
          issue: { owner: 'github', repo: 'my-repo', number: 12 },
          ref: 'f123',
        },
        input,
      );

      expect(deleted).toBeTruthy();
      expect(commentBody).toMatch(/original author/);
      expect(commentBody).toMatch(/open issue/);
      expect(commentBody).toMatch(/Removing the label/);
    });

    test('on label emergency-approval', async () => {
      let ghReviewBody;

      nock('https://api.github.com/')
        .post('/repos/github/my-repo/pulls/12/reviews', (req) =>  {
          ghReviewBody = req;
          return true;
        }).reply(200, 'way to go');

      await onIssueOrPR(
        ghClient,
        {
          ...mockContext,
          payload: {
            action: 'labeled',
            label: {
              name: 'emergency-approval'
            },
            pull_request: {
              html_url: "https://github.com/github/my-repo/pull/12",
              number: 1,
            },
          },
          issue: { owner: 'github', repo: 'my-repo', number: 12 },
          ref: 'f123',
        },
        input,
      );

      expect(ghReviewBody).toEqual({
        body: 'Skipping approval check - emergency-approval applied',
        event: 'APPROVE',
      });
    });

    it('on label emergency-ci', async () => {
      let ghCommentBody;
      let checkUpdateBody;

      nock('https://api.github.com').get('/repos/the-org/the-repo/branches/master').reply(200, {
        protection: {
          required_status_checks: {
            contexts: requiredChecks,
          },
        },
      })

      nock('https://api.github.com')
        .post('/repos/github/my-repo/issues/12/comments', (req) =>  {
          ghCommentBody = req;
          return true;
        }).reply(200, 'way to go');

      nock('https://api.github.com')
        .post('/repos/github/my-repo/statuses/cab4', (req) => {
          checkUpdateBody = req;
          return true;
        })
        .reply(200, 'okay!')
        .post('/repos/github/my-repo/statuses/cab4')
        .reply(200, 'okay!')

      const html_url = "https://github.com/my-repo/my-project/pull/234";
      await onIssueOrPR(
        ghClient,
        {
          ...mockContext,
          payload: {
            pull_request: {
              number: 12,
              head: {
                ref: 'erik/foo',
                sha: 'cab4',
              },
              html_url,
            },
            action: 'labeled',
            label: {
              name: 'emergency-ci',
            },
          },
          issue: { owner: 'github', repo: 'my-repo', number: 12 },
          ref: 'f123',
        },
        input,
      );

      expect(checkUpdateBody).toEqual({ context: 'ci/circleci: fast_spec', state: 'success' });
      expect(ghCommentBody['body']).toContain('Bypassing CI checks - emergency-ci applied');
      expect(ghCommentBody['body']).toContain('Jan 01 2000 00:00:00');
      expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(/emergency-ci/));
    });
  });
});
