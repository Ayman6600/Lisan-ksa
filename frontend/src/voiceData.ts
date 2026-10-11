// =========================================================================
// Lisan KSA - Live Voice Multi-Language Profiles & Dialect Presets
// =========================================================================

export type VoiceLanguageProfile = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'rtl' | 'ltr';
  speechCode: string;
  speakerRole: string;
};

export const SPEAKER_LANGUAGES: VoiceLanguageProfile[] = [
  {
    code: 'ar',
    name: 'Arabic (Saudi Official / فصحى)',
    nativeName: 'العربية (السعودية)',
    flag: '🇸🇦',
    direction: 'rtl',
    speechCode: 'ar-SA',
    speakerRole: 'Saudi Official / Host',
  },
  {
    code: 'ar-najd',
    name: 'Arabic (Najdi Dialect / نجدي)',
    nativeName: 'العربية (اللهجة النجدية)',
    flag: '🇸🇦',
    direction: 'rtl',
    speechCode: 'ar-SA',
    speakerRole: 'Saudi Citizen (Central)',
  },
  {
    code: 'ar-hijaz',
    name: 'Arabic (Hejazi Dialect / حجازي)',
    nativeName: 'العربية (اللهجة الحجازية)',
    flag: '🇸🇦',
    direction: 'rtl',
    speechCode: 'ar-SA',
    speakerRole: 'Saudi Citizen (Western)',
  },
  {
    code: 'en',
    name: 'English (Expatriate / Global)',
    nativeName: 'English',
    flag: '🌐',
    direction: 'ltr',
    speechCode: 'en-US',
    speakerRole: 'Expatriate / Visitor',
  },
  {
    code: 'ur',
    name: 'Urdu (اردو)',
    nativeName: 'اردو',
    flag: '🇵🇰',
    direction: 'rtl',
    speechCode: 'ur-PK',
    speakerRole: 'Expatriate Worker / Resident',
  },
  {
    code: 'hi',
    name: 'Hindi (हिन्दी)',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    direction: 'ltr',
    speechCode: 'hi-IN',
    speakerRole: 'Expatriate Worker / Resident',
  },
  {
    code: 'bn',
    name: 'Bengali (বাংলা)',
    nativeName: 'বাংলা',
    flag: '🇧🇩',
    direction: 'ltr',
    speechCode: 'bn-BD',
    speakerRole: 'Expatriate Worker / Resident',
  },
  {
    code: 'tl',
    name: 'Filipino / Tagalog',
    nativeName: 'Tagalog',
    flag: '🇵🇭',
    direction: 'ltr',
    speechCode: 'fil-PH',
    speakerRole: 'Healthcare / Hospitality Professional',
  },
];

export type PresetPhrase = {
  text: string;
  targetTranslation: string;
  topic: string;
};

