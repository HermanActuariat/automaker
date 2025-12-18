"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  pointerWithin,
} from "@dnd-kit/core";
import { useAppStore, Feature } from "@/store/app-store";
import { getElectronAPI } from "@/lib/electron";
import type { AutoModeEvent } from "@/types/electron";
import { pathsEqual } from "@/lib/utils";
import { getBlockingDependencies } from "@/lib/dependency-resolver";
import { BoardBackgroundModal } from "@/components/dialogs/board-background-modal";
import { RefreshCw } from "lucide-react";
import { useAutoMode } from "@/hooks/use-auto-mode";
import { useKeyboardShortcutsConfig } from "@/hooks/use-keyboard-shortcuts";
import { useWindowState } from "@/hooks/use-window-state";
// Board-view specific imports
import { BoardHeader } from "./board-view/board-header";
import { BoardSearchBar } from "./board-view/board-search-bar";
import { BoardControls } from "./board-view/board-controls";
import { KanbanBoard } from "./board-view/kanban-board";
import {
  AddFeatureDialog,
  AgentOutputModal,
  CompletedFeaturesModal,
  ArchiveAllVerifiedDialog,
  DeleteCompletedFeatureDialog,
  EditFeatureDialog,
  FeatureSuggestionsDialog,
  FollowUpDialog,
  PlanApprovalDialog,
} from "./board-view/dialogs";
import { CreateWorktreeDialog } from "./board-view/dialogs/create-worktree-dialog";
import { DeleteWorktreeDialog } from "./board-view/dialogs/delete-worktree-dialog";
import { CommitWorktreeDialog } from "./board-view/dialogs/commit-worktree-dialog";
import { CreatePRDialog } from "./board-view/dialogs/create-pr-dialog";
import { CreateBranchDialog } from "./board-view/dialogs/create-branch-dialog";
import { WorktreePanel } from "./board-view/worktree-panel";
import { COLUMNS } from "./board-view/constants";
import {
  useBoardFeatures,
  useBoardDragDrop,
  useBoardActions,
  useBoardKeyboardShortcuts,
  useBoardColumnFeatures,
  useBoardEffects,
  useBoardBackground,
  useBoardPersistence,
  useFollowUpState,
  useSuggestionsState,
} from "./board-view/hooks";

// Stable empty array to avoid infinite loop in selector
const EMPTY_WORKTREES: ReturnType<
  ReturnType<typeof useAppStore.getState>["getWorktrees"]
> = [];

