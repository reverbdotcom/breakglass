jest.mock('../src/input');
jest.mock('../src/context');
jest.mock('../src/slack');

import * as nock from 'nock';
import * as mockdate from 'mockdate'
import { postMessage } from '../src/slack';
import { onPullRequest } from '../src/on_pull_request';
import * as github from '@actions/github';
import * as core from '@actions/core';

nock.disableNetConnect();
nock('https://api.github.com').log(console.log);
mockdate.set('2000-1-1 00:00:00');

const ghClient = new github.GitHub('foozles');
const input = {
  githubToken: 'the-github-token',
  slackHook: '',
  instructions: 'this is how we pr',
  skipApprovalLabel: 'emergency-approval',
  skipCILabel: 'emergency-ci',
  requiredChecks: [
    'ci/circleci: fast_spec',
    'ci/circleci: js',
  ],
  verifiedCILabel: 'the-verified-ci-label',
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

    await onPullRequest(
      ghClient,
      {
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
    test('on label emergency-approval', async () => {
      let ghReviewBody;

      nock('https://api.github.com/')
        .post('/repos/github/my-repo/pulls/12/reviews', (req) =>  {
          ghReviewBody = req;
          return true;
        }).reply(200, 'way to go');

      await onPullRequest(
        ghClient,
        {
          payload: {
            action: 'labeled',
            label: {
              name: 'emergency-approval'
            },
            pull_request: {
              html_url: "https://github.com/github/my-repo/pull/12",
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
      await onPullRequest(
        ghClient,
        {
          payload: {
            pull_request: {
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
      expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`Bypassing CI.*${html_url}`)));
    });
  });
});
