import { mocked } from 'ts-jest/utils';
import { summaryReport } from '../src/summary_report';
import { getClosedInPastWeek, getDetailedPR, getDetailedIssue } from '../src/github';
import { postMessage } from '../src/slack';

jest.mock('../src/input');
jest.mock('../src/github');
jest.mock('../src/slack');

describe('::summaryReport', () => {
  describe('slack csv', () => {
    describe('pr', () => {
      const htmlURL = 'https://github.com/my-org/my-project/pull/26386';
      const commitSHA = 'eee9b64';

      function mockPR(overrides = {} as any) {
        const pullRequest = {
          number: 1,
          pull_request: {
          },
        };

        const detailedPullRequest = {
          html_url: htmlURL,
          labels: [],
          merge_commit_sha: commitSHA,
          user: {},
          ...overrides,
        } as any;

        mocked(getClosedInPastWeek).mockResolvedValue([pullRequest]);
        mocked(getDetailedPR).mockResolvedValue(detailedPullRequest);
      };

      describe('merged', () => {
        beforeEach(() => {
          mockPR({
            merged: true,
          });
        });

        it('is included', async () => {
          await summaryReport();

          expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(htmlURL));
          expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(commitSHA));
          expect(postMessage).toHaveBeenCalledWith(expect.stringMatching('code-change'));
        });
      });

      describe('closed but not merged', () => {
        beforeEach(() => {
          mockPR({
            merged: false,
          });
        });


        it('is not included', async () => {
          await summaryReport();
          expect(postMessage).not.toHaveBeenCalledWith(expect.stringMatching(htmlURL));
        });
      });
    });

    it('includes issues (access requests)', async () => {
      const issue = {
        number: 2,
        pull_request: undefined,
      };

      const htmlURL = 'https://github.com/my-org/my-project/issue/26386';
      const detailedIssue = {
        html_url: htmlURL,
        labels: [],
        merge_commit_sha: undefined,
        user: {},
      } as any;

      mocked(getClosedInPastWeek).mockResolvedValue([issue]);
      mocked(getDetailedIssue).mockResolvedValue(detailedIssue);

      await summaryReport();

      expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(htmlURL));
      expect(postMessage).toHaveBeenCalledWith(expect.stringMatching('access-request'));
    });
  });
});
