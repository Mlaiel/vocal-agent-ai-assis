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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Microphone, SpeakerHigh, Warning, Play, Pause, Square, SpeakerX, Camera, Eye, Upload, Gear } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import '@/lib/spark-fallback'

// Extend window interface for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// Define SpeechRecognition type
type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

interface VoiceSettings {
  rate: number
  pitch: number
  voice: string
  autoRead: boolean
  voiceCommands: boolean
}

interface VoiceCommand {
  command: string
  action: () => void
  description: string
}

export default function App() {
  // All hooks declared at the top level - no conditional hooks
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [textToRead, setTextToRead] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isListeningForCommands, setIsListeningForCommands] = useState(false)
  const [currentTab, setCurrentTab] = useState('voice')
  
  const [settings, setSettings] = useKV<VoiceSettings>('voice-settings', {
    rate: 1,
    pitch: 1,
    voice: '',
    autoRead: true,
    voiceCommands: true
  })

  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const commandRecognitionRef = useRef<SpeechRecognitionType | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Check Web Speech API support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsRecognitionSupported(true)
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      
      // Setup regular speech recognition
      recognitionRef.current = new SpeechRecognition() as SpeechRecognitionType
      
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
            setTranscript(prev => prev + ' ' + finalTranscript)
            if (settings?.autoRead) {
              speakText(finalTranscript)
            }
          }
        }

        recognitionRef.current.onerror = (event) => {
          setError(`Speech recognition error: ${event.error}`)
          setIsListening(false)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }
      }

      // Setup command recognition
      commandRecognitionRef.current = new SpeechRecognition() as SpeechRecognitionType
      
      if (commandRecognitionRef.current) {
        commandRecognitionRef.current.continuous = true
        commandRecognitionRef.current.interimResults = false
        commandRecognitionRef.current.lang = 'en-US'

        commandRecognitionRef.current.onresult = (event) => {
          const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim()
          console.log('Voice command detected:', command)
          if (settings?.voiceCommands && isListeningForCommands) {
            handleVoiceCommand(command)
          }
        }

        commandRecognitionRef.current.onerror = (event) => {
          console.error('Command recognition error:', event.error)
          if (settings?.voiceCommands) {
            // Restart command listening on error
            setTimeout(() => startCommandListening(), 1000)
          }
        }

        commandRecognitionRef.current.onend = () => {
          if (settings?.voiceCommands && isListeningForCommands) {
            // Restart command listening if it should be active
            setTimeout(() => startCommandListening(), 500)
          }
        }
      }
    }

    // Check speech synthesis support
    if ('speechSynthesis' in window) {
      setIsSpeechSupported(true)
      synthRef.current = window.speechSynthesis

      // Load available voices
      const loadVoices = () => {
        const voices = synthRef.current?.getVoices() || []
        setAvailableVoices(voices)
        
        // Auto-select a default voice if none is set
        if (!settings?.voice && voices.length > 0) {
          const defaultVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0]
          setSettings(prev => ({ ...prev!, voice: defaultVoice.name }))
        }
      }

      loadVoices()
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = loadVoices
      }
    }

    return () => {
      // Cleanup
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (commandRecognitionRef.current) {
        commandRecognitionRef.current.stop()
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  const announceToUser = (message: string) => {
    if (isSpeechSupported && synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.volume = 0.8
      utterance.rate = 1.2
      synthRef.current.speak(utterance)
    }
  }

  const startListening = () => {
    if (recognitionRef.current && isRecognitionSupported) {
      setError('')
      setIsListening(true)
      recognitionRef.current.start()
      announceToUser('Listening started')
    } else {
      setError('Speech recognition not supported')
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
    utterance.rate = settings?.rate || 1
    utterance.pitch = settings?.pitch || 1
    
    if (settings?.voice) {
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
      // Ensure spark is available
      if (!window.spark) {
        throw new Error('Spark API not available')
      }
      
      const prompt = window.spark.llmPrompt`Please provide a clear, concise summary of this content suitable for audio narration: ${textToRead}`
      const summary = await window.spark.llm(prompt)
      
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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      announceToUser('Image selected for analysis')
    }
  }

  const analyzeImage = async () => {
    if (!selectedImage) {
      announceToUser('Please select an image first')
      return
    }

    setIsAnalyzing(true)
    announceToUser('Analyzing image...')

    try {
      // Convert image to base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string
        
        // Ensure spark is available
        if (!window.spark) {
          throw new Error('Spark API not available')
        }
        
        const prompt = window.spark.llmPrompt`You are an AI assistant helping visually impaired users. Please provide a detailed, clear description of this image. Focus on:
        1. What objects, people, or scenes are present
        2. Their positions and relationships
        3. Colors, lighting, and mood
        4. Any text visible in the image
        5. Any potential hazards or safety considerations
        
        Keep the description conversational and helpful for someone who cannot see the image. Image data: ${base64Data}`
        
        const description = await window.spark.llm(prompt)
        
        if (description) {
          const fullDescription = `Image description: ${description}`
          speakText(fullDescription)
          setTextToRead(fullDescription)
          toast.success('Image analyzed and described')
        }
      }
      reader.readAsDataURL(selectedImage)
    } catch (error) {
      const errorMsg = 'Failed to analyze image'
      setError(errorMsg)
      announceToUser(errorMsg)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera if available
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
        announceToUser('Camera started. Use the capture button to take a photo for analysis.')
      }
    } catch (error) {
      const errorMsg = 'Failed to access camera'
      setError(errorMsg)
      announceToUser(errorMsg)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setIsCameraActive(false)
      announceToUser('Camera stopped')
    }
  }

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      
      // Convert canvas to blob and analyze
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
          setSelectedImage(file)
          
          const reader = new FileReader()
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string)
          }
          reader.readAsDataURL(file)
          
          announceToUser('Photo captured. Analyzing...')
          
          // Auto-analyze captured image
          setTimeout(() => analyzeImage(), 500)
        }
      }, 'image/jpeg', 0.8)
    }
  }

  const testVoiceSettings = () => {
    const testText = "This is a test of your voice settings. Rate, pitch, and voice have been applied."
    speakText(testText)
    announceToUser('Testing voice settings')
  }

  const describeEnvironment = async () => {
    announceToUser('Starting environmental description...')
    
    if (isCameraActive && videoRef.current) {
      // If camera is active, capture and analyze current view
      captureImage()
    } else {
      // Start camera for environmental description
      await startCamera()
      setTimeout(() => {
        if (videoRef.current) {
          captureImage()
        }
      }, 2000) // Give camera time to initialize
    }
  }

  const showHelp = () => {
    const helpText = `Welcome to Vocal Agent. This is an AI voice assistant designed for accessibility. 
    You can navigate using voice commands, convert speech to text, read text aloud, analyze images, 
    and get environmental descriptions. Say "help commands" to hear all available voice commands.`
    speakText(helpText)
  }

  const showCapabilities = () => {
    const capabilitiesText = `I can help you with speech to text conversion, reading text aloud, analyzing images and describing your environment, providing safety alerts, and responding to voice commands. I'm designed to be accessible and help with daily tasks.`
    speakText(capabilitiesText)
  }

  const listVoiceCommands = () => {
    const commandsList = voiceCommands
      .map(cmd => `${cmd.command}: ${cmd.description}`)
      .join('. ')
    
    const introText = `Here are the available voice commands: ${commandsList}`
    speakText(introText)
  }

  const voiceCommands: VoiceCommand[] = [
    // Navigation commands
    { command: 'go to voice', action: () => { setCurrentTab('voice'); announceToUser('Switched to voice tab') }, description: 'Switch to voice tab' },
    { command: 'go to vision', action: () => { setCurrentTab('vision'); announceToUser('Switched to vision tab') }, description: 'Switch to vision tab' },
    { command: 'go to actions', action: () => { setCurrentTab('actions'); announceToUser('Switched to actions tab') }, description: 'Switch to actions tab' },
    { command: 'go to settings', action: () => { setCurrentTab('settings'); announceToUser('Switched to settings tab') }, description: 'Switch to settings tab' },
    
    // Voice control commands
    { command: 'start listening', action: startListening, description: 'Start speech to text' },
    { command: 'stop listening', action: stopListening, description: 'Stop speech to text' },
    { command: 'read text', action: () => speakText(textToRead), description: 'Read the entered text aloud' },
    { command: 'stop reading', action: stopSpeaking, description: 'Stop current speech' },
    { command: 'read transcript', action: () => speakText(transcript), description: 'Read the transcript aloud' },
    { command: 'clear transcript', action: clearTranscript, description: 'Clear the transcript' },
    { command: 'summarize', action: summarizeContent, description: 'Summarize and read content' },
    
    // Vision commands
    { command: 'start camera', action: startCamera, description: 'Start the camera' },
    { command: 'stop camera', action: stopCamera, description: 'Stop the camera' },
    { command: 'capture image', action: captureImage, description: 'Capture and analyze image' },
    { command: 'analyze image', action: analyzeImage, description: 'Analyze selected image' },
    { command: 'describe environment', action: describeEnvironment, description: 'Describe current environment' },
    
    // Safety and quick actions
    { command: 'safety alert', action: sendSafetyAlert, description: 'Send safety alert' },
    { command: 'test voice', action: testVoiceSettings, description: 'Test current voice settings' },
    
    // Settings commands
    { command: 'speech faster', action: () => { 
      const newRate = Math.min((settings?.rate || 1) + 0.2, 2.0)
      setSettings(prev => ({ ...prev!, rate: newRate }))
      announceToUser(`Speech rate increased to ${newRate.toFixed(1)}`)
    }, description: 'Increase speech rate' },
    { command: 'speech slower', action: () => { 
      const newRate = Math.max((settings?.rate || 1) - 0.2, 0.5)
      setSettings(prev => ({ ...prev!, rate: newRate }))
      announceToUser(`Speech rate decreased to ${newRate.toFixed(1)}`)
    }, description: 'Decrease speech rate' },
    { command: 'pitch higher', action: () => { 
      const newPitch = Math.min((settings?.pitch || 1) + 0.2, 2.0)
      setSettings(prev => ({ ...prev!, pitch: newPitch }))
      announceToUser(`Speech pitch increased to ${newPitch.toFixed(1)}`)
    }, description: 'Increase speech pitch' },
    { command: 'pitch lower', action: () => { 
      const newPitch = Math.max((settings?.pitch || 1) - 0.2, 0.5)
      setSettings(prev => ({ ...prev!, pitch: newPitch }))
      announceToUser(`Speech pitch decreased to ${newPitch.toFixed(1)}`)
    }, description: 'Decrease speech pitch' },
    
    // Help commands
    { command: 'help', action: showHelp, description: 'Show general help' },
    { command: 'help commands', action: listVoiceCommands, description: 'List all voice commands' },
    { command: 'what can you do', action: showCapabilities, description: 'Describe app capabilities' },
  ]

  // Effect to handle voice commands state
  useEffect(() => {
    if (settings?.voiceCommands && !isListeningForCommands) {
      startCommandListening()
    } else if (!settings?.voiceCommands && isListeningForCommands) {
      stopCommandListening()
    }
  }, [settings?.voiceCommands])

  const handleVoiceCommand = (command: string) => {
    if (!settings?.voiceCommands) return

    // Find matching command (case insensitive, partial matching)
    const matchedCommand = voiceCommands.find(cmd => 
      command.includes(cmd.command) || 
      cmd.command.includes(command) ||
      // Handle variations
      (cmd.command === 'go to voice' && (command.includes('voice tab') || command.includes('speech'))) ||
      (cmd.command === 'go to vision' && (command.includes('vision tab') || command.includes('camera') || command.includes('image'))) ||
      (cmd.command === 'go to actions' && (command.includes('actions tab') || command.includes('quick actions'))) ||
      (cmd.command === 'go to settings' && (command.includes('settings tab') || command.includes('preferences'))) ||
      (cmd.command === 'start listening' && command.includes('listen')) ||
      (cmd.command === 'read text' && (command.includes('read') && !command.includes('transcript'))) ||
      (cmd.command === 'help commands' && command.includes('commands'))
    )

    if (matchedCommand) {
      console.log('Executing voice command:', matchedCommand.command)
      announceToUser(`Executing: ${matchedCommand.command}`)
      matchedCommand.action()
    } else {
      console.log('Unknown voice command:', command)
      announceToUser('Unknown command. Say "help commands" to hear available commands.')
    }
  }

  const startCommandListening = () => {
    if (commandRecognitionRef.current && settings?.voiceCommands) {
      setIsListeningForCommands(true)
      try {
        commandRecognitionRef.current.start()
        console.log('Voice commands activated')
      } catch (error) {
        console.error('Failed to start command recognition:', error)
        setIsListeningForCommands(false)
      }
    }
  }

  const stopCommandListening = () => {
    if (commandRecognitionRef.current) {
      commandRecognitionRef.current.stop()
      setIsListeningForCommands(false)
      console.log('Voice commands deactivated')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      {/* Mobile-first header with better spacing */}
      <header className="text-center space-y-2 p-4 pb-2 sm:p-6 sm:pb-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
          Vocal-Agent
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          AI Voice Assistant for Accessibility
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Owner: Fahed Mlaiel | mlaiel@live.de
        </p>
      </header>

      {/* Main container with better mobile padding */}
      <div className="px-2 sm:px-4 lg:px-6 pb-6 space-y-4 sm:space-y-6">

      {error && (
        <Alert className="border-destructive mx-2 sm:mx-0">
          <Warning className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Responsive tabs with mobile-optimized layout */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mx-2 sm:mx-0 h-auto">
          <TabsTrigger value="voice" className="text-xs sm:text-sm py-2 sm:py-3">
            <Microphone className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Voice</span>
          </TabsTrigger>
          <TabsTrigger value="vision" className="text-xs sm:text-sm py-2 sm:py-3">
            <Eye className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Vision</span>
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs sm:text-sm py-2 sm:py-3">
            <Warning className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Actions</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm py-2 sm:py-3">
            <Gear className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voice" className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          {/* Mobile-first layout - stacked on mobile, side-by-side on tablet+ */}
          <div className="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
            {/* Speech to Text */}
            <Card className="w-full">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Microphone className="h-5 w-5 sm:h-6 sm:w-6" />
                  Speech to Text
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    size="lg"
                    onClick={isListening ? stopListening : startListening}
                    disabled={!isRecognitionSupported}
                    className="flex-1 h-12 sm:h-10 text-sm sm:text-base"
                    aria-label={isListening ? 'Stop listening' : 'Start listening'}
                  >
                    <Microphone className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    {isListening ? 'Stop Listening' : 'Start Listening'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearTranscript}
                    disabled={!transcript}
                    className="h-12 sm:h-10 sm:w-auto w-full text-sm sm:text-base"
                    aria-label="Clear transcript"
                  >
                    Clear
                  </Button>
                </div>
                
                {transcript && (
                  <div className="space-y-2">
                    <Label htmlFor="transcript" className="text-sm sm:text-base">Transcript:</Label>
                    <Textarea
                      id="transcript"
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder="Your speech will appear here..."
                      className="min-h-20 sm:min-h-24 text-sm sm:text-base resize-none"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Text to Speech */}
            <Card className="w-full">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <SpeakerHigh className="h-5 w-5 sm:h-6 sm:w-6" />
                  Text to Speech
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text-input" className="text-sm sm:text-base">Enter text to read aloud:</Label>
                  <Textarea
                    id="text-input"
                    value={textToRead}
                    onChange={(e) => setTextToRead(e.target.value)}
                    placeholder="Enter text here..."
                    className="min-h-20 sm:min-h-24 text-sm sm:text-base resize-none"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    size="lg"
                    onClick={() => speakText(textToRead)}
                    disabled={!isSpeechSupported || !textToRead.trim()}
                    className="flex-1 h-12 sm:h-10 text-sm sm:text-base"
                    aria-label={isSpeaking ? 'Stop reading' : 'Read text aloud'}
                  >
                    {isSpeaking ? (
                      <>
                        <Pause className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        Stop Reading
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        Read Aloud
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={summarizeContent}
                    disabled={!textToRead.trim()}
                    className="h-12 sm:h-10 sm:w-auto w-full text-sm sm:text-base"
                    aria-label="Summarize and read"
                  >
                    Summarize
                  </Button>
                </div>

                {isSpeaking && (
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Reading Progress:</Label>
                    <Progress value={progress} className="w-full h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vision" className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          <div className="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
            {/* Image Analysis */}
            <Card className="w-full">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
                  Image Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-upload" className="text-sm sm:text-base">Upload an image to analyze:</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    ref={fileInputRef}
                    className="cursor-pointer text-sm h-12 sm:h-10"
                  />
                </div>

                {imagePreview && (
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Selected Image:</Label>
                    <img
                      src={imagePreview}
                      alt="Selected for analysis"
                      className="w-full max-h-40 sm:max-h-48 object-contain rounded-md border"
                    />
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={analyzeImage}
                  disabled={!selectedImage || isAnalyzing}
                  className="w-full h-12 sm:h-10 text-sm sm:text-base"
                  aria-label="Analyze selected image"
                >
                  <Upload className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
                </Button>
              </CardContent>
            </Card>

            {/* Live Camera */}
            <Card className="w-full">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
                  Live Camera
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {isCameraActive && (
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Camera View:</Label>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-h-40 sm:max-h-48 rounded-md border bg-black"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={isCameraActive ? stopCamera : startCamera}
                    className="flex-1 h-12 sm:h-10 text-sm sm:text-base"
                    aria-label={isCameraActive ? 'Stop camera' : 'Start camera'}
                  >
                    <Camera className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                  </Button>
                  
                  {isCameraActive && (
                    <Button
                      onClick={captureImage}
                      variant="outline"
                      className="h-12 sm:h-10 sm:w-auto w-full text-sm sm:text-base"
                      aria-label="Capture and analyze current view"
                    >
                      Capture
                    </Button>
                  )}
                </div>

                <Button
                  size="lg"
                  onClick={describeEnvironment}
                  className="w-full h-12 sm:h-10 text-sm sm:text-base"
                  variant="secondary"
                  aria-label="Describe current environment"
                >
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Describe Environment
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <SpeakerX className="h-5 w-5 sm:h-6 sm:w-6" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button
                  variant="outline"
                  onClick={() => speakText(transcript)}
                  disabled={!transcript.trim() || !isSpeechSupported}
                  className="h-12 sm:h-10 text-sm sm:text-base"
                  aria-label="Read transcript aloud"
                >
                  <SpeakerHigh className="h-4 w-4 mr-2" />
                  Read Transcript
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={sendSafetyAlert}
                  className="h-12 sm:h-10 text-sm sm:text-base"
                  aria-label="Send safety alert"
                >
                  <Warning className="h-4 w-4 mr-2" />
                  Safety Alert
                </Button>

                <Button
                  variant="secondary"
                  onClick={listVoiceCommands}
                  disabled={!isSpeechSupported}
                  className="h-12 sm:h-10 text-sm sm:text-base"
                  aria-label="List all voice commands"
                >
                  <SpeakerX className="h-4 w-4 mr-2" />
                  Voice Commands Help
                </Button>

                <Button
                  variant="outline"
                  onClick={showCapabilities}
                  disabled={!isSpeechSupported}
                  className="h-12 sm:h-10 text-sm sm:text-base"
                  aria-label="Describe app capabilities"
                >
                  <SpeakerX className="h-4 w-4 mr-2" />
                  What Can You Do?
                </Button>

                <div className="col-span-1 sm:col-span-2 flex items-center justify-center space-x-2 p-3 rounded-md border">
                  <Switch
                    id="auto-read"
                    checked={settings?.autoRead || false}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev!, autoRead: checked }))
                    }
                  />
                  <Label htmlFor="auto-read" className="text-sm sm:text-base">Auto-read new content</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          {/* Voice Settings */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Gear className="h-5 w-5 sm:h-6 sm:w-6" />
                Voice Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Voice Selection */}
              <div className="space-y-2">
                <Label htmlFor="voice-select" className="text-sm sm:text-base">Voice:</Label>
                <Select
                  value={settings?.voice || ''}
                  onValueChange={(value) => {
                    setSettings(prev => ({ ...prev!, voice: value }))
                    announceToUser(`Voice changed to ${value}`)
                  }}
                >
                  <SelectTrigger id="voice-select" className="h-12 sm:h-10">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                      <SelectItem key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Speech Rate */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm sm:text-base">Speech Rate:</Label>
                  <span className="text-xs sm:text-sm font-medium px-2 py-1 bg-muted rounded">
                    {(settings?.rate || 1).toFixed(1)}x
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={[settings?.rate || 1]}
                  onValueChange={(value) => {
                    const rate = value[0]
                    setSettings(prev => ({ ...prev!, rate }))
                    announceToUser(`Speech rate set to ${rate.toFixed(1)}`)
                  }}
                  className="w-full"
                />
              </div>

              {/* Speech Pitch */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm sm:text-base">Speech Pitch:</Label>
                  <span className="text-xs sm:text-sm font-medium px-2 py-1 bg-muted rounded">
                    {(settings?.pitch || 1).toFixed(1)}
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={[settings?.pitch || 1]}
                  onValueChange={(value) => {
                    const pitch = value[0]
                    setSettings(prev => ({ ...prev!, pitch }))
                    announceToUser(`Speech pitch set to ${pitch.toFixed(1)}`)
                  }}
                  className="w-full"
                />
              </div>

              {/* Auto Read Setting */}
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div className="space-y-1">
                  <Label htmlFor="auto-read-setting" className="text-sm sm:text-base">Auto-read Content</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Automatically read new content when available
                  </p>
                </div>
                <Switch
                  id="auto-read-setting"
                  checked={settings?.autoRead || false}
                  onCheckedChange={(checked) => {
                    setSettings(prev => ({ ...prev!, autoRead: checked }))
                    announceToUser(`Auto-read ${checked ? 'enabled' : 'disabled'}`)
                  }}
                />
              </div>

              {/* Voice Commands Setting */}
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div className="space-y-1">
                  <Label htmlFor="voice-commands-setting" className="text-sm sm:text-base">Voice Commands</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Enable hands-free navigation with voice commands
                  </p>
                </div>
                <Switch
                  id="voice-commands-setting"
                  checked={settings?.voiceCommands || false}
                  onCheckedChange={(checked) => {
                    setSettings(prev => ({ ...prev!, voiceCommands: checked }))
                    announceToUser(`Voice commands ${checked ? 'enabled' : 'disabled'}`)
                    if (checked) {
                      announceToUser('Say "help commands" to learn available voice commands')
                    }
                  }}
                />
              </div>

              {/* Voice Commands Status */}
              {settings?.voiceCommands && (
                <div className="bg-accent/10 p-3 rounded-md border border-accent/20">
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${isListeningForCommands ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span>
                      Voice Commands: {isListeningForCommands ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Say "help commands" to hear all available voice commands
                  </p>
                </div>
              )}

              {/* Test Voice Settings */}
              <div className="pt-4 border-t">
                <Button
                  size="lg"
                  onClick={testVoiceSettings}
                  disabled={!isSpeechSupported}
                  className="w-full h-12 sm:h-10 text-sm sm:text-base"
                  aria-label="Test current voice settings"
                >
                  <SpeakerX className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Test Voice Settings
                </Button>
              </div>

              {/* Reset to Defaults */}
              <Button
                variant="outline"
                onClick={() => {
                  setSettings({
                    rate: 1,
                    pitch: 1,
                    voice: availableVoices.find(v => v.lang.startsWith('en'))?.name || '',
                    autoRead: true,
                    voiceCommands: true
                  })
                  announceToUser('Voice settings reset to defaults')
                }}
                className="w-full h-12 sm:h-10 text-sm sm:text-base"
                aria-label="Reset voice settings to defaults"
              >
                Reset to Defaults
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mobile-optimized footer with better spacing */}
      <div className="text-center text-xs sm:text-sm text-muted-foreground space-y-2 pt-4 sm:pt-6 pb-4">
        <p className="flex flex-col sm:flex-row sm:justify-center gap-1 sm:gap-2">
          <span>Speech Recognition: {isRecognitionSupported ? '✓ Supported' : '✗ Not supported'}</span>
          <span className="hidden sm:inline">|</span>
          <span>Speech Synthesis: {isSpeechSupported ? '✓ Supported' : '✗ Not supported'}</span>
        </p>
        <p className="text-xs px-4">
          Attribution to Fahed Mlaiel is mandatory in all copies, forks, and derivatives.
        </p>
      </div>
      </div>
    </div>
  )
}
