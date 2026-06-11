import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AnalyticsState = {
  pageViewCounts: Record<string, number>;
  onboardingStartedAt: number | null;

  actions: AnalyticsActions;
};

type AnalyticsActions = {
  incrementPageView: (pageKey: string) => number;
  startOnboardingTimer: () => void;
  clearOnboardingTimer: () => void;
  reset: () => void;
};

type PersistedAnalyticsState = Omit<AnalyticsState, "actions">;

const initialData = {
  pageViewCounts: {} as Record<string, number>,
  onboardingStartedAt: null as number | null,
};

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      ...initialData,

      actions: {
        incrementPageView: (pageKey) => {
          const current = get().pageViewCounts[pageKey] ?? 0;
          const next = current + 1;
          set((state) => ({
            pageViewCounts: { ...state.pageViewCounts, [pageKey]: next },
          }));
          return next;
        },

        startOnboardingTimer: () => {
          if (get().onboardingStartedAt != null) return;
          set({ onboardingStartedAt: Date.now() });
        },

        clearOnboardingTimer: () => set({ onboardingStartedAt: null }),

        reset: () => set({ ...initialData }),
      },
    }),
    {
      name: "@analytics_data",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedAnalyticsState => {
        const { actions: _actions, ...persistedState } = state;
        return persistedState;
      },
    },
  ),
);
