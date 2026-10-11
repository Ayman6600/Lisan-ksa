import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS, RADII, SHADOWS } from '../theme';
import { UserProfile } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  apiUrl: string;
  user: UserProfile | null;
  token: string | null;
  onLoginSuccess: (user: UserProfile, token: string) => void;
  onLogout: () => void;
};

export const AuthModal: React.FC<Props> = ({
  visible,
  onClose,
  apiUrl,
  user,
  token,
  onLoginSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'nafath' | 'email' | 'register'>('nafath');

  // Nafath state
  const [nafathId, setNafathId] = useState('2491827364');
  const [nafathChallenge, setNafathChallenge] = useState<string | null>(null);
  const [nafathStage, setNafathStage] = useState<'input' | 'challenge'>('input');
  const [nafathCountdown, setNafathCountdown] = useState(120);

  // Email login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regNationalId, setRegNationalId] = useState('');
  const [regLang, setRegLang] = useState('ar');

  // General loading & error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Countdown timer for Nafath challenge
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (nafathStage === 'challenge' && nafathCountdown > 0) {
      timer = setInterval(() => {
        setNafathCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [nafathStage, nafathCountdown]);

  // Request Nafath Challenge Code
  const handleNafathRequestChallenge = async () => {
    const cleanId = nafathId.trim();
    if (cleanId.length !== 10 || (!cleanId.startsWith('1') && !cleanId.startsWith('2'))) {
      setErrorMsg('Please enter a 10-digit Saudi ID (starts with 1) or Iqama number (starts with 2).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/nafath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nationalId: cleanId,
          stage: 'challenge',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Nafath challenge request failed.');
      }

      setNafathChallenge(data.challengeCode);
      setNafathStage('challenge');
      setNafathCountdown(120);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not connect to Nafath authentication gateway.');
    } finally {
      setLoading(false);
    }
  };

  // Confirm and complete Nafath verification
  const handleNafathVerify = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/nafath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nationalId: nafathId.trim(),
          stage: 'verify',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Nafath verification failed.');
      }

      onLoginSuccess(data.user, data.token);
      setNafathStage('input');
      setNafathChallenge(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete Nafath sign-in.');
    } finally {
      setLoading(false);
    }
  };

  // Handle standard email password login
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate user.');
    } finally {
      setLoading(false);
    }
  };

  // Handle user registration
  const handleRegister = async () => {
    if (!regEmail.trim() || regPassword.length < 6) {
      setErrorMsg('Please enter a valid email and password (minimum 6 characters).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim() || 'Lisan User',
          email: regEmail.trim(),
          password: regPassword.trim(),
          nationalId: regNationalId.trim(),
          preferredLanguage: regLang,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (type: 'citizen' | 'resident') => {
    if (type === 'citizen') {
      setEmail('citizen@lisan-ksa.sa');
      setPassword('saudi1234');
      setNafathId('1092837465');
    } else {
      setEmail('resident@lisan-ksa.sa');
      setPassword('resident1234');
      setNafathId('2491827364');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.crestBadge}>
                <Text style={styles.crestGlyph}>🛡️</Text>
              </View>
              <View>
                <Text style={styles.sheetTitle}>
                  {user ? 'User Profile' : 'Sign In to Lisan KSA'}
                </Text>
                <Text style={styles.sheetSub}>
                  {user ? 'Verified Account Credentials' : 'نفاذ • Unified National Access & Accounts'}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* If user is logged in: Display Active Profile Details */}
            {user ? (
              <View style={styles.profileBox}>
                <View style={styles.profileAvatarCard}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarLetter}>
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{user.name}</Text>
                    <Text style={styles.profileEmail}>{user.email}</Text>
                    {user.nafathVerified && (
                      <View style={styles.nafathVerifiedPill}>
                        <Text style={styles.nafathVerifiedText}>🛡️ نفاذ موثق • Nafath Verified</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Profile Meta Info */}
                <View style={styles.metaList}>
                  {user.maskedId && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>National ID / Iqama (هوية / إقامة):</Text>
                      <Text style={styles.metaValue}>{user.maskedId}</Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Account Role:</Text>
                    <Text style={styles.metaValue}>
                      {user.role === 'citizen' ? '🇸🇦 Saudi Citizen' : '🌐 Resident Expatriate'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Session Security:</Text>
                    <Text style={styles.metaValue}>JWT Bearer TLS Enforced</Text>
                  </View>
                </View>

                {/* Log Out Button */}
                <Pressable
                  onPress={() => {
                    onLogout();
                    onClose();
                  }}
                  style={styles.logoutBtn}
                >
                  <Text style={styles.logoutBtnText}>Log Out / تسجيل الخروج</Text>
                </Pressable>
              </View>
            ) : (
              /* If NOT logged in: Tabs for Nafath, Email Login, Register */
              <View>
                {/* Tabs Selector */}
                <View style={styles.tabSelector}>
                  <Pressable
                    onPress={() => {
                      setActiveTab('nafath');
                      setErrorMsg(null);
                    }}
                    style={[styles.tabButton, activeTab === 'nafath' && styles.tabButtonActive]}
                  >
                    <Text style={[styles.tabButtonText, activeTab === 'nafath' && styles.tabButtonTextActive]}>
                      🛡️ Nafath (نفاذ)
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setActiveTab('email');
                      setErrorMsg(null);
                    }}
                    style={[styles.tabButton, activeTab === 'email' && styles.tabButtonActive]}
                  >
                    <Text style={[styles.tabButtonText, activeTab === 'email' && styles.tabButtonTextActive]}>
                      🔑 Password
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setActiveTab('register');
                      setErrorMsg(null);
                    }}
                    style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]}
                  >
                    <Text style={[styles.tabButtonText, activeTab === 'register' && styles.tabButtonTextActive]}>
                      📝 Register
                    </Text>
                  </Pressable>
                </View>

                {/* Error Banner */}
                {errorMsg && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{errorMsg}</Text>
                  </View>
                )}

                {/* ========================================================= */}
                {/* TAB 1: SAUDI NAFATH SSO (نفاذ) */}
                {/* ========================================================= */}
                {activeTab === 'nafath' && (
                  <View style={styles.sectionBody}>
                    <View style={styles.nafathBrandCard}>
                      <Text style={styles.nafathBrandArabic}>النفاذ الوطني الموحد</Text>
                      <Text style={styles.nafathBrandEnglish}>Saudi National Unified Access</Text>
                      <Text style={styles.nafathBrandDesc}>
                        Authenticate securely using your Saudi National ID or Resident Iqama number.
                      </Text>
                    </View>

                    {nafathStage === 'input' ? (
                      <View>
                        <Text style={styles.inputLabel}>National ID / Iqama Number (رقم الهوية أو الإقامة):</Text>
                        <TextInput
                          value={nafathId}
                          onChangeText={setNafathId}
                          placeholder="e.g. 2491827364 or 1092837465"
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="numeric"
                          maxLength={10}
                          style={styles.textInput}
                        />

                        <View style={styles.quickDemoRow}>
                          <Text style={styles.quickDemoLabel}>Fill Demo ID:</Text>
                          <Pressable onPress={() => fillQuickDemo('resident')} style={styles.quickDemoChip}>
                            <Text style={styles.quickDemoChipText}>Expat Iqama (249...)</Text>
                          </Pressable>
                          <Pressable onPress={() => fillQuickDemo('citizen')} style={styles.quickDemoChip}>
                            <Text style={styles.quickDemoChipText}>Citizen ID (109...)</Text>
                          </Pressable>
                        </View>

                        <Pressable
                          onPress={handleNafathRequestChallenge}
                          style={[styles.primaryActionBtn, loading && styles.btnDisabled]}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.primaryActionBtnText}>
                              Request Nafath Challenge / طلب التحقق
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.challengeBox}>
                        <Text style={styles.challengePromptTitle}>
                          Open the Nafath App on your Mobile Device
                        </Text>
                        <Text style={styles.challengePromptSub}>
                          Select and confirm this 2-digit number on your Nafath mobile verification screen:
                        </Text>

                        {/* Giant Challenge Code Display */}
                        <View style={styles.challengeCodeCard}>
                          <Text style={styles.challengeCodeNumber}>{nafathChallenge || '42'}</Text>
                        </View>

                        <Text style={styles.challengeTimer}>
                          Expires in: {Math.floor(nafathCountdown / 60)}:
                          {(nafathCountdown % 60).toString().padStart(2, '0')}
                        </Text>

                        <Pressable
                          onPress={handleNafathVerify}
                          style={[styles.primaryActionBtn, loading && styles.btnDisabled]}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.primaryActionBtnText}>
                              Confirm Approval in Nafath / تأكيد
                            </Text>
                          )}
                        </Pressable>

                        <Pressable
                          onPress={() => {
                            setNafathStage('input');
                            setNafathChallenge(null);
                          }}
                          style={styles.backBtn}
                        >
                          <Text style={styles.backBtnText}>Use Different ID Number</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                {/* ========================================================= */}
                {/* TAB 2: EMAIL & PASSWORD LOGIN */}
                {/* ========================================================= */}
                {activeTab === 'email' && (
                  <View style={styles.sectionBody}>
                    <Text style={styles.inputLabel}>Email Address:</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="user@example.com"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.textInput}
                    />

                    <Text style={styles.inputLabel}>Password:</Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry
                      style={styles.textInput}
                    />

                    <View style={styles.quickDemoRow}>
                      <Text style={styles.quickDemoLabel}>Autofill Credentials:</Text>
                      <Pressable onPress={() => fillQuickDemo('resident')} style={styles.quickDemoChip}>
                        <Text style={styles.quickDemoChipText}>Resident Demo</Text>
                      </Pressable>
                      <Pressable onPress={() => fillQuickDemo('citizen')} style={styles.quickDemoChip}>
                        <Text style={styles.quickDemoChipText}>Citizen Demo</Text>
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={handleEmailLogin}
                      style={[styles.primaryActionBtn, loading && styles.btnDisabled]}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Sign In / دخول</Text>
                      )}
                    </Pressable>
                  </View>
                )}

                {/* ========================================================= */}
                {/* TAB 3: REGISTER NEW ACCOUNT */}
                {/* ========================================================= */}
                {activeTab === 'register' && (
                  <View style={styles.sectionBody}>
                    <Text style={styles.inputLabel}>Full Name (الاسم الكامل):</Text>
                    <TextInput
                      value={regName}
                      onChangeText={setRegName}
                      placeholder="e.g. Tariq Mansoor"
                      placeholderTextColor={COLORS.textMuted}
                      style={styles.textInput}
                    />

                    <Text style={styles.inputLabel}>Email Address:</Text>
                    <TextInput
                      value={regEmail}
                      onChangeText={setRegEmail}
                      placeholder="tariq@example.sa"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.textInput}
                    />

                    <Text style={styles.inputLabel}>National ID / Iqama (Optional):</Text>
                    <TextInput
                      value={regNationalId}
                      onChangeText={setRegNationalId}
                      placeholder="10-digit Saudi ID or Iqama"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                      style={styles.textInput}
                    />

                    <Text style={styles.inputLabel}>Password (Min 6 chars):</Text>
                    <TextInput
                      value={regPassword}
                      onChangeText={setRegPassword}
                      placeholder="Create password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry
                      style={styles.textInput}
                    />

                    <Pressable
                      onPress={handleRegister}
                      style={[styles.primaryActionBtn, loading && styles.btnDisabled]}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Create Account / إنشاء حساب</Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  crestBadge: {
    width: 44,
    height: 44,
    borderRadius: RADII.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  crestGlyph: {
    fontSize: 22,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  sheetSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADII.full,
    backgroundColor: COLORS.cardSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  contentScroll: {
    marginTop: 16,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardSubtle,
    borderRadius: RADII.md,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADII.sm,
  },
  tabButtonActive: {
    backgroundColor: COLORS.card,
    ...SHADOWS.sm,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: COLORS.dangerLight,
    padding: 12,
    borderRadius: RADII.sm,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 13,
    color: COLORS.danger,
    lineHeight: 18,
  },
  sectionBody: {
    paddingVertical: 4,
  },
  nafathBrandCard: {
    backgroundColor: COLORS.primaryLight,
    padding: 14,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 16,
    alignItems: 'center',
  },
  nafathBrandArabic: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  nafathBrandEnglish: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  nafathBrandDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: COLORS.cardSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  quickDemoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  quickDemoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  quickDemoChip: {
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADII.full,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  quickDemoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.goldDark,
  },
  primaryActionBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADII.md,
    alignItems: 'center',
    marginTop: 12,
    ...SHADOWS.emerald,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  challengeBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  challengePromptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  challengePromptSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  challengeCodeCard: {
    width: 120,
    height: 100,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADII.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 18,
    ...SHADOWS.emerald,
  },
  challengeCodeNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 4,
  },
  challengeTimer: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.goldDark,
    marginBottom: 16,
  },
  backBtn: {
    marginTop: 14,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  profileBox: {
    paddingVertical: 8,
  },
  profileAvatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.cardSubtle,
    padding: 16,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  nafathVerifiedPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.full,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  nafathVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  metaList: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  logoutBtn: {
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 14,
    borderRadius: RADII.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
