import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { PersistenceService } from '@/services/persistence.service';

interface SettingsState {
  theme: 'light' | 'dark' | 'system'; defaultTemperature: number; defaultMaxTokens: number | null;
  defaultSystemPrompt: string | null;
}
interface SettingsActions {
  setTheme: (theme: SettingsState['theme']) => void;
  setDefaultTemperature: (temp: number) => void; setDefaultMaxTokens: (tokens: number | null) => void;
  setDefaultSystemPrompt: (prompt: string | null) => void;
  loadSettings: () => Promise<void>;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`;

export const useSettingsStore = create(
  immer<SettingsState & SettingsActions>((set) => ({
    theme: 'system', defaultTemperature: 0.7, defaultMaxTokens: null, defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    setTheme: (t) => { set({ theme: t }); PersistenceService.saveSetting('theme', t); },
    setDefaultTemperature: (t) => { set({ defaultTemperature: t }); PersistenceService.saveSetting('defaultTemperature', t); },
    setDefaultMaxTokens: (t) => { set({ defaultMaxTokens: t }); PersistenceService.saveSetting('defaultMaxTokens', t); },
    setDefaultSystemPrompt: (p) => { set({ defaultSystemPrompt: p }); PersistenceService.saveSetting('defaultSystemPrompt', p); },
    loadSettings: async () => {
      const theme = await PersistenceService.loadSetting('theme', 'system');
      const temp = await PersistenceService.loadSetting('defaultTemperature', 0.7);
      const tokens = await PersistenceService.loadSetting('defaultMaxTokens', null);
      const systemPrompt = await PersistenceService.loadSetting('defaultSystemPrompt', DEFAULT_SYSTEM_PROMPT);
      set({ theme, defaultTemperature: temp, defaultMaxTokens: tokens, defaultSystemPrompt: systemPrompt });
    },
  }))
);
