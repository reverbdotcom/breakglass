import * as request from 'request-promise-native';
import * as core from '@actions/core';

const hook = core.getInput('slack_hook');

export async function postMessage(text: string) {
  if (!hook) {
    core.debug(`skipping slack hook ${text}, hook not defined`);
    return;
  }

  return request({
    uri: hook,
    method: 'POST',
    body: {
      text,
    },
    json: true,
  });
}
