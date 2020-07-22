jest.mock('./../src/input');
jest.mock('./../src/context');
jest.mock('./../src/on_issue');
jest.mock('./../src/on_pull_request');
jest.mock('./../src/retroactively_mark_prs_with_green_builds');
jest.mock('./../src/check_for_review');

jest.mock('@actions/github', () => {
  return {
    getOctokit() { return { } }
  }
});

jest.mock('@actions/core', () => {
  return {
    debug: jest.fn(),
    getInput: jest.fn().mockImplementation(_ => ''),
    setFailed: jest.fn(),
  };
});

import { getContext } from '../src/context';
import { mocked } from 'ts-jest/utils';
import { run } from './../src/run';
import { onIssue } from './../src/on_issue';
import { onPullRequest } from './../src/on_pull_request';
import * as core from '@actions/core'
import * as github from '@actions/github';

import {
  retroactivelyMarkPRsWithGreenBuilds,
} from '../src/retroactively_mark_prs_with_green_builds';

function mockContext(context = {} as any) {
  mocked(getContext).mockReturnValue(context);
}

describe('::run', () => {
  describe('pr event', () => {
    beforeEach(() => {
      mockContext({
        eventName: 'pull_request',
      });
    });

    it('only runs onPullRequest', () => {
      run();
      expect(onPullRequest).toHaveBeenCalled();
      expect(onIssue).not.toHaveBeenCalled();
    });
  });

  describe('schedule event', () => {
    describe('daily cron', () => {
      beforeEach(() => {
        mockContext({
          eventName: 'schedule',
          payload: {
            schedule: '* 14 * * *',
          }
        });
      });

      it('runs retroactive ci checks', () => {
        run();
        expect(retroactivelyMarkPRsWithGreenBuilds).toHaveBeenCalled();
      })
    });

    describe('other crons', () => {
      beforeEach(() => {
        mockContext({
          eventName: 'schedule',
          payload: {
            schedule: '0 * * * *',
          }
        });
      });

      it('does not run', () => {
        run();
        expect(retroactivelyMarkPRsWithGreenBuilds).not.toHaveBeenCalled();
      });
    });
  });

  describe('issue event', () => {
    beforeEach(() => {
      mockContext({
        eventName: 'issues',
      });
    });

    it('runs onIssue', () => {
      run();
      expect(onIssue).toHaveBeenCalled();
      expect(onPullRequest).not.toHaveBeenCalled();
    });
  });

  describe('unsuppored event', () => {
    beforeEach(() => {
      mockContext({
        eventName: 'non_supported_event',
      });
    });

    it('fails the workflow', () => {
      run();
      expect(core.setFailed).toHaveBeenCalledWith(expect.stringMatching(/unsupported/));
    });
  });

  describe('on error', () => {
    beforeEach(() => {
      mockContext({
        eventName: 'issues',
      });
    });

    it('fails the workflow', () => {
      const message = 'oh no!';
      const error = new Error(message);
      mocked(onIssue).mockImplementation(() => {
        throw error;
      });
      run();
      expect(core.setFailed).toHaveBeenCalledWith(message);
    });
  });
});
