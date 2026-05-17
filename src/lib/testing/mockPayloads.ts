import { GitHubWebhookPayload } from '@/types';

export interface MockPayloadOptions {
  owner?: string;
  repo?: string;
  branch?: string;
  defaultBranch?: string;
}

function createBasePayload(options: MockPayloadOptions = {}): GitHubWebhookPayload {
  const owner = options.owner || 'local-owner';
  const repo = options.repo || 'local-repo';

  return {
    repository: {
      id: 1001,
      name: repo,
      full_name: `${owner}/${repo}`,
      default_branch: options.defaultBranch || 'main',
      clone_url: `https://github.com/${owner}/${repo}.git`,
      owner: {
        login: owner,
        id: 2001,
      },
    },
    sender: {
      login: 'local-tester',
      id: 3001,
    },
  };
}

export function createPullRequestWebhookPayload(
  options: MockPayloadOptions = {}
): GitHubWebhookPayload {
  return {
    ...createBasePayload(options),
    action: 'opened',
    pull_request: {
      number: 42,
      title: 'Local regression fixture',
      changed_files: 2,
      files: [
        { filename: 'src/services/user-service.ts' },
        { filename: 'src/api/users.test.ts' },
      ],
      head: {
        ref: options.branch || 'feature/local-regression',
      },
    },
  };
}

export function createWorkflowRunWebhookPayload(
  options: MockPayloadOptions = {}
): GitHubWebhookPayload {
  return {
    ...createBasePayload(options),
    action: 'completed',
    workflow_run: {
      id: 987654321,
      name: 'Deploy and Test',
      head_branch: options.branch || 'main',
      head_sha: 'abc1234def5678',
      status: 'completed',
      conclusion: 'failure',
    },
  };
}

export function createIssueCommentWebhookPayload(
  options: MockPayloadOptions = {}
): GitHubWebhookPayload {
  return {
    ...createBasePayload(options),
    action: 'created',
    issue: {
      number: 77,
      pull_request: {
        url: `https://api.github.com/repos/${options.owner || 'local-owner'}/${options.repo || 'local-repo'}/pulls/77`,
      },
    },
    comment: {
      id: 555001,
    },
  };
}

// Made with Bob
