// Login / Register screen. Lives outside the (tabs) group so it has no tab bar.
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ApiError, login as apiLogin, register as apiRegister } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText } from '@/components/ui';
import { colors, font, radius, spacing } from '@/lib/theme';

const DEMO_EMAIL = 'demo@k21.local';
const DEMO_PASSWORD = 'demo1234';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(creds?: { email: string; password: string }) {
    setError(null);
    const useEmail = creds?.email ?? email.trim();
    const usePassword = creds?.password ?? password;

    if (!useEmail || !usePassword) {
      setError('Please enter your email and password.');
      return;
    }
    if (mode === 'register' && usePassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === 'register' && !creds
          ? await apiRegister({
              email: useEmail,
              password: usePassword,
              name: name.trim() || undefined,
            })
          : await apiLogin({ email: useEmail, password: usePassword });
      await signIn(result.token, result.user);
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function useDemo() {
    setMode('login');
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    void submit({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.logo}>K21</Text>
            <Text style={styles.tagline}>Calorie Tracker</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </Text>

            {mode === 'register' ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Name (optional)"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="words"
                accessibilityLabel="Name"
              />
            ) : null}

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              accessibilityLabel="Email"
            />

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              accessibilityLabel="Password"
            />

            <ErrorText message={error} />

            <View style={styles.actions}>
              <Button
                label={mode === 'login' ? 'Sign in' : 'Create account'}
                onPress={() => submit()}
                loading={busy}
              />
              <Button
                label="Use demo account"
                variant="secondary"
                onPress={useDemo}
                disabled={busy}
              />
            </View>

            <Button
              label={
                mode === 'login'
                  ? "Don't have an account? Register"
                  : 'Already have an account? Sign in'
              }
              variant="ghost"
              onPress={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              disabled={busy}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.xl },
  brand: { alignItems: 'center' },
  logo: { fontSize: 48, fontWeight: '900', color: colors.green, letterSpacing: 1 },
  tagline: { fontSize: font.h3, color: colors.orange, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  title: { fontSize: font.h2, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.white,
  },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
