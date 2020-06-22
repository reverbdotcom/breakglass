import { mocked } from 'ts-jest/utils';
import { checkForReview } from '../src/check_for_review';
import {
  getIssuesMissingReview,
  addCommentToIssue,
  getDetailedPR,
  labelIssue,
} from '../src/github';

import { postMessage } from '../src/slack';

jest.mock('../src/input');
jest.mock('../src/github');
jest.mock('../src/slack');

describe('::checkForReview', () => {
  it('sends a message to slack', async () => {
    mocked(getIssuesMissingReview).mockResolvedValue([{
      html_url: "github.com/pull/23",
    } as any]);

    mocked(getDetailedPR).mockResolvedValue({
      merged: 'yesterday',
    } as any);

    mocked(labelIssue).mockResolvedValue({
      id: 1,
    } as any);

    mocked(addCommentToIssue).mockResolvedValue({
      id: 1,
    } as any);

    await checkForReview();
    expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(/missing verification by a peer.*\/23/i));
  });

  it('does not notify of unmerged prs with label', async () => {
    mocked(getIssuesMissingReview).mockResolvedValue([{
      html_url: "github.com/pull/23",
      pull_request: true,
    } as any]);

    mocked(getDetailedPR).mockResolvedValue({
      merged: undefined,
    } as any);

    mocked(labelIssue).mockResolvedValue({
      id: 1,
    } as any);

    mocked(addCommentToIssue).mockResolvedValue({
      id: 1,
    } as any);


    await checkForReview();
    expect(postMessage).not.toHaveBeenCalled();
  });
})
