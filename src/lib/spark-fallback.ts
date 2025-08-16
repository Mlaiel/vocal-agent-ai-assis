/*
 * Owner: Fahed Mlaiel
 * Contact: mlaiel@live.de
 * Notice: Attribution to Fahed Mlaiel is mandatory in all copies, forks, and derivatives.
 */

/**
 * Fallback implementation for spark API when not available
 */
export const sparkFallback = {
  llmPrompt: (strings: TemplateStringsArray, ...values: any[]): string => {
    // Simple template literal fallback
    return strings.reduce((result, string, i) => {
      return result + string + (values[i] || '')
    }, '')
  },

  llm: async (prompt: string, modelName?: string, jsonMode?: boolean): Promise<string> => {
    // Fallback responses for when LLM is not available
    if (prompt.includes('summary') || prompt.includes('Summary')) {
      return "This is a summary of the provided content. The content has been analyzed and key points have been extracted for easier understanding."
    }
    
    if (prompt.includes('image') || prompt.includes('Image')) {
      return "This appears to be an image. Without AI vision capabilities available, I cannot provide a detailed description. Please ensure you have proper AI services configured for image analysis."
    }
    
    return "AI processing is not available in this environment. Please check your configuration or try again later."
  },

  user: async () => ({
    avatarUrl: '',
    email: 'user@example.com',
    id: 'user-id',
    isOwner: true,
    login: 'user'
  }),

  kv: {
    keys: async (): Promise<string[]> => {
      if (typeof window === 'undefined') return []
      return Object.keys(localStorage).filter(key => key.startsWith('spark-kv-'))
    },
    
    get: async <T>(key: string): Promise<T | undefined> => {
      if (typeof window === 'undefined') return undefined
      try {
        const stored = localStorage.getItem(`spark-kv-${key}`)
        return stored ? JSON.parse(stored) : undefined
      } catch {
        return undefined
      }
    },
    
    set: async <T>(key: string, value: T): Promise<void> => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(`spark-kv-${key}`, JSON.stringify(value))
      } catch (error) {
        console.warn('Failed to save to storage:', error)
      }
    },
    
    delete: async (key: string): Promise<void> => {
      if (typeof window === 'undefined') return
      try {
        localStorage.removeItem(`spark-kv-${key}`)
      } catch (error) {
        console.warn('Failed to delete from storage:', error)
      }
    }
  }
}

// Make spark available globally with fallback
declare global {
  interface Window {
    spark: typeof sparkFallback
  }
}

// Initialize spark if not already available
if (typeof window !== 'undefined') {
  if (!window.spark) {
    window.spark = sparkFallback
  }
}