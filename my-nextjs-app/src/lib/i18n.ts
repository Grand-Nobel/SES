import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from '../../locales/en/common.json';
import ar from '../../locales/ar/common.json';

i18n
  .use(initReactI18next) // passes i18n to react-i18next
  .init({
    resources: {
      en: {
        common: en,
      },
      ar: {
        common: ar,
      },
    },
    lng: 'en', // default language
    fallbackLng: 'en',

    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