export function BoardView() {
  const {
    currentProject,
    maxConcurrency,
    setMaxConcurrency,
    defaultSkipTests,
    showProfilesOnly,
    aiProfiles,
    kanbanCardDetailLevel,
    setKanbanCardDetailLevel,
    specCreatingForProject,
    setSpecCreatingForProject,
    pendingPlanApproval,
    setPendingPlanApproval,
    updateFeature,
    getCurrentWorktree,
    setCurrentWorktree,
    getWorktrees,
    setWorktrees,
    useWorktrees,
    enableDependencyBlocking,
    isPrimaryWorktreeBranch,
    getPrimaryWorktreeBranch,
  } = useAppStore();
  const shortcuts = useKeyboardShortcutsConfig();
  const {
    features: hookFeatures,
    isLoading,
    persistedCategories,
    loadFeatures,
    saveCategory,
  } = useBoardFeatures({ currentProject });
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [outputFeature, setOutputFeature] = useState<Feature | null>(null);
  const [featuresWithContext, setFeaturesWithContext] = useState<Set<string>>(
    new Set()
  );
  const [showArchiveAllVerifiedDialog, setShowArchiveAllVerifiedDialog] =
    useState(false);
  const [showBoardBackgroundModal, setShowBoardBackgroundModal] =
    useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [deleteCompletedFeature, setDeleteCompletedFeature] =
    useState<Feature | null>(null);
  // State for viewing plan in read-only mode
  const [viewPlanFeature, setViewPlanFeature] = useState<Feature | null>(null);

  // Worktree dialog states
  const [showCreateWorktreeDialog, setShowCreateWorktreeDialog] =
    useState(false);
  const [showDeleteWorktreeDialog, setShowDeleteWorktreeDialog] =
    useState(false);
  const [showCommitWorktreeDialog, setShowCommitWorktreeDialog] =
    useState(false);
  const [showCreatePRDialog, setShowCreatePRDialog] = useState(false);
  const [showCreateBranchDialog, setShowCreateBranchDialog] = useState(false);
  const [selectedWorktreeForAction, setSelectedWorktreeForAction] = useState<{
    path: string;
    branch: string;
    isMain: boolean;
    hasChanges?: boolean;
    changedFilesCount?: number;
  } | null>(null);
  const [worktreeRefreshKey, setWorktreeRefreshKey] = useState(0);

  // Follow-up state hook
  const {
    showFollowUpDialog,
    followUpFeature,
    followUpPrompt,
    followUpImagePaths,
    followUpPreviewMap,
    setShowFollowUpDialog,
    setFollowUpFeature,
    setFollowUpPrompt,
    setFollowUpImagePaths,
    setFollowUpPreviewMap,
    handleFollowUpDialogChange,
  } = useFollowUpState();

  // Suggestions state hook
  const {
    showSuggestionsDialog,
    suggestionsCount,
    featureSuggestions,
    isGeneratingSuggestions,
    setShowSuggestionsDialog,
    setSuggestionsCount,
    setFeatureSuggestions,
    setIsGeneratingSuggestions,
    updateSuggestions,
    closeSuggestionsDialog,
  } = useSuggestionsState();
  // Search filter for Kanban cards
  const [searchQuery, setSearchQuery] = useState("");
  // Plan approval loading state
  const [isPlanApprovalLoading, setIsPlanApprovalLoading] = useState(false);
  // Derive spec creation state from store - check if current project is the one being created
  const isCreatingSpec = specCreatingForProject === currentProject?.path;
  const creatingSpecProjectPath = specCreatingForProject ?? undefined;

  const checkContextExists = useCallback(
    async (featureId: string): Promise<boolean> => {
      if (!currentProject) return false;

      try {
        const api = getElectronAPI();
        if (!api?.autoMode?.contextExists) {
          return false;
        }

        const result = await api.autoMode.contextExists(
          currentProject.path,
          featureId
        );

        return result.success && result.exists === true;
      } catch (error) {
        console.error("[Board] Error checking context:", error);
        return false;
      }
    },
    [currentProject]
  );

  // Use board effects hook
  useBoardEffects({
    currentProject,
    specCreatingForProject,
    setSpecCreatingForProject,
    setSuggestionsCount,
    setFeatureSuggestions,
    setIsGeneratingSuggestions,
    checkContextExists,
    features: hookFeatures,
    isLoading,
    setFeaturesWithContext,
  });

  // Auto mode hook
  const autoMode = useAutoMode();
  // Get runningTasks from the hook (scoped to current project)
  const runningAutoTasks = autoMode.runningTasks;

  // Window state hook for compact dialog mode
  const { isMaximized } = useWindowState();

  // Keyboard shortcuts hook will be initialized after actions hook

  // Prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get unique categories from existing features AND persisted categories for autocomplete suggestions
  const categorySuggestions = useMemo(() => {
    const featureCategories = hookFeatures
      .map((f) => f.category)
      .filter(Boolean);
    // Merge feature categories with persisted categories
    const allCategories = [...featureCategories, ...persistedCategories];
    return [...new Set(allCategories)].sort();
  }, [hookFeatures, persistedCategories]);

  // Branch suggestions for the branch autocomplete
  // Shows all local branches as suggestions, but users can type any new branch name
  // When the feature is started, a worktree will be created if needed
  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([]);

  // Fetch branches when project changes or worktrees are created/modified
  useEffect(() => {
    const fetchBranches = async () => {
      if (!currentProject) {
        setBranchSuggestions([]);
        return;
      }

      try {
        const api = getElectronAPI();
        if (!api?.worktree?.listBranches) {
          setBranchSuggestions([]);
          return;
        }

        const result = await api.worktree.listBranches(currentProject.path);
        if (result.success && result.result?.branches) {
          const localBranches = result.result.branches
            .filter((b) => !b.isRemote)
            .map((b) => b.name);
          setBranchSuggestions(localBranches);
        }
      } catch (error) {
        console.error("[BoardView] Error fetching branches:", error);
        setBranchSuggestions([]);
      }
    };

    fetchBranches();
  }, [currentProject, worktreeRefreshKey]);

  // Custom collision detection that prioritizes columns over cards
  const collisionDetectionStrategy = useCallback((args: any) => {
    // First, check if pointer is within a column
    const pointerCollisions = pointerWithin(args);
    const columnCollisions = pointerCollisions.filter((collision: any) =>
      COLUMNS.some((col) => col.id === collision.id)
    );

    // If we found a column collision, use that
    if (columnCollisions.length > 0) {
      return columnCollisions;
    }

    // Otherwise, use rectangle intersection for cards
    return rectIntersection(args);
  }, []);

  // Use persistence hook
  const { persistFeatureCreate, persistFeatureUpdate, persistFeatureDelete } =
    useBoardPersistence({ currentProject });

  // Memoize the removed worktrees handler to prevent infinite loops
  const handleRemovedWorktrees = useCallback(
    (removedWorktrees: Array<{ path: string; branch: string }>) => {
      // Reset features that were assigned to the removed worktrees (by branch)
      hookFeatures.forEach((feature) => {
        const matchesRemovedWorktree = removedWorktrees.some((removed) => {
          // Match by branch name since worktreePath is no longer stored
          return feature.branchName === removed.branch;
        });

        if (matchesRemovedWorktree) {
          // Reset the feature's branch assignment
          persistFeatureUpdate(feature.id, {
            branchName: null as unknown as string | undefined,
          });
        }
      });
    },
    [hookFeatures, persistFeatureUpdate]
  );

  // Get in-progress features for keyboard shortcuts (needed before actions hook)
  const inProgressFeaturesForShortcuts = useMemo(() => {
    return hookFeatures.filter((f) => {
      const isRunning = runningAutoTasks.includes(f.id);
      return isRunning || f.status === "in_progress";
    });
  }, [hookFeatures, runningAutoTasks]);

  // Get current worktree info (path) for filtering features
  // This needs to be before useBoardActions so we can pass currentWorktreeBranch
  const currentWorktreeInfo = currentProject
    ? getCurrentWorktree(currentProject.path)
    : null;
  const currentWorktreePath = currentWorktreeInfo?.path ?? null;
  const worktreesByProject = useAppStore((s) => s.worktreesByProject);
  const worktrees = useMemo(
    () =>
      currentProject
        ? worktreesByProject[currentProject.path] ?? EMPTY_WORKTREES
        : EMPTY_WORKTREES,
    [currentProject, worktreesByProject]
  );

  // Get the branch for the currently selected worktree
  // Find the worktree that matches the current selection, or use main worktree
  const selectedWorktree = useMemo(() => {
    if (currentWorktreePath === null) {
      // Primary worktree selected - find the main worktree
      return worktrees.find((w) => w.isMain);
    } else {
      // Specific worktree selected - find it by path
      return worktrees.find(
        (w) => !w.isMain && pathsEqual(w.path, currentWorktreePath)
      );
    }
  }, [worktrees, currentWorktreePath]);

  // Get the current branch from the selected worktree (not from store which may be stale)
  const currentWorktreeBranch = selectedWorktree?.branch ?? null;

  // Get the branch for the currently selected worktree (for defaulting new features)
  // Use the branch from selectedWorktree, or fall back to main worktree's branch
  const selectedWorktreeBranch =
    currentWorktreeBranch || worktrees.find((w) => w.isMain)?.branch || "main";

  // Extract all action handlers into a hook
  const {
    handleAddFeature,
    handleUpdateFeature,
    handleDeleteFeature,
    handleStartImplementation,
    handleVerifyFeature,
    handleResumeFeature,
    handleManualVerify,
    handleMoveBackToInProgress,
    handleOpenFollowUp,
    handleSendFollowUp,
    handleCommitFeature,
    handleMergeFeature,
    handleCompleteFeature,
    handleUnarchiveFeature,
    handleViewOutput,
    handleOutputModalNumberKeyPress,
    handleForceStopFeature,
    handleStartNextFeatures,
    handleArchiveAllVerified,
  } = useBoardActions({
    currentProject,
    features: hookFeatures,
    runningAutoTasks,
    loadFeatures,
    persistFeatureCreate,
    persistFeatureUpdate,
    persistFeatureDelete,
    saveCategory,
    setEditingFeature,
    setShowOutputModal,
    setOutputFeature,
    followUpFeature,
    followUpPrompt,
    followUpImagePaths,
    setFollowUpFeature,
    setFollowUpPrompt,
    setFollowUpImagePaths,
    setFollowUpPreviewMap,
    setShowFollowUpDialog,
    inProgressFeaturesForShortcuts,
    outputFeature,
    projectPath: currentProject?.path || null,
    onWorktreeCreated: () => setWorktreeRefreshKey((k) => k + 1),
    currentWorktreeBranch,
  });

  // Client-side auto mode: periodically check for backlog items and move them to in-progress
  // Use a ref to track the latest auto mode state so async operations always check the current value
  const autoModeRunningRef = useRef(autoMode.isRunning);
  useEffect(() => {
    autoModeRunningRef.current = autoMode.isRunning;
  }, [autoMode.isRunning]);

  // Use a ref to track the latest features to avoid effect re-runs when features change
  const hookFeaturesRef = useRef(hookFeatures);
  useEffect(() => {
    hookFeaturesRef.current = hookFeatures;
  }, [hookFeatures]);

  // Track features that are pending (started but not yet confirmed running)
  const pendingFeaturesRef = useRef<Set<string>>(new Set());

  // Listen to auto mode events to remove features from pending when they start running
  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.autoMode) return;

    const unsubscribe = api.autoMode.onEvent((event: AutoModeEvent) => {
      if (!currentProject) return;

      // Only process events for the current project
      const eventProjectPath =
        "projectPath" in event ? event.projectPath : undefined;
      if (eventProjectPath && eventProjectPath !== currentProject.path) {
        return;
      }

      switch (event.type) {
        case "auto_mode_feature_start":
          // Feature is now confirmed running - remove from pending
          if (event.featureId) {
            pendingFeaturesRef.current.delete(event.featureId);
          }
          break;

        case "auto_mode_feature_complete":
        case "auto_mode_error":
          // Feature completed or errored - remove from pending if still there
          if (event.featureId) {
            pendingFeaturesRef.current.delete(event.featureId);
          }
          break;
      }
    });

    return unsubscribe;
  }, [currentProject]);

  useEffect(() => {
    if (!autoMode.isRunning || !currentProject) {
      return;
    }

    let isChecking = false;
    let isActive = true; // Track if this effect is still active

    const checkAndStartFeatures = async () => {
      // Check if auto mode is still running and effect is still active
      // Use ref to get the latest value, not the closure value
      if (!isActive || !autoModeRunningRef.current || !currentProject) {
        return;
      }

      // Prevent concurrent executions
      if (isChecking) {
        return;
      }

      isChecking = true;
      try {
        // Double-check auto mode is still running before proceeding
        if (!isActive || !autoModeRunningRef.current || !currentProject) {
          return;
        }

        // Count currently running tasks + pending features
        const currentRunning =
          runningAutoTasks.length + pendingFeaturesRef.current.size;
        const availableSlots = maxConcurrency - currentRunning;

        // No available slots, skip check
        if (availableSlots <= 0) {
          return;
        }

        // Filter backlog features by the currently selected worktree branch
        // This logic mirrors use-board-column-features.ts for consistency
        // Use ref to get the latest features without causing effect re-runs
        const currentFeatures = hookFeaturesRef.current;
        const backlogFeatures = currentFeatures.filter((f) => {
          if (f.status !== "backlog") return false;

          const featureBranch = f.branchName;

          // Features without branchName are considered unassigned (show only on primary worktree)
          if (!featureBranch) {
            // No branch assigned - show only when viewing primary worktree
            const isViewingPrimary = currentWorktreePath === null;
            return isViewingPrimary;
          }

          if (currentWorktreeBranch === null) {
            // We're viewing main but branch hasn't been initialized yet
            // Show features assigned to primary worktree's branch
            return currentProject.path
              ? isPrimaryWorktreeBranch(currentProject.path, featureBranch)
              : false;
          }

          // Match by branch name
          return featureBranch === currentWorktreeBranch;
        });

        if (backlogFeatures.length === 0) {
          return;
        }

        // Sort by priority (lower number = higher priority, priority 1 is highest)
        const sortedBacklog = [...backlogFeatures].sort(
          (a, b) => (a.priority || 999) - (b.priority || 999)
        );

        // Filter out features with blocking dependencies if dependency blocking is enabled
        const eligibleFeatures = enableDependencyBlocking
          ? sortedBacklog.filter((f) => {
              const blockingDeps = getBlockingDependencies(f, currentFeatures);
              return blockingDeps.length === 0;
            })
          : sortedBacklog;

        // Start features up to available slots
        const featuresToStart = eligibleFeatures.slice(0, availableSlots);

        for (const feature of featuresToStart) {
          // Check again before starting each feature
          if (!isActive || !autoModeRunningRef.current || !currentProject) {
            return;
          }

          // Simplified: No worktree creation on client - server derives workDir from feature.branchName
          // If feature has no branchName and primary worktree is selected, assign primary branch
          if (currentWorktreePath === null && !feature.branchName) {
            const primaryBranch =
              (currentProject.path
                ? getPrimaryWorktreeBranch(currentProject.path)
                : null) || "main";
            await persistFeatureUpdate(feature.id, {
              branchName: primaryBranch,
            });
          }

          // Final check before starting implementation
          if (!isActive || !autoModeRunningRef.current || !currentProject) {
            return;
          }

          // Start the implementation - server will derive workDir from feature.branchName
          const started = await handleStartImplementation(feature);

          // If successfully started, track it as pending until we receive the start event
          if (started) {
            pendingFeaturesRef.current.add(feature.id);
          }
        }
      } finally {
        isChecking = false;
      }
    };

    // Check immediately, then every 3 seconds
    checkAndStartFeatures();
    const interval = setInterval(checkAndStartFeatures, 3000);

    return () => {
      // Mark as inactive to prevent any pending async operations from continuing
      isActive = false;
      clearInterval(interval);
      // Clear pending features when effect unmounts or dependencies change
      pendingFeaturesRef.current.clear();
    };
  }, [
    autoMode.isRunning,
    currentProject,
    runningAutoTasks,
    maxConcurrency,
    // hookFeatures is accessed via hookFeaturesRef to prevent effect re-runs
    currentWorktreeBranch,
    currentWorktreePath,
    getPrimaryWorktreeBranch,
    isPrimaryWorktreeBranch,
    enableDependencyBlocking,
    persistFeatureUpdate,
    handleStartImplementation,
  ]);

  // Use keyboard shortcuts hook (after actions hook)
  useBoardKeyboardShortcuts({
    features: hookFeatures,
    runningAutoTasks,
    onAddFeature: () => setShowAddDialog(true),
    onStartNextFeatures: handleStartNextFeatures,
    onViewOutput: handleViewOutput,
  });

  // Use drag and drop hook
  const { activeFeature, handleDragStart, handleDragEnd } = useBoardDragDrop({
    features: hookFeatures,
    currentProject,
    runningAutoTasks,
    persistFeatureUpdate,
    handleStartImplementation,
  });

  // Use column features hook
  const { getColumnFeatures, completedFeatures } = useBoardColumnFeatures({
    features: hookFeatures,
    runningAutoTasks,
    searchQuery,
    currentWorktreePath,
    currentWorktreeBranch,
    projectPath: currentProject?.path || null,
  });

  // Use background hook
  const { backgroundSettings, backgroundImageStyle } = useBoardBackground({
    currentProject,
  });

  // Find feature for pending plan approval
  const pendingApprovalFeature = useMemo(() => {
    if (!pendingPlanApproval) return null;
    return hookFeatures.find((f) => f.id === pendingPlanApproval.featureId) || null;
  }, [pendingPlanApproval, hookFeatures]);

  // Handle plan approval
  const handlePlanApprove = useCallback(
    async (editedPlan?: string) => {
      if (!pendingPlanApproval || !currentProject) return;

      const featureId = pendingPlanApproval.featureId;
      setIsPlanApprovalLoading(true);
      try {
        const api = getElectronAPI();
        if (!api?.autoMode?.approvePlan) {
          throw new Error("Plan approval API not available");
        }

        const result = await api.autoMode.approvePlan(
          pendingPlanApproval.projectPath,
          pendingPlanApproval.featureId,
          true,
          editedPlan
        );

        if (result.success) {
          // Immediately update local feature state to hide "Approve Plan" button
          // Get current feature to preserve version
          const currentFeature = hookFeatures.find(f => f.id === featureId);
          updateFeature(featureId, {
            planSpec: {
              status: 'approved',
              content: editedPlan || pendingPlanApproval.planContent,
              version: currentFeature?.planSpec?.version || 1,
              approvedAt: new Date().toISOString(),
              reviewedByUser: true,
            },
          });
          // Reload features from server to ensure sync
          loadFeatures();
        } else {
          console.error("[Board] Failed to approve plan:", result.error);
        }
      } catch (error) {
        console.error("[Board] Error approving plan:", error);
      } finally {
        setIsPlanApprovalLoading(false);
        setPendingPlanApproval(null);
      }
    },
    [pendingPlanApproval, currentProject, setPendingPlanApproval, updateFeature, loadFeatures, hookFeatures]
  );

  // Handle plan rejection
  const handlePlanReject = useCallback(
    async (feedback?: string) => {
      if (!pendingPlanApproval || !currentProject) return;

      const featureId = pendingPlanApproval.featureId;
      setIsPlanApprovalLoading(true);
      try {
        const api = getElectronAPI();
        if (!api?.autoMode?.approvePlan) {
          throw new Error("Plan approval API not available");
        }

        const result = await api.autoMode.approvePlan(
          pendingPlanApproval.projectPath,
          pendingPlanApproval.featureId,
          false,
          undefined,
          feedback
        );

        if (result.success) {
          // Immediately update local feature state
          // Get current feature to preserve version
          const currentFeature = hookFeatures.find(f => f.id === featureId);
          updateFeature(featureId, {
            status: 'backlog',
            planSpec: {
              status: 'rejected',
              content: pendingPlanApproval.planContent,
              version: currentFeature?.planSpec?.version || 1,
              reviewedByUser: true,
            },
          });
          // Reload features from server to ensure sync
          loadFeatures();
        } else {
          console.error("[Board] Failed to reject plan:", result.error);
        }
      } catch (error) {
        console.error("[Board] Error rejecting plan:", error);
      } finally {
        setIsPlanApprovalLoading(false);
        setPendingPlanApproval(null);
      }
    },
    [pendingPlanApproval, currentProject, setPendingPlanApproval, updateFeature, loadFeatures, hookFeatures]
  );

  // Handle opening approval dialog from feature card button
  const handleOpenApprovalDialog = useCallback(
    (feature: Feature) => {
      if (!feature.planSpec?.content || !currentProject) return;

      // Determine the planning mode for approval (skip should never have a plan requiring approval)
      const mode = feature.planningMode;
      const approvalMode: "lite" | "spec" | "full" =
        mode === 'lite' || mode === 'spec' || mode === 'full' ? mode : 'spec';

      // Re-open the approval dialog with the feature's plan data
      setPendingPlanApproval({
        featureId: feature.id,
        projectPath: currentProject.path,
        planContent: feature.planSpec.content,
        planningMode: approvalMode,
      });
    },
    [currentProject, setPendingPlanApproval]
  );

  if (!currentProject) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="board-view-no-project"
      >
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="board-view-loading"
      >
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden content-bg relative"
      data-testid="board-view"
    >
      {/* Header */}
      <BoardHeader
        projectName={currentProject.name}
        maxConcurrency={maxConcurrency}
        onConcurrencyChange={setMaxConcurrency}
        isAutoModeRunning={autoMode.isRunning}
        onAutoModeToggle={(enabled) => {
          if (enabled) {
            autoMode.start();
          } else {
            autoMode.stop();
          }
        }}
        onAddFeature={() => setShowAddDialog(true)}
        addFeatureShortcut={{
          key: shortcuts.addFeature,
          action: () => setShowAddDialog(true),
          description: "Add new feature",
        }}
        isMounted={isMounted}
      />

      {/* Worktree Panel */}
      <WorktreePanel
        refreshTrigger={worktreeRefreshKey}
        projectPath={currentProject.path}
        onCreateWorktree={() => setShowCreateWorktreeDialog(true)}
        onDeleteWorktree={(worktree) => {
          setSelectedWorktreeForAction(worktree);
          setShowDeleteWorktreeDialog(true);
        }}
        onCommit={(worktree) => {
          setSelectedWorktreeForAction(worktree);
          setShowCommitWorktreeDialog(true);
        }}
        onCreatePR={(worktree) => {
          setSelectedWorktreeForAction(worktree);
          setShowCreatePRDialog(true);
        }}
        onCreateBranch={(worktree) => {
          setSelectedWorktreeForAction(worktree);
          setShowCreateBranchDialog(true);
        }}
        onRemovedWorktrees={handleRemovedWorktrees}
        runningFeatureIds={runningAutoTasks}
        features={hookFeatures.map((f) => ({
          id: f.id,
          branchName: f.branchName,
        }))}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search Bar Row */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <BoardSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isCreatingSpec={isCreatingSpec}
            creatingSpecProjectPath={creatingSpecProjectPath ?? undefined}
            currentProjectPath={currentProject?.path}
          />

          {/* Board Background & Detail Level Controls */}
          <BoardControls
            isMounted={isMounted}
            onShowBoardBackground={() => setShowBoardBackgroundModal(true)}
            onShowCompletedModal={() => setShowCompletedModal(true)}
            completedCount={completedFeatures.length}
            kanbanCardDetailLevel={kanbanCardDetailLevel}
            onDetailLevelChange={setKanbanCardDetailLevel}
          />
        </div>
        {/* Kanban Columns */}
        <KanbanBoard
          sensors={sensors}
          collisionDetectionStrategy={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          activeFeature={activeFeature}
          getColumnFeatures={getColumnFeatures}
          backgroundImageStyle={backgroundImageStyle}
          backgroundSettings={backgroundSettings}
          onEdit={(feature) => setEditingFeature(feature)}
          onDelete={(featureId) => handleDeleteFeature(featureId)}
          onViewOutput={handleViewOutput}
          onVerify={handleVerifyFeature}
          onResume={handleResumeFeature}
          onForceStop={handleForceStopFeature}
          onManualVerify={handleManualVerify}
          onMoveBackToInProgress={handleMoveBackToInProgress}
          onFollowUp={handleOpenFollowUp}
          onCommit={handleCommitFeature}
          onComplete={handleCompleteFeature}
          onImplement={handleStartImplementation}
          onViewPlan={(feature) => setViewPlanFeature(feature)}
          onApprovePlan={handleOpenApprovalDialog}
          featuresWithContext={featuresWithContext}
          runningAutoTasks={runningAutoTasks}
          shortcuts={shortcuts}
          onStartNextFeatures={handleStartNextFeatures}
          onShowSuggestions={() => setShowSuggestionsDialog(true)}
          suggestionsCount={suggestionsCount}
          onArchiveAllVerified={() => setShowArchiveAllVerifiedDialog(true)}
        />
      </div>

      {/* Board Background Modal */}
      <BoardBackgroundModal
        open={showBoardBackgroundModal}
        onOpenChange={setShowBoardBackgroundModal}
      />

      {/* Completed Features Modal */}
      <CompletedFeaturesModal
        open={showCompletedModal}
        onOpenChange={setShowCompletedModal}
        completedFeatures={completedFeatures}
        onUnarchive={handleUnarchiveFeature}
        onDelete={(feature) => setDeleteCompletedFeature(feature)}
      />

      {/* Delete Completed Feature Confirmation Dialog */}
      <DeleteCompletedFeatureDialog
        feature={deleteCompletedFeature}
        onClose={() => setDeleteCompletedFeature(null)}
        onConfirm={async () => {
          if (deleteCompletedFeature) {
            await handleDeleteFeature(deleteCompletedFeature.id);
            setDeleteCompletedFeature(null);
          }
        }}
      />

      {/* Add Feature Dialog */}
      <AddFeatureDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddFeature}
        categorySuggestions={categorySuggestions}
        branchSuggestions={branchSuggestions}
        defaultSkipTests={defaultSkipTests}
        defaultBranch={selectedWorktreeBranch}
        currentBranch={currentWorktreeBranch || undefined}
        isMaximized={isMaximized}
        showProfilesOnly={showProfilesOnly}
        aiProfiles={aiProfiles}
      />

      {/* Edit Feature Dialog */}
      <EditFeatureDialog
        feature={editingFeature}
        onClose={() => setEditingFeature(null)}
        onUpdate={handleUpdateFeature}
        categorySuggestions={categorySuggestions}
        branchSuggestions={branchSuggestions}
        currentBranch={currentWorktreeBranch || undefined}
        isMaximized={isMaximized}
        showProfilesOnly={showProfilesOnly}
        aiProfiles={aiProfiles}
        allFeatures={hookFeatures}
      />

      {/* Agent Output Modal */}
      <AgentOutputModal
        open={showOutputModal}
        onClose={() => setShowOutputModal(false)}
        featureDescription={outputFeature?.description || ""}
        featureId={outputFeature?.id || ""}
        featureStatus={outputFeature?.status}
        onNumberKeyPress={handleOutputModalNumberKeyPress}
      />

      {/* Archive All Verified Dialog */}
      <ArchiveAllVerifiedDialog
        open={showArchiveAllVerifiedDialog}
        onOpenChange={setShowArchiveAllVerifiedDialog}
        verifiedCount={getColumnFeatures("verified").length}
        onConfirm={async () => {
          await handleArchiveAllVerified();
          setShowArchiveAllVerifiedDialog(false);
        }}
      />

      {/* Follow-Up Prompt Dialog */}
      <FollowUpDialog
        open={showFollowUpDialog}
        onOpenChange={handleFollowUpDialogChange}
        feature={followUpFeature}
        prompt={followUpPrompt}
        imagePaths={followUpImagePaths}
        previewMap={followUpPreviewMap}
        onPromptChange={setFollowUpPrompt}
        onImagePathsChange={setFollowUpImagePaths}
        onPreviewMapChange={setFollowUpPreviewMap}
        onSend={handleSendFollowUp}
        isMaximized={isMaximized}
      />

      {/* Feature Suggestions Dialog */}
      <FeatureSuggestionsDialog
        open={showSuggestionsDialog}
        onClose={closeSuggestionsDialog}
        projectPath={currentProject.path}
        suggestions={featureSuggestions}
        setSuggestions={updateSuggestions}
        isGenerating={isGeneratingSuggestions}
        setIsGenerating={setIsGeneratingSuggestions}
      />

      {/* Plan Approval Dialog */}
      <PlanApprovalDialog
        open={pendingPlanApproval !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPlanApproval(null);
          }
        }}
        feature={pendingApprovalFeature}
        planContent={pendingPlanApproval?.planContent || ""}
        onApprove={handlePlanApprove}
        onReject={handlePlanReject}
        isLoading={isPlanApprovalLoading}
      />

      {/* View Plan Dialog (read-only) */}
      {viewPlanFeature && viewPlanFeature.planSpec?.content && (
        <PlanApprovalDialog
          open={true}
          onOpenChange={(open) => !open && setViewPlanFeature(null)}
          feature={viewPlanFeature}
          planContent={viewPlanFeature.planSpec.content}
          onApprove={() => setViewPlanFeature(null)}
          onReject={() => setViewPlanFeature(null)}
          viewOnly={true}
        />
      )}

      {/* Create Worktree Dialog */}
      <CreateWorktreeDialog
        open={showCreateWorktreeDialog}
        onOpenChange={setShowCreateWorktreeDialog}
        projectPath={currentProject.path}
        onCreated={(newWorktree) => {
          // Add the new worktree to the store immediately to avoid race condition
          // when deriving currentWorktreeBranch for filtering
          const currentWorktrees = getWorktrees(currentProject.path);
          const newWorktreeInfo = {
            path: newWorktree.path,
            branch: newWorktree.branch,
            isMain: false,
            isCurrent: false,
            hasWorktree: true,
          };
          setWorktrees(currentProject.path, [
            ...currentWorktrees,
            newWorktreeInfo,
          ]);

          // Now set the current worktree with both path and branch
          setCurrentWorktree(
            currentProject.path,
            newWorktree.path,
            newWorktree.branch
          );

          // Trigger refresh to get full worktree details (hasChanges, etc.)
          setWorktreeRefreshKey((k) => k + 1);
        }}
      />

      {/* Delete Worktree Dialog */}
      <DeleteWorktreeDialog
        open={showDeleteWorktreeDialog}
        onOpenChange={setShowDeleteWorktreeDialog}
        projectPath={currentProject.path}
        worktree={selectedWorktreeForAction}
        onDeleted={(deletedWorktree, _deletedBranch) => {
          // Reset features that were assigned to the deleted worktree (by branch)
          hookFeatures.forEach((feature) => {
            // Match by branch name since worktreePath is no longer stored
            if (feature.branchName === deletedWorktree.branch) {
              // Reset the feature's branch assignment
              persistFeatureUpdate(feature.id, {
                branchName: null as unknown as string | undefined,
              });
            }
          });

          setWorktreeRefreshKey((k) => k + 1);
          setSelectedWorktreeForAction(null);
        }}
      />

      {/* Commit Worktree Dialog */}
      <CommitWorktreeDialog
        open={showCommitWorktreeDialog}
        onOpenChange={setShowCommitWorktreeDialog}
        worktree={selectedWorktreeForAction}
        onCommitted={() => {
          setWorktreeRefreshKey((k) => k + 1);
          setSelectedWorktreeForAction(null);
        }}
      />

      {/* Create PR Dialog */}
      <CreatePRDialog
        open={showCreatePRDialog}
        onOpenChange={setShowCreatePRDialog}
        worktree={selectedWorktreeForAction}
        onCreated={() => {
          setWorktreeRefreshKey((k) => k + 1);
          setSelectedWorktreeForAction(null);
        }}
      />

      {/* Create Branch Dialog */}
      <CreateBranchDialog
        open={showCreateBranchDialog}
        onOpenChange={setShowCreateBranchDialog}
        worktree={selectedWorktreeForAction}
        onCreated={() => {
          setWorktreeRefreshKey((k) => k + 1);
          setSelectedWorktreeForAction(null);
        }}
      />
    </div>
  );
}
