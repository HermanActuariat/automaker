import { useMemo, useCallback } from "react";
import { Feature } from "@/store/app-store";
import { resolveDependencies } from "@/lib/dependency-resolver";

type ColumnId = Feature["status"];

interface UseBoardColumnFeaturesProps {
  features: Feature[];
  runningAutoTasks: string[];
  searchQuery: string;
}

export function useBoardColumnFeatures({
  features,
  runningAutoTasks,
  searchQuery,
}: UseBoardColumnFeaturesProps) {
  // Memoize column features to prevent unnecessary re-renders
  const columnFeaturesMap = useMemo(() => {
    const map: Record<ColumnId, Feature[]> = {
      backlog: [],
      in_progress: [],
      waiting_approval: [],
      verified: [],
      completed: [], // Completed features are shown in the archive modal, not as a column
    };

    // Filter features by search query (case-insensitive)
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filteredFeatures = normalizedQuery
      ? features.filter(
          (f) =>
            f.description.toLowerCase().includes(normalizedQuery) ||
            f.category?.toLowerCase().includes(normalizedQuery)
        )
      : features;

    filteredFeatures.forEach((f) => {
      // If feature has a running agent, always show it in "in_progress"
      const isRunning = runningAutoTasks.includes(f.id);
      if (isRunning) {
        map.in_progress.push(f);
      } else {
        // Otherwise, use the feature's status (fallback to backlog for unknown statuses)
        const status = f.status as ColumnId;
        if (map[status]) {
          map[status].push(f);
        } else {
          // Unknown status, default to backlog
          map.backlog.push(f);
        }
      }
    });

    // Apply dependency-aware sorting to backlog
    // This ensures features appear in dependency order (dependencies before dependents)
    // Within the same dependency level, features are sorted by priority
    if (map.backlog.length > 0) {
      const { orderedFeatures } = resolveDependencies(map.backlog);
      map.backlog = orderedFeatures;
    }

    return map;
  }, [features, runningAutoTasks, searchQuery]);

  const getColumnFeatures = useCallback(
    (columnId: ColumnId) => {
      return columnFeaturesMap[columnId];
    },
    [columnFeaturesMap]
  );

  // Memoize completed features for the archive modal
  const completedFeatures = useMemo(() => {
    return features.filter((f) => f.status === "completed");
  }, [features]);

  return {
    columnFeaturesMap,
    getColumnFeatures,
    completedFeatures,
  };
}
