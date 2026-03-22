#!/usr/bin/env node

/**
 * GLM PR Review Script
 *
 * Fetches a PR diff from GitHub, sends it to GLM API for code review,
 * and posts the review as a PR comment.
 *
 * Environment Variables:
 *   - GITHUB_TOKEN: GitHub personal access token
 *   - GLM_API_KEY: GLM API key
 *   - GITHUB_REPOSITORY: Repository in format "owner/repo"
 *   - PR_NUMBER: Pull request number
 */

const MAX_DIFF_LENGTH = 30000;

/**
 * Reads required environment variables.
 */
function getConfig() {
  const githubToken = process.env.GITHUB_TOKEN;
  const glmApiKey = process.env.GLM_API_KEY;
  const repository = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;

  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }
  if (!glmApiKey) {
    console.error('Error: GLM_API_KEY environment variable is required');
    process.exit(1);
  }
  if (!repository) {
    console.error('Error: GITHUB_REPOSITORY environment variable is required (format: owner/repo)');
    process.exit(1);
  }
  if (!prNumber) {
    console.error('Error: PR_NUMBER environment variable is required');
    process.exit(1);
  }

  return {
    githubToken,
    glmApiKey,
    repository,
    prNumber,
    glmApiUrl: process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    glmModel: process.env.GLM_MODEL || 'glm-4-flash',
  };
}

/**
 * Fetches the diff for a pull request from GitHub.
 */
async function fetchPRDiff(githubToken, repository, prNumber) {
  const url = `https://api.github.com/repos/${repository}/pulls/${prNumber}`;
  console.error(`Fetching PR from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3.diff',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const diff = await response.text();
  console.error(`Fetched diff: ${diff.length} characters`);

  return diff;
}

/**
 * Sends the diff to GLM API for code review.
 */
async function reviewWithGLM(diff, glmApiKey, apiUrl, model) {
  const systemPrompt = `You are a code reviewer. Review the following git diff for:
- Bugs and logic errors
- Type safety issues
- Security vulnerabilities
- Missing error handling
- Breaking changes for public APIs

Ignore:
- Code style and formatting
- Naming conventions

Provide a concise review in markdown format. Use bullet points for specific issues. If no significant issues are found, say "LGTM - no significant issues found."`;

  const truncatedDiff = diff.length > MAX_DIFF_LENGTH
    ? diff.slice(0, MAX_DIFF_LENGTH) + '\n\n... (truncated)'
    : diff;

  console.error(`Sending to GLM (${model}): ${truncatedDiff.length} characters`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${glmApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: truncatedDiff },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GLM API failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const data = await response.json();
  const review = data.choices?.[0]?.message?.content;

  if (!review) {
    throw new Error(`GLM API returned unexpected response: ${JSON.stringify(data)}`);
  }

  console.error('Review received from GLM');
  return review;
}

/**
 * Posts a comment to a GitHub pull request.
 */
async function postPRComment(githubToken, repository, prNumber, body) {
  const url = `https://api.github.com/repos/${repository}/issues/${prNumber}/comments`;
  console.error(`Posting comment to: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed to post comment: ${response.status} ${response.statusText}\n${text}`);
  }

  console.error('Comment posted successfully');
}

/**
 * Main execution flow.
 */
async function main() {
  try {
    const config = getConfig();

    // Fetch PR diff
    const diff = await fetchPRDiff(
      config.githubToken,
      config.repository,
      config.prNumber,
    );

    // Skip review if diff is empty
    if (!diff.trim()) {
      console.error('PR diff is empty, skipping review');
      process.exit(0);
    }

    // Get review from GLM
    const review = await reviewWithGLM(
      diff,
      config.glmApiKey,
      config.glmApiUrl,
      config.glmModel,
    );

    // Post review as PR comment
    const commentBody = `## 🤖 GLM Code Review\n\n${review}`;
    await postPRComment(
      config.githubToken,
      config.repository,
      config.prNumber,
      commentBody,
    );

    console.error('PR review completed successfully');
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
