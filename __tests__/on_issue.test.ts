jest.mock('@actions/core', () => {
  const inputs = {
    relevant_labels: 'console-access',
  };

  return {
    debug: jest.fn(),
    getInput: jest.fn().mockImplementation(input => inputs[input] || ''),
  };
});

jest.mock('../src/slack');

import * as core from '@actions/core';
import { onIssue } from '../src/on_issue';
import { postMessage } from '../src/slack';

function buildContext(context = {} as any) {
  const { payload } = context;

  return {
    actor: context.actor,
    eventName: 'foo-vent',
    sha: 'sha-cago',
    workflow: 'always',
    action: 'action!',
    job: 'the misfits',
    issue: { number: 10, owner: 'repo', repo: 'man' },
    runNumber: 123,
    runId: 321,
    ref: 'ref',
    repo: { owner: 'repo', repo: 'man' },
    payload: {
      action: payload.action,
      issue: {
        body: '',
        ...payload.issue,
      },
      label: {
        ...payload.label,
      },
      repository: {
        ...payload.repository,
      },
    },
  };
}

describe('::onIssue', () => {
  async function run(overrides = {} as any) {
    const context = buildContext(overrides);
    await onIssue(context);
  }

  describe('label event', () => {
    describe('adding relevant label', () => {
      it('records event in slack', () => {
        run({
          actor: 'Al Pacino',
          payload: {
            action: 'labeled',
            issue: {
              labels: [{
                name: 'console-access',
              }],
            },
            label: {
              name: 'console-access',
            },
          },
        });

        expect(core.debug).not.toHaveBeenCalled();
        expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(/requested by Al Pacino/i));
      });
    });

    describe('with existing relevant label', () => {
      it('records event in slack', () => {
        run({
          actor: 'Marlon Brando',
          payload: {
            action: 'labeled',
            issue: {
              labels: [{
                name: 'console-access',
              }],
            },
            label: {
              name: 'approved',
            },
          },
        });

        expect(core.debug).not.toHaveBeenCalled();
        expect(postMessage).toHaveBeenCalledWith(expect.stringMatching(/approved\*\_ by Marlon Brando/i));
      });
    });
  });

  describe('ignores', () => {
    let context;

    beforeEach(() => {
      context = buildContext({
        actor: 'Marlon Brando',
        payload: {
          action: 'labeled',
          issue: {
            labels: [{
              name: 'console-access',
            }],
          },
          label: {
            name: 'approved',
          },
        },
      });
    });

    it('verifies context for falsy-tests would actually be truthy unchanged', () => {
      run(context);
      expect(postMessage).toHaveBeenCalled();
    });

    it('does not record anything on events other than label ', () => {
      context.payload.action = 'created';
      run(context);
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('does not record anything if relevant labels are not present', () => {
      context.payload.issue.labels = [];
      run(context);
      expect(postMessage).not.toHaveBeenCalled();
    });
  });
});
