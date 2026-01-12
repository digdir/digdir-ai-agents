/**
 * Git operations for fetching file versions
 */

import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FileVersion {
  content: string;
  commitHash: string;
  commitMessage: string;
  commitDate: string;
  author: string;
}

export interface GitModule {
  git: SimpleGit;
  repoRoot: string;
}

/**
 * Initialize git module for a repository
 */
export async function initGit(filePath: string): Promise<GitModule> {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  const git = simpleGit(dir);

  // Find repository root
  const repoRoot = await git.revparse(['--show-toplevel']);

  return {
    git,
    repoRoot: repoRoot.trim()
  };
}

/**
 * Get current (working) version of a file
 */
export async function getCurrentVersion(filePath: string): Promise<string> {
  const absolutePath = path.resolve(filePath);
  return await fs.readFile(absolutePath, 'utf-8');
}

/**
 * Get previous committed version of a file
 */
export async function getPreviousVersion(
  gitModule: GitModule,
  filePath: string,
  commitRef: string = 'HEAD~1'
): Promise<FileVersion | null> {
  const { git, repoRoot } = gitModule;
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

  try {
    // Get file content at specified commit
    const content = await git.show([`${commitRef}:${relativePath}`]);

    // Get commit info
    const log = await git.log({
      file: relativePath,
      maxCount: 1,
      from: commitRef,
      to: commitRef
    });

    if (log.latest) {
      return {
        content,
        commitHash: log.latest.hash,
        commitMessage: log.latest.message,
        commitDate: log.latest.date,
        author: log.latest.author_name
      };
    }

    return {
      content,
      commitHash: commitRef,
      commitMessage: '',
      commitDate: '',
      author: ''
    };
  } catch (error) {
    // File might not exist in previous commit
    return null;
  }
}

/**
 * Get the last N commits that modified a file
 */
export async function getFileHistory(
  gitModule: GitModule,
  filePath: string,
  maxCount: number = 10
): Promise<Array<{ hash: string; message: string; date: string; author: string }>> {
  const { git, repoRoot } = gitModule;
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

  const log = await git.log({
    file: relativePath,
    maxCount
  });

  return log.all.map(entry => ({
    hash: entry.hash,
    message: entry.message,
    date: entry.date,
    author: entry.author_name
  }));
}

/**
 * Save content to a file and stage it
 */
export async function saveAndStage(
  gitModule: GitModule,
  filePath: string,
  content: string
): Promise<void> {
  const absolutePath = path.resolve(filePath);
  await fs.writeFile(absolutePath, content, 'utf-8');

  const { git, repoRoot } = gitModule;
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
  await git.add(relativePath);
}

/**
 * Check if file has uncommitted changes
 */
export async function hasUncommittedChanges(
  gitModule: GitModule,
  filePath: string
): Promise<boolean> {
  const { git, repoRoot } = gitModule;
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');

  const status = await git.status([relativePath]);
  return status.modified.length > 0 ||
         status.staged.length > 0 ||
         status.not_added.length > 0;
}
