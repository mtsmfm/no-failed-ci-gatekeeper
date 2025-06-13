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
      case "pull_request_review":
        await handlePullRequestReview(octokit, context, statusContext);
        break;
      case "check_suite":
        await handleCheckSuite(octokit, context, statusContext);
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

async function handleCheckSuite(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  statusContext: string,
): Promise<void> {
  const checkSuite = context.payload.check_suite;
  if (!checkSuite) {
    core.info("No check_suite data in payload");
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const sha = checkSuite.head_sha;

  // Handle different check suite statuses
  if (checkSuite.status === "requested" || checkSuite.status === "queued") {
    // Set initial pending status when check suite is created
    const prs = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: sha,
    });

    if (prs.data.length > 0) {
      await octokit.rest.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state: "pending",
        context: statusContext,
        description: "Waiting for CI workflows to complete",
      });
      core.info("Set initial pending status for new check suite");
    }
    return;
  }

  // Only continue for completed check suites
  if (checkSuite.status !== "completed") {
    core.info(`Check suite ${checkSuite.id} has status: ${checkSuite.status}`);
    return;
  }

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

  core.info(`Check suite completed for commit ${sha}`);

  // Get all check runs for this suite
  const checkRuns = await octokit.rest.checks.listForSuite({
    owner,
    repo,
    check_suite_id: checkSuite.id,
  });

  // Check the conclusion of the check suite
  const hasFailures = checkRuns.data.check_runs.some(
    (run) => run.conclusion === "failure" || run.conclusion === "cancelled",
  );

  const allSuccess = !hasFailures && checkSuite.conclusion === "success";

  await octokit.rest.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state: allSuccess ? "success" : "failure",
    context: statusContext,
    description: allSuccess ? `All checks passed` : `Some checks failed`,
  });

  core.info(
    `Set ${allSuccess ? "success" : "failure"} status based on check suite`,
  );
}

run();
