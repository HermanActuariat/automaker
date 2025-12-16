/**
 * Worktree Integration Tests
 *
 * Tests for git worktree functionality including:
 * - Creating and deleting worktrees
 * - Committing changes
 * - Switching branches
 * - Branch listing
 * - Worktree isolation
 * - Feature filtering by worktree
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

// Import shared utilities
import {
  waitForNetworkIdle,
  apiCreateWorktree,
  apiDeleteWorktree,
  apiListWorktrees,
  apiCommitWorktree,
  apiSwitchBranch,
  apiListBranches,
  createTestGitRepo,
  cleanupTempDir,
  createTempDirPath,
  getWorktreePath,
  listWorktrees,
  listBranches,
  setupProjectWithPath,
  waitForBoardView,
  clickAddFeature,
  fillAddFeatureDialog,
  confirmAddFeature,
} from "./utils";

const execAsync = promisify(exec);

// ============================================================================
// Test Setup
// ============================================================================

// Create unique temp dir for this test run
const TEST_TEMP_DIR = createTempDirPath("worktree-tests");

interface TestRepo {
  path: string;
  cleanup: () => Promise<void>;
}

// Configure all tests to run serially to prevent interference
test.describe.configure({ mode: "serial" });

// ============================================================================
// Test Suite: Worktree Integration Tests
// ============================================================================
test.describe("Worktree Integration Tests", () => {
  let testRepo: TestRepo;

  test.beforeAll(async () => {
    // Create test temp directory
    if (!fs.existsSync(TEST_TEMP_DIR)) {
      fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
    }
  });

  test.beforeEach(async () => {
    // Create a fresh test repo for each test
    testRepo = await createTestGitRepo(TEST_TEMP_DIR);
  });

  test.afterEach(async () => {
    // Cleanup test repo after each test
    if (testRepo) {
      await testRepo.cleanup();
    }
  });

  test.afterAll(async () => {
    // Cleanup temp directory
    cleanupTempDir(TEST_TEMP_DIR);
  });

  // ==========================================================================
  // Basic Worktree Operations
  // ==========================================================================

  test("should display worktree selector with main branch", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Verify the worktree selector is visible
    const branchLabel = page.getByText("Branch:");
    await expect(branchLabel).toBeVisible({ timeout: 10000 });

    // Verify main branch button is displayed
    const mainBranchButton = page.getByRole("button", { name: "main" });
    await expect(mainBranchButton).toBeVisible({ timeout: 10000 });
  });

  test("should create a worktree via API and verify filesystem", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const branchName = "feature/test-worktree";
    const expectedWorktreePath = getWorktreePath(testRepo.path, branchName);

    const { response, data } = await apiCreateWorktree(page, testRepo.path, branchName);

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);

    // Verify worktree was created on filesystem
    expect(fs.existsSync(expectedWorktreePath)).toBe(true);

    // Verify branch was created
    const branches = await listBranches(testRepo.path);
    expect(branches).toContain(branchName);

    // Verify worktree is listed by git
    const worktrees = await listWorktrees(testRepo.path);
    expect(worktrees.length).toBe(1);
    expect(worktrees[0]).toBe(expectedWorktreePath);
  });

  test("should create two worktrees and list them both", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create first worktree
    const { response: response1 } = await apiCreateWorktree(page, testRepo.path, "feature/worktree-one");
    expect(response1.ok()).toBe(true);

    // Create second worktree
    const { response: response2 } = await apiCreateWorktree(page, testRepo.path, "feature/worktree-two");
    expect(response2.ok()).toBe(true);

    // Verify both worktrees exist
    const worktrees = await listWorktrees(testRepo.path);
    expect(worktrees.length).toBe(2);

    // Verify branches were created
    const branches = await listBranches(testRepo.path);
    expect(branches).toContain("feature/worktree-one");
    expect(branches).toContain("feature/worktree-two");
  });

  test("should delete a worktree via API and verify cleanup", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create a worktree
    const branchName = "feature/to-delete";
    const worktreePath = getWorktreePath(testRepo.path, branchName);

    await apiCreateWorktree(page, testRepo.path, branchName);
    expect(fs.existsSync(worktreePath)).toBe(true);

    // Delete it
    const { response } = await apiDeleteWorktree(page, testRepo.path, worktreePath, true);
    expect(response.ok()).toBe(true);

    // Verify worktree directory is removed
    expect(fs.existsSync(worktreePath)).toBe(false);

    // Verify branch is deleted
    const branches = await listBranches(testRepo.path);
    expect(branches).not.toContain(branchName);
  });

  test("should delete worktree but keep branch when deleteBranch is false", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const branchName = "feature/keep-branch";
    const worktreePath = getWorktreePath(testRepo.path, branchName);

    await apiCreateWorktree(page, testRepo.path, branchName);
    expect(fs.existsSync(worktreePath)).toBe(true);

    // Delete worktree but keep branch
    const { response } = await apiDeleteWorktree(page, testRepo.path, worktreePath, false);
    expect(response.ok()).toBe(true);

    // Verify worktree is gone but branch remains
    expect(fs.existsSync(worktreePath)).toBe(false);
    const branches = await listBranches(testRepo.path);
    expect(branches).toContain(branchName);
  });

  test("should list worktrees via API", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);

    // Create some worktrees first
    await apiCreateWorktree(page, testRepo.path, "feature/list-test-1");
    await apiCreateWorktree(page, testRepo.path, "feature/list-test-2");

    // List worktrees via API
    const { response, data } = await apiListWorktrees(page, testRepo.path, true);

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);
    expect(data.worktrees).toHaveLength(3); // main + 2 worktrees

    // Verify worktree details
    const branches = data.worktrees.map((w) => w.branch);
    expect(branches).toContain("main");
    expect(branches).toContain("feature/list-test-1");
    expect(branches).toContain("feature/list-test-2");
  });

  // ==========================================================================
  // Commit Operations
  // ==========================================================================

  test("should commit changes in a worktree via API", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const branchName = "feature/commit-test";
    const worktreePath = getWorktreePath(testRepo.path, branchName);

    const { response: createResponse } = await apiCreateWorktree(page, testRepo.path, branchName);
    expect(createResponse.ok()).toBe(true);

    // Create a new file in the worktree
    const testFilePath = path.join(worktreePath, "test-commit.txt");
    fs.writeFileSync(testFilePath, "This is a test file for commit");

    // Commit the changes via API
    const { response, data } = await apiCommitWorktree(page, worktreePath, "Add test file for commit integration test");

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);
    expect(data.result?.committed).toBe(true);
    expect(data.result?.branch).toBe(branchName);
    expect(data.result?.commitHash).toBeDefined();
    expect(data.result?.commitHash?.length).toBe(8);

    // Verify the commit exists in git log
    const { stdout: logOutput } = await execAsync("git log --oneline -1", { cwd: worktreePath });
    expect(logOutput).toContain("Add test file for commit integration test");
  });

  test("should return no changes when committing with no modifications", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const branchName = "feature/no-changes-commit";
    const worktreePath = getWorktreePath(testRepo.path, branchName);

    await apiCreateWorktree(page, testRepo.path, branchName);

    // Try to commit without any changes
    const { response, data } = await apiCommitWorktree(page, worktreePath, "Empty commit attempt");

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);
    expect(data.result?.committed).toBe(false);
    expect(data.result?.message).toBe("No changes to commit");
  });

  test("should handle multiple sequential commits in a worktree", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const branchName = "feature/multi-commit";
    const worktreePath = getWorktreePath(testRepo.path, branchName);

    await apiCreateWorktree(page, testRepo.path, branchName);

    // First commit
    fs.writeFileSync(path.join(worktreePath, "file1.txt"), "First file");
    const { data: data1 } = await apiCommitWorktree(page, worktreePath, "First commit");
    expect(data1.result?.committed).toBe(true);

    // Second commit
    fs.writeFileSync(path.join(worktreePath, "file2.txt"), "Second file");
    const { data: data2 } = await apiCommitWorktree(page, worktreePath, "Second commit");
    expect(data2.result?.committed).toBe(true);

    // Third commit
    fs.writeFileSync(path.join(worktreePath, "file3.txt"), "Third file");
    const { data: data3 } = await apiCommitWorktree(page, worktreePath, "Third commit");
    expect(data3.result?.committed).toBe(true);

    // Verify all commits exist in log
    const { stdout: logOutput } = await execAsync("git log --oneline -5", { cwd: worktreePath });
    expect(logOutput).toContain("First commit");
    expect(logOutput).toContain("Second commit");
    expect(logOutput).toContain("Third commit");
  });

  // ==========================================================================
  // Branch Switching
  // ==========================================================================

  test("should switch branches within a worktree via API", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create a second branch in the main repo for switching
    await execAsync("git branch test-switch-target", { cwd: testRepo.path });

    // Switch to the new branch via API
    const { response, data } = await apiSwitchBranch(page, testRepo.path, "test-switch-target");

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);
    expect(data.result?.previousBranch).toBe("main");
    expect(data.result?.currentBranch).toBe("test-switch-target");
    expect(data.result?.message).toContain("Switched to branch");

    // Verify the branch was actually switched
    const { stdout: currentBranch } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd: testRepo.path });
    expect(currentBranch.trim()).toBe("test-switch-target");

    // Switch back to main
    await execAsync("git checkout main", { cwd: testRepo.path });
  });

  test("should prevent branch switch with uncommitted changes", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create a branch to switch to
    await execAsync("git branch test-switch-blocked", { cwd: testRepo.path });

    // Create uncommitted changes
    const testFilePath = path.join(testRepo.path, "uncommitted-change.txt");
    fs.writeFileSync(testFilePath, "This file has uncommitted changes");
    await execAsync("git add uncommitted-change.txt", { cwd: testRepo.path });

    // Try to switch branches (should fail)
    const { response, data } = await apiSwitchBranch(page, testRepo.path, "test-switch-blocked");

    expect(response.ok()).toBe(false);
    expect(data.success).toBe(false);
    expect(data.error).toContain("uncommitted changes");
    expect(data.code).toBe("UNCOMMITTED_CHANGES");

    // Clean up - reset changes
    await execAsync("git reset HEAD", { cwd: testRepo.path });
    fs.unlinkSync(testFilePath);
  });

  test("should handle switching to non-existent branch", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Try to switch to a branch that doesn't exist
    const { response, data } = await apiSwitchBranch(page, testRepo.path, "non-existent-branch");

    expect(response.ok()).toBe(false);
    expect(data.success).toBe(false);
    expect(data.error).toContain("does not exist");
  });

  test("should handle switching to current branch (no-op)", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Try to switch to the current branch
    const { response, data } = await apiSwitchBranch(page, testRepo.path, "main");

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);
    expect(data.result?.message).toContain("Already on branch");
  });

  // ==========================================================================
  // List Branches
  // ==========================================================================

  test("should list all branches via API", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create additional branches
    await execAsync("git branch feature/branch-list-1", { cwd: testRepo.path });
    await execAsync("git branch feature/branch-list-2", { cwd: testRepo.path });
    await execAsync("git branch bugfix/test-branch", { cwd: testRepo.path });

    // List branches via API
    const { response, data } = await apiListBranches(page, testRepo.path);

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);
    expect(data.result?.currentBranch).toBe("main");
    expect(data.result?.branches.length).toBeGreaterThanOrEqual(4);

    const branchNames = data.result?.branches.map((b) => b.name) || [];
    expect(branchNames).toContain("main");
    expect(branchNames).toContain("feature/branch-list-1");
    expect(branchNames).toContain("feature/branch-list-2");
    expect(branchNames).toContain("bugfix/test-branch");

    // Verify current branch is marked correctly
    const currentBranchInfo = data.result?.branches.find((b) => b.name === "main");
    expect(currentBranchInfo?.isCurrent).toBe(true);
  });

  // ==========================================================================
  // Worktree Isolation
  // ==========================================================================

  test("should isolate files between worktrees", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create two worktrees
    const branch1 = "feature/isolation-1";
    const branch2 = "feature/isolation-2";
    const worktree1Path = getWorktreePath(testRepo.path, branch1);
    const worktree2Path = getWorktreePath(testRepo.path, branch2);

    await apiCreateWorktree(page, testRepo.path, branch1);
    await apiCreateWorktree(page, testRepo.path, branch2);

    // Create different files in each worktree
    const file1Path = path.join(worktree1Path, "worktree1-only.txt");
    const file2Path = path.join(worktree2Path, "worktree2-only.txt");

    fs.writeFileSync(file1Path, "File only in worktree 1");
    fs.writeFileSync(file2Path, "File only in worktree 2");

    // Verify file1 only exists in worktree1
    expect(fs.existsSync(file1Path)).toBe(true);
    expect(fs.existsSync(path.join(worktree2Path, "worktree1-only.txt"))).toBe(false);

    // Verify file2 only exists in worktree2
    expect(fs.existsSync(file2Path)).toBe(true);
    expect(fs.existsSync(path.join(worktree1Path, "worktree2-only.txt"))).toBe(false);

    // Commit in worktree1
    await execAsync("git add worktree1-only.txt", { cwd: worktree1Path });
    await execAsync('git commit -m "Add file in worktree1"', { cwd: worktree1Path });

    // Commit in worktree2
    await execAsync("git add worktree2-only.txt", { cwd: worktree2Path });
    await execAsync('git commit -m "Add file in worktree2"', { cwd: worktree2Path });

    // Verify commits are separate
    const { stdout: log1 } = await execAsync("git log --oneline -1", { cwd: worktree1Path });
    const { stdout: log2 } = await execAsync("git log --oneline -1", { cwd: worktree2Path });

    expect(log1).toContain("Add file in worktree1");
    expect(log2).toContain("Add file in worktree2");
    expect(log1).not.toContain("Add file in worktree2");
    expect(log2).not.toContain("Add file in worktree1");
  });

  test("should detect modified files count in worktree listing", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    const branchName = "feature/changes-detection";
    const worktreePath = getWorktreePath(testRepo.path, branchName);

    await apiCreateWorktree(page, testRepo.path, branchName);

    // Create multiple modified files
    fs.writeFileSync(path.join(worktreePath, "change1.txt"), "Change 1");
    fs.writeFileSync(path.join(worktreePath, "change2.txt"), "Change 2");
    fs.writeFileSync(path.join(worktreePath, "change3.txt"), "Change 3");

    // List worktrees and check for changes
    const { response, data } = await apiListWorktrees(page, testRepo.path, true);

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);

    // Find the worktree we created
    const changedWorktree = data.worktrees.find((w) => w.branch === branchName);
    expect(changedWorktree).toBeDefined();
    expect(changedWorktree?.hasChanges).toBe(true);
    expect(changedWorktree?.changedFilesCount).toBeGreaterThanOrEqual(3);
  });

  // ==========================================================================
  // Existing Branch Handling
  // ==========================================================================

  test("should create worktree from existing branch", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // First, create a branch with some commits (without worktree)
    const branchName = "feature/existing-branch";
    await execAsync(`git branch ${branchName}`, { cwd: testRepo.path });
    await execAsync(`git checkout ${branchName}`, { cwd: testRepo.path });
    fs.writeFileSync(path.join(testRepo.path, "existing-file.txt"), "Content from existing branch");
    await execAsync("git add existing-file.txt", { cwd: testRepo.path });
    await execAsync('git commit -m "Commit on existing branch"', { cwd: testRepo.path });
    await execAsync("git checkout main", { cwd: testRepo.path });

    // Now create a worktree for that existing branch
    const expectedWorktreePath = getWorktreePath(testRepo.path, branchName);

    const { response, data } = await apiCreateWorktree(page, testRepo.path, branchName);

    expect(response.ok()).toBe(true);
    expect(data.success).toBe(true);

    // Verify the worktree has the file from the existing branch
    const existingFilePath = path.join(expectedWorktreePath, "existing-file.txt");
    expect(fs.existsSync(existingFilePath)).toBe(true);
    const content = fs.readFileSync(existingFilePath, "utf-8");
    expect(content).toBe("Content from existing branch");
  });

  test("should return existing worktree when creating with same branch name", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create first worktree
    const branchName = "feature/duplicate-test";
    const { response: response1, data: data1 } = await apiCreateWorktree(page, testRepo.path, branchName);
    expect(response1.ok()).toBe(true);
    expect(data1.success).toBe(true);
    expect(data1.worktree?.isNew).not.toBe(false); // New branch was created

    // Try to create another worktree with same branch name
    // This should succeed and return the existing worktree (not an error)
    const { response: response2, data: data2 } = await apiCreateWorktree(page, testRepo.path, branchName);

    expect(response2.ok()).toBe(true);
    expect(data2.success).toBe(true);
    expect(data2.worktree?.isNew).toBe(false); // Not a new creation, returned existing
    expect(data2.worktree?.branch).toBe(branchName);
  });

  // ==========================================================================
  // Feature Integration
  // ==========================================================================

  test("should add a feature to backlog with specific branch", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Create a worktree first
    const branchName = "feature/test-branch";
    await apiCreateWorktree(page, testRepo.path, branchName);

    // Click add feature button
    await clickAddFeature(page);

    // Fill in the feature details
    await fillAddFeatureDialog(page, "Test feature for worktree", {
      branch: branchName,
      category: "Testing",
    });

    // Confirm
    await confirmAddFeature(page);

    // Wait for the feature to appear
    await page.waitForTimeout(1000);

    // Verify feature was created with correct branch by checking the filesystem
    const featuresDir = path.join(testRepo.path, ".automaker", "features");
    const featureDirs = fs.readdirSync(featuresDir);
    expect(featureDirs.length).toBeGreaterThan(0);

    // Find and read the feature file
    const featureDir = featureDirs[0];
    const featureFilePath = path.join(featuresDir, featureDir, "feature.json");
    const featureData = JSON.parse(fs.readFileSync(featureFilePath, "utf-8"));

    expect(featureData.description).toBe("Test feature for worktree");
    expect(featureData.branchName).toBe(branchName);
    expect(featureData.status).toBe("backlog");
  });

  test("should filter features by selected worktree", async ({ page }) => {
    // Create the worktrees first (using git directly for setup)
    await execAsync(`git worktree add ".worktrees/feature-worktree-a" -b feature/worktree-a`, {
      cwd: testRepo.path,
    });
    await execAsync(`git worktree add ".worktrees/feature-worktree-b" -b feature/worktree-b`, {
      cwd: testRepo.path,
    });

    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // First click on main to ensure we're on the main branch
    const mainButton = page.getByRole("button", { name: "main" }).first();
    await mainButton.click();
    await page.waitForTimeout(500);

    // Create feature for main branch
    await clickAddFeature(page);
    const descriptionInput = page.locator('[data-testid="add-feature-dialog"] textarea').first();
    await descriptionInput.fill("Feature for main branch");
    await confirmAddFeature(page);

    // Wait for feature to be visible
    const mainFeatureText = page.getByText("Feature for main branch");
    await expect(mainFeatureText).toBeVisible({ timeout: 10000 });

    // Switch to worktree-a and create a feature there
    const worktreeAButton = page.getByRole("button", { name: /feature\/worktree-a/i });
    await worktreeAButton.click();
    await page.waitForTimeout(500);

    // Main feature should not be visible now
    await expect(mainFeatureText).not.toBeVisible();

    // Create feature for worktree-a
    await clickAddFeature(page);
    const descriptionInput2 = page.locator('[data-testid="add-feature-dialog"] textarea').first();
    await descriptionInput2.fill("Feature for worktree A");
    await confirmAddFeature(page);

    // Wait for feature to be visible
    const worktreeAText = page.getByText("Feature for worktree A");
    await expect(worktreeAText).toBeVisible({ timeout: 10000 });

    // Switch to worktree-b and create a feature
    const worktreeBButton = page.getByRole("button", { name: /feature\/worktree-b/i });
    await worktreeBButton.click();
    await page.waitForTimeout(500);

    // worktree-a feature should not be visible
    await expect(worktreeAText).not.toBeVisible();

    await clickAddFeature(page);
    const descriptionInput3 = page.locator('[data-testid="add-feature-dialog"] textarea').first();
    await descriptionInput3.fill("Feature for worktree B");
    await confirmAddFeature(page);

    const worktreeBText = page.getByText("Feature for worktree B");
    await expect(worktreeBText).toBeVisible({ timeout: 10000 });

    // Switch back to main and verify filtering
    await mainButton.click();
    await page.waitForTimeout(500);

    await expect(mainFeatureText).toBeVisible({ timeout: 10000 });
    await expect(worktreeAText).not.toBeVisible();
    await expect(worktreeBText).not.toBeVisible();
  });

  test("should pre-fill branch when creating feature from selected worktree", async ({ page }) => {
    // Create a worktree first
    const branchName = "feature/pre-fill-test";
    await execAsync(`git worktree add ".worktrees/feature-pre-fill-test" -b ${branchName}`, {
      cwd: testRepo.path,
    });

    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);
    await waitForBoardView(page);

    // Wait for worktree selector to load
    await page.waitForTimeout(1000);

    // Click on the worktree to select it
    const worktreeButton = page.getByRole("button", { name: /feature\/pre-fill-test/i });
    await worktreeButton.click();
    await page.waitForTimeout(500);

    // Open add feature dialog
    await clickAddFeature(page);

    // Verify the branch input button shows the selected worktree's branch
    const branchButton = page.locator('[data-testid="feature-branch-input"]');
    await expect(branchButton).toContainText(branchName, { timeout: 5000 });

    // Close dialog
    await page.keyboard.press("Escape");
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  test("should handle commit with missing required fields", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);

    // Try to commit without worktreePath
    const response1 = await page.request.post("http://localhost:3008/api/worktree/commit", {
      data: { message: "Missing worktreePath" },
    });

    expect(response1.ok()).toBe(false);
    const result1 = await response1.json();
    expect(result1.success).toBe(false);
    expect(result1.error).toContain("worktreePath");

    // Try to commit without message
    const response2 = await page.request.post("http://localhost:3008/api/worktree/commit", {
      data: { worktreePath: testRepo.path },
    });

    expect(response2.ok()).toBe(false);
    const result2 = await response2.json();
    expect(result2.success).toBe(false);
    expect(result2.error).toContain("message");
  });

  test("should handle switch-branch with missing required fields", async ({ page }) => {
    await setupProjectWithPath(page, testRepo.path);
    await page.goto("/");
    await waitForNetworkIdle(page);

    // Try to switch without worktreePath
    const response1 = await page.request.post("http://localhost:3008/api/worktree/switch-branch", {
      data: { branchName: "some-branch" },
    });

    expect(response1.ok()).toBe(false);
    const result1 = await response1.json();
    expect(result1.success).toBe(false);
    expect(result1.error).toContain("worktreePath");

    // Try to switch without branchName
    const response2 = await page.request.post("http://localhost:3008/api/worktree/switch-branch", {
      data: { worktreePath: testRepo.path },
    });

    expect(response2.ok()).toBe(false);
    const result2 = await response2.json();
    expect(result2.success).toBe(false);
    expect(result2.error).toContain("branchName");
  });
});
