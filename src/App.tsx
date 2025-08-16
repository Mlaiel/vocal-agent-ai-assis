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
import { Microphone, Speaker, AlertTriangle, Play, Pause, Square, Volume2, Camera, Eye, Upload, Gear } from '@phosphor-icons/react'
import { useKV } from '@/hooks/useKV'
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

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const commandRecognitionRef = useRef<SpeechRecognition | null>(null)
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

      // Setup command recognition
      commandRecognitionRef.current = new SpeechRecognition()
      
      if (commandRecognitionRef.current) {
        commandRecognitionRef.current.continuous = true
        commandRecognitionRef.current.interimResults = false
        commandRecognitionRef.current.lang = 'en-US'

        commandRecognitionRef.current.onresult = (event) => {
          const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim()
          console.log('Voice command received:', command)
          handleVoiceCommand(command)
        }

        commandRecognitionRef.current.onerror = (event) => {
          console.error('Command recognition error:', event.error)
          setIsListeningForCommands(false)
        }

        commandRecognitionRef.current.onend = () => {
          // Auto-restart command listening if enabled
          if (settings.voiceCommands && isListeningForCommands) {
            setTimeout(() => {
              if (commandRecognitionRef.current) {
                commandRecognitionRef.current.start()
              }
            }, 100)
          }
        }
      }
    }

    if ('speechSynthesis' in window) {
      setIsSpeechSupported(true)
      synthRef.current = window.speechSynthesis
      
      // Load available voices
      const loadVoices = () => {
        const voices = synthRef.current?.getVoices() || []
        setAvailableVoices(voices)
        
        // Set default voice if none selected
        if (!settings.voice && voices.length > 0) {
          const defaultVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0]
          setSettings(prev => ({ ...prev, voice: defaultVoice.name }))
        }
      }
      
      // Voices might not be available immediately
      if (synthRef.current.getVoices().length > 0) {
        loadVoices()
      } else {
        synthRef.current.addEventListener('voiceschanged', loadVoices)
      }
    }

    // Announce app ready
    setTimeout(() => {
      announceToUser('Vocal Agent ready. Say "help commands" to learn voice commands, or use the interface directly.')
    }, 1000)
  }, [])

  // Effect to handle voice commands state
  useEffect(() => {
    if (settings.voiceCommands && !isListeningForCommands) {
      startCommandListening()
    } else if (!settings.voiceCommands && isListeningForCommands) {
      stopCommandListening()
    }
  }, [settings.voiceCommands])

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
      const newRate = Math.min(settings.rate + 0.2, 2.0)
      setSettings(prev => ({ ...prev, rate: newRate }))
      announceToUser(`Speech rate increased to ${newRate.toFixed(1)}`)
    }, description: 'Increase speech rate' },
    { command: 'speech slower', action: () => { 
      const newRate = Math.max(settings.rate - 0.2, 0.5)
      setSettings(prev => ({ ...prev, rate: newRate }))
      announceToUser(`Speech rate decreased to ${newRate.toFixed(1)}`)
    }, description: 'Decrease speech rate' },
    { command: 'pitch higher', action: () => { 
      const newPitch = Math.min(settings.pitch + 0.2, 2.0)
      setSettings(prev => ({ ...prev, pitch: newPitch }))
      announceToUser(`Speech pitch increased to ${newPitch.toFixed(1)}`)
    }, description: 'Increase speech pitch' },
    { command: 'pitch lower', action: () => { 
      const newPitch = Math.max(settings.pitch - 0.2, 0.5)
      setSettings(prev => ({ ...prev, pitch: newPitch }))
      announceToUser(`Speech pitch decreased to ${newPitch.toFixed(1)}`)
    }, description: 'Decrease speech pitch' },
    
    // Help commands
    { command: 'help', action: showHelp, description: 'Show general help' },
    { command: 'help commands', action: listVoiceCommands, description: 'List all voice commands' },
    { command: 'what can you do', action: showCapabilities, description: 'Describe app capabilities' },
  ]

  const handleVoiceCommand = (command: string) => {
    if (!settings.voiceCommands) return

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
    if (commandRecognitionRef.current && settings.voiceCommands) {
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

  const showHelp = () => {
    const helpText = `Welcome to Vocal Agent. This is an AI voice assistant designed for accessibility. 
    You can navigate using voice commands, convert speech to text, read text aloud, analyze images, 
    and get environmental descriptions. Say "help commands" to hear all available voice commands.`
    speakText(helpText)
  }

  const listVoiceCommands = () => {
    const commandsList = voiceCommands
      .map(cmd => `${cmd.command}: ${cmd.description}`)
      .join('. ')
    
    const introText = `Here are the available voice commands: ${commandsList}`
    speakText(introText)
  }

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

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <Toaster />
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

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="vision">Vision</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="voice" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="vision" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Image Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Image Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-upload">Upload an image to analyze:</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    ref={fileInputRef}
                    className="cursor-pointer"
                  />
                </div>

                {imagePreview && (
                  <div className="space-y-2">
                    <Label>Selected Image:</Label>
                    <img
                      src={imagePreview}
                      alt="Selected for analysis"
                      className="w-full max-h-48 object-contain rounded-md border"
                    />
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={analyzeImage}
                  disabled={!selectedImage || isAnalyzing}
                  className="w-full"
                  aria-label="Analyze selected image"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
                </Button>
              </CardContent>
            </Card>

            {/* Live Camera */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Live Camera
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCameraActive && (
                  <div className="space-y-2">
                    <Label>Camera View:</Label>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-h-48 rounded-md border bg-black"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={isCameraActive ? stopCamera : startCamera}
                    className="flex-1"
                    aria-label={isCameraActive ? 'Stop camera' : 'Start camera'}
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                  </Button>
                  
                  {isCameraActive && (
                    <Button
                      onClick={captureImage}
                      variant="outline"
                      aria-label="Capture and analyze current view"
                    >
                      Capture
                    </Button>
                  )}
                </div>

                <Button
                  size="lg"
                  onClick={describeEnvironment}
                  className="w-full"
                  variant="secondary"
                  aria-label="Describe current environment"
                >
                  <Eye className="h-5 w-5 mr-2" />
                  Describe Environment
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
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

                <Button
                  variant="secondary"
                  onClick={listVoiceCommands}
                  disabled={!isSpeechSupported}
                  aria-label="List all voice commands"
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  Voice Commands Help
                </Button>

                <Button
                  variant="outline"
                  onClick={showCapabilities}
                  disabled={!isSpeechSupported}
                  aria-label="Describe app capabilities"
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  What Can You Do?
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
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          {/* Voice Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gear className="h-5 w-5" />
                Voice Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Voice Selection */}
              <div className="space-y-2">
                <Label htmlFor="voice-select">Voice:</Label>
                <Select
                  value={settings.voice}
                  onValueChange={(value) => {
                    setSettings(prev => ({ ...prev, voice: value }))
                    announceToUser(`Voice changed to ${value}`)
                  }}
                >
                  <SelectTrigger id="voice-select">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="rate-slider">Speech Rate:</Label>
                  <span className="text-sm text-muted-foreground">
                    {settings.rate.toFixed(1)}x
                  </span>
                </div>
                <Slider
                  id="rate-slider"
                  value={[settings.rate]}
                  onValueChange={([value]) => {
                    setSettings(prev => ({ ...prev, rate: value }))
                  }}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                  aria-label="Speech rate"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Slow (0.5x)</span>
                  <span>Normal (1.0x)</span>
                  <span>Fast (2.0x)</span>
                </div>
              </div>

              {/* Speech Pitch */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pitch-slider">Speech Pitch:</Label>
                  <span className="text-sm text-muted-foreground">
                    {settings.pitch.toFixed(1)}
                  </span>
                </div>
                <Slider
                  id="pitch-slider"
                  value={[settings.pitch]}
                  onValueChange={([value]) => {
                    setSettings(prev => ({ ...prev, pitch: value }))
                  }}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                  aria-label="Speech pitch"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low (0.5)</span>
                  <span>Normal (1.0)</span>
                  <span>High (2.0)</span>
                </div>
              </div>

              {/* Auto-read Setting */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="auto-read-setting">Auto-read new content</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically read new content when it appears
                  </p>
                </div>
                <Switch
                  id="auto-read-setting"
                  checked={settings.autoRead}
                  onCheckedChange={(checked) => {
                    setSettings(prev => ({ ...prev, autoRead: checked }))
                    announceToUser(`Auto-read ${checked ? 'enabled' : 'disabled'}`)
                  }}
                />
              </div>

              {/* Voice Commands Setting */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="voice-commands-setting">Voice Commands</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable hands-free navigation with voice commands
                  </p>
                </div>
                <Switch
                  id="voice-commands-setting"
                  checked={settings.voiceCommands}
                  onCheckedChange={(checked) => {
                    setSettings(prev => ({ ...prev, voiceCommands: checked }))
                    announceToUser(`Voice commands ${checked ? 'enabled' : 'disabled'}`)
                    if (checked) {
                      announceToUser('Say "help commands" to learn available voice commands')
                    }
                  }}
                />
              </div>

              {/* Voice Commands Status */}
              {settings.voiceCommands && (
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
                  className="w-full"
                  aria-label="Test current voice settings"
                >
                  <Volume2 className="h-5 w-5 mr-2" />
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
                className="w-full"
                aria-label="Reset voice settings to defaults"
              >
                Reset to Defaults
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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