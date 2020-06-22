jest.mock('../src/input');
jest.mock('../src/context');

import * as nock from 'nock';
nock.disableNetConnect();

import * as mockdate from 'mockdate'
// https://bit.ly/3dIr5C5
mockdate.set('1969-12-05 00:00:00');

import {
  addCommentToIssue,
  getPRsMissingCIChecks,
  getIssuesMissingReview,
  labelIssue,
  tagCIChecksOnPR,
  getStatusOfMaster,
  getClosedInPastWeek,
} from '../src/github';

const API = 'https://api.github.com';

describe('github', () => {
  describe('configuration', () => {
    it('builds client with input token', async () => {
      expect.assertions(1);

      let headers;
      nock(API).post(`/repos/the-org/the-repo/issues/12/labels`).reply(200, function() {
        headers = this.req.headers;
      });

      await labelIssue(12, 'label');
      expect(headers).toEqual(expect.objectContaining({
        authorization: [
          'token the-github-token',
        ],
      }));
    });
  });

  describe('::getStatusOfMaster', () => {
    it('returns status data', async () => {
      expect.assertions(1);
      const data = { the: 'data' };

      nock(API).get(`/repos/the-org/the-repo/commits/master/status`).reply(200, data);

      const responseData = await getStatusOfMaster();
      expect(responseData).toEqual(data);
    });
  });

  describe('::labelIssue', () => {
    it('labels issue', async () => {
      expect.assertions(1);

      const number = 12;

      nock(API).post(`/repos/the-org/the-repo/issues/${number}/labels`, (body) => {
        expect(body).toEqual({
          labels: ['custom-label'],
        });
        return true;
      }).reply(200);

      await labelIssue(number, 'custom-label');
    });
  });

  describe('::addCommentToIssue', () => {
    it('adds comment to issue', async () => {
      expect.assertions(1);

      const number = 12;

      nock(API).post(`/repos/the-org/the-repo/issues/${number}/comments`, (body) => {
        expect(body).toEqual({
          body: expect.stringMatching('the comment'),
        });
        return true;
      }).reply(200);

      await addCommentToIssue(number, 'the comment');
    });
  });

  describe('::tagCIChecksOnPR', () => {
    it('labels issue with configured label', async () => {
      expect.assertions(1);

      const number = 12;

      nock(API).post(`/repos/the-org/the-repo/issues/${number}/labels`, (body) => {
        expect(body).toEqual({
          labels: ['the-verified-ci-label'],
        });
        return true;
      }).reply(200);

      await tagCIChecksOnPR(number);
    });
  });

  describe('::getClosedInPastWeek', () => {
    it('returns closed issues from past week', async () => {
      expect.assertions(2);

      const firstQuery = 'page=1&q=repo%3Athe-org%2Fthe-repo+state%3Aclosed+closed%3A%3E1969-11-28';
      nock(API).get(`/search/issues?${firstQuery}`).reply(200, {
        total_count: 31,
        items: [{
          id: 1,
          name: 'pr 1',
          pull_request: {},
        }, {
          id: 2,
          name: 'an issue',
        }],
      });

      const secondQuery = 'page=2&q=repo%3Athe-org%2Fthe-repo+state%3Aclosed+closed%3A%3E1969-11-28';
      nock(API).get(`/search/issues?${secondQuery}`).reply(200, {
        items: [{
          id: 3,
          name: 'pr 2',
          pull_request: {},
        }],
      });

      const issues = await getClosedInPastWeek();
      expect(issues.length).toEqual(3);
      expect(issues.map(i => i.id)).toEqual([1,2,3])
    });
  });

  describe('::getPRsMissingCIChecks', () => {
    it('returns prs that have the ci-bypass tag but not the ci-verified tag', async () => {
      expect.assertions(2);

      const q = 'repo%3Athe-org%2Fthe-repo+label%3Athe-skip-ci-label+-label%3Athe-verified-ci-label+state%3Aclosed';
      nock(API).get(`/search/issues?q=${q}`).reply(200, {
        items: [{
          id: 1,
          name: 'pr',
          pull_request: {},
        }, {
          id: 2,
          name: 'an issue',
        }],
      });

      const prs = await getPRsMissingCIChecks();
      expect(prs.length).toEqual(1);
      expect(prs[0].id).toEqual(1);
    });
  });

  describe('::getMergedEmergencyPrsMissingReview', () => {
    it('returns pull requests that have the approval bypass tag, are merged, but not the posthoc review tag', async () => {
      expect.assertions(2);

      const q = 'repo%3Athe-org%2Fthe-repo+label%3Athe-skip-approval-label+-label%3Athe-posthoc-approval-label+state%3Aclosed';
      nock(API).get(`/search/issues?q=${q}`).reply(200, {
        items: [{
          id: 1,
          name: 'pr',
          pull_request: {},
        }, {
          id: 2,
          name: 'an issue',
        }],
      });

      const prs = await getIssuesMissingReview();
      expect(prs.length).toEqual(2);
      expect(prs[0].id).toEqual(1);
    });
  });
});