export const QUICK_VOICE_PRESETS: Record<string, PresetPhrase[]> = {
  ar: [
    {
      text: 'أهلاً بك، هل وثقت عقد عملك في منصة قوى رسمياً؟',
      targetTranslation: 'Welcome, have you officially authenticated your employment contract on Qiwa?',
      topic: 'Contract Qiwa',
    },
    {
      text: 'يرجى سداد رسوم تجديد الإقامة عبر خدمة سداد البنكية.',
      targetTranslation: 'Please pay the residency permit renewal fees via the Sadad banking service.',
      topic: 'Iqama Renewal',
    },
    {
      text: 'أين مكتب الموارد البشرية وإدارة شؤون الموظفين من فضلك؟',
      targetTranslation: 'Where is the Human Resources office and personnel department please?',
      topic: 'Workplace',
    },
    {
      text: 'هل قمت بإجراء الفحص الطبي المطلوب لنقل الكفالة؟',
      targetTranslation: 'Have you completed the required medical examination for sponsorship transfer?',
      topic: 'Sponsorship',
    },
  ],
  'ar-najd': [
    {
      text: 'يا هلا، وثقت العقد حقك في قوى والا باقي؟',
      targetTranslation: 'Hello there, did you authenticate your contract on Qiwa or not yet?',
      topic: 'Contract',
    },
    {
      text: 'لا هنت، سدد رسوم الإقامة عن طريق سداد عشان تطلع.',
      targetTranslation: 'Please pay the Iqama fees through Sadad so it can be issued.',
      topic: 'Iqama',
    },
  ],
  'ar-hijaz': [
    {
      text: 'أهلاً وسهلاً، شفت إشعار تجديد العقد في أبشر وقوى؟',
      targetTranslation: 'Welcome! Did you check the contract renewal notification on Absher and Qiwa?',
      topic: 'Absher & Qiwa',
    },
    {
      text: 'فين ورقة الفحص الطبي الله يسعدك؟',
      targetTranslation: 'Where is your medical checkup form please?',
      topic: 'Medical',
    },
  ],
  en: [
    {
      text: 'I need to renew my residency permit before it expires next week.',
      targetTranslation: 'أحتاج إلى تجديد تصريح إقامتي قبل انتهاء صلاحيته الأسبوع المقبل.',
      topic: 'Iqama',
    },
    {
      text: 'How can I authenticate and accept my contract on the Qiwa portal?',
      targetTranslation: 'كيف يمكنني توثيق وقبول عقدي عبر منصة قوى؟',
      topic: 'Qiwa',
    },
    {
      text: 'Where can I complete the certified medical examination for Muqeem?',
      targetTranslation: 'أين يمكنني إجراء الفحص الطبي المعتمد لمنصة مقيم؟',
      topic: 'Medical',
    },
    {
      text: 'What are the official steps to transfer sponsorship to a new company?',
      targetTranslation: 'ما هي الخطوات الرسمية لنقل الكفالة إلى شركة جديدة؟',
      topic: 'Transfer',
    },
  ],
  ur: [
    {
      text: 'مجھے اگلے ہفتے ختم ہونے سے پہلے اپنا اقامہ تجدید کروانا ہے۔',
      targetTranslation: 'أحتاج إلى تجديد تصريح إقامتي قبل انتهاء صلاحيته الأسبوع المقبل.',
      topic: 'Iqama (اقامہ)',
    },
    {
      text: 'میں قویٰ پلیٹ فارم پر اپنا ملازمت کا معاہدہ کیسے منظور کروں؟',
      targetTranslation: 'كيف يمكنني توثيق وقبول عقدي عبر منصة قوى؟',
      topic: 'Qiwa (معاہدہ)',
    },
    {
      text: 'کیا آپ مجھے سداد کے ذریعے فیس ادا کرنے کا طریقہ بتا سکتے ہیں؟',
      targetTranslation: 'هل يمكنك إخباري بكيفية سداد الرسوم عبر نظام سداد؟',
      topic: 'Sadad (فیس سداد)',
    },
  ],
  hi: [
    {
      text: 'मुझे अगले सप्ताह समाप्त होने से पहले अपना इकामा नवीनीकृत करना होगा।',
      targetTranslation: 'أحتاج إلى تجديد تصريح إقامتي قبل انتهاء صلاحيته الأسبوع المقبل.',
      topic: 'Iqama (इकामा)',
    },
    {
      text: 'मैं किवा पोर्टल पर अपने अनुबंध को कैसे सत्यापित और स्वीकृत करूं?',
      targetTranslation: 'كيف يمكنني توثيق وقبول عقدي عبر منصة قوى؟',
      topic: 'Qiwa (अनुबंध)',
    },
    {
      text: 'सदाद के माध्यम से शुल्क का भुगतान करने की क्या प्रक्रिया है?',
      targetTranslation: 'ما هو الإجراء المتبع لسداد الرسوم عبر نظام سداد؟',
      topic: 'Sadad (भुगतान)',
    },
  ],
  bn: [
    {
      text: 'আগামী সপ্তাহে মেয়াদ শেষ হওয়ার আগে আমার ইকামা নবায়ন করতে হবে।',
      targetTranslation: 'أحتاج إلى تجديد تصريح إقامتي قبل انتهاء صلاحيته الأسبوع المقبل.',
      topic: 'Iqama (ইকামা)',
    },
    {
      text: 'কিওয়া পোর্টালে আমি কীভাবে আমার কর্মসংস্থান চুক্তি অনুমোদন করব?',
      targetTranslation: 'كيف يمكنني توثيق وقبول عقدي عبر منصة قوى؟',
      topic: 'Qiwa (চুক্তি)',
    },
    {
      text: 'সাদাদের মাধ্যমে ইকামা ফি পরিশোধ করার নিয়ম কী?',
      targetTranslation: 'ما هي طريقة سداد رسوم الإقامة عبر نظام سداد؟',
      topic: 'Sadad (ফি পরিশোধ)',
    },
  ],
  tl: [
    {
      text: 'Kailangan ko pong i-renew ang aking Iqama bago mag-expire sa susunod na linggo.',
      targetTranslation: 'أحتاج إلى تجديد تصريح إقامتي قبل انتهاء صلاحيته الأسبوع المقبل.',
      topic: 'Iqama',
    },
    {
      text: 'Paano ko po maaprubahan ang aking kontrata sa Qiwa platform?',
      targetTranslation: 'كيف يمكنني توثيق وقبول عقدي عبر منصة قوى؟',
      topic: 'Qiwa',
    },
  ],
};

export function getLanguageProfile(code: string): VoiceLanguageProfile {
  const found = SPEAKER_LANGUAGES.find((l) => l.code === code);
  if (found) return found;
  return {
    code,
    name: code.toUpperCase(),
    nativeName: code.toUpperCase(),
    flag: '🌐',
    direction: 'ltr',
    speechCode: 'en-US',
    speakerRole: 'Speaker',
  };
}
