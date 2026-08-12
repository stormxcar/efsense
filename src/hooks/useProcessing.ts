import { useCallback } from 'react'
import { useUIStore } from '@/store'

export function useProcessing() {
  const startProcessing = useUIStore(state => state.startProcessing)
  const stopProcessing = useUIStore(state => state.stopProcessing)

  return useCallback(async <T,>(message: string, task: () => Promise<T>): Promise<T> => {
    startProcessing(message)
    try {
      return await task()
    } finally {
      stopProcessing()
    }
  }, [startProcessing, stopProcessing])
}
