import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

const language = import.meta.env.VITE_APP_LANG || 'en';

i18next
  .use(initReactI18next)
  .init({
    resources,
    lng: language,
    fallbackLng: 'en',
    ns: ['common', 'controls', 'canvas', 'settings', 'prompt', 'vfs', 'git', 'ai', 'welcome'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
