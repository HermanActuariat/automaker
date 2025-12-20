import { Button } from "@/components/ui/button";
import { GitBranch, Plus, RefreshCw } from "lucide-react";
import { cn, pathsEqual } from "@/lib/utils";
import type { WorktreePanelProps, WorktreeInfo } from "./types";
import {
  useWorktrees,
  useDevServers,
  useBranches,
  useWorktreeActions,
  useDefaultEditor,
  useRunningFeatures,
} from "./hooks";
import { WorktreeTab } from "./components";

export function WorktreePanel({
  projectPath,
  onCreateWorktree,
  onDeleteWorktree,
  onCommit,
  onCreatePR,
  onCreateBranch,
  onAddressPRComments,
  onResolveConflicts,
  onRemovedWorktrees,
  runningFeatureIds = [],
  features = [],
  branchCardCounts,
  refreshTrigger = 0,
}: WorktreePanelProps) {
  const {
    isLoading,
    worktrees,
    currentWorktree,
    currentWorktreePath,
    useWorktreesEnabled,
    fetchWorktrees,
    handleSelectWorktree,
  } = useWorktrees({ projectPath, refreshTrigger, onRemovedWorktrees });

  const {
    isStartingDevServer,
    getWorktreeKey,
    isDevServerRunning,
    getDevServerInfo,
    handleStartDevServer,
    handleStopDevServer,
    handleOpenDevServerUrl,
  } = useDevServers({ projectPath });

  const {
    branches,
    filteredBranches,
    aheadCount,
    behindCount,
    isLoadingBranches,
    branchFilter,
    setBranchFilter,
    resetBranchFilter,
    fetchBranches,
  } = useBranches();

  const {
    isPulling,
    isPushing,
    isSwitching,
    isActivating,
    handleSwitchBranch,
    handlePull,
    handlePush,
    handleOpenInEditor,
  } = useWorktreeActions({
    fetchWorktrees,
    fetchBranches,
  });

  const { defaultEditorName } = useDefaultEditor();

  const { hasRunningFeatures } = useRunningFeatures({
    runningFeatureIds,
    features,
  });

  const isWorktreeSelected = (worktree: WorktreeInfo) => {
    return worktree.isMain
      ? currentWorktree === null ||
          currentWorktree === undefined ||
          currentWorktree.path === null
      : pathsEqual(worktree.path, currentWorktreePath);
  };

  const handleBranchDropdownOpenChange =
    (worktree: WorktreeInfo) => (open: boolean) => {
      if (open) {
        fetchBranches(worktree.path);
        resetBranchFilter();
      }
    };

  const handleActionsDropdownOpenChange =
    (worktree: WorktreeInfo) => (open: boolean) => {
      if (open) {
        fetchBranches(worktree.path);
      }
    };

  const mainWorktree = worktrees.find((w) => w.isMain);
  const nonMainWorktrees = worktrees.filter((w) => !w.isMain);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-glass/50 backdrop-blur-sm">
      {/* Branch section - always visible */}
      <GitBranch className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground mr-2">Branch:</span>

      <div className="flex items-center gap-2">
        {mainWorktree && (
          <WorktreeTab
            key={mainWorktree.path}
            worktree={mainWorktree}
            cardCount={branchCardCounts?.[mainWorktree.branch]}
            hasChanges={mainWorktree.hasChanges}
            changedFilesCount={mainWorktree.changedFilesCount}
            isSelected={isWorktreeSelected(mainWorktree)}
            isRunning={hasRunningFeatures(mainWorktree)}
            isActivating={isActivating}
            isDevServerRunning={isDevServerRunning(mainWorktree)}
            devServerInfo={getDevServerInfo(mainWorktree)}
            defaultEditorName={defaultEditorName}
            branches={branches}
            filteredBranches={filteredBranches}
            branchFilter={branchFilter}
            isLoadingBranches={isLoadingBranches}
            isSwitching={isSwitching}
            isPulling={isPulling}
            isPushing={isPushing}
            isStartingDevServer={isStartingDevServer}
            aheadCount={aheadCount}
            behindCount={behindCount}
            onSelectWorktree={handleSelectWorktree}
            onBranchDropdownOpenChange={handleBranchDropdownOpenChange(
              mainWorktree
            )}
            onActionsDropdownOpenChange={handleActionsDropdownOpenChange(
              mainWorktree
            )}
            onBranchFilterChange={setBranchFilter}
            onSwitchBranch={handleSwitchBranch}
            onCreateBranch={onCreateBranch}
            onPull={handlePull}
            onPush={handlePush}
            onOpenInEditor={handleOpenInEditor}
            onCommit={onCommit}
            onCreatePR={onCreatePR}
            onAddressPRComments={onAddressPRComments}
            onResolveConflicts={onResolveConflicts}
            onDeleteWorktree={onDeleteWorktree}
            onStartDevServer={handleStartDevServer}
            onStopDevServer={handleStopDevServer}
            onOpenDevServerUrl={handleOpenDevServerUrl}
          />
        )}
      </div>

      {/* Worktrees section - only show if enabled */}
      {useWorktreesEnabled && (
        <>
          <div className="w-px h-5 bg-border mx-2" />
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Worktrees:</span>

          <div className="flex items-center gap-2 flex-wrap">
            {nonMainWorktrees.map((worktree) => {
              const cardCount = branchCardCounts?.[worktree.branch];
              return (
                <WorktreeTab
                  key={worktree.path}
                  worktree={worktree}
                  cardCount={cardCount}
                  hasChanges={worktree.hasChanges}
                  changedFilesCount={worktree.changedFilesCount}
                  isSelected={isWorktreeSelected(worktree)}
                  isRunning={hasRunningFeatures(worktree)}
                  isActivating={isActivating}
                  isDevServerRunning={isDevServerRunning(worktree)}
                  devServerInfo={getDevServerInfo(worktree)}
                  defaultEditorName={defaultEditorName}
                  branches={branches}
                  filteredBranches={filteredBranches}
                  branchFilter={branchFilter}
                  isLoadingBranches={isLoadingBranches}
                  isSwitching={isSwitching}
                  isPulling={isPulling}
                  isPushing={isPushing}
                  isStartingDevServer={isStartingDevServer}
                  aheadCount={aheadCount}
                  behindCount={behindCount}
                  onSelectWorktree={handleSelectWorktree}
                  onBranchDropdownOpenChange={handleBranchDropdownOpenChange(
                    worktree
                  )}
                  onActionsDropdownOpenChange={handleActionsDropdownOpenChange(
                    worktree
                  )}
                  onBranchFilterChange={setBranchFilter}
                  onSwitchBranch={handleSwitchBranch}
                  onCreateBranch={onCreateBranch}
                  onPull={handlePull}
                  onPush={handlePush}
                  onOpenInEditor={handleOpenInEditor}
                  onCommit={onCommit}
                  onCreatePR={onCreatePR}
                  onAddressPRComments={onAddressPRComments}
                  onResolveConflicts={onResolveConflicts}
                  onDeleteWorktree={onDeleteWorktree}
                  onStartDevServer={handleStartDevServer}
                  onStopDevServer={handleStopDevServer}
                  onOpenDevServerUrl={handleOpenDevServerUrl}
                />
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={onCreateWorktree}
              title="Create new worktree"
            >
              <Plus className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={async () => {
                const removedWorktrees = await fetchWorktrees();
                if (
                  removedWorktrees &&
                  removedWorktrees.length > 0 &&
                  onRemovedWorktrees
                ) {
                  onRemovedWorktrees(removedWorktrees);
                }
              }}
              disabled={isLoading}
              title="Refresh worktrees"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
              />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
