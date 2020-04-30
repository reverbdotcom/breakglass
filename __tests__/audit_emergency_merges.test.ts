import { mocked } from 'ts-jest/utils';
import { auditEmergencyMerges } from '../src/audit_emergency_merges';
import { getMergedEmergencyPRsMissingReview } from '../src/github';
import { postMessage } from '../src/slack';

jest.mock('../src/input');
jest.mock('../src/github');
jest.mock('../src/slack');


describe('::auditEmergencyMerges', () => {
  it('sends a message to slack', async () => {
    let pullRequest;
    pullRequest = {
      html_url: "www.iamurl.com",
    };
    mocked(getMergedEmergencyPRsMissingReview).mockResolvedValue([pullRequest]);
    await auditEmergencyMerges();
    expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(/Emergency merged PR needs still needs a review! www.iamurl.com/i));
  });
})
