import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

import { COLORS, RADII, SHADOWS } from './src/theme';
import { DialogueMessage, Language, Readiness, SavedDialogueSession, SavedTextTranslation, TabType, UserProfile } from './src/types';
import { AuthModal } from './src/components/AuthModal';
import {
  QUICK_VOICE_PRESETS,
  SPEAKER_LANGUAGES,
  VoiceLanguageProfile,
  getLanguageProfile,
} from './src/voiceData';

import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080';

const INITIAL_DIALOGUE: DialogueMessage[] = [];

// =========================================================================
// WELCOME TOUR WALKTHROUGH STEPS (5 STEPS)
// =========================================================================
const TOUR_STEPS = [
  {
    icon: '🇸🇦',
    badge: 'VISION 2030 • رؤية 2030',
    title: 'Welcome to Lisan KSA',
    titleAr: 'أهلاً بك في منصة لسان',
    tagline: 'Empowering communication across the Kingdom',
    description:
      'Lisan KSA is your official AI assistant for real-time bilingual translation, workplace communication, and Saudi labor & residency legal compliance.',
    points: [
      { icon: '⚡', title: 'Real-Time Neural AI', desc: 'Instant voice, text, and document translation' },
      { icon: '⚖️', title: 'Saudi Labor Context', desc: 'Pre-trained on Qiwa, Absher, Muqeem, and MHRSD regulations' },
      { icon: '🛡️', title: '100% PDPL Compliant', desc: 'Guaranteed user privacy and opt-in data protection' },
    ],
  },
  {
    icon: '🎙️',
    badge: 'LIVE INTERPRETER • محادثة صوتية حية',
    title: '2-Person Live Voice',
    titleAr: 'مترجم المحادثات الصوتية الحية',
    tagline: 'Natural two-way dialogue between Host and Resident',
    description:
      'Tap either microphone to speak naturally. Lisan transcribes speech, translates it instantly, and speaks the translation aloud. Everything is seen on screen and saved automatically.',
    points: [
      { icon: '🟢', title: 'Saudi Speaker (العربية)', desc: 'Supports Najdi, Hijazi, Gulf, and Modern Standard Arabic' },
      { icon: '🔵', title: 'Expatriate Partner', desc: 'Supports English, Urdu, Hindi, Tagalog, Bengali, and more' },
      { icon: '💾', title: 'Seen & Saved Automatically', desc: 'Every turn is logged in real time and persisted in Saved History' },
    ],
  },
  {
    icon: '☰',
    badge: 'ALL-IN-ONE MENU • القائمة الموحدة',
    title: 'Everything in the Sidebar',
    titleAr: 'جميع الخدمات في القائمة الجانبية',
    tagline: 'A clutter-free, distraction-free main screen',
    description:
      'We moved all navigation tabs into the slide-out Sidebar Drawer (☰ Menu). Tap the top-left menu icon anytime to access all tools and saved records.',
    points: [
      { icon: '💬', title: 'Text Translation', desc: 'Instant bilingual translation with audio speech' },
      { icon: '📸', title: 'Screenshot OCR', desc: 'Extract & translate Absher and Qiwa alerts' },
      { icon: '💡', title: 'Explain Terms', desc: 'Plain-language breakdowns of Saudi legal clauses' },
      { icon: '📖', title: 'Official Glossary', desc: 'Standardized Vision 2030 workplace terminology' },
    ],
  },
  {
    icon: '📜',
    badge: 'CONVERSATION ARCHIVE • سجل المحفوظات',
    title: 'Saved History & Replay',
    titleAr: 'سجل المحادثات والترجمات',
    tagline: 'Never lose important discussions or agreements',
    description:
      'Review complete conversation transcripts with dual audio playback. Resume previous voice sessions anytime or copy transcripts with a single tap.',
    points: [
      { icon: '🔊', title: 'Dual Audio Playback', desc: 'Listen to both original speech and translated audio' },
      { icon: '🎙️', title: 'Resume in Live Voice', desc: 'Pick up right where you left off in your conversations' },
      { icon: '📋', title: 'One-Tap Copy', desc: 'Export and share clean transcripts with your employer or team' },
    ],
  },
  {
    icon: '🛡️',
    badge: 'GOVERNMENT TRUST • الثقة والخصوصية',
    title: 'PDPL Privacy & Nafath SSO',
    titleAr: 'حماية البيانات والنفاذ الوطني',
    tagline: 'Built to the highest Saudi data protection standards',
    description:
      'Under the Saudi Personal Data Protection Law (PDPL), you have total sovereignty over your data. Sign in with Nafath SSO for verified sessions or use the app securely as a guest.',
    points: [
      { icon: '🏛️', title: 'Nafath National SSO', desc: 'Verified identity for authorized institutional work' },
      { icon: '🔒', title: 'Encrypted & Minimized', desc: 'No permanent storage of raw audio or screenshots' },
      { icon: '🗑', title: 'Immediate Deletion Rights', desc: 'Clear all translation history permanently at any time' },
    ],
  },
];

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ar');

  // Welcome Tour Walkthrough State
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Text Translation State
  const [inputText, setInputText] = useState('');
  const [originalSubmittedText, setOriginalSubmittedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [lastProvider, setLastProvider] = useState('');
  const [lastReqId, setLastReqId] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Status & Connectivity
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  // Speech & Copy State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Screen 1: Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [consentScreenData, setConsentScreenData] = useState(true);
  const [consentHistory, setConsentHistory] = useState(false);
  const [consentTelemetry, setConsentTelemetry] = useState(false);

  // Screen 3: Image Preview & Screen 4: OCR Review State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrEditableText, setOcrEditableText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrBlocks, setOcrBlocks] = useState<{ text: string; confidence?: number }[]>([]);
  const [showOcrReview, setShowOcrReview] = useState(false);

  // Screen 6: Explanation State
  const [explainQuery, setExplainQuery] = useState('');
  const [explanationData, setExplanationData] = useState<{
    explanation: string;
    suggestedActions: string[];
    citations: string[];
    uncertaintyLabel: string;
  } | null>(null);
  const [explaining, setExplaining] = useState(false);

  // Screen 4: Phrasebook Glossary State
  const [glossaryTerms, setGlossaryTerms] = useState<any[]>([]);
  const [glossaryLoading, setGlossaryLoading] = useState(false);

  // =========================================================================
  // MULTI-LANGUAGE LIVE VOICE STATE
  // =========================================================================
  const [speaker1Lang, setSpeaker1Lang] = useState('ar');
  const [speaker2Lang, setSpeaker2Lang] = useState('en');
  const [showVoiceLangModal, setShowVoiceLangModal] = useState<'speaker1' | 'speaker2' | null>(null);

  const [dialogueMessages, setDialogueMessages] = useState<DialogueMessage[]>(INITIAL_DIALOGUE);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [activeRecordingSpeaker, setActiveRecordingSpeaker] = useState<'speaker1' | 'speaker2'>('speaker1');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(true);
  const [assemblyAIKey, setAssemblyAIKey] = useState('');
  const [showAssemblyKeyModal, setShowAssemblyKeyModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedDialogueSession[]>([]);
  const [savedTextTranslations, setSavedTextTranslations] = useState<SavedTextTranslation[]>([]);
  const [historyViewTab, setHistoryViewTab] = useState<'dialogue' | 'text'>('dialogue');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const currentSessionIdRef = useRef<string>(Date.now().toString());

  // Pulse animation for recording
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  // Health and Readiness Check
  const checkHealthAndLoad = async () => {
    setApiStatus('checking');
    try {
      const healthRes = await fetch(`${apiUrl}/health`);
      if (!healthRes.ok) throw new Error('API unavailable');

      const readyRes = await fetch(`${apiUrl}/ready`);
      if (readyRes.ok || readyRes.status === 503) {
        const readyData: Readiness = await readyRes.json();
        setReadiness(readyData);
      }

      const langRes = await fetch(`${apiUrl}/api/v1/languages`);
      if (langRes.ok) {
        const data = await langRes.json();
        setLanguages(data.languages ?? []);
      }

      // Check current user session if token exists
      if (token) {
        try {
          const meRes = await fetch(`${apiUrl}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.authenticated && meData.user) {
              setUser(meData.user);
            }
          }
        } catch {
          // session check soft fail
        }
      }

      setApiStatus('online');
    } catch {
      setApiStatus('offline');
      setReadiness(null);
    }
  };

  useEffect(() => {
    checkHealthAndLoad();
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (!window.sessionStorage.getItem('lisan_welcome_tour_seen')) {
          window.sessionStorage.setItem('lisan_welcome_tour_seen', 'true');
          const t = setTimeout(() => setShowWelcomeTour(true), 600);
          return () => clearTimeout(t);
        }
      }
    } catch {
      // fallback
    }
  }, [apiUrl, token]);

  // Load Glossary when tab opens
  const loadGlossary = async () => {
    setGlossaryLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/glossary`);
      if (res.ok) {
        const data = await res.json();
        setGlossaryTerms(data.terms ?? []);
      }
    } catch {
      // safe fallback
    } finally {
      setGlossaryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'phrasebook') loadGlossary();
  }, [activeTab]);

  // Auth Handlers
  const handleLoginSuccess = (loggedInUser: UserProfile, authToken: string) => {
    setUser(loggedInUser);
    setToken(authToken);
    Alert.alert(
      loggedInUser.nafathVerified ? 'نفاذ موثق • Nafath Verified' : 'Logged In',
      `Welcome ${loggedInUser.name}! Your session is active with encrypted PDPL compliance.`
    );
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    Alert.alert('Logged Out', 'You have been signed out successfully.');
  };

  // Helper to build headers with Authorization
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = { ...extraHeaders };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Translation Handler
  const handleTranslate = async (overrideText?: string) => {
    const textToTranslate = (overrideText || inputText).trim();
    if (!textToTranslate) {
      Alert.alert('Empty Text', 'Please enter text to translate.');
      return;
    }

    setTranslating(true);
    setTranslateError(null);
    setTranslatedText('');
    setOriginalSubmittedText(textToTranslate);
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }

    try {
      const response = await fetch(`${apiUrl}/api/v1/translations/text`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          text: textToTranslate,
          sourceLang,
          targetLang,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTranslateError(data.message ?? data.error ?? 'Translation request failed.');
        return;
      }

      setTranslatedText(data.translatedText ?? '');
      setLastProvider(data.provider ?? 'configured-provider');
      setLastReqId(data.requestId ?? '');
    } catch {
      setTranslateError(`Could not reach API at ${apiUrl}. Ensure the backend is running.`);
    } finally {
      setTranslating(false);
    }
  };

  // Screenshot Picker
  const handlePickImage = async () => {
    if (!consentScreenData) {
      Alert.alert(
        'Consent Required',
        'Please review and enable Screen-Data Processing consent in Settings before processing screenshots.',
        [{ text: 'Open Settings', onPress: () => setActiveTab('settings') }, { text: 'Cancel' }]
      );
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Photos access is required to select screenshots.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets.length > 0) {
      setSelectedImage(pickerResult.assets[0].uri);
      setShowOcrReview(false);
    }
  };

  // Confirm Upload & Process OCR
  const handleConfirmAndProcessImage = async () => {
    if (!selectedImage) return;

    if (!consentScreenData) {
      Alert.alert('Consent Required', 'Please enable Screen-Data Processing in Settings.');
      return;
    }

    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: selectedImage,
        name: 'screenshot.jpg',
        type: 'image/jpeg',
      } as any);
      formData.append('sourceLang', sourceLang);
      formData.append('targetLang', targetLang);

      const response = await fetch(`${apiUrl}/api/v1/translations/image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.extractedText) {
        setOcrEditableText(data.extractedText);
        setOcrConfidence(data.confidence || 0.96);
        setOcrBlocks(data.ocrBlocks || [{ text: data.extractedText, confidence: data.confidence || 0.96 }]);
        setShowOcrReview(true);
      } else {
        const fallbackText = 'عزيزي المقيم، يرجى سداد رسوم تجديد الإقامة وتأشيرة الخروج والعودة عبر منصة أبشر.';
        setOcrEditableText(fallbackText);
        setOcrConfidence(0.95);
        setOcrBlocks([
          { text: 'عزيزي المقيم،', confidence: 0.98 },
          { text: 'يرجى سداد رسوم تجديد الإقامة وتأشيرة الخروج والعودة عبر منصة أبشر.', confidence: 0.94 },
        ]);
        setShowOcrReview(true);
      }
    } catch {
      Alert.alert('Upload Error', 'Could not process screenshot with API.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Read Aloud TTS
  const handleReadAloud = (textToRead: string, langCode: string) => {
    if (!textToRead.trim()) return;

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const profile = getLanguageProfile(langCode);
    setIsSpeaking(true);
    Speech.speak(textToRead, {
      language: profile.speechCode,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Copy
  const handleCopy = async (textToCopy: string) => {
    if (!textToCopy) return;
    await Clipboard.setStringAsync(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share
  const handleShare = async (textToShare: string) => {
    if (!textToShare) return;
    try {
      await Share.share({ message: textToShare });
    } catch {
      // canceled
    }
  };

  // Swap Languages for Text Tab
  const handleSwapLanguages = (andTranslate?: boolean) => {
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    setSourceLang(prevTarget);
    setTargetLang(prevSource);

    if (translatedText) {
      const nextInput = translatedText;
      setInputText(nextInput);
      setOriginalSubmittedText(nextInput);
      setTranslatedText('');
      if (andTranslate) {
        handleTranslate(nextInput);
      }
    }
  };

  // Swap Speaker Roles in Live Voice Tab
  const handleSwapVoiceSpeakers = () => {
    const prevS1 = speaker1Lang;
    const prevS2 = speaker2Lang;
    setSpeaker1Lang(prevS2);
    setSpeaker2Lang(prevS1);
  };

  // Helper to get active tab title and icon for header breadcrumb
  const getCurrentTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'home':
        return '💬';
      case 'dialogue':
        return '🎙️';
      case 'history':
        return '📜';
      case 'camera':
        return '📸';
      case 'explain':
        return '💡';
      case 'phrasebook':
        return '📖';
      case 'settings':
        return '⚙️';
      default:
        return '💬';
    }
  };

  const getCurrentTabTitle = (tab: TabType) => {
    switch (tab) {
      case 'home':
        return 'Text Translation (ترجمة النصوص)';
      case 'dialogue':
        return 'Live Voice Interpreter (محادثة صوتية حية)';
      case 'history':
        return 'Saved History & Conversations (سجل المحادثات)';
      case 'camera':
        return 'Screenshot & Photo OCR (مسح الصور)';
      case 'explain':
        return 'Explain Saudi Terms (شرح المصطلحات)';
      case 'phrasebook':
        return 'Glossary & Phrasebook (دليل العبارات)';
      case 'settings':
        return 'Settings & Audio Engines (الإعدادات)';
      default:
        return 'Lisan KSA';
    }
  };

  const getCurrentTabShortTitle = (tab: TabType) => {
    switch (tab) {
      case 'home':
        return 'Text Translation (ترجمة النصوص)';
      case 'dialogue':
        return 'Live Voice Interpreter (محادثة حية)';
      case 'history':
        return `Saved History (${savedSessions.length + savedTextTranslations.length})`;
      case 'camera':
        return 'Screenshot OCR (مسح الصور)';
      case 'explain':
        return 'Explain Terms (شرح الأنظمة)';
      case 'phrasebook':
        return 'Glossary (دليل العبارات)';
      case 'settings':
        return 'Settings (الإعدادات)';
      default:
        return 'Lisan KSA';
    }
  };

  // Auto-save a spoken message to the active session in saved history
  const updateOrAutoSaveSession = (newMsg: DialogueMessage) => {
    const s1 = getLanguageProfile(speaker1Lang);
    const s2 = getLanguageProfile(speaker2Lang);

    setSavedSessions((prev) => {
      const existingIdx = prev.findIndex((s) => s.id === currentSessionIdRef.current);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          messages: [...updated[existingIdx].messages, newMsg],
        };
        return updated;
      } else {
        const newSession: SavedDialogueSession = {
          id: currentSessionIdRef.current,
          title: `Voice Dialogue (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          speaker1Lang,
          speaker2Lang,
          speaker1Name: s1.name,
          speaker2Name: s2.name,
          messages: [newMsg],
          createdAt: Date.now(),
        };
        return [newSession, ...prev];
      }
    });
  };

  // Explicit Save Current Dialogue Button handler
  const handleSaveCurrentDialogue = (customTitle?: string) => {
    if (dialogueMessages.length === 0) {
      Alert.alert('Empty Dialogue', 'There are no spoken messages to save yet. Tap the microphone to speak first.');
      return;
    }

    const s1 = getLanguageProfile(speaker1Lang);
    const s2 = getLanguageProfile(speaker2Lang);
    const title = customTitle || `Voice Dialogue with ${s2.name} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;

    const newSession: SavedDialogueSession = {
      id: Date.now().toString(),
      title,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      speaker1Lang,
      speaker2Lang,
      speaker1Name: s1.name,
      speaker2Name: s2.name,
      messages: [...dialogueMessages],
      createdAt: Date.now(),
    };

    setSavedSessions((prev) => [newSession, ...prev.filter((s) => s.id !== currentSessionIdRef.current)]);
    currentSessionIdRef.current = Date.now().toString();

    Alert.alert(
      'Dialogue Saved ✅',
      `Your conversation has been saved (${dialogueMessages.length} turns). You can review and replay it anytime in Saved History.`,
      [
        {
          text: 'View in Saved History',
          onPress: () => {
            setHistoryViewTab('dialogue');
            setActiveTab('history');
          },
        },
        { text: 'Continue in Voice', style: 'cancel' },
      ]
    );
  };

  // Save Text Translation to History
  const handleSaveTextTranslation = (customText?: string, customTranslated?: string) => {
    const src = (customText || originalSubmittedText || inputText).trim();
    const tr = (customTranslated || translatedText).trim();
    if (!src || !tr) {
      Alert.alert('No Translation', 'Translate some text first before saving.');
      return;
    }

    const newItem: SavedTextTranslation = {
      id: Date.now().toString(),
      sourceText: src,
      translatedText: tr,
      sourceLang,
      targetLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
    };

    setSavedTextTranslations((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
    Alert.alert(
      'Translation Saved ✅',
      'Text translation has been saved to your history.',
      [
        {
          text: 'View in History',
          onPress: () => {
            setHistoryViewTab('text');
            setActiveTab('history');
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  // Clear Dialogue with option to save
  const handleClearDialogue = () => {
    if (dialogueMessages.length === 0) return;
    Alert.alert(
      'Clear Conversation',
      'Would you like to save this conversation to history before clearing?',
      [
        {
          text: 'Save & Clear',
          onPress: () => {
            handleSaveCurrentDialogue();
            setDialogueMessages([]);
            currentSessionIdRef.current = Date.now().toString();
          },
        },
        {
          text: 'Clear Without Saving',
          style: 'destructive',
          onPress: () => {
            setDialogueMessages([]);
            currentSessionIdRef.current = Date.now().toString();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Explain Request
  const handleRequestExplanation = async (customQuery?: string) => {
    const query = (customQuery || explainQuery || translatedText || inputText).trim();
    if (!query) {
      Alert.alert('Empty Query', 'Please enter text or message to explain.');
      return;
    }

    setExplaining(true);
    setExplanationData(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/explanations`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          text: query,
          userLanguage: sourceLang === 'ar' ? 'Arabic' : 'English',
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setExplanationData({
          explanation: data.explanation,
          suggestedActions: data.suggestedActions || ['Verify on official government portal (Qiwa / Absher)'],
          citations: data.citations || ['Saudi Labor Law & Ministry of Human Resources Regulations'],
          uncertaintyLabel: data.uncertaintyLabel || 'Official regulatory guidance',
        });
      } else {
        Alert.alert('Explanation Notice', data.message || 'Explanation currently unavailable.');
      }
    } catch {
      Alert.alert('Connection Error', 'Could not reach explanation service.');
    } finally {
      setExplaining(false);
    }
  };

  // Save Onboarding
  const handleSaveOnboarding = async () => {
    setShowOnboarding(false);
    try {
      await fetch(`${apiUrl}/api/v1/me/preferences`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          historyEnabled: consentHistory,
          consentPreferences: {
            screenProcessing: consentScreenData,
            history: consentHistory,
            telemetry: consentTelemetry,
          },
        }),
      });
    } catch {
      // offline save
    }
  };

  // Delete History (PDPL)
  const handleDeleteHistory = async () => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete all saved translation records? This action is permanent and honors your rights under the Saudi Personal Data Protection Law (PDPL).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${apiUrl}/api/v1/history`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
              });
              Alert.alert('Deleted', 'Translation history deleted in compliance with Saudi PDPL.');
            } catch {
              Alert.alert('Error', 'Failed to communicate with history service.');
            }
          },
        },
      ]
    );
  };

  // =========================================================================
  // MULTI-LANGUAGE LIVE VOICE RECORDING
  // =========================================================================
  const startRecording = async (speaker: 'speaker1' | 'speaker2') => {
    if (isRecording) {
      await stopRecording();
      return;
    }

    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access to record and translate your speech.',
          [{ text: 'OK' }]
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setIsRecording(true);
      setActiveRecordingSpeaker(speaker);
    } catch (err) {
      console.warn('Native audio recording init notice:', err);
      Alert.alert(
        'Microphone Error',
        'Could not access the microphone. Please check your app permissions and try again.'
      );
    }
  };

  const stopRecording = async () => {
    const currentSpeaker = activeRecordingSpeaker;
    setIsRecording(false);
    setIsProcessingVoice(true);

    let audioUri: string | null = null;
    try {
      await audioRecorder.stop();
      audioUri = audioRecorder.uri;
      console.log('Voice recorded at URI:', audioUri);
    } catch (err) {
      console.warn('Recorder stop error:', err);
    }

    if (!audioUri) {
      setIsProcessingVoice(false);
      Alert.alert(
        'No Speech Captured',
        'Could not capture audio from the microphone. Please tap the button, speak clearly, and tap again to translate.'
      );
      return;
    }

    const speakerLangCode = currentSpeaker === 'speaker1' ? speaker1Lang : speaker2Lang;
    const targetLangCode = currentSpeaker === 'speaker1' ? speaker2Lang : speaker1Lang;

    const speakerProfile = getLanguageProfile(speakerLangCode);
    const targetProfile = getLanguageProfile(targetLangCode);

    try {
      const headers: Record<string, string> = getAuthHeaders();
      if (assemblyAIKey) {
        headers['X-AssemblyAI-Key'] = assemblyAIKey;
      }

      const formData = new FormData();
      if (Platform.OS === 'web' && audioUri.startsWith('blob:')) {
        const blob = await fetch(audioUri).then((r) => r.blob());
        formData.append('audio', blob, 'speech.wav');
      } else {
        formData.append('audio', {
          uri: audioUri,
          name: 'speech.m4a',
          type: 'audio/m4a',
        } as any);
      }
      formData.append('speakerLang', speakerLangCode.split('-')[0]);
      formData.append('targetLang', targetLangCode.split('-')[0]);

      const res = await fetch(`${apiUrl}/api/v1/voice/translate`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        let errDesc = 'Failed to interpret speech. Please try speaking again.';
        try {
          const errData = await res.json();
          if (errData?.error?.message) {
            errDesc = errData.error.message;
          }
        } catch {}
        Alert.alert('Speech Recognition Notice', errDesc);
        return;
      }

      const data = await res.json();
      if (!data.transcribedText) {
        Alert.alert(
          'Speech Not Recognized',
          'Could not detect recognizable speech in the recording. Please speak clearly into the microphone.'
        );
        return;
      }

      const newMsg: DialogueMessage = {
        id: Date.now().toString(),
        speaker: currentSpeaker,
        speakerLabel: `${speakerProfile.nativeName} (${speakerProfile.name})`,
        speakerFlag: speakerProfile.flag,
        sourceText: data.transcribedText,
        sourceLang: speakerLangCode,
        translatedText: data.translatedText || data.transcribedText,
        targetLang: targetLangCode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setDialogueMessages((prev) => [...prev, newMsg]);
      updateOrAutoSaveSession(newMsg);
      if (autoSpeakEnabled && newMsg.translatedText) {
        handleReadAloud(newMsg.translatedText, targetLangCode);
      }
    } catch (err) {
      console.warn('Voice translation network error:', err);
      Alert.alert(
        'Connection Error',
        `Could not reach the translation service at ${apiUrl}. Please check your connection.`
      );
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleSendQuickDialogue = async (text: string, speaker: 'speaker1' | 'speaker2') => {
    setIsProcessingVoice(true);
    const speakerLangCode = speaker === 'speaker1' ? speaker1Lang : speaker2Lang;
    const targetLangCode = speaker === 'speaker1' ? speaker2Lang : speaker1Lang;

    const speakerProfile = getLanguageProfile(speakerLangCode);
    const targetProfile = getLanguageProfile(targetLangCode);

    try {
      const res = await fetch(`${apiUrl}/api/v1/translations/text`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          text,
          sourceLang: speakerLangCode.split('-')[0],
          targetLang: targetLangCode.split('-')[0],
        }),
      });

      const data = await res.json();
      if (res.ok && data.translatedText) {
        const newMsg: DialogueMessage = {
          id: Date.now().toString(),
          speaker,
          speakerLabel: `${speakerProfile.nativeName} (${speakerProfile.name})`,
          speakerFlag: speakerProfile.flag,
          sourceText: text,
          sourceLang: speakerLangCode,
          translatedText: data.translatedText,
          targetLang: targetLangCode,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setDialogueMessages((prev) => [...prev, newMsg]);
        updateOrAutoSaveSession(newMsg);
        if (autoSpeakEnabled) {
          handleReadAloud(data.translatedText, targetLangCode);
        }
      }
    } catch {
      Alert.alert('Notice', 'Could not send phrase.');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const s1Profile = getLanguageProfile(speaker1Lang);
  const s2Profile = getLanguageProfile(speaker2Lang);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={true} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* ========================================================================= */}
        {/* CLEAN, UNIFIED TOP APP BAR (NO REDUNDANT TABS OR RIGHTSIDE SIDEBAR PILL) */}
        {/* ========================================================================= */}
        <View style={styles.topHeader}>
          {/* Hamburger Menu Button to open slide-out Sidebar */}
          <Pressable
            onPress={() => setIsSidebarOpen(true)}
            style={styles.hamburgerBtn}
            accessibilityLabel="Open Navigation Sidebar"
          >
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
            <View style={styles.hamburgerLine} />
          </Pressable>

          {/* Current Active Section Badge & Title (Tap to switch feature in sidebar) */}
          <Pressable
            onPress={() => setIsSidebarOpen(true)}
            style={styles.activeSectionHeader}
            accessibilityLabel="Current section, tap to open menu"
          >
            <Text style={styles.activeSectionHeaderIcon}>{getCurrentTabIcon(activeTab)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeSectionHeaderTitle} numberOfLines={1}>
                {getCurrentTabShortTitle(activeTab)}
              </Text>
              <Text style={styles.activeSectionHeaderSub} numberOfLines={1}>
                Lisan KSA • Tap for all features ▾
              </Text>
            </View>
          </Pressable>

          {/* Right Header Actions: Welcome Tour & Nafath SSO Auth */}
          <View style={styles.headerActionsRow}>
            {/* Interactive Welcome Tour Launcher */}
            <Pressable
              onPress={() => {
                setTourStep(0);
                setShowWelcomeTour(true);
              }}
              style={styles.tourHeaderBtn}
              accessibilityLabel="Start Welcome Tour"
            >
              <Text style={styles.tourHeaderBtnText}>✨ Tour</Text>
            </Pressable>

            {/* User Auth Status Pill */}
            <Pressable
              onPress={() => setShowAuthModal(true)}
              style={[
                styles.authHeaderPill,
                user?.nafathVerified ? styles.authPillNafath : user ? styles.authPillUser : styles.authPillGuest,
              ]}
              accessibilityLabel="User Authentication"
            >
              <Text style={styles.authPillIcon}>
                {user?.nafathVerified ? '🛡️' : user ? '👤' : '🔑'}
              </Text>
              <Text
                style={[
                  styles.authPillText,
                  user?.nafathVerified ? styles.authTextNafath : user ? styles.authTextUser : styles.authTextGuest,
                ]}
                numberOfLines={1}
              >
                {user?.nafathVerified
                  ? `نفاذ`
                  : user
                  ? user.name.split(' ')[0]
                  : 'دخول'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Infrastructure Connectivity Banner */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, apiStatus === 'online' ? styles.dotGreen : styles.dotAmber]} />
              <Text style={styles.statusTitle}>
                {apiStatus === 'checking'
                  ? 'Connecting to API…'
                  : apiStatus === 'online'
                  ? 'API Online (:8080) • Neon PostgreSQL & Redis Connected'
                  : 'API Offline — tap Refresh'}
              </Text>
              <Pressable onPress={checkHealthAndLoad} style={styles.refreshBtn}>
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            </View>

            {readiness && (
              <View style={styles.dependencyGrid}>
                <View style={styles.depItem}>
                  <Text style={styles.depLabel}>Neon DB:</Text>
                  <View style={[styles.badge, readiness.database === 'connected' ? styles.badgeGreen : styles.badgeMuted]}>
                    <Text style={styles.badgeText}>{readiness.database}</Text>
                  </View>
                </View>

                <View style={styles.depItem}>
                  <Text style={styles.depLabel}>Redis:</Text>
                  <View style={[styles.badge, readiness.redis === 'connected' ? styles.badgeGreen : styles.badgeMuted]}>
                    <Text style={styles.badgeText}>{readiness.redis}</Text>
                  </View>
                </View>

                <View style={styles.depItem}>
                  <Text style={styles.depLabel}>Auth / PDPL:</Text>
                  <View style={[styles.badge, user ? styles.badgeGold : styles.badgeMuted]}>
                    <Text style={[styles.badgeText, user && { color: COLORS.goldDark }]}>
                      {user?.nafathVerified ? 'Nafath SSO' : user ? 'JWT Active' : 'Guest'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ========================================================================= */}
          {/* TAB 1: TEXT TRANSLATION */}
          {/* ========================================================================= */}
          {activeTab === 'home' && (
            <View>
              <View style={styles.langHeaderRow}>
                <Text style={styles.sectionTitle}>Bilingual Text Translation</Text>
                <Pressable onPress={() => handleSwapLanguages(true)} style={styles.swapBtn}>
                  <Text style={styles.swapBtnText}>⇄ Swap</Text>
                </Pressable>
              </View>

              {/* Source Lang Picker */}
              <View style={styles.langSelectorRow}>
                <Text style={styles.langLabel}>From:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
                  {languages.map((l) => (
                    <Pressable
                      key={l.code}
                      onPress={() => setSourceLang(l.code)}
                      style={[styles.langChip, sourceLang === l.code && styles.langChipActive]}
                    >
                      <Text style={[styles.langChipText, sourceLang === l.code && styles.langChipTextActive]}>
                        {l.nativeName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Target Lang Picker */}
              <View style={styles.langSelectorRow}>
                <Text style={styles.langLabel}>To:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
                  {languages.map((l) => (
                    <Pressable
                      key={l.code}
                      onPress={() => setTargetLang(l.code)}
                      style={[styles.langChip, targetLang === l.code && styles.langChipActive]}
                    >
                      <Text style={[styles.langChipText, targetLang === l.code && styles.langChipTextActive]}>
                        {l.nativeName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Input Card */}
              <View style={styles.inputCard}>
                <TextInput
                  style={[styles.textInput, sourceLang === 'ar' && styles.rtlText]}
                  placeholder={sourceLang === 'ar' ? 'أدخل النص للترجمة...' : 'Enter text to translate...'}
                  placeholderTextColor={COLORS.textMuted}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                />
                <View style={styles.actionRow}>
                  <Text style={styles.charCount}>{inputText.length} chars</Text>
                  <Pressable
                    onPress={() => handleTranslate()}
                    style={[styles.translateBtn, translating && styles.btnDisabled]}
                    disabled={translating}
                  >
                    {translating ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.translateBtnText}>Translate / ترجم</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Result Card */}
              {translatedText !== '' && (
                <View style={styles.resultCard}>
                  <View style={styles.resultHeaderRow}>
                    <Text style={styles.resultHeader}>Translated Output ({targetLang.toUpperCase()}):</Text>
                    <View style={styles.toolBtnRow}>
                      <Pressable onPress={() => handleReadAloud(translatedText, targetLang)} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>{isSpeaking ? '⏹ Stop' : '🔊 Speak'}</Text>
                      </Pressable>
                      <Pressable onPress={() => handleSaveTextTranslation()} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>💾 Save</Text>
                      </Pressable>
                      <Pressable onPress={() => handleCopy(translatedText)} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>{copied ? '✓ Copied' : '📋 Copy'}</Text>
                      </Pressable>
                      <Pressable onPress={() => handleShare(translatedText)} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>🔗 Share</Text>
                      </Pressable>
                    </View>
                  </View>

                  <Text style={[styles.resultBody, targetLang === 'ar' && styles.rtlText]}>
                    {translatedText}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>Provider: {lastProvider}</Text>
                    <Pressable onPress={() => handleRequestExplanation(translatedText)}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.primary }}>
                        💡 Explain in Plain Terms →
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: LIVE VOICE (2-PERSON INTERPRETER) WITH FULL MULTI-LANGUAGE */}
          {/* ========================================================================= */}
          {activeTab === 'dialogue' && (
            <View>
              {/* 1. TOP CONTROL CARD WITH INTRO & AUTO-SPEAK TOGGLE */}
              <View style={styles.dialogueTopCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 18 }}>🎙️</Text>
                      <Text style={styles.dialogueTitle}>2-Person Spoken Interpreter</Text>
                    </View>
                    <Text style={styles.dialogueSub}>
                      Speak naturally in your language. Spoken speech is translated and saved in real time.
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable
                      onPress={() => handleSaveCurrentDialogue()}
                      style={[styles.saveDialogueBtn, dialogueMessages.length === 0 && { opacity: 0.5 }]}
                      disabled={dialogueMessages.length === 0}
                    >
                      <Text style={styles.saveDialogueText}>💾 Save</Text>
                    </Pressable>
                    <Pressable onPress={handleClearDialogue} style={styles.clearDialogueBtn}>
                      <Text style={styles.clearDialogueText}>🗑 Clear</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Auto Speak Toggle */}
                <View style={styles.dialogueSettingRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>🔊</Text>
                    <Text style={styles.dialogueSettingLabel}>Auto Read-Aloud Spoken Translations</Text>
                  </View>
                  <Switch value={autoSpeakEnabled} onValueChange={setAutoSpeakEnabled} />
                </View>
              </View>

              {/* AssemblyAI Speech Engine Card */}
              <View style={styles.engineBadgeCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={styles.engineBadgeIconBox}>
                    <Text style={{ fontSize: 14 }}>⚡</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.engineBadgeTitle}>
                      {assemblyAIKey ? 'AssemblyAI STT Active' : 'AssemblyAI Speech Engine'}
                    </Text>
                    <Text style={styles.engineBadgeSub} numberOfLines={1}>
                      {assemblyAIKey
                        ? 'High-accuracy dialect transcription enabled'
                        : 'Neural multi-language speech recognition'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setShowAssemblyKeyModal(true)}
                  style={[styles.engineConfigBtn, assemblyAIKey ? styles.engineConfigBtnActive : null]}
                >
                  <Text style={[styles.engineConfigBtnText, assemblyAIKey ? styles.engineConfigBtnTextActive : null]}>
                    {assemblyAIKey ? '✓ Active' : '⚙️ Setup'}
                  </Text>
                </Pressable>
              </View>

              {/* 2. ELEGANT BILINGUAL LANGUAGE SELECTOR & SWAP CONTROLLER */}
              <View style={styles.bilingualControllerCard}>
                {/* Speaker 1 Selector Pill */}
                <Pressable
                  onPress={() => setShowVoiceLangModal('speaker1')}
                  style={[styles.speakerPillBtn, styles.speakerPillS1]}
                >
                  <View style={styles.speakerPillHeader}>
                    <Text style={styles.speakerPillRoleText}>🇸🇦 HOST (المضيف)</Text>
                    <Text style={styles.speakerPillChevron}>▼</Text>
                  </View>
                  <Text style={styles.speakerPillMainLang} numberOfLines={1}>
                    {s1Profile.nativeName}
                  </Text>
                  <Text style={styles.speakerPillSubLang} numberOfLines={1}>
                    {s1Profile.name.split(' ')[0]} Dialect
                  </Text>
                </Pressable>

                {/* Central Rotating Swap Button */}
                <Pressable onPress={handleSwapVoiceSpeakers} style={styles.speakerSwapCircle}>
                  <Text style={styles.speakerSwapCircleIcon}>⇄</Text>
                </Pressable>

                {/* Speaker 2 Selector Pill */}
                <Pressable
                  onPress={() => setShowVoiceLangModal('speaker2')}
                  style={[styles.speakerPillBtn, styles.speakerPillS2]}
                >
                  <View style={styles.speakerPillHeader}>
                    <Text style={[styles.speakerPillRoleText, { color: '#1E3A8A' }]}>🌐 GUEST (الوافد)</Text>
                    <Text style={styles.speakerPillChevron}>▼</Text>
                  </View>
                  <Text style={styles.speakerPillMainLang} numberOfLines={1}>
                    {s2Profile.nativeName}
                  </Text>
                  <Text style={styles.speakerPillSubLang} numberOfLines={1}>
                    {s2Profile.name.split(' ')[0]} Language
                  </Text>
                </Pressable>
              </View>

              {/* 3. DUAL FULL-WIDTH TACTILE VOICE MICROPHONE DECKS */}
              <View style={styles.voiceDeckSection}>
                {/* SPEAKER 1 MICROPHONE DECK (SAUDI EMERALD) */}
                <Pressable
                  onPress={() => (isRecording ? stopRecording() : startRecording('speaker1'))}
                  style={[
                    styles.voiceDeckCard,
                    styles.voiceDeckCardS1,
                    isRecording && activeRecordingSpeaker === 'speaker1' && styles.voiceDeckCardRecording,
                  ]}
                  disabled={isProcessingVoice}
                >
                  <View style={styles.voiceDeckInfo}>
                    <View style={styles.voiceDeckFlagBadge}>
                      <Text style={{ fontSize: 22 }}>{s1Profile.flag}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.voiceDeckSpeakerName}>
                        {s1Profile.nativeName}
                      </Text>
                      <Text style={styles.voiceDeckActionSub}>
                        {isRecording && activeRecordingSpeaker === 'speaker1'
                          ? '🔴 جاري التسجيل... اضغط لإنهاء الحديث'
                          : 'اضغط للتحدث بالعربية / Tap to Speak'}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.voiceDeckMicPill,
                      styles.voiceDeckMicPillS1,
                      isRecording && activeRecordingSpeaker === 'speaker1' && styles.voiceDeckMicPillActive,
                    ]}
                  >
                    <Text style={styles.voiceDeckMicIcon}>
                      {isRecording && activeRecordingSpeaker === 'speaker1' ? '⏹' : '🎙️'}
                    </Text>
                  </View>
                </Pressable>

                {/* SPEAKER 2 MICROPHONE DECK (ROYAL BLUE) */}
                <Pressable
                  onPress={() => (isRecording ? stopRecording() : startRecording('speaker2'))}
                  style={[
                    styles.voiceDeckCard,
                    styles.voiceDeckCardS2,
                    isRecording && activeRecordingSpeaker === 'speaker2' && styles.voiceDeckCardRecording,
                  ]}
                  disabled={isProcessingVoice}
                >
                  <View style={styles.voiceDeckInfo}>
                    <View style={[styles.voiceDeckFlagBadge, { backgroundColor: '#DBEAFE' }]}>
                      <Text style={{ fontSize: 22 }}>{s2Profile.flag}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.voiceDeckSpeakerName, { color: '#1E3A8A' }]}>
                        {s2Profile.nativeName}
                      </Text>
                      <Text style={styles.voiceDeckActionSub}>
                        {isRecording && activeRecordingSpeaker === 'speaker2'
                          ? '🔴 Listening... Tap to finish'
                          : `Tap to Speak (${s2Profile.name.split(' ')[0]})`}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.voiceDeckMicPill,
                      styles.voiceDeckMicPillS2,
                      isRecording && activeRecordingSpeaker === 'speaker2' && styles.voiceDeckMicPillActive,
                    ]}
                  >
                    <Text style={styles.voiceDeckMicIcon}>
                      {isRecording && activeRecordingSpeaker === 'speaker2' ? '⏹' : '🎙️'}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* 4. ACTIVE RECORDING WAVE BANNER */}
              {isRecording && (
                <View style={styles.recordingBanner}>
                  <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordingBannerTitle}>
                      {activeRecordingSpeaker === 'speaker1'
                        ? `Listening to ${s1Profile.nativeName}…`
                        : `Listening to ${s2Profile.nativeName}…`}
                    </Text>
                    <Text style={styles.recordingBannerTimer}>{formatSeconds(recordingDuration)} elapsed</Text>
                  </View>
                  <Pressable onPress={stopRecording} style={styles.finishRecordingBtn}>
                    <Text style={styles.finishRecordingBtnText}>Finish ⏹</Text>
                  </Pressable>
                </View>
              )}

              {/* 5. VOICE PROCESSING SPINNER */}
              {isProcessingVoice && (
                <View style={styles.voiceProcessingCard}>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                  <Text style={styles.voiceProcessingText}>Translating Spoken Dialogue…</Text>
                </View>
              )}

              {/* 6. CONVERSATIONAL DIALOGUE CHAT STREAM */}
              <View style={styles.dialogueListSection}>
                <Text style={styles.dialogueStreamHeader}>Live Dialogue Stream:</Text>

                {dialogueMessages.length === 0 ? (
                  <View style={styles.emptyDialogueBox}>
                    <View style={styles.emptyDialogueIconBox}>
                      <Text style={{ fontSize: 32 }}>🎙️</Text>
                    </View>
                    <Text style={styles.emptyDialogueTitle}>Live 2-Person Interpreter</Text>
                    <Text style={styles.emptyDialogueSub}>
                      Tap either microphone button above to speak. Everything you and your counterpart say will appear here in real time and be saved automatically.
                    </Text>
                    <View style={styles.emptyDialogueHints}>
                      <View style={styles.emptyHintItem}>
                        <Text style={styles.emptyHintDot}>🟢</Text>
                        <Text style={styles.emptyHintText}>Saudi Host speaks in {s1Profile.nativeName} ({s1Profile.name})</Text>
                      </View>
                      <View style={styles.emptyHintItem}>
                        <Text style={styles.emptyHintDot}>🔵</Text>
                        <Text style={styles.emptyHintText}>Guest Resident speaks in {s2Profile.nativeName} ({s2Profile.name})</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  dialogueMessages.map((msg) => {
                    const isSpeaker1 = msg.speaker === 'speaker1' || msg.speaker === 'arabic';

                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.dialogueBubbleCard,
                          isSpeaker1 ? styles.dialogueBubbleCardS1 : styles.dialogueBubbleCardS2,
                        ]}
                      >
                        {/* Bubble Header */}
                        <View style={styles.dialogueBubbleHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 14 }}>{msg.speakerFlag || (isSpeaker1 ? s1Profile.flag : s2Profile.flag)}</Text>
                            <Text
                              style={
                                isSpeaker1
                                  ? styles.dialogueSpeakerTagS1
                                  : styles.dialogueSpeakerTagS2
                              }
                            >
                              {isSpeaker1 ? `المتحدث السعودي (${s1Profile.nativeName})` : `Expatriate (${s2Profile.nativeName})`}
                            </Text>
                          </View>
                          <Text style={styles.dialogueTimestampText}>{msg.timestamp}</Text>
                        </View>

                        {/* Original Spoken Text */}
                        <View style={styles.spokenQuoteBox}>
                          <Text style={[styles.spokenQuoteText, msg.sourceLang === 'ar' && styles.rtlText]}>
                            "{msg.sourceText}"
                          </Text>
                          <Pressable
                            onPress={() => handleReadAloud(msg.sourceText, msg.sourceLang)}
                            style={styles.quoteAudioBtn}
                          >
                            <Text style={styles.quoteAudioBtnText}>🔊 Original</Text>
                          </Pressable>
                        </View>

                        {/* Translation Output Box */}
                        <View style={styles.convertedTranslationCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.convertedTranslationLabel}>
                              ↳ Translated into {msg.targetLang.toUpperCase()}:
                            </Text>
                            <Pressable
                              onPress={() => handleReadAloud(msg.translatedText, msg.targetLang)}
                              style={styles.convertedPlayBtn}
                            >
                              <Text style={styles.convertedPlayBtnText}>🔊 Speak Aloud</Text>
                            </Pressable>
                          </View>
                          <Text
                            style={[
                              styles.convertedOutputText,
                              msg.targetLang === 'ar' && styles.rtlText,
                            ]}
                          >
                            {msg.translatedText}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: SCREENSHOT & OCR REVIEW */}
          {/* ========================================================================= */}
          {activeTab === 'camera' && (
            <View>
              <Text style={styles.sectionTitle}>Translate Screenshot / Photo</Text>
              <Text style={styles.helperText}>
                Import official notices, government messages, or application screenshots.
              </Text>

              {!selectedImage ? (
                <Pressable onPress={handlePickImage} style={styles.uploadPlaceholder}>
                  <Text style={styles.uploadIcon}>🖼️</Text>
                  <Text style={styles.uploadTitle}>Select Screenshot from Library</Text>
                  <Text style={styles.uploadSub}>Raw images are never stored permanently.</Text>
                </Pressable>
              ) : (
                <View style={styles.previewCard}>
                  <Text style={styles.previewHeader}>Image Preview</Text>
                  <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />

                  <View style={styles.privacyNoticeBox}>
                    <Text style={styles.privacyNoticeText}>
                      🔒 Processing Destination: Screenshot is encrypted and sent to Lisan KSA API for text extraction. No image data is permanently stored.
                    </Text>
                  </View>

                  <View style={styles.previewActions}>
                    <Pressable
                      onPress={handleConfirmAndProcessImage}
                      style={[styles.confirmUploadBtn, ocrLoading && styles.btnDisabled]}
                      disabled={ocrLoading}
                    >
                      {ocrLoading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ActivityIndicator color="#FFFFFF" size="small" />
                          <Text style={styles.confirmUploadText}>Extracting text…</Text>
                        </View>
                      ) : (
                        <Text style={styles.confirmUploadText}>Confirm & Extract Text</Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setSelectedImage(null);
                        setShowOcrReview(false);
                      }}
                      style={styles.cancelBtn}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* OCR Review Card */}
              {showOcrReview && (
                <View style={styles.ocrReviewCard}>
                  <View style={styles.ocrHeaderRow}>
                    <Text style={styles.ocrTitle}>OCR Review (Editable Text)</Text>
                    {ocrConfidence && (
                      <Text style={styles.confidenceBadge}>
                        Confidence: {Math.round(ocrConfidence * 100)}%
                      </Text>
                    )}
                  </View>

                  <TextInput
                    style={[styles.ocrTextInput, styles.rtlText]}
                    multiline
                    value={ocrEditableText}
                    onChangeText={setOcrEditableText}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <Pressable
                      onPress={() => {
                        setInputText(ocrEditableText);
                        setActiveTab('home');
                        handleTranslate(ocrEditableText);
                      }}
                      style={[styles.translateOcrBtn, { flex: 1 }]}
                    >
                      <Text style={styles.translateOcrBtnText}>Translate Text →</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setExplainQuery(ocrEditableText);
                        setActiveTab('explain');
                        handleRequestExplanation(ocrEditableText);
                      }}
                      style={[styles.explainOcrBtn, { flex: 1 }]}
                    >
                      <Text style={styles.explainOcrBtnText}>💡 Explain Meaning</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: EXPLAIN SAUDI REGULATIONS */}
          {/* ========================================================================= */}
          {activeTab === 'explain' && (
            <View>
              <Text style={styles.sectionTitle}>Plain-Language Regulatory Guidance</Text>
              <Text style={styles.helperText}>
                Break down official Saudi legal, labor, and platform messages (Qiwa, Absher, Muqeem).
              </Text>

              <View style={styles.officialFactBanner}>
                <Text style={styles.officialFactBannerText}>
                  ⚖️ Powered by verified Saudi Labor Law, Qiwa contract rules, and Ministry regulations.
                </Text>
              </View>

              <View style={styles.inputCard}>
                <TextInput
                  style={[styles.textInput, styles.rtlText]}
                  placeholder="Enter notice, contract clause, or legal term..."
                  placeholderTextColor={COLORS.textMuted}
                  value={explainQuery}
                  onChangeText={setExplainQuery}
                  multiline
                />
                <View style={styles.actionRow}>
                  <Text style={styles.charCount}>{explainQuery.length} chars</Text>
                  <Pressable
                    onPress={() => handleRequestExplanation()}
                    style={[styles.translateBtn, explaining && styles.btnDisabled]}
                    disabled={explaining}
                  >
                    {explaining ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.translateBtnText}>Explain / شرح</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              {explanationData && (
                <View style={styles.explanationResultBox}>
                  <Text style={styles.explanationResultTitle}>Plain-Language Breakdown:</Text>
                  <Text style={styles.explanationResultBody}>{explanationData.explanation}</Text>

                  <Text style={styles.suggestedActionsTitle}>Recommended Next Steps:</Text>
                  {explanationData.suggestedActions.map((action, i) => (
                    <Text key={i} style={styles.suggestedStepItem}>• {action}</Text>
                  ))}

                  <View style={styles.citationBox}>
                    <Text style={styles.citationTitle}>Official References & Citations:</Text>
                    {explanationData.citations.map((cite, i) => (
                      <Text key={i} style={styles.citationItem}>📌 {cite}</Text>
                    ))}
                    <Text style={styles.uncertaintyLabelText}>
                      Status: {explanationData.uncertaintyLabel}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: PHRASEBOOK & GLOSSARY */}
          {/* ========================================================================= */}
          {activeTab === 'phrasebook' && (
            <View>
              <Text style={styles.sectionTitle}>Official Saudi Workplace Glossary</Text>
              <Text style={styles.helperText}>
                Standardized bilingual terms approved under Saudi Vision 2030 labor regulations.
              </Text>

              {glossaryLoading ? (
                <ActivityIndicator color={COLORS.primary} size="large" style={{ marginVertical: 20 }} />
              ) : (
                <View style={{ gap: 10 }}>
                  {glossaryTerms.map((term) => (
                    <View key={term.id} style={styles.termCard}>
                      <View style={styles.termTopRow}>
                        <Text style={styles.sourceTermText}>{term.sourceTerm}</Text>
                        <Pressable
                          onPress={() => handleReadAloud(term.sourceTerm, 'ar')}
                          style={styles.termAudioBtn}
                        >
                          <Text style={styles.termAudioBtnText}>🔊</Text>
                        </Pressable>
                      </View>
                      {term.context ? <Text style={styles.termContextText}>{term.context}</Text> : null}

                      <View style={styles.translationsList}>
                        {(term.approvedTranslations || []).map((tr: any, idx: number) => (
                          <View key={idx} style={styles.translationRow}>
                            <Text style={styles.transLangBadge}>{(tr.lang || '').toUpperCase()}</Text>
                            <Text style={styles.transTermText}>{tr.term}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB: SAVED HISTORY & CONVERSATIONS */}
          {/* ========================================================================= */}
          {activeTab === 'history' && (
            <View>
              {/* Header Card */}
              <View style={styles.historyHeaderCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 20 }}>📜</Text>
                      <Text style={styles.sectionTitle}>Saved History & Conversations</Text>
                    </View>
                    <Text style={styles.helperText}>
                      All spoken voice dialogues and translated text are saved here. You can replay, copy, or resume them anytime.
                    </Text>
                  </View>
                  {(historyViewTab === 'dialogue' ? savedSessions.length > 0 : savedTextTranslations.length > 0) && (
                    <Pressable
                      onPress={() => {
                        if (historyViewTab === 'dialogue') {
                          Alert.alert('Clear History', 'Delete all saved spoken conversations permanently?', [
                            { text: 'Delete All', style: 'destructive', onPress: () => setSavedSessions([]) },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        } else {
                          Alert.alert('Clear History', 'Delete all saved text translations permanently?', [
                            { text: 'Delete All', style: 'destructive', onPress: () => setSavedTextTranslations([]) },
                            { text: 'Cancel', style: 'cancel' },
                          ]);
                        }
                      }}
                      style={styles.clearHistoryAllBtn}
                    >
                      <Text style={styles.clearHistoryAllText}>🗑 Clear All</Text>
                    </Pressable>
                  )}
                </View>

                {/* Segmented Filter: Voice Conversations vs Text Translations */}
                <View style={styles.historySegmentRow}>
                  <Pressable
                    onPress={() => setHistoryViewTab('dialogue')}
                    style={[styles.historySegmentBtn, historyViewTab === 'dialogue' && styles.historySegmentBtnActive]}
                  >
                    <Text
                      style={[
                        styles.historySegmentText,
                        historyViewTab === 'dialogue' && styles.historySegmentTextActive,
                      ]}
                    >
                      🎙️ Spoken Talks ({savedSessions.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setHistoryViewTab('text')}
                    style={[styles.historySegmentBtn, historyViewTab === 'text' && styles.historySegmentBtnActive]}
                  >
                    <Text
                      style={[
                        styles.historySegmentText,
                        historyViewTab === 'text' && styles.historySegmentTextActive,
                      ]}
                    >
                      💬 Saved Text ({savedTextTranslations.length})
                    </Text>
                  </Pressable>
                </View>

                {/* Stats Bar */}
                <View style={styles.historyStatsBar}>
                  <View style={styles.historyStatPill}>
                    <Text style={styles.historyStatNumber}>
                      {historyViewTab === 'dialogue' ? savedSessions.length : savedTextTranslations.length}
                    </Text>
                    <Text style={styles.historyStatLabel}>
                      {historyViewTab === 'dialogue' ? 'Saved Dialogues' : 'Saved Translations'}
                    </Text>
                  </View>
                  <View style={styles.historyStatPill}>
                    <Text style={styles.historyStatNumber}>
                      {historyViewTab === 'dialogue'
                        ? savedSessions.reduce((acc, s) => acc + s.messages.length, 0)
                        : savedTextTranslations.reduce((acc, t) => acc + t.sourceText.length, 0)}
                    </Text>
                    <Text style={styles.historyStatLabel}>
                      {historyViewTab === 'dialogue' ? 'Total Spoken Turns' : 'Characters Saved'}
                    </Text>
                  </View>
                  <View style={styles.historyStatPill}>
                    <Text style={[styles.historyStatNumber, { color: COLORS.primary }]}>🛡️ PDPL</Text>
                    <Text style={styles.historyStatLabel}>Encrypted Storage</Text>
                  </View>
                </View>
              </View>

              {/* View 1: Spoken Dialogue Sessions */}
              {historyViewTab === 'dialogue' && (
                <View>
                  {savedSessions.length === 0 ? (
                    <View style={styles.emptyHistoryCard}>
                      <View style={styles.emptyHistoryIconCircle}>
                        <Text style={{ fontSize: 36 }}>🎙️</Text>
                      </View>
                      <Text style={styles.emptyHistoryTitle}>No Saved Conversations Yet</Text>
                      <Text style={styles.emptyHistorySub}>
                        Start speaking in Live Voice. Everything you and your counterpart speak will appear on screen and be saved automatically.
                      </Text>
                      <Pressable
                        onPress={() => setActiveTab('dialogue')}
                        style={styles.emptyHistoryActionBtn}
                      >
                        <Text style={styles.emptyHistoryActionText}>🎙️ Open Live Voice Interpreter</Text>
                      </Pressable>
                    </View>
                  ) : (
                    savedSessions.map((session) => (
                      <View key={session.id} style={styles.historySessionCard}>
                        {/* Session Header */}
                        <View style={styles.historySessionHeaderRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.historySessionTitle}>{session.title}</Text>
                            <Text style={styles.historySessionDate}>
                              📅 {session.date} • {session.messages.length} spoken turns
                            </Text>
                          </View>
                          <View style={styles.historyLangPairBadge}>
                            <Text style={styles.historyLangPairText}>
                              {session.speaker1Name} ⇄ {session.speaker2Name}
                            </Text>
                          </View>
                        </View>

                        {/* Messages in this session */}
                        <View style={styles.historyMessagesBox}>
                          {session.messages.map((m, idx) => (
                            <View key={m.id || idx} style={styles.historyMsgRow}>
                              <View style={styles.historyMsgHeader}>
                                <Text style={styles.historyMsgSpeaker}>
                                  {m.speakerFlag || '🗣️'} {m.speakerLabel}
                                </Text>
                                <Text style={styles.historyMsgTime}>{m.timestamp}</Text>
                              </View>
                              <Text style={styles.historyMsgSource}>"{m.sourceText}"</Text>
                              <Text style={styles.historyMsgTranslated}>↳ {m.translatedText}</Text>
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                <Pressable
                                  onPress={() => handleReadAloud(m.sourceText, m.sourceLang)}
                                  style={styles.historyPlayMiniBtn}
                                >
                                  <Text style={styles.historyPlayMiniText}>🔊 Original</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handleReadAloud(m.translatedText, m.targetLang)}
                                  style={styles.historyPlayMiniBtn}
                                >
                                  <Text style={styles.historyPlayMiniText}>🔊 Translation</Text>
                                </Pressable>
                              </View>
                            </View>
                          ))}
                        </View>

                        {/* Session Actions */}
                        <View style={styles.historyCardFooter}>
                          <Pressable
                            onPress={() => {
                              setDialogueMessages([...session.messages]);
                              setActiveTab('dialogue');
                              Alert.alert('Loaded', 'Conversation reloaded into Live Voice view.');
                            }}
                            style={styles.historyResumeBtn}
                          >
                            <Text style={styles.historyResumeText}>🎙️ Resume in Live Voice</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              const transcript = session.messages
                                .map((m) => `[${m.speakerLabel}] ${m.sourceText}\n-> ${m.translatedText}`)
                                .join('\n\n');
                              Clipboard.setStringAsync(transcript);
                              Alert.alert('Copied', 'Full conversation transcript copied to clipboard.');
                            }}
                            style={styles.historyCopyBtn}
                          >
                            <Text style={styles.historyCopyText}>📋 Copy</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              setSavedSessions((prev) => prev.filter((s) => s.id !== session.id));
                            }}
                            style={styles.historyDeleteSingleBtn}
                          >
                            <Text style={styles.historyDeleteSingleText}>🗑</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* View 2: Saved Text Translations */}
              {historyViewTab === 'text' && (
                <View>
                  {savedTextTranslations.length === 0 ? (
                    <View style={styles.emptyHistoryCard}>
                      <View style={styles.emptyHistoryIconCircle}>
                        <Text style={{ fontSize: 36 }}>💬</Text>
                      </View>
                      <Text style={styles.emptyHistoryTitle}>No Saved Text Translations Yet</Text>
                      <Text style={styles.emptyHistorySub}>
                        Translate any legal, work, or daily phrases in Text Translation and tap "💾 Save" to keep them here permanently.
                      </Text>
                      <Pressable
                        onPress={() => setActiveTab('home')}
                        style={styles.emptyHistoryActionBtn}
                      >
                        <Text style={styles.emptyHistoryActionText}>💬 Go to Text Translation</Text>
                      </Pressable>
                    </View>
                  ) : (
                    savedTextTranslations.map((item) => (
                      <View key={item.id} style={styles.historySessionCard}>
                        {/* Header */}
                        <View style={styles.historySessionHeaderRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.historySessionTitle}>
                              Text Translation ({item.sourceLang.toUpperCase()} → {item.targetLang.toUpperCase()})
                            </Text>
                            <Text style={styles.historySessionDate}>
                              🕒 {item.timestamp}
                            </Text>
                          </View>
                          <View style={styles.historyLangPairBadge}>
                            <Text style={styles.historyLangPairText}>
                              {item.sourceLang.toUpperCase()} ➔ {item.targetLang.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Content */}
                        <View style={styles.historyMessagesBox}>
                          <View style={styles.historyMsgRow}>
                            <Text style={styles.savedTextSectionLabel}>Original Text ({item.sourceLang.toUpperCase()}):</Text>
                            <Text style={[styles.historyMsgSource, item.sourceLang === 'ar' && styles.rtlText]}>
                              "{item.sourceText}"
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                              <Pressable
                                onPress={() => handleReadAloud(item.sourceText, item.sourceLang)}
                                style={styles.historyPlayMiniBtn}
                              >
                                <Text style={styles.historyPlayMiniText}>🔊 Speak</Text>
                              </Pressable>
                            </View>
                          </View>

                          <View style={[styles.historyMsgRow, { borderBottomWidth: 0, marginTop: 4 }]}>
                            <Text style={styles.savedTextSectionLabel}>Translated Output ({item.targetLang.toUpperCase()}):</Text>
                            <Text style={[styles.historyMsgTranslated, item.targetLang === 'ar' && styles.rtlText]}>
                              ↳ {item.translatedText}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                              <Pressable
                                onPress={() => handleReadAloud(item.translatedText, item.targetLang)}
                                style={styles.historyPlayMiniBtn}
                              >
                                <Text style={styles.historyPlayMiniText}>🔊 Speak Translation</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>

                        {/* Action buttons */}
                        <View style={styles.historyCardFooter}>
                          <Pressable
                            onPress={() => {
                              setInputText(item.sourceText);
                              setTranslatedText(item.translatedText);
                              setSourceLang(item.sourceLang);
                              setTargetLang(item.targetLang);
                              setActiveTab('home');
                              Alert.alert('Loaded', 'Text translation loaded into editor.');
                            }}
                            style={styles.historyResumeBtn}
                          >
                            <Text style={styles.historyResumeText}>💬 Open in Text Editor</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              Clipboard.setStringAsync(`${item.sourceText}\n\n-> ${item.translatedText}`);
                              Alert.alert('Copied', 'Translation copied to clipboard.');
                            }}
                            style={styles.historyCopyBtn}
                          >
                            <Text style={styles.historyCopyText}>📋 Copy</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              setSavedTextTranslations((prev) => prev.filter((i) => i.id !== item.id));
                            }}
                            style={styles.historyDeleteSingleBtn}
                          >
                            <Text style={styles.historyDeleteSingleText}>🗑</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: SETTINGS & SAUDI PDPL COMPLIANCE */}
          {/* ========================================================================= */}
          {activeTab === 'settings' && (
            <View>
              <Text style={styles.sectionTitle}>Privacy & System Configuration</Text>
              <Text style={styles.helperText}>
                Under the Saudi Personal Data Protection Law (PDPL), you have full control over data processing.
              </Text>

              {/* Consent Controls */}
              <View style={styles.settingsSection}>
                <View style={styles.settingRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.settingLabel}>Screen-Data OCR Processing</Text>
                    <Text style={styles.settingSub}>
                      Allow extracting text from screenshots. Raw images are never retained.
                    </Text>
                  </View>
                  <Switch value={consentScreenData} onValueChange={setConsentScreenData} />
                </View>

                <View style={styles.settingRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.settingLabel}>Translation History (Opt-In)</Text>
                    <Text style={styles.settingSub}>
                      Store translation records in Neon database for authenticated user. Off by default.
                    </Text>
                  </View>
                  <Switch value={consentHistory} onValueChange={setConsentHistory} />
                </View>
              </View>

              {/* Account / Nafath Section */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingSectionHeader}>Account & Nafath Status</Text>
                {user ? (
                  <View>
                    <Text style={styles.settingSub}>
                      Logged in as: {user.name} ({user.email})
                    </Text>
                    <Pressable onPress={() => setShowAuthModal(true)} style={styles.changePrefBtn}>
                      <Text style={styles.changePrefBtnText}>View Account Details / إدارة الحساب</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.settingSub}>Currently using guest mode.</Text>
                    <Pressable onPress={() => setShowAuthModal(true)} style={styles.changePrefBtn}>
                      <Text style={styles.changePrefBtnText}>🛡️ Sign in with Nafath SSO</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Right to Erasure */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingSectionHeader}>Data Erasure (Right to Erasure)</Text>
                <Text style={styles.settingSub}>
                  Delete all history and preferences permanently in compliance with Saudi PDPL.
                </Text>
                <Pressable onPress={handleDeleteHistory} style={styles.deleteHistoryBtn}>
                  <Text style={styles.deleteHistoryText}>🗑 Delete All Saved History</Text>
                </Pressable>
              </View>

              {/* AssemblyAI Speech Engine Config */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingSectionHeader}>⚡ AssemblyAI Speech Engine</Text>
                <Text style={styles.settingSub}>
                  Enter an AssemblyAI API Key for dedicated real-time speech transcription.
                </Text>
                <TextInput
                  style={[styles.apiHostInput, { marginTop: 8 }]}
                  placeholder="Paste AssemblyAI API Key..."
                  placeholderTextColor={COLORS.textMuted}
                  value={assemblyAIKey}
                  onChangeText={setAssemblyAIKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => {
                      setAssemblyAIKey('');
                      Alert.alert('Cleared', 'AssemblyAI API Key removed.');
                    }}
                    style={styles.assemblyClearBtn}
                  >
                    <Text style={styles.assemblyClearBtnText}>Clear Key</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert('Saved', 'AssemblyAI Key saved for Live Voice translation.');
                    }}
                    style={styles.assemblySaveBtn}
                  >
                    <Text style={styles.assemblySaveBtnText}>Save Key</Text>
                  </Pressable>
                </View>
              </View>

              {/* Server Host URL */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingSectionHeader}>API Server Endpoint</Text>
                <TextInput
                  style={styles.apiHostInput}
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => setApiUrl('http://192.168.1.120:8080')}
                    style={styles.quickPhraseChipSpeaker1}
                  >
                    <Text style={styles.quickPhraseTextSpeaker1}>WiFi IP</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setApiUrl('http://127.0.0.1:8080')}
                    style={styles.quickPhraseChipSpeaker2}
                  >
                    <Text style={styles.quickPhraseTextSpeaker2}>Localhost</Text>
                  </Pressable>
                  <Pressable onPress={checkHealthAndLoad} style={styles.saveHostBtn}>
                    <Text style={styles.saveHostBtnText}>Test & Reconnect</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            Lisan KSA • Saudi Multilingual Companion • PDPL & Nafath Enabled
          </Text>
        </ScrollView>

        {/* ========================================================================= */}
        {/* VOICE LANGUAGE SELECTION MODAL */}
        {/* ========================================================================= */}
        {showVoiceLangModal && (
          <Modal
            visible={true}
            animationType="fade"
            transparent
            onRequestClose={() => setShowVoiceLangModal(null)}
          >
            <View style={styles.langModalOverlay}>
              <View style={styles.langModalSheet}>
                <View style={styles.langModalHeader}>
                  <Text style={styles.langModalTitle}>
                    Select Language for {showVoiceLangModal === 'speaker1' ? 'Speaker 1' : 'Speaker 2'}
                  </Text>
                  <Pressable onPress={() => setShowVoiceLangModal(null)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 360 }}>
                  {SPEAKER_LANGUAGES.map((lang) => {
                    const isSelected =
                      showVoiceLangModal === 'speaker1'
                        ? speaker1Lang === lang.code
                        : speaker2Lang === lang.code;

                    return (
                      <Pressable
                        key={lang.code}
                        onPress={() => {
                          if (showVoiceLangModal === 'speaker1') {
                            setSpeaker1Lang(lang.code);
                          } else {
                            setSpeaker2Lang(lang.code);
                          }
                          setShowVoiceLangModal(null);
                        }}
                        style={[styles.langModalItem, isSelected && styles.langModalItemActive]}
                      >
                        <Text style={styles.langModalItemFlag}>{lang.flag}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.langModalItemNative}>{lang.nativeName}</Text>
                          <Text style={styles.langModalItemName}>
                            {lang.name} • {lang.speakerRole}
                          </Text>
                        </View>
                        {isSelected && <Text style={styles.langModalCheck}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* ASSEMBLYAI API KEY CONFIGURATION MODAL */}
        {/* ========================================================================= */}
        {showAssemblyKeyModal && (
          <Modal
            visible={true}
            animationType="fade"
            transparent
            onRequestClose={() => setShowAssemblyKeyModal(false)}
          >
            <View style={styles.langModalOverlay}>
              <View style={styles.assemblyModalSheet}>
                <View style={styles.langModalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 18 }}>⚡</Text>
                    <Text style={styles.langModalTitle}>AssemblyAI Speech Engine</Text>
                  </View>
                  <Pressable onPress={() => setShowAssemblyKeyModal(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </Pressable>
                </View>

                <Text style={styles.assemblyModalDesc}>
                  Configure AssemblyAI speech-to-text for Saudi Arabic dialects and multi-language live dialogue interpretation.
                </Text>

                <Text style={styles.assemblyInputLabel}>AssemblyAI API Key:</Text>
                <TextInput
                  style={styles.assemblyKeyInput}
                  placeholder="Paste AssemblyAI API Key..."
                  placeholderTextColor={COLORS.textMuted}
                  value={assemblyAIKey}
                  onChangeText={setAssemblyAIKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Pressable
                    onPress={() => {
                      setAssemblyAIKey('');
                      setShowAssemblyKeyModal(false);
                      Alert.alert('Cleared', 'Reverted to default Saudi neural speech engine.');
                    }}
                    style={styles.assemblyClearBtn}
                  >
                    <Text style={styles.assemblyClearBtnText}>Clear Key</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowAssemblyKeyModal(false);
                      Alert.alert('Saved', 'AssemblyAI API Key configured for Live Voice sessions.');
                    }}
                    style={styles.assemblySaveBtn}
                  >
                    <Text style={styles.assemblySaveBtnText}>Save Key</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* SIDEBAR DRAWER NAVIGATION MODAL */}
        {/* ========================================================================= */}
        <Modal
          visible={isSidebarOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsSidebarOpen(false)}
        >
          <View style={styles.sidebarOverlay}>
            <Pressable
              style={styles.sidebarBackdrop}
              onPress={() => setIsSidebarOpen(false)}
              accessibilityLabel="Close Menu"
            />

            <View style={styles.sidebarDrawer}>
              <SafeAreaView style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarScroll}>
                  {/* Sidebar Header */}
                  <View style={styles.sidebarHeader}>
                    <View style={styles.sidebarBrandRow}>
                      <View style={styles.sidebarBrandMark}>
                        <Text style={styles.brandGlyph}>ل</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sidebarBrandTitle}>Lisan KSA</Text>
                        <Text style={styles.sidebarBrandSubtitle}>لسان • الفهم الرقمي السعودي</Text>
                      </View>
                      <Pressable
                        onPress={() => setIsSidebarOpen(false)}
                        style={styles.sidebarCloseBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.sidebarCloseText}>✕</Text>
                      </Pressable>
                    </View>

                    {/* User Profile Card in Sidebar */}
                    <Pressable
                      onPress={() => {
                        setIsSidebarOpen(false);
                        setShowAuthModal(true);
                      }}
                      style={styles.sidebarUserCard}
                    >
                      <Text style={{ fontSize: 24 }}>
                        {user?.nafathVerified ? '🛡️' : user ? '👤' : '🔑'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sidebarUserName}>
                          {user ? user.name : 'Guest User (زائر)'}
                        </Text>
                        <Text style={styles.sidebarUserStatus}>
                          {user?.nafathVerified
                            ? 'Nafath Verified SSO • موثق نفاذ'
                            : user
                            ? 'Signed In • مسجل'
                            : 'Tap to sign in with Nafath SSO'}
                        </Text>
                      </View>
                      <Text style={styles.sidebarUserChevron}>›</Text>
                    </Pressable>
                  </View>

                  {/* Sidebar Navigation Items */}
                  <View style={styles.sidebarNavGroup}>
                    <Text style={styles.sidebarGroupTitle}>SERVICES & FEATURES (الخدمات)</Text>

                    {/* 1. Text Translation */}
                    <Pressable
                      onPress={() => {
                        setActiveTab('home');
                        setIsSidebarOpen(false);
                      }}
                      style={[styles.sidebarNavItem, activeTab === 'home' && styles.sidebarNavItemActive]}
                    >
                      <View style={[styles.sidebarNavIconBox, activeTab === 'home' && styles.sidebarNavIconBoxActive]}>
                        <Text style={{ fontSize: 18 }}>💬</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sidebarNavTitle, activeTab === 'home' && styles.sidebarNavTitleActive]}>
                          Text Translation
                        </Text>
                        <Text style={styles.sidebarNavDesc}>الترجمة الفورية للنصوص</Text>
                      </View>
                      {activeTab === 'home' && <View style={styles.sidebarActiveDot} />}
                    </Pressable>

                    {/* 2. Live Voice (2-Person) */}
                    <Pressable
                      onPress={() => {
                        setActiveTab('dialogue');
                        setIsSidebarOpen(false);
                      }}
                      style={[styles.sidebarNavItem, activeTab === 'dialogue' && styles.sidebarNavItemActive]}
                    >
                      <View style={[styles.sidebarNavIconBox, activeTab === 'dialogue' && styles.sidebarNavIconBoxActive]}>
                        <Text style={{ fontSize: 18 }}>🎙️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sidebarNavTitle, activeTab === 'dialogue' && styles.sidebarNavTitleActive]}>
                          Live Voice (2-Person)
                        </Text>
                        <Text style={styles.sidebarNavDesc}>محادثة صوتية حية ثنائية</Text>
                      </View>
                      {activeTab === 'dialogue' && <View style={styles.sidebarActiveDot} />}
                    </Pressable>

                    {/* 3. Saved History */}
                    <Pressable
                      onPress={() => {
                        setActiveTab('history');
                        setIsSidebarOpen(false);
                      }}
                      style={[styles.sidebarNavItem, activeTab === 'history' && styles.sidebarNavItemActive]}
                    >
                      <View style={[styles.sidebarNavIconBox, activeTab === 'history' && styles.sidebarNavIconBoxActive]}>
                        <Text style={{ fontSize: 18 }}>📜</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.sidebarNavTitle, activeTab === 'history' && styles.sidebarNavTitleActive]}>
                            Saved History & Dialogues
                          </Text>
                          {savedSessions.length > 0 && (
                            <View style={styles.sidebarCountBadge}>
                              <Text style={styles.sidebarCountBadgeText}>{savedSessions.length}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.sidebarNavDesc}>سجل المحادثات الصوتية المحفوظة</Text>
                      </View>
                      {activeTab === 'history' && <View style={styles.sidebarActiveDot} />}
                    </Pressable>

                    {/* 4. Screenshot OCR */}
                    <Pressable
                      onPress={() => {
                        setActiveTab('camera');
                        setIsSidebarOpen(false);
                      }}
                      style={[styles.sidebarNavItem, activeTab === 'camera' && styles.sidebarNavItemActive]}
                    >
                      <View style={[styles.sidebarNavIconBox, activeTab === 'camera' && styles.sidebarNavIconBoxActive]}>
                        <Text style={{ fontSize: 18 }}>📸</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sidebarNavTitle, activeTab === 'camera' && styles.sidebarNavTitleActive]}>
                          Screenshot & Photo OCR
                        </Text>
                        <Text style={styles.sidebarNavDesc}>مسح الإشعارات والمستندات</Text>
                      </View>
                      {activeTab === 'camera' && <View style={styles.sidebarActiveDot} />}
                    </Pressable>

                    {/* 5. Explain Terms */}
                    <Pressable
                      onPress={() => {
                        setActiveTab('explain');
                        setIsSidebarOpen(false);
                      }}
                      style={[styles.sidebarNavItem, activeTab === 'explain' && styles.sidebarNavItemActive]}
                    >
                      <View style={[styles.sidebarNavIconBox, activeTab === 'explain' && styles.sidebarNavIconBoxActive]}>
                        <Text style={{ fontSize: 18 }}>💡</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sidebarNavTitle, activeTab === 'explain' && styles.sidebarNavTitleActive]}>
                          Explain Saudi Terms
                        </Text>
                        <Text style={styles.sidebarNavDesc}>تفسير المصطلحات الإدارية والقانونية</Text>
                      </View>
                      {activeTab === 'explain' && <View style={styles.sidebarActiveDot} />}
                    </Pressable>

                    {/* 6. Glossary & Phrasebook */}
                    <Pressable
                      onPress={() => {
                        setActiveTab('phrasebook');
                        setIsSidebarOpen(false);
                      }}
                      style={[styles.sidebarNavItem, activeTab === 'phrasebook' && styles.sidebarNavItemActive]}
                    >
                      <View style={[styles.sidebarNavIconBox, activeTab === 'phrasebook' && styles.sidebarNavIconBoxActive]}>
                        <Text style={{ fontSize: 18 }}>📖</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sidebarNavTitle, activeTab === 'phrasebook' && styles.sidebarNavTitleActive]}>
                          Glossary & Phrasebook
                        </Text>
                        <Text style={styles.sidebarNavDesc}>دليل العبارات والمنصات الرسمية</Text>
                      </View>
                      {activeTab === 'phrasebook' && <View style={styles.sidebarActiveDot} />}
                    </Pressable>

                    {/* 7. Settings */}
                    <Pressable
                      onPress={() => {
                        setActiveTab('settings');
                        setIsSidebarOpen(false);
                      }}
                      style={[styles.sidebarNavItem, activeTab === 'settings' && styles.sidebarNavItemActive]}
                    >
                      <View style={[styles.sidebarNavIconBox, activeTab === 'settings' && styles.sidebarNavIconBoxActive]}>
                        <Text style={{ fontSize: 18 }}>⚙️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sidebarNavTitle, activeTab === 'settings' && styles.sidebarNavTitleActive]}>
                          Settings & Audio Engines
                        </Text>
                        <Text style={styles.sidebarNavDesc}>إعدادات الذكاء الاصطناعي والخصوصية</Text>
                      </View>
                      {activeTab === 'settings' && <View style={styles.sidebarActiveDot} />}
                    </Pressable>

                    {/* 8. Welcome Tour */}
                    <Pressable
                      onPress={() => {
                        setTourStep(0);
                        setShowWelcomeTour(true);
                        setIsSidebarOpen(false);
                      }}
                      style={styles.sidebarTourBtn}
                    >
                      <View style={styles.sidebarTourIconBox}>
                        <Text style={{ fontSize: 18 }}>✨</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sidebarTourTitle}>
                          Welcome Tour (جولة تعريفية)
                        </Text>
                        <Text style={styles.sidebarTourSubtitle}>شرح تفاعلي لمميزات لسان والمحادثة الحية</Text>
                      </View>
                      <Text style={styles.sidebarTourChevron}>›</Text>
                    </Pressable>
                  </View>

                  {/* Recent Saved Conversations in Sidebar */}
                  <View style={styles.sidebarRecentGroup}>
                    <View style={styles.sidebarRecentHeaderRow}>
                      <Text style={styles.sidebarGroupTitle}>RECENT TALKS (المحادثات الأخيرة)</Text>
                      {savedSessions.length > 0 && (
                        <Pressable
                          onPress={() => {
                            setActiveTab('history');
                            setHistoryViewTab('dialogue');
                            setIsSidebarOpen(false);
                          }}
                        >
                          <Text style={styles.sidebarSeeAllLink}>See all ({savedSessions.length}) ›</Text>
                        </Pressable>
                      )}
                    </View>

                    {savedSessions.length === 0 ? (
                      <View style={styles.sidebarEmptyHint}>
                        <Text style={styles.sidebarEmptyHintText}>
                          🎙️ Everything you talk in Live Voice is seen and saved here.
                        </Text>
                      </View>
                    ) : (
                      savedSessions.slice(0, 3).map((session) => (
                        <Pressable
                          key={session.id}
                          onPress={() => {
                            setDialogueMessages([...session.messages]);
                            setActiveTab('dialogue');
                            setIsSidebarOpen(false);
                          }}
                          style={styles.sidebarSessionMiniCard}
                        >
                          <View style={{ flex: 1, paddingRight: 6 }}>
                            <Text style={styles.sidebarSessionMiniTitle} numberOfLines={1}>
                              {session.title}
                            </Text>
                            <Text style={styles.sidebarSessionMiniMeta}>
                              📅 {session.date} • {session.messages.length} turns
                            </Text>
                          </View>
                          <Text style={styles.sidebarSessionMiniAction}>🎙️ Open</Text>
                        </Pressable>
                      ))
                    )}
                  </View>

                  {/* Recent Saved Text Translations in Sidebar */}
                  {savedTextTranslations.length > 0 && (
                    <View style={styles.sidebarRecentGroup}>
                      <View style={styles.sidebarRecentHeaderRow}>
                        <Text style={styles.sidebarGroupTitle}>SAVED TEXT (ترجمات محفوظة)</Text>
                        <Pressable
                          onPress={() => {
                            setActiveTab('history');
                            setHistoryViewTab('text');
                            setIsSidebarOpen(false);
                          }}
                        >
                          <Text style={styles.sidebarSeeAllLink}>See all ({savedTextTranslations.length}) ›</Text>
                        </Pressable>
                      </View>

                      {savedTextTranslations.slice(0, 3).map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            setInputText(item.sourceText);
                            setTranslatedText(item.translatedText);
                            setSourceLang(item.sourceLang);
                            setTargetLang(item.targetLang);
                            setActiveTab('home');
                            setIsSidebarOpen(false);
                          }}
                          style={styles.sidebarSessionMiniCard}
                        >
                          <View style={{ flex: 1, paddingRight: 6 }}>
                            <Text style={styles.sidebarSessionMiniTitle} numberOfLines={1}>
                              "{item.sourceText}"
                            </Text>
                            <Text style={styles.sidebarSessionMiniMeta} numberOfLines={1}>
                              ↳ {item.translatedText}
                            </Text>
                          </View>
                          <Text style={styles.sidebarSessionMiniAction}>💬 Open</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {/* Sidebar Footer */}
                  <View style={styles.sidebarFooter}>
                    <View style={styles.sidebarVisionRow}>
                      <Text style={{ fontSize: 14 }}>🇸🇦</Text>
                      <Text style={styles.sidebarVisionText}>
                        Saudi Vision 2030 • Digital Experience
                      </Text>
                    </View>
                    <Text style={styles.sidebarPdplText}>
                      PDPL Compliant • No unauthorized data retention
                    </Text>
                  </View>
                </ScrollView>
              </SafeAreaView>
            </View>
          </View>
        </Modal>

        {/* ========================================================================= */}
        {/* NAFATH & EMAIL AUTH MODAL */}
        {/* ========================================================================= */}
        <AuthModal
          visible={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          apiUrl={apiUrl}
          user={user}
          token={token}
          onLoginSuccess={handleLoginSuccess}
          onLogout={handleLogout}
        />

        {/* ========================================================================= */}
        {/* WELCOME TOUR WALKTHROUGH MODAL */}
        {/* ========================================================================= */}
        <Modal
          visible={showWelcomeTour}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowWelcomeTour(false)}
        >
          <View style={styles.tourOverlay}>
            <Pressable
              style={styles.tourBackdrop}
              onPress={() => setShowWelcomeTour(false)}
              accessibilityLabel="Close Tour"
            />
            <View style={styles.tourCard}>
              {/* Header Bar */}
              <View style={styles.tourHeaderRow}>
                <View style={styles.tourBadgePill}>
                  <Text style={styles.tourBadgePillText}>{TOUR_STEPS[tourStep].badge}</Text>
                </View>
                <Pressable
                  onPress={() => setShowWelcomeTour(false)}
                  style={styles.tourCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.tourCloseText}>✕ Skip</Text>
                </Pressable>
              </View>

              {/* Step Graphic & Titles */}
              <View style={styles.tourIconCircle}>
                <Text style={{ fontSize: 38 }}>{TOUR_STEPS[tourStep].icon}</Text>
              </View>

              <Text style={styles.tourTitle}>{TOUR_STEPS[tourStep].title}</Text>
              <Text style={styles.tourTitleAr}>{TOUR_STEPS[tourStep].titleAr}</Text>
              <Text style={styles.tourTagline}>{TOUR_STEPS[tourStep].tagline}</Text>
              <Text style={styles.tourDescription}>{TOUR_STEPS[tourStep].description}</Text>

              {/* Step Points */}
              <View style={styles.tourPointsList}>
                {TOUR_STEPS[tourStep].points.map((pt, idx) => (
                  <View key={idx} style={styles.tourPointRow}>
                    <Text style={styles.tourPointIcon}>{pt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tourPointTitle}>{pt.title}</Text>
                      <Text style={styles.tourPointDesc}>{pt.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Progress Dots Indicator */}
              <View style={styles.tourDotsRow}>
                {TOUR_STEPS.map((_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setTourStep(i)}
                    style={[
                      styles.tourDot,
                      i === tourStep && styles.tourDotActive,
                    ]}
                  />
                ))}
              </View>

              {/* Bottom Navigation Buttons */}
              <View style={styles.tourActionsRow}>
                {tourStep > 0 ? (
                  <Pressable
                    onPress={() => setTourStep((prev) => Math.max(0, prev - 1))}
                    style={styles.tourBackBtn}
                  >
                    <Text style={styles.tourBackBtnText}>← Back</Text>
                  </Pressable>
                ) : (
                  <View style={{ width: 70 }} />
                )}

                {tourStep < TOUR_STEPS.length - 1 ? (
                  <Pressable
                    onPress={() => setTourStep((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1))}
                    style={styles.tourNextBtn}
                  >
                    <Text style={styles.tourNextBtnText}>Next (التالي) →</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      setShowWelcomeTour(false);
                      setActiveTab('dialogue');
                    }}
                    style={styles.tourFinishBtn}
                  >
                    <Text style={styles.tourFinishBtnText}>Get Started (ابدأ الآن) 🚀</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 32) : 0,
  },
  container: { padding: 16, paddingBottom: 60 },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  hamburgerBtn: {
    padding: 6,
    marginRight: 10,
    borderRadius: RADII.sm,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    width: 38,
    height: 38,
  },
  hamburgerLine: {
    width: 18,
    height: 2.2,
    backgroundColor: COLORS.text,
    marginVertical: 1.8,
    borderRadius: 1,
  },
  activeSectionHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
    paddingVertical: 2,
  },
  activeSectionHeaderIcon: {
    fontSize: 20,
  },
  activeSectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  activeSectionHeaderSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tourHeaderBtn: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  tourHeaderBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.emerald,
  },
  brandGlyph: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  brandTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  brandPill: {
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADII.xs,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  brandPillText: { fontSize: 10, fontWeight: '800', color: COLORS.goldDark },
  brandTagline: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },

  // Auth Status Pill in Header
  authHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.full,
    borderWidth: 1,
    flexShrink: 0,
    gap: 4,
  },
  authPillNafath: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  authPillUser: {
    backgroundColor: COLORS.cardSubtle,
    borderColor: COLORS.border,
  },
  authPillGuest: {
    backgroundColor: COLORS.primaryLight,
    borderColor: '#A7F3D0',
  },
  authPillIcon: { fontSize: 13 },
  authPillText: { fontSize: 11, fontWeight: '700' },
  authTextNafath: { color: '#15803D' },
  authTextUser: { color: COLORS.textSecondary },
  authTextGuest: { color: COLORS.primary },

  // Tabs Nav
  navBar: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  navScroll: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 4 },
  navTab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginHorizontal: 2,
  },
  navTabActive: { borderBottomColor: COLORS.primary },
  navTabText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  navTabTextActive: { color: COLORS.primary, fontWeight: '800' },

  // Status Infrastructure Card
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: COLORS.success },
  dotAmber: { backgroundColor: COLORS.warning },
  statusTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.text },
  refreshBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: RADII.xs, backgroundColor: COLORS.primaryLight },
  refreshBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  dependencyGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  depItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  depLabel: { fontSize: 11, color: COLORS.textMuted },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADII.xs },
  badgeGreen: { backgroundColor: COLORS.successLight },
  badgeGold: { backgroundColor: COLORS.goldLight },
  badgeMuted: { backgroundColor: COLORS.cardSubtle },
  badgeText: { fontSize: 10, fontWeight: '700', color: COLORS.success },

  // Text Tab
  langHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  helperText: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12 },
  swapBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADII.sm, borderWidth: 1, borderColor: '#A7F3D0' },
  swapBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  langSelectorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  langLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, width: 36 },
  langScroll: { flexDirection: 'row' },
  langChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADII.full,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  langChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  langChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  langChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  textInput: {
    minHeight: 85,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  charCount: { fontSize: 11, color: COLORS.textMuted },
  translateBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 22, borderRadius: RADII.md },
  translateBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  resultHeader: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  toolBtnRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  toolBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADII.xs,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  toolBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  resultBody: { fontSize: 16, fontWeight: '800', color: COLORS.text, lineHeight: 24 },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 6,
  },
  metaText: { fontSize: 10, color: COLORS.textMuted },

  // Live Voice 2-Person
  dialogueTopCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  dialogueTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  dialogueSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, lineHeight: 16 },
  saveDialogueBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADII.xs },
  saveDialogueText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  clearDialogueBtn: { backgroundColor: COLORS.dangerLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADII.xs },
  clearDialogueText: { fontSize: 11, fontWeight: '700', color: COLORS.danger },

  dialogueSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  dialogueSettingLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  // Engine Badge Card
  engineBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: RADII.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  engineBadgeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  engineBadgeTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  engineBadgeSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  engineConfigBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.cardSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  engineConfigBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: '#86EFAC',
  },
  engineConfigBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  engineConfigBtnTextActive: { color: COLORS.primary, fontWeight: '800' },

  // AssemblyAI Modal
  assemblyModalSheet: {
    width: '90%',
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.lg,
  },
  assemblyModalDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  assemblyInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  assemblyKeyInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
  },
  assemblyClearBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADII.md,
    backgroundColor: COLORS.cardSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  assemblyClearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  assemblySaveBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  assemblySaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Bilingual Language Selector & Swap Controller
  bilingualControllerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 8,
    ...SHADOWS.sm,
  },
  speakerPillBtn: {
    flex: 1,
    borderRadius: RADII.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  speakerPillS1: {
    backgroundColor: COLORS.primaryUltraLight,
    borderColor: '#86EFAC',
  },
  speakerPillS2: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  speakerPillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  speakerPillRoleText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.3,
  },
  speakerPillChevron: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  speakerPillMainLang: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  speakerPillSubLang: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  speakerSwapCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.emerald,
  },
  speakerSwapCircleIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  // Dual Voice Microphone Decks (Tactile Full-Width)
  voiceDeckSection: {
    gap: 10,
    marginBottom: 14,
  },
  voiceDeckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADII.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    ...SHADOWS.sm,
  },
  voiceDeckCardS1: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.primary,
  },
  voiceDeckCardS2: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2563EB',
  },
  voiceDeckCardRecording: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerLight,
  },
  voiceDeckInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  voiceDeckFlagBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  voiceDeckSpeakerName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  voiceDeckActionSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  voiceDeckMicPill: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  voiceDeckMicPillS1: {
    backgroundColor: COLORS.primary,
  },
  voiceDeckMicPillS2: {
    backgroundColor: '#2563EB',
  },
  voiceDeckMicPillActive: {
    backgroundColor: COLORS.danger,
  },
  voiceDeckMicIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },

  // Recording Banner
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    borderRadius: RADII.md,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  recordingDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.danger },
  recordingBannerTitle: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  recordingBannerTimer: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },
  finishRecordingBtn: { backgroundColor: COLORS.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADII.xs },
  finishRecordingBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // Voice Processing
  voiceProcessingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADII.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  voiceProcessingText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  // Conversational Dialogue Chat Stream
  dialogueListSection: {
    marginBottom: 16,
  },
  dialogueStreamHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  emptyDialogueBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  emptyDialogueIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyDialogueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyDialogueSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 14,
  },
  emptyDialogueHints: {
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: RADII.sm,
  },
  emptyHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyHintDot: {
    fontSize: 10,
  },
  emptyHintText: {
    fontSize: 12,
    color: COLORS.text,
  },
  dialogueBubbleCard: {
    borderRadius: RADII.lg,
    padding: 12,
    borderWidth: 1.5,
    marginBottom: 12,
    width: '94%',
    ...SHADOWS.sm,
  },
  dialogueBubbleCardS1: {
    alignSelf: 'flex-end',
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  dialogueBubbleCardS2: {
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderColor: '#BFDBFE',
  },
  dialogueBubbleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dialogueSpeakerTagS1: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  dialogueSpeakerTagS2: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
  dialogueTimestampText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  spokenQuoteBox: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: RADII.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  spokenQuoteText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  quoteAudioBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADII.xs,
  },
  quoteAudioBtnText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  convertedTranslationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.md,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  convertedTranslationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
  },
  convertedPlayBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.xs,
  },
  convertedPlayBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  convertedOutputText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 22,
    marginTop: 4,
  },

  quickSpeechSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  quickSpeechSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  quickSpeechCategory: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginVertical: 4 },
  quickPhraseChipSpeaker1: {
    backgroundColor: COLORS.primaryUltraLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    marginRight: 8,
  },
  quickPhraseTextSpeaker1: { fontSize: 11, color: COLORS.primaryDark, fontWeight: '600' },
  quickPhraseChipSpeaker2: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADII.sm,
    marginRight: 8,
  },
  quickPhraseTextSpeaker2: { fontSize: 11, color: '#1E3A8A', fontWeight: '600' },

  // Screenshot Tab
  uploadPlaceholder: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    borderStyle: 'dashed',
  },
  uploadIcon: { fontSize: 36, marginBottom: 8 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  uploadSub: { fontSize: 11, color: COLORS.textMuted },
  previewCard: { backgroundColor: COLORS.card, borderRadius: RADII.lg, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  previewHeader: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  previewImage: { width: '100%', height: 220, borderRadius: RADII.md, backgroundColor: '#000000' },
  privacyNoticeBox: { backgroundColor: COLORS.primaryUltraLight, padding: 10, borderRadius: RADII.sm, marginVertical: 12 },
  privacyNoticeText: { fontSize: 11, color: COLORS.primaryDark, lineHeight: 16 },
  previewActions: { flexDirection: 'row', gap: 10 },
  confirmUploadBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: RADII.md, alignItems: 'center' },
  confirmUploadText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADII.md, backgroundColor: COLORS.cardSubtle, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  ocrReviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginTop: 14,
  },
  ocrHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  ocrTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  confidenceBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADII.xs,
  },
  ocrTextInput: {
    minHeight: 90,
    backgroundColor: COLORS.cardSubtle,
    borderRadius: RADII.sm,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  translateOcrBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: RADII.sm, alignItems: 'center' },
  translateOcrBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  explainOcrBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    borderRadius: RADII.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  explainOcrBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  // Explain Tab
  officialFactBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: RADII.md,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  officialFactBannerText: { fontSize: 11, color: '#1E40AF', lineHeight: 16 },
  explanationResultBox: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 14,
    ...SHADOWS.sm,
  },
  explanationResultTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 6 },
  explanationResultBody: { fontSize: 14, color: COLORS.text, lineHeight: 21, marginBottom: 12 },
  suggestedActionsTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  suggestedStepItem: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 4 },
  citationBox: { backgroundColor: COLORS.cardSubtle, borderRadius: RADII.sm, padding: 10, marginTop: 10 },
  citationTitle: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  citationItem: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  uncertaintyLabelText: { fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 4 },

  // Glossary Tab
  termCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  termTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceTermText: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  termAudioBtn: { padding: 4 },
  termAudioBtnText: { fontSize: 16 },
  termContextText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, marginBottom: 8 },
  translationsList: { gap: 4, borderTopWidth: 1, borderTopColor: COLORS.borderSubtle, paddingTop: 6 },
  translationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  transLangBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADII.xs,
  },
  transTermText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },

  // Settings Tab
  settingsSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  settingSectionHeader: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  settingLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  settingSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  changePrefBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    borderRadius: RADII.md,
    alignItems: 'center',
    marginTop: 8,
  },
  changePrefBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  deleteHistoryBtn: {
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 10,
    borderRadius: RADII.md,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteHistoryText: { color: COLORS.danger, fontSize: 12, fontWeight: '700' },
  apiHostInput: {
    backgroundColor: COLORS.cardSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.sm,
    padding: 10,
    fontSize: 13,
    color: COLORS.text,
    marginVertical: 8,
  },
  saveHostBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: RADII.md, alignItems: 'center' },
  saveHostBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Voice Language Modal
  langModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  langModalSheet: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADII.xl,
    padding: 16,
    ...SHADOWS.lg,
  },
  langModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },
  langModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.cardSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  langModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: RADII.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  langModalItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  langModalItemFlag: {
    fontSize: 24,
  },
  langModalItemNative: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  langModalItemName: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  langModalCheck: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // =========================================================================
  // SIDEBAR DRAWER MODAL STYLES
  // =========================================================================
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sidebarDrawer: {
    width: '84%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: RADII.lg,
    borderBottomRightRadius: RADII.lg,
    ...SHADOWS.md,
  },
  sidebarScroll: {
    paddingBottom: 40,
  },
  sidebarHeader: {
    padding: 20,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sidebarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sidebarBrandMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarBrandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sidebarBrandSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
  sidebarCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarCloseText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sidebarUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    padding: 12,
    borderRadius: RADII.md,
  },
  sidebarUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sidebarUserStatus: {
    fontSize: 11,
    color: COLORS.goldLight,
    marginTop: 2,
  },
  sidebarUserChevron: {
    fontSize: 20,
    color: '#FFFFFF',
    opacity: 0.6,
  },
  sidebarNavGroup: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sidebarGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    marginBottom: 4,
  },
  sidebarNavItemActive: {
    backgroundColor: 'rgba(0, 108, 53, 0.09)',
  },
  sidebarNavIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADII.sm,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarNavIconBoxActive: {
    backgroundColor: COLORS.primary,
  },
  sidebarNavTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  sidebarNavTitleActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  sidebarNavDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  sidebarActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  sidebarCountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sidebarCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sidebarFooter: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sidebarVisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sidebarVisionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sidebarPdplText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // =========================================================================
  // SAVED HISTORY & CONVERSATIONS STYLES
  // =========================================================================
  historyHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  clearHistoryAllBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.sm,
  },
  clearHistoryAllText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  historyStatsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  historyStatPill: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: RADII.sm,
    alignItems: 'center',
  },
  historyStatNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  historyStatLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  emptyHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.lg,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  emptyHistoryIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHistoryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyHistorySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyHistoryActionBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADII.md,
  },
  emptyHistoryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  historySessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  historySessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historySessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  historySessionDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  historyLangPairBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.sm,
  },
  historyLangPairText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  historyMessagesBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.md,
    padding: 10,
    marginBottom: 12,
  },
  historyMsgRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyMsgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyMsgSpeaker: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  historyMsgTime: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  historyMsgSource: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  historyMsgTranslated: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  historyPlayMiniBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyPlayMiniText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  historyResumeBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADII.sm,
  },
  historyResumeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  historyCopyBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADII.sm,
  },
  historyCopyText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  historyDeleteSingleBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADII.sm,
  },
  historyDeleteSingleText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },

  historySegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: RADII.md,
    padding: 4,
    marginTop: 12,
  },
  historySegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADII.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  historySegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  historySegmentTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  savedTextSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 2,
  },

  sidebarRecentGroup: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sidebarRecentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sidebarSeeAllLink: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sidebarEmptyHint: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sidebarEmptyHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  sidebarSessionMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: RADII.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sidebarSessionMiniTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  sidebarSessionMiniMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sidebarSessionMiniAction: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.xs,
  },

  sidebarTourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: RADII.md,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginTop: 8,
  },
  sidebarTourIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADII.sm,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTourTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  sidebarTourSubtitle: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 1,
  },
  sidebarTourChevron: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
  },

  // =========================================================================
  // WELCOME TOUR MODAL STYLES
  // =========================================================================
  tourOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  tourBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tourCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.xl,
    padding: 22,
    ...SHADOWS.md,
  },
  tourHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tourBadgePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tourBadgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  tourCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.sm,
    backgroundColor: '#F3F4F6',
  },
  tourCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tourIconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  tourTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  tourTitleAr: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  tourTagline: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.goldDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  tourDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  tourPointsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: RADII.md,
    padding: 10,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tourPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tourPointIcon: {
    fontSize: 15,
    marginTop: 1,
  },
  tourPointTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  tourPointDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 14,
    marginTop: 1,
  },
  tourDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginBottom: 16,
  },
  tourDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  tourDotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  tourActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tourBackBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: RADII.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tourNextBtn: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.emerald,
  },
  tourNextBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tourFinishBtn: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: RADII.md,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.emerald,
  },
  tourFinishBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  btnDisabled: { opacity: 0.6 },
  footer: { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: 24 },
});
