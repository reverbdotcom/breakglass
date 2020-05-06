import { mocked } from 'ts-jest/utils';
import { summaryReport } from '../src/summary_report';
import { getClosedInPastWeek, getDetailedPR } from '../src/github';
import { postMessage } from '../src/slack';

jest.mock('../src/input');
jest.mock('../src/github');
jest.mock('../src/slack');

describe('::summaryReport', () => {
  it('sends a csv to slack', async () => {
    let pullRequest;
    pullRequest = {
      number: 1,
    };

    let detailedPullRequest;
    detailedPullRequest = {
      html_url: "www.url.com",
      title: "hi",
      user: {login: "name"},
      merged: 'a date',
      merged_by: {login: "name"},
      labels: ['label one', 'label two'],
    };
    mocked(getClosedInPastWeek).mockResolvedValue([pullRequest]);
    mocked(getDetailedPR).mockResolvedValue(detailedPullRequest);
    await summaryReport();
    expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(/url,title,creator,merged,merged_by,closed_at,labels,review_comments/i));
    expect(postMessage).toHaveBeenCalledWith(
      expect.stringMatching("www.url.com\",\"hi\",\"name\",\"a date\",\"name\",undefined,label one,label two,undefined")
    );
  });
});
