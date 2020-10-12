jest.mock('../src/context');
jest.mock('../src/github');

import { mocked } from 'ts-jest/utils';
import { checkForBranchProtection } from '../src/check_for_branch_protection';
import { client } from '../src/github';

const VALID_BRANCH_SETTINGS = {
  enforce_admins: {
    enabled: true
  },
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
  },
  required_status_checks: {
    contexts: [{ name: 'ci-foozles' }],
  }
}

describe('::checkForBranchProtection', () => {
  it('does not open an issue if the configuration is valid', async () => {
    (client.repos.getBranchProtection as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
      },
    }))

    await checkForBranchProtection();

    expect(client.issues.create).not.toHaveBeenCalled();
  });

  it('opens an issue if ci checks are not enabled', async () => {
    (client.repos.getBranchProtection as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
        required_status_checks: {
          contexts: [],
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
    (client.repos.getBranchProtection as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
        enforce_admins: {
          enabled: false
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

  it('opens an issue if reviews are not required', async () => {
    (client.repos.getBranchProtection as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
        required_pull_request_reviews: null,
      },
    }))

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      body: expect.stringContaining('pull request reviews'),
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });

  it('opens an issue if changes do not dismiss a review', async () => {
    (client.repos.getBranchProtection as any).mockReturnValue(Promise.resolve({
      data: {
        ...VALID_BRANCH_SETTINGS,
        required_pull_request_reviews: {
          dismiss_stale_reviews: false,
        },
      },
    }))

    await checkForBranchProtection();

    expect(client.issues.create).toHaveBeenCalledWith({
      body: expect.stringContaining('dismiss stale reviews'),
      owner: 'the-org',
      repo: 'the-repo',
      title: 'Branch Protection Missing or Incomplete',
    });
  });
});
