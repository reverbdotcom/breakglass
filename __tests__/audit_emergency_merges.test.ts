import { mocked } from 'ts-jest/utils';
import { auditEmergencyMerges } from '../src/audit_emergency_merges';
import { postMessage } from '../src/slack';
import {
  getMergedEmergencyPRsMissingReview,
  getDetailedPR,
} from '../src/github';

jest.mock('../src/input');
jest.mock('../src/github');
jest.mock('../src/slack');


describe('::auditEmergencyMerges', () => {
  it('sends a message to slack', async () => {
    mocked(getMergedEmergencyPRsMissingReview).mockResolvedValue([{
      html_url: "github.com/pull/23",
    } as any]);

    mocked(getDetailedPR).mockResolvedValue({
      merged: 'yesterday',
    } as any);

    await auditEmergencyMerges();
    expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(/needs a review.*pull\/23/i));
  });

  it('does not notify of unmerged prs with label', async () => {
    mocked(getMergedEmergencyPRsMissingReview).mockResolvedValue([{
      html_url: "github.com/pull/23",
    } as any]);

    mocked(getDetailedPR).mockResolvedValue({
      merged: undefined,
    } as any);

    await auditEmergencyMerges();
    expect(postMessage).not.toHaveBeenCalled();
  });
})
