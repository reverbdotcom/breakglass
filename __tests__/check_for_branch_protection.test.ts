jest.mock('../src/context');
jest.mock('../src/github');

const input = {
  requiredChecks: ['true'],
};

jest.mock('../src/input', () => {
  return {
    getInput: () => {
      return input;
    }
  }
});

import { mocked } from 'ts-jest/utils';
import { checkForBranchProtection } from '../src/check_for_branch_protection';
import {
  client,
  fetchCurrentSettings,
} from '../src/github';
import { getInput } from '../src/input';

const VALID_BRANCH_SETTINGS = {
  protected: true,
  protection: {
    required_status_checks: {
      enforcement_level: 'everyone',
      contexts: [{ name: 'ci-foozles' }],
    },
  },
}

describe('::checkForBranchProtection', () => {
  it('does not open an issue if the configuration is valid', async () => {
    mocked(fetchCurrentSettings).mockResolvedValue({
      ...VALID_BRANCH_SETTINGS,
    } as any);

    await checkForBranchProtection();

    expect(client.issues.create).not.toHaveBeenCalled();
  });

  it('opens an issue if the branch is not protected', async () => {
    mocked(fetchCurrentSettings).mockResolvedValue({
      ...VALID_BRANCH_SETTINGS,
      protected: false,
    } as any)

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      body: expect.stringContaining('not enabled'),
      labels: ['branch-protection-alert'],
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });

  it('opens an issue if ci checks are not enabled', async () => {
    mocked(fetchCurrentSettings).mockResolvedValue({
      ...VALID_BRANCH_SETTINGS,
      protection: {
        required_status_checks: {
          contexts: [],
        }
      }
    } as any);

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      labels: ['branch-protection-alert'],
      body: expect.stringContaining('required status checks are not enforced'),
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });

  it('does not open an issue if ci checks are not required per the input', async () => {
    input.requiredChecks = [];

    mocked(fetchCurrentSettings).mockResolvedValue({
      ...VALID_BRANCH_SETTINGS,
      protection: {
        required_status_checks: {
          enforcement_level: 'everyone',
          contexts: [],
        }
      }
    } as any);

    await checkForBranchProtection();

    expect(client.issues.create).not.toHaveBeenCalled();
  });

  it('opens an issue if rules are not applied to admins', async () => {
    mocked(fetchCurrentSettings).mockResolvedValue({
      ...VALID_BRANCH_SETTINGS,
      protection: {
        required_status_checks: {
          enforcement_level: 'nobody',
        },
      },
    } as any);

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      labels: ['branch-protection-alert'],
      body: expect.stringContaining('not enabled for admins'),
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });
});
