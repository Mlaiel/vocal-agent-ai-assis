/*
 * Owner: Fahed Mlaiel
 * Contact: mlaiel@live.de
 * Notice: Attribution to Fahed Mlaiel is mandatory in all copies, forks, and derivatives.
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Microphone, Speaker, AlertTriangle, Play, Pause, Square, Volume2 } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'

interface VoiceSettings {
  rate: number
  pitch: number
  voice: string
  autoRead: boolean
}

export default function App() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [textToRead, setTextToRead] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  
  const [settings, setSettings] = useKV<VoiceSettings>('voice-settings', {
    rate: 1,
    pitch: 1,
    voice: '',
    autoRead: true
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    // Check Web Speech API support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsRecognitionSupported(true)
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'

        recognitionRef.current.onresult = (event) => {
          let finalTranscript = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript
            }
          }
          if (finalTranscript) {
            setTranscript(prev => prev + finalTranscript + ' ')
            announceToUser(`Captured: ${finalTranscript}`)
          }
        }

        recognitionRef.current.onerror = (event) => {
          setError(`Speech recognition error: ${event.error}`)
          setIsListening(false)
          announceToUser(`Error: ${event.error}`)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
          announceToUser('Stopped listening')
        }
      }
    }

    if ('speechSynthesis' in window) {
      setIsSpeechSupported(true)
      synthRef.current = window.speechSynthesis
    }

    // Announce app ready
    setTimeout(() => {
      announceToUser('Vocal Agent ready. Use the microphone button to start voice input, or enter text to have it read aloud.')
    }, 1000)
  }, [])

  const announceToUser = (message: string) => {
    if (synthRef.current && isSpeechSupported) {
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.rate = 1.2
      utterance.pitch = 1
      synthRef.current.speak(utterance)
    }
  }

  const startListening = () => {
    if (recognitionRef.current && isRecognitionSupported) {
      setError('')
      setIsListening(true)
      recognitionRef.current.start()
      announceToUser('Listening...')
      toast.success('Listening started')
    } else {
      setError('Speech recognition not supported in this browser')
      announceToUser('Speech recognition not supported')
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const speakText = (text: string) => {
    if (!synthRef.current || !isSpeechSupported) {
      setError('Speech synthesis not supported')
      return
    }

    if (isSpeaking) {
      synthRef.current.cancel()
      setIsSpeaking(false)
      setProgress(0)
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = settings.rate
    utterance.pitch = settings.pitch
    
    if (settings.voice) {
      const voices = synthRef.current.getVoices()
      const selectedVoice = voices.find(voice => voice.name === settings.voice)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true)
      setProgress(0)
      toast.success('Reading started')
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      setProgress(0)
      currentUtteranceRef.current = null
      toast.success('Reading completed')
    }

    utterance.onerror = (event) => {
      setError(`Speech synthesis error: ${event.error}`)
      setIsSpeaking(false)
      setProgress(0)
    }

    // Simulate progress
    utterance.onboundary = () => {
      setProgress(prev => Math.min(prev + 10, 90))
    }

    currentUtteranceRef.current = utterance
    synthRef.current.speak(utterance)
  }

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
      setProgress(0)
      announceToUser('Stopped reading')
    }
  }

  const clearTranscript = () => {
    setTranscript('')
    announceToUser('Transcript cleared')
  }

  const summarizeContent = async () => {
    if (!textToRead.trim()) {
      announceToUser('No content to summarize')
      return
    }

    try {
      const prompt = spark.llmPrompt`Please provide a clear, concise summary of this content suitable for audio narration: ${textToRead}`
      const summary = await spark.llm(prompt)
      
      if (summary) {
        speakText(`Summary: ${summary}`)
        toast.success('Summary generated and reading')
      }
    } catch (error) {
      const errorMsg = 'Failed to generate summary'
      setError(errorMsg)
      announceToUser(errorMsg)
    }
  }

  const sendSafetyAlert = () => {
    const alertMessage = 'Safety Alert: Please be aware of your surroundings'
    announceToUser(alertMessage)
    toast.error(alertMessage)
  }

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Vocal-Agent
        </h1>
        <p className="text-muted-foreground text-lg">
          AI Voice Assistant for Accessibility
        </p>
        <p className="text-sm text-muted-foreground">
          Owner: Fahed Mlaiel | mlaiel@live.de
        </p>
      </header>

      {error && (
        <Alert className="border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Speech to Text */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Microphone className="h-5 w-5" />
              Speech to Text
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="lg"
                onClick={isListening ? stopListening : startListening}
                disabled={!isRecognitionSupported}
                className="flex-1"
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
              >
                <Microphone className="h-5 w-5 mr-2" />
                {isListening ? 'Stop Listening' : 'Start Listening'}
              </Button>
              <Button
                variant="outline"
                onClick={clearTranscript}
                disabled={!transcript}
                aria-label="Clear transcript"
              >
                Clear
              </Button>
            </div>
            
            {transcript && (
              <div className="space-y-2">
                <Label htmlFor="transcript">Transcript:</Label>
                <Textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your speech will appear here..."
                  className="min-h-24"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Text to Speech */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Speaker className="h-5 w-5" />
              Text to Speech
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-input">Enter text to read aloud:</Label>
              <Textarea
                id="text-input"
                value={textToRead}
                onChange={(e) => setTextToRead(e.target.value)}
                placeholder="Enter text here..."
                className="min-h-24"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                size="lg"
                onClick={() => speakText(textToRead)}
                disabled={!isSpeechSupported || !textToRead.trim()}
                className="flex-1"
                aria-label={isSpeaking ? 'Stop reading' : 'Read text aloud'}
              >
                {isSpeaking ? (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Stop Reading
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Read Aloud
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={summarizeContent}
                disabled={!textToRead.trim()}
                aria-label="Summarize and read"
              >
                Summarize
              </Button>
            </div>

            {isSpeaking && (
              <div className="space-y-2">
                <Label>Reading Progress:</Label>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => speakText(transcript)}
              disabled={!transcript.trim() || !isSpeechSupported}
              aria-label="Read transcript aloud"
            >
              <Speaker className="h-4 w-4 mr-2" />
              Read Transcript
            </Button>
            
            <Button
              variant="destructive"
              onClick={sendSafetyAlert}
              aria-label="Send safety alert"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Safety Alert
            </Button>

            <div className="flex items-center space-x-2">
              <Switch
                id="auto-read"
                checked={settings.autoRead}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, autoRead: checked }))
                }
              />
              <Label htmlFor="auto-read">Auto-read new content</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>
          Speech Recognition: {isRecognitionSupported ? '✓ Supported' : '✗ Not supported'}
          {' | '}
          Speech Synthesis: {isSpeechSupported ? '✓ Supported' : '✗ Not supported'}
        </p>
        <p className="text-xs">
          Attribution to Fahed Mlaiel is mandatory in all copies, forks, and derivatives.
        </p>
      </div>
    </div>
  )
}