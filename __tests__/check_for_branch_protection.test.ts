jest.mock('../src/context');
jest.mock('../src/github');

import { mocked } from 'ts-jest/utils';
import { checkForBranchProtection } from '../src/check_for_branch_protection';
import { client } from '../src/github';

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
    (client.repos.getBranch as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
      },
    }))

    await checkForBranchProtection();

    expect(client.issues.create).not.toHaveBeenCalled();
  });

  it('opens an issue if the branch is not protected', async () => {
    (client.repos.getBranch as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
        protected: false,
      },
    }))

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      body: expect.stringContaining('not enabled'),
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });

  it('opens an issue if ci checks are not enabled', async () => {
    (client.repos.getBranch as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
        protection: {
          required_status_checks: {
            contexts: [],
          }
        }
      },
    }))

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      body: expect.stringContaining('required status checks are not enforced'),
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });

  it('opens an issue if rules are not applied to admins', async () => {
    (client.repos.getBranch as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
        protection: {
          required_status_checks: {
            enforcement_level: 'nobody',
          },
        },
      },
    }))

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      body: expect.stringContaining('not enabled for admins'),
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });
});
