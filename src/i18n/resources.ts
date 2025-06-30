import common_en from '../locales/en/common.json';
import controls_en from '../locales/en/controls.json';
import canvas_en from '../locales/en/canvas.json';
import settings_en from '../locales/en/settings.json';
import prompt_en from '../locales/en/prompt.json';
import vfs_en from '../locales/en/vfs.json';
import git_en from '../locales/en/git.json';
import ai_en from '../locales/en/ai.json';
import tools_en from '../locales/en/tools.json';
import renderers_en from '../locales/en/renderers.json';

// Add other languages as needed
import common_fr from '../locales/fr/common.json';
import controls_fr from '../locales/fr/controls.json';
import canvas_fr from '../locales/fr/canvas.json';
import settings_fr from '../locales/fr/settings.json';
import prompt_fr from '../locales/fr/prompt.json';
import vfs_fr from '../locales/fr/vfs.json';
import git_fr from '../locales/fr/git.json';
import ai_fr from '../locales/fr/ai.json';
import tools_fr from '../locales/fr/tools.json';
import renderers_fr from '../locales/fr/renderers.json';

export const resources = {
  en: {
    common: common_en,
    controls: controls_en,
    canvas: canvas_en,
    settings: settings_en,
    prompt: prompt_en,
    vfs: vfs_en,
    git: git_en,
    ai: ai_en,
    tools: tools_en,
    renderers: renderers_en,
  },
  fr: {
    common: common_fr,
    controls: controls_fr,
    canvas: canvas_fr,
    settings: settings_fr,
    prompt: prompt_fr,
    vfs: vfs_fr,
    git: git_fr,
    ai: ai_fr,
    tools: tools_fr,
    renderers: renderers_fr,
  },
} as const;
