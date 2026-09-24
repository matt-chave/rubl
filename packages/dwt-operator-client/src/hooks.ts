import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBffClient } from './bff'
import { ensureReservedIds, flushQueue, submitOrQueue } from './queue'
import { createBrowserStore } from './store'
import type { CreateMovementBody, QueueStore } from './types'

const bff = createBffClient()
const defaultStore = createBrowserStore()

export function useReservedIds(store: QueueStore = defaultStore) {
  return useQuery({
    queryKey: ['reserved-ids'],
    queryFn: () => store.getReservedIds(),
  })
}

export function useEnsureReservedIds(store: QueueStore = defaultStore) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      ensureReservedIds(store, (movementCount) => bff.reserveIds(movementCount), {
        min: 1,
        batch: 5,
        isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reserved-ids'] })
    },
  })
}

export function useSubmitMovement(store: QueueStore = defaultStore) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateMovementBody) =>
      submitOrQueue(store, body, {
        isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
        postMovement: (payload) => bff.createMovement(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reserved-ids'] })
      void queryClient.invalidateQueries({ queryKey: ['offline-queue'] })
    },
  })
}

export function useOfflineQueue(store: QueueStore = defaultStore) {
  return useQuery({
    queryKey: ['offline-queue'],
    queryFn: () => store.list(),
  })
}

export function useFlushQueue(store: QueueStore = defaultStore) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      flushQueue(store, {
        isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
        postMovement: (payload) => bff.createMovement(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offline-queue'] })
    },
  })
}
