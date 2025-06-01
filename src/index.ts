import * as github from "@actions/github";
import * as core from "@actions/core";

async function run() {
  const octokit = github.getOctokit(core.getInput("github-token"));
  const statusContext = core.getInput("context");

  const context = github.context;
  const sha = context.payload.workflow_run?.head_sha || context.sha;
  const checks = await octokit.rest.checks.listForRef({
    ref: sha,
    owner: context.repo.owner,
    repo: context.repo.repo,
  });
  const allRuns = checks.data.check_runs;
  const notCompletedRuns = allRuns.filter(
    (suite) => suite.status !== "completed"
  );

  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

  const params = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha,
    context: statusContext,
    target_url: runUrl,
  } satisfies Partial<
    Parameters<typeof octokit.rest.repos.createCommitStatus>[0]
  >;

  switch (context.eventName) {
    case "pull_request_review": {
      if (allRuns.length === 0) {
        console.log(
          "No runs found, assuming CI is skipped with commit comment or filter"
        );

        await octokit.rest.repos.createCommitStatus({
          ...params,
          state: "success",
        });
      }
      return;
    }
    case "workflow_run": {
      if (notCompletedRuns.length === 0) {
        await octokit.rest.repos.createCommitStatus({
          ...params,
          state: checks.data.check_runs.every(
            (suite) => suite.conclusion === "success"
          )
            ? "success"
            : "failure",
        });
      } else {
        console.log("Not all runs are completed");
        console.log(notCompletedRuns.map((s) => s.url));
      }
      return;
    }
  }
}

run();
