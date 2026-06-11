import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SubscriptionStatus = "free" | "active_trial" | "churned_trial" | "premium";

type SubscriptionState = {
  isPremium: boolean;
  subscriptionStatus: SubscriptionStatus;
  everHadTrial: boolean;

  actions: SubscriptionActions;
};

type SubscriptionActions = {
  setIsPremium: (isPremium: boolean) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  markEverHadTrial: () => void;
  reset: () => void;
};

type PersistedSubscriptionState = Omit<SubscriptionState, "actions">;

const initialData = {
  isPremium: false,
  subscriptionStatus: "free" as SubscriptionStatus,
  everHadTrial: false,
};

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      ...initialData,

      actions: {
        setIsPremium: (isPremium) => set({ isPremium }),
        setSubscriptionStatus: (subscriptionStatus) => set({ subscriptionStatus }),
        markEverHadTrial: () => set({ everHadTrial: true }),
        reset: () => set({ ...initialData }),
      },
    }),
    {
      name: "@subscription_data",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedSubscriptionState => {
        const { actions: _actions, ...persistedState } = state;
        return persistedState;
      },
    },
  ),
);

export const useSubscriptionActions = () => useSubscriptionStore((state) => state.actions);
export const useIsPremium = () => useSubscriptionStore((state) => state.isPremium);
export const useSubscriptionStatus = () =>
  useSubscriptionStore((state) => state.subscriptionStatus);
export const useEverHadTrial = () => useSubscriptionStore((state) => state.everHadTrial);
