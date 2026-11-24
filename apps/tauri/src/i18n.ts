import { en, zh } from '@navigation/core'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

function resolveLanguage() {
  if (navigator.language.startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: resolveLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})
