import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useProjects } from '@/context/ProjectsContext';
import { parseRepoInput } from '@/lib/repo-url';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Streak%20Keeper';

export default function AddProjectScreen() {
  const { addProject } = useProjects();
  const [repoInput, setRepoInput] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = parseRepoInput(repoInput);

  const onLink = async () => {
    if (!parsed) {
      Alert.alert('Need a repo', 'Paste a GitHub link, e.g. https://github.com/you/your-repo');
      return;
    }
    if (!token.trim()) {
      Alert.alert('Need a token', 'The phone pushes over HTTPS. SSH keys cannot push from Android.');
      return;
    }
    setSaving(true);
    try {
      await addProject(repoInput, token);
      Alert.alert('Linked', 'Token saved on this device. You can tap +1 now.');
      router.back();
    } catch (err) {
      Alert.alert('Could not link', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Link a repo</Text>
        <Text style={styles.hint}>
          Paste the GitHub link and a personal access token with repo access. The phone commits over HTTPS — SSH deploy keys do not work here.
        </Text>

        <Text style={styles.label}>Repo</Text>
        <TextInput
          style={styles.input}
          value={repoInput}
          onChangeText={setRepoInput}
          placeholder="https://github.com/user/repo"
          placeholderTextColor="#6e7681"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>GitHub token</Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="ghp_… or github_pat_…"
          placeholderTextColor="#6e7681"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Pressable onPress={() => WebBrowser.openBrowserAsync(TOKEN_URL)}>
          <Text style={styles.link}>Create a classic token (repo scope)</Text>
        </Pressable>

        <Pressable style={[styles.save, saving && styles.disabled]} onPress={onLink} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Link repo</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  form: { padding: 16, paddingBottom: 40 },
  title: { color: '#e6edf3', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  hint: { color: '#8b949e', lineHeight: 20, marginBottom: 18, fontSize: 14 },
  label: { color: '#c9d1d9', marginBottom: 6, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#e6edf3',
    fontSize: 15,
    marginBottom: 16,
  },
  link: { color: '#3fb950', fontWeight: '700', marginTop: -8, marginBottom: 20 },
  save: {
    backgroundColor: '#238636',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.7 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
