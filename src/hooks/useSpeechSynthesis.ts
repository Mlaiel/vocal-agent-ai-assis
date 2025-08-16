/*
 * Owner: Fahed Mlaiel
 * Contact: mlaiel@live.de
 * Notice: Attribution to Fahed Mlaiel is mandatory in all copies, forks, and derivatives.
 */

import { useEffect, useRef, useCallback } from 'react'

interface UseSpeechSynthesisProps {
  rate?: number
  pitch?: number
  volume?: number
  voice?: SpeechSynthesisVoice | null
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void
  cancel: () => void
  pause: () => void
  resume: () => void
  speaking: boolean
  supported: boolean
  voices: SpeechSynthesisVoice[]
}

export function useSpeechSynthesis({
  rate = 1,
  pitch = 1,
  volume = 1,
  voice = null
}: UseSpeechSynthesisProps = {}): UseSpeechSynthesisReturn {
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis

      const updateVoices = () => {
        voicesRef.current = synthRef.current?.getVoices() || []
      }

      updateVoices()
      if (synthRef.current) {
        synthRef.current.addEventListener('voiceschanged', updateVoices)
      }

      return () => {
        if (synthRef.current) {
          synthRef.current.removeEventListener('voiceschanged', updateVoices)
        }
      }
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume

    if (voice) {
      utterance.voice = voice
    }

    utteranceRef.current = utterance
    synthRef.current.speak(utterance)
  }, [rate, pitch, volume, voice])

  const cancel = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel()
    }
  }, [])

  const pause = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.pause()
    }
  }, [])

  const resume = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.resume()
    }
  }, [])

  return {
    speak,
    cancel,
    pause,
    resume,
    speaking: synthRef.current?.speaking || false,
    supported: !!synthRef.current,
    voices: voicesRef.current
  }
}