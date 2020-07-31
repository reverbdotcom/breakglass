jest.mock('./../src/input');
jest.mock('./../src/context');
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

import * as core from '@actions/core'
import * as github from '@actions/github';

import { getContext } from '../src/context';
import { mocked } from 'ts-jest/utils';
import { run } from './../src/run';
import { onIssueOrPR } from './../src/on_pull_request';
import { checkForReview } from './../src/check_for_review';

import {
  retroactivelyMarkPRsWithGreenBuilds,
} from '../src/retroactively_mark_prs_with_green_builds';

function mockContext(context = {} as any) {
  mocked(getContext).mockReturnValue(context);
}

describe('::run', () => {
  describe('pr/issue event', () => {
    it('runs on issues', () => {
      mockContext({
        eventName: 'pull_request',
      });

      run();
      expect(onIssueOrPR).toHaveBeenCalled();
    });

    it('runs on prs', () => {
      mockContext({
        eventName: 'issues',
      });

      run();
      expect(onIssueOrPR).toHaveBeenCalled();
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

      it('runs crons', () => {
        run();
        expect(retroactivelyMarkPRsWithGreenBuilds).toHaveBeenCalled();
        expect(checkForReview).toHaveBeenCalled();
      })
    });
  });

  describe('unsupported event', () => {
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
      mocked(onIssueOrPR).mockImplementation(() => {
        throw error;
      });
      run();
      expect(core.setFailed).toHaveBeenCalledWith(message);
    });
  });
});
