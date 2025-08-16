/*
 * Owner: Fahed Mlaiel
 * Contact: mlaiel@live.de
 * Notice: Attribution to Fahed Mlaiel is mandatory in all copies, forks, and derivatives.
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * Fallback implementation of useKV hook using localStorage
 * This provides persistent storage for user settings and data
 */
export function useKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const valueToStore = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(valueToStore))
        } catch (error) {
          console.warn('Failed to save to localStorage:', error)
        }
      }
      return valueToStore
    })
  }, [key])

  const deleteValue = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.warn('Failed to remove from localStorage:', error)
      }
    }
    setValue(defaultValue)
  }, [key, defaultValue])

  return [value, setStoredValue, deleteValue]
}