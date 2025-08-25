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
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold mb-4">Voice Features Coming Soon</h2>
            <p className="text-muted-foreground">Speech recognition and text-to-speech features will be available once all components are properly loaded.</p>
          </div>
        </TabsContent>

        <TabsContent value="vision" className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold mb-4">Vision Features Coming Soon</h2>
            <p className="text-muted-foreground">Image analysis and camera features will be available once all components are properly loaded.</p>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold mb-4">Quick Actions Coming Soon</h2>
            <p className="text-muted-foreground">Quick action buttons will be available once all features are implemented.</p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Gear className="h-5 w-5 sm:h-6 sm:w-6" />
                Voice Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="text-center p-4">
                <p className="text-muted-foreground">Settings panel will be available once voice features are implemented.</p>
              </div>
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
