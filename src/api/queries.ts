import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  BarcodeProduct,
  ChatMessage,
  DashboardResponse,
  DaySummary,
  LedgerRange,
  Meal,
  MealType,
  MealSource,
  Profile,
  ScheduledNotificationItem,
  SubscriptionDetails,
  Targets,
  TrainerClientSummary,
  User,
  Workout,
} from './hisaabApi';

// ─── Query Keys ──────────────────────────────────────────────
export const queryKeys = {
  dashboard: (date?: string) => ['dashboard', date ?? 'today'] as const,
  ledger: (from?: string, to?: string) => ['ledger', from, to] as const,
  meal: (id: string) => ['meal', id] as const,
  chatHistory: (limit?: number) => ['chat', 'history', limit ?? 50] as const,
  subscription: ['subscription'] as const,
  trainerInviteCode: ['trainer', 'inviteCode'] as const,
  trainerClients: ['trainer', 'clients'] as const,
  trainerClientDashboard: (clientId: string, date?: string) => ['trainer', 'client', clientId, date ?? 'today'] as const,
  workouts: (date?: string) => ['workouts', date ?? 'today'] as const,
};

// ─── Server / AI status ──────────────────────────────────────
export function useServerHealth() {
  return useQuery({ queryKey: ['health'], queryFn: () => api.health(), staleTime: 60_000 });
}

// ─── Dashboard ───────────────────────────────────────────────
export function useDashboard(date?: string) {
  return useQuery<DashboardResponse>({
    queryKey: queryKeys.dashboard(date),
    queryFn: () => api.dashboard.get(date),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasAnalyzing = data?.meals?.some((m) => m.status === 'analyzing');
      return hasAnalyzing ? 2000 : false;
    },
  });
}

// ─── Ledger ──────────────────────────────────────────────────
export function useLedger(from?: string, to?: string) {
  return useQuery<LedgerRange>({
    queryKey: queryKeys.ledger(from, to),
    queryFn: () => api.ledger.get(from, to),
  });
}

// ─── Meal Detail ─────────────────────────────────────────────
export function useMeal(id: string) {
  return useQuery<{ meal: Meal }>({
    queryKey: queryKeys.meal(id),
    queryFn: () => api.meals.get(id),
    enabled: Boolean(id),
  });
}

// ─── Workouts ────────────────────────────────────────────────
export function useWorkouts(date?: string) {
  return useQuery<{ workouts: Workout[] }>({
    queryKey: queryKeys.workouts(date),
    queryFn: () => api.workouts.list(date),
  });
}

// ─── Chat ────────────────────────────────────────────────────
export function useChatHistory(limit = 50) {
  return useQuery({
    queryKey: queryKeys.chatHistory(limit),
    queryFn: () => api.chat.history(limit),
  });
}

// ─── Subscription ────────────────────────────────────────────
export function useSubscription() {
  return useQuery<SubscriptionDetails>({
    queryKey: queryKeys.subscription,
    queryFn: () => api.subscription.get(),
  });
}

// ─── Trainer ─────────────────────────────────────────────────
export function useTrainerInviteCode() {
  return useQuery({
    queryKey: queryKeys.trainerInviteCode,
    queryFn: () => api.trainer.inviteCode(),
  });
}

export function useTrainerClients() {
  return useQuery<{ clients: TrainerClientSummary[] }>({
    queryKey: queryKeys.trainerClients,
    queryFn: () => api.trainer.clients(),
  });
}

export function useTrainerClientDashboard(clientId: string, date?: string) {
  return useQuery({
    queryKey: queryKeys.trainerClientDashboard(clientId, date),
    queryFn: () => api.trainer.clientDashboard(clientId, date),
    enabled: Boolean(clientId),
  });
}

// ─── Mutations ───────────────────────────────────────────────

export function useAnalyzeMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      input: {
        image?: { uri: string; name?: string; type?: string };
        imageBase64?: string;
        mimeType?: string;
        description?: string;
        mealType?: MealType;
        date?: string;
      };
      wait?: boolean;
    }) => api.meals.analyze(args.input, { wait: args.wait }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useCreateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      dishName: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG?: number;
      healthScore?: number;
      mealType?: MealType;
      date?: string;
      source?: MealSource;
      servings?: number;
    }) => api.meals.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function usePatchMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        dishName: string;
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        fiberG: number;
        mealType: MealType;
        servings: number;
      }>;
    }) => api.meals.patch(id, patch),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.meal(variables.id) });
    },
  });
}

/** Edit mode: save the item list; the server recomputes totals. */
export function useEditMealItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; items: { ref?: number; name: string; grams?: number }[]; dishName?: string; mealType?: MealType }) =>
      api.meals.editItems(id, body),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.meal(variables.id), data);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

/** P1: answer "How many …?" — instant server recount. */
export function useClarifyMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pieces, ingredientIndex }: { id: string; pieces: number; ingredientIndex?: number }) =>
      api.meals.clarify(id, { pieces, ingredientIndex }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.meal(variables.id), data);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

/** P1: "Wrong?" — AI redoes the meal from the photo + the user's details. */
export function useCorrectMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; quantity?: string; notes?: string }) =>
      api.meals.correct(id, body),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.meal(variables.id), data);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useRetryMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, wait }: { id: string; wait?: boolean }) => api.meals.retry(id, { wait }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.meals.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useLogWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ml, date }: { ml: number; date?: string }) => api.water.log(ml, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteLastWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) => api.water.deleteLast(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useLogWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: string; durationMin: number; caloriesBurned?: number; date?: string; notes?: string }) =>
      api.workouts.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workouts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
  });
}

/**
 * The user's message shows up the moment they send it (the coach can take a few seconds),
 * and the reply is added as soon as it arrives. On failure the message is taken back out.
 */
export function useSendChatMessage() {
  const queryClient = useQueryClient();
  const key = queryKeys.chatHistory();
  type History = { messages: ChatMessage[] };
  return useMutation({
    mutationFn: (message: string) => api.chat.send(message),
    onMutate: async (message: string) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<History>(key);
      const mine: ChatMessage = { id: `local-${Date.now()}`, role: 'user', text: message, createdAt: new Date().toISOString() };
      queryClient.setQueryData<History>(key, { messages: [...(before?.messages ?? []), mine] });
      return { before };
    },
    onError: (_err, _message, ctx) => {
      if (ctx) queryClient.setQueryData<History>(key, ctx.before);
    },
    onSuccess: ({ reply }) => {
      queryClient.setQueryData<History>(key, (h) => ({ messages: [...(h?.messages ?? []), reply] }));
      queryClient.invalidateQueries({ queryKey: ['chat'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useClearChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.chat.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat'] });
    },
  });
}

export function useMockUpgrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId?: 'pro_monthly' | 'pro_yearly') => api.subscription.mockUpgrade(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.subscription.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useLinkTrainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.trainer.link(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer', 'clients'] });
    },
  });
}

export function useRevokeTrainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.trainer.revoke(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer', 'inviteCode'] });
      queryClient.invalidateQueries({ queryKey: ['trainer', 'clients'] });
    },
  });
}

export function useUnlinkClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => api.trainer.unlink(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer', 'clients'] });
    },
  });
}

export function useSyncHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      source: 'apple_health' | 'health_connect';
      workouts: {
        externalId: string;
        type: string;
        durationMin: number;
        caloriesBurned: number;
        startedAt: string;
      }[];
    }) => api.healthSync.sync(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

