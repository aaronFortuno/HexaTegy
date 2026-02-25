/**
 * i18n — helper de traducció mínim.
 *
 * Idiomes: ca (per defecte), es, en.
 * t("key") retorna la cadena traduïda o la clau si no existeix.
 */
import { ca } from "./ca.js";
import { es } from "./es.js";
import { en } from "./en.js";
const LOCALES = {
    ca: ca,
    es: es,
    en: en,
};
const STORAGE_KEY = "hexategy_locale";
let current = ca;
let currentLocale = "ca";
// Listeners que es notifiquen quan canvia l'idioma
const localeListeners = new Set();
/** Subscriure's als canvis d'idioma. Retorna una funció per dessubscriure's. */
export function onLocaleChange(cb) {
    localeListeners.add(cb);
    return () => localeListeners.delete(cb);
}
/** Inicialitzar l'idioma (detecta el navegador o llegeix localStorage) */
export function initI18n() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const browserLang = navigator.language.slice(0, 2).toLowerCase();
    const detected = stored ?? (LOCALES[browserLang] ? browserLang : "ca");
    setLocale(detected);
}
export function setLocale(locale) {
    const translations = LOCALES[locale];
    if (!translations)
        return;
    current = translations;
    currentLocale = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.setAttribute("lang", locale);
    // Notificar subscriptors (vistes que necessiten re-renderitzar)
    localeListeners.forEach((cb) => cb());
}
export function getLocale() { return currentLocale; }
export function t(key) {
    return current[key] ?? key;
}
export const AVAILABLE_LOCALES = [
    { code: "ca", label: "Català" },
    { code: "es", label: "Castellano" },
    { code: "en", label: "English" },
];
