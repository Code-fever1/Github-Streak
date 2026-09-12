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
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useProjects } from '@/context/ProjectsContext';
import { parseRepoInput } from '@/lib/repo-url';
import { deployKeysUrl } from '@/lib/ssh-key';

export default function AddProjectScreen() {
  const { addProject } = useProjects();
  const [repoInput, setRepoInput] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = parseRepoInput(repoInput);

  const onLink = async () => {
    if (!parsed) {
      Alert.alert('Need a repo', 'Paste a GitHub link, e.g. https://github.com/you/your-repo');
      return;
    }
    setSaving(true);
    try {
      const result = await addProject(repoInput);
      setOwner(result.project.owner);
      setRepo(result.project.repo);
      setPublicKey(result.publicKey);
      await Clipboard.setStringAsync(result.publicKey);
    } catch (err) {
      Alert.alert('Could not link', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onCopy = async () => {
    if (!publicKey) return;
    await Clipboard.setStringAsync(publicKey);
    Alert.alert('Copied', 'Paste it as a deploy key on GitHub (allow write).');
  };

  const onOpenGithub = async () => {
    if (!owner || !repo) return;
    await WebBrowser.openBrowserAsync(deployKeysUrl(owner, repo));
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.title}>Link a repo</Text>
        <Text style={styles.hint}>Paste the GitHub link. We create a unique SSH key for you — add it on GitHub, done.</Text>

        <Text style={styles.label}>Repo</Text>
        <TextInput
          style={styles.input}
          value={repoInput}
          onChangeText={setRepoInput}
          placeholder="https://github.com/user/repo"
          placeholderTextColor="#6e7681"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!publicKey}
        />

        {!publicKey ? (
          <Pressable style={[styles.save, saving && styles.disabled]} onPress={onLink} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Generate SSH key & link</Text>}
          </Pressable>
        ) : (
          <View style={styles.keyBox}>
            <Text style={styles.keyLabel}>Add this deploy key on GitHub (write access)</Text>
            <Text style={styles.key} selectable>
              {publicKey}
            </Text>
            <Pressable style={styles.copy} onPress={onCopy}>
              <Text style={styles.copyText}>Copy key</Text>
            </Pressable>
            <Pressable style={styles.github} onPress={onOpenGithub}>
              <Text style={styles.githubText}>Open GitHub → Deploy keys</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={() => router.back()}>
              <Text style={styles.saveText}>Done</Text>
            </Pressable>
          </View>
        )}
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
  save: {
    backgroundColor: '#238636',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.7 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  keyBox: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  keyLabel: { color: '#8b949e', fontSize: 13, marginBottom: 8 },
  key: { color: '#c9d1d9', fontSize: 12, lineHeight: 18 },
  copy: { marginTop: 12, alignSelf: 'flex-start' },
  copyText: { color: '#3fb950', fontWeight: '700' },
  github: {
    marginTop: 12,
    backgroundColor: '#21262d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 12,
  },
  githubText: { color: '#e6edf3', fontWeight: '600' },
});
