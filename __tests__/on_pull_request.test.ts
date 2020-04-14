import * as nock from 'nock';
import * as mockdate from 'mockdate'
import { onPullRequest } from '../src/on_pull_request';
import * as github from '@actions/github';
import * as core from '@actions/core';

jest.mock('@actions/core', () => {
  let input = {}

  return {
    debug: jest.fn(),
    getInput(key) {
      return input[key];
    },
    __setInput(i) {
      input = i;
    },
  };
});

nock.disableNetConnect()
nock('https://api.github.com').log(console.log)
mockdate.set('2000-1-1 00:00:00');
const ghClient = new github.GitHub('foozles');

describe('pull request actions', () => {
  beforeEach(() => {
    // @ts-ignore
    core.__setInput({
      slack_hook: 'https://foo.slack/hook',
      instructions: 'this is how we pr',
      skip_approval_label: 'emergency-approval',
      skip_ci_label: 'emergency-ci',
      required_checks: 'ci/circleci: fast_spec, ci/circleci: js',
    });
  });

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
    );

    expect(body['body']).toContain('this is how we pr');
    expect(body['body']).toContain('Jan 01 2000 00:00:00');
  });

  describe('on label', () => {
    let slackMsg;

    beforeEach(() => {
      nock('https://foo.slack/')
        .post('/hook', (req) =>  {
          slackMsg = req;
          return true;
        }).reply(200, 'way to go');
    });

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
          payload: { action: 'labeled', label: { name: 'emergency-approval' } },
          issue: { owner: 'github', repo: 'my-repo', number: 12 },
          ref: 'f123',
        },
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

      await onPullRequest(
        ghClient,
        {
          payload: { pull_request: { head: { ref: 'erik/sox', sha: 'cab4' } }, action: 'labeled', label: { name: 'emergency-ci' } },
          issue: { owner: 'github', repo: 'my-repo', number: 12 },
          ref: 'f123',
        },
      );

      expect(checkUpdateBody).toEqual({ context: 'ci/circleci: fast_spec', state: 'success' });
      expect(ghCommentBody['body']).toContain('Bypassing CI checks - emergency-ci applied');
      expect(ghCommentBody['body']).toContain('Jan 01 2000 00:00:00');
      expect(slackMsg).toEqual({
        text: 'Bypassing CI checks for: https://github.com/github/my-repo/12'
      });
    });
  });
});