import {
  getInput,
  debug,
} from '@actions/core';

import * as github from '@actions/github';
import { postMessage } from './slack';

type Context = typeof github.context;

const LABELED_ACTION = 'labeled';
const NEWLINE = '\n';
const RELEVANT_LABELS = getInput('relevant_labels').split(',');

export async function onIssue(context: Context) {
  const payload = context.payload;

  const {
    action,
    issue,
    label,
  } = payload;

  if (action !== LABELED_ACTION) {
    // even when creating an issue with a label, the label event happens after the create event
    debug('irrelevant issue event, skipping');
    return;
  }

  const relevantLabels = getRelevantLabels(issue);
  if (!relevantLabels.length) {
    debug('irrelevant issue label, skipping');
    return;
  }

  // relevant label was already on issue, a different one was added
  if (relevantLabels.indexOf(label.name) < 0) {
    await onLabel(context);

  // label event is the application of relevant label
  } else {
    await onEnterWorkflow(label.name, context);
  }
}

function getRelevantLabels(issue): string[] {
  return issue.labels.reduce((accumulator, label) => {
    const { name } = label;
    if (RELEVANT_LABELS.indexOf(name) < 0) return accumulator;
    return [...accumulator, name];
  }, []);
}

async function onEnterWorkflow(labelName, context) {
  const {
    actor,
    payload,
  } = context;

  const {
    issue,
    repository,
  } = payload;

  const {
    name,
  } = repository;

  const {
    html_url,
    number,
    body,
  } = issue;

  const quotedBody = body.split(NEWLINE).map(line => `> ${line}`).join(NEWLINE);
  await record(`<${html_url}|#${number}> (${name}) _*${labelName}*_ requested by ${actor}\n\n${quotedBody}`);
}

async function onLabel(context) {
  const {
    actor,
    payload,
  } = context;

  const {
    issue,
    label,
    repository,
  } = payload;

  const {
    name,
  } = repository;

  const {
    html_url,
    number,
  } = issue;

  await record(`<${html_url}|#${number}> (${name}) _*${label.name}*_ by ${actor}`);
}

async function record(message) {
  await postMessage(message);
}
