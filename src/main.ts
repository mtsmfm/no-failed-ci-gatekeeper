import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    const statusContext = core.getInput("context") || "no-failed-ci-gatekeeper";

    const octokit = github.getOctokit(token);
    const { context } = github;

    // Handle different event types
    switch (context.eventName) {
      case "pull_request":
        await handlePullRequest(octokit, context, statusContext);
        break;
      case "workflow_run":
        await handleWorkflowRun(octokit, context, statusContext);
        break;
      case "pull_request_review":
        await handlePullRequestReview(octokit, context, statusContext);
        break;
      default:
        core.info(`This action doesn't handle ${context.eventName} events`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
}

async function handlePullRequest(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  statusContext: string,
): Promise<void> {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.setFailed("Could not get pull request information from context");
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const sha = pr.head.sha;

  core.info(`Setting initial pending status for PR #${pr.number} (${sha})`);

  // Set initial pending status
  await octokit.rest.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state: "pending",
    context: statusContext,
    description: "Waiting for CI workflows to complete",
  });

  core.info("Set initial pending status");
}

async function handlePullRequestReview(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  statusContext: string,
): Promise<void> {
  const review = context.payload.review;
  const pr = context.payload.pull_request;

  if (!review || !pr) {
    core.info("No review or PR data in payload");
    return;
  }

  // Only handle approved reviews
  if (review.state !== "approved") {
    core.info("Review is not an approval");
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const sha = pr.head.sha;

  // Check if there are any workflows for this commit
  const workflowRuns = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    head_sha: sha,
  });

  if (workflowRuns.data.total_count === 0) {
    // No workflows were triggered, PR is approved, set success
    await octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state: "success",
      context: statusContext,
      description: "No workflows triggered, PR approved",
    });
    core.info("Set success status for approved PR with no workflows");
  }
}

async function handleWorkflowRun(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  statusContext: string,
): Promise<void> {
  const workflowRun = context.payload.workflow_run;
  if (!workflowRun) {
    core.info("No workflow_run data in payload");
    return;
  }

  // Only process completed workflow runs
  if (workflowRun.status !== "completed") {
    core.info(`Workflow run ${workflowRun.id} is not completed yet`);
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const sha = workflowRun.head_sha;

  // Check if this commit is associated with a PR
  const prs = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    owner,
    repo,
    commit_sha: sha,
  });

  if (prs.data.length === 0) {
    core.info("No PRs associated with this commit");
    return;
  }

  core.info(`Checking all workflows for commit ${sha}`);

  // Get all workflow runs for this commit
  const allRuns = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    head_sha: sha,
  });

  // Check if all workflows are completed
  const pendingRuns = allRuns.data.workflow_runs.filter(
    (run) => run.status === "queued" || run.status === "in_progress",
  );

  if (pendingRuns.length > 0) {
    core.info(`Still ${pendingRuns.length} workflows pending`);
    // Keep status as pending
    await octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state: "pending",
      context: statusContext,
      description: `Waiting for ${pendingRuns.length} workflow(s) to complete`,
    });
    return;
  }

  // All workflows completed, check results
  const failedRuns = allRuns.data.workflow_runs.filter(
    (run) => run.conclusion === "failure" || run.conclusion === "cancelled",
  );

  const allSuccess = failedRuns.length === 0;

  await octokit.rest.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state: allSuccess ? "success" : "failure",
    context: statusContext,
    description: allSuccess
      ? `All ${allRuns.data.workflow_runs.length} workflows passed`
      : `${failedRuns.length} workflow(s) failed`,
  });

  core.info(`Set ${allSuccess ? "success" : "failure"} status`);
}

run();
