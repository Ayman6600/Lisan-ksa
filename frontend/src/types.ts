// =========================================================================
// Lisan KSA - Shared Mobile Types
// =========================================================================

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  direction: 'rtl' | 'ltr';
  flag?: string;
};

export type DialectOption = {
  id: string;
  name: string;
  nativeName: string;
  langCode: string;
  flag: string;
  direction: 'rtl' | 'ltr';
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  nationalId?: string;
  maskedId?: string;
  nafathVerified: boolean;
  role: string;
  preferredLanguage: string;
};

export type Readiness = {
  status: string;
  database: 'connected' | 'disconnected' | 'not_configured';
  redis: 'connected' | 'disconnected' | 'not_configured';
};

export type TabType = 'home' | 'dialogue' | 'camera' | 'explain' | 'phrasebook' | 'settings' | 'history';

export type SavedDialogueSession = {
  id: string;
  title: string;
  date: string;
  speaker1Lang: string;
  speaker2Lang: string;
  speaker1Name: string;
  speaker2Name: string;
  messages: DialogueMessage[];
  createdAt: number;
};

export type DialogueMessage = {
  id: string;
  speaker: 'speaker1' | 'speaker2' | 'arabic' | 'counterpart';
  speakerLabel: string;
  speakerFlag: string;
  sourceText: string;
  sourceLang: string;
  translatedText: string;
  targetLang: string;
  timestamp: string;
};

export type SavedTextTranslation = {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: string;
  createdAt: number;
};

