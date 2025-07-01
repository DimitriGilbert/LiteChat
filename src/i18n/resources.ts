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
import welcome_en from '../locales/en/welcome.json';

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
import welcome_fr from '../locales/fr/welcome.json';

// German
import common_de from '../locales/de/common.json';
import controls_de from '../locales/de/controls.json';
import canvas_de from '../locales/de/canvas.json';
import settings_de from '../locales/de/settings.json';
import prompt_de from '../locales/de/prompt.json';
import vfs_de from '../locales/de/vfs.json';
import git_de from '../locales/de/git.json';
import ai_de from '../locales/de/ai.json';
import tools_de from '../locales/de/tools.json';
import renderers_de from '../locales/de/renderers.json';
import welcome_de from '../locales/de/welcome.json';

// Spanish
import common_es from '../locales/es/common.json';
import controls_es from '../locales/es/controls.json';
import canvas_es from '../locales/es/canvas.json';
import settings_es from '../locales/es/settings.json';
import prompt_es from '../locales/es/prompt.json';
import vfs_es from '../locales/es/vfs.json';
import git_es from '../locales/es/git.json';
import ai_es from '../locales/es/ai.json';
import tools_es from '../locales/es/tools.json';
import renderers_es from '../locales/es/renderers.json';
import welcome_es from '../locales/es/welcome.json';

// Italian
import common_it from '../locales/it/common.json';
import controls_it from '../locales/it/controls.json';
import canvas_it from '../locales/it/canvas.json';
import settings_it from '../locales/it/settings.json';
import prompt_it from '../locales/it/prompt.json';
import vfs_it from '../locales/it/vfs.json';
import git_it from '../locales/it/git.json';
import ai_it from '../locales/it/ai.json';
import tools_it from '../locales/it/tools.json';
import renderers_it from '../locales/it/renderers.json';
import welcome_it from '../locales/it/welcome.json';

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
    welcome: welcome_en,
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
    welcome: welcome_fr,
  },
  de: {
    common: common_de,
    controls: controls_de,
    canvas: canvas_de,
    settings: settings_de,
    prompt: prompt_de,
    vfs: vfs_de,
    git: git_de,
    ai: ai_de,
    tools: tools_de,
    renderers: renderers_de,
    welcome: welcome_de,
  },
  es: {
    common: common_es,
    controls: controls_es,
    canvas: canvas_es,
    settings: settings_es,
    prompt: prompt_es,
    vfs: vfs_es,
    git: git_es,
    ai: ai_es,
    tools: tools_es,
    renderers: renderers_es,
    welcome: welcome_es,
  },
  it: {
    common: common_it,
    controls: controls_it,
    canvas: canvas_it,
    settings: settings_it,
    prompt: prompt_it,
    vfs: vfs_it,
    git: git_it,
    ai: ai_it,
    tools: tools_it,
    renderers: renderers_it,
    welcome: welcome_it,
  },
} as const;
