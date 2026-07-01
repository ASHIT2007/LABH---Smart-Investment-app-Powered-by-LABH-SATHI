// settings.js - Central configuration & state for user preferences

const DEFAULT_SETTINGS = {
  currency: "INR",
  language: "EN",
  showClock: true,
  theme: "dark",
};

let appSettings = JSON.parse(localStorage.getItem("labh_settings")) || DEFAULT_SETTINGS;

const FX_RATES = {
  INR: 1,
  USD: 0.012,
  JPY: 1.8,
  EUR: 0.011,
  GBP: 0.0095,
};

const SYMBOLS = {
  INR: "₹",
  USD: "$",
  JPY: "¥",
  EUR: "€",
  GBP: "£",
};

const DICTIONARY = {
  EN: {
    dashboard: "Dashboard",
    markets: "Markets",
    portfolio: "Portfolio",
    history: "Trade History",
    sentiment: "Sentiment",
    aipicks: "AI Picks",
    threatglobe: "Threat Globe",
    logout: "Log out",
    search: "Search symbol or name...",
    settings: "Settings",
    language: "Language",
    currency: "Currency",
    showClock: "Show Clock",
    lightTheme: "Light Theme",
  },
  HI: {
    dashboard: "डैशबोर्ड",
    markets: "बाज़ार",
    portfolio: "पोर्टफोलियो",
    history: "ट्रेड हिस्ट्री",
    sentiment: "सेंटीमेंट",
    aipicks: "एआई पिक्स",
    threatglobe: "थ्रेट ग्लोब",
    logout: "लॉग आउट",
    search: "प्रतीक या नाम खोजें...",
    settings: "सेटिंग्स",
    language: "भाषा",
    currency: "मुद्रा",
    showClock: "घड़ी दिखाएं",
    lightTheme: "लाइट थीम",
  },
  ES: {
    dashboard: "Tablero",
    markets: "Mercados",
    portfolio: "Portafolio",
    history: "Historial Comercial",
    sentiment: "Sentimiento",
    aipicks: "Opciones IA",
    threatglobe: "Globo de Amenazas",
    logout: "Cerrar sesión",
    search: "Buscar símbolo o nombre...",
    settings: "Ajustes",
    language: "Idioma",
    currency: "Moneda",
    showClock: "Mostrar Reloj",
    lightTheme: "Tema Claro",
  },
  FR: {
    dashboard: "Tableau de Bord",
    markets: "Marchés",
    portfolio: "Portefeuille",
    history: "Historique",
    sentiment: "Sentiment",
    aipicks: "Choix IA",
    threatglobe: "Globe des Menaces",
    logout: "Se déconnecter",
    search: "Rechercher symbole ou nom...",
    settings: "Paramètres",
    language: "Langue",
    currency: "Devise",
    showClock: "Afficher l'horloge",
    lightTheme: "Thème Clair",
  }
};

window.getSetting = (key) => appSettings[key];

window.updateSetting = (key, value) => {
  appSettings[key] = value;
  localStorage.setItem("labh_settings", JSON.stringify(appSettings));
  applySettings();
};

window.formatPrice = (inrValue, maxDecimals = 2) => {
  if (typeof inrValue !== 'number') return inrValue;
  const currency = appSettings.currency || "INR";
  const rate = FX_RATES[currency] || 1;
  const symbol = SYMBOLS[currency] || "₹";
  const converted = Math.round(inrValue * rate * 100) / 100;
  return symbol + converted.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals });
};

window.t = (key) => {
  const lang = appSettings.language || "EN";
  return DICTIONARY[lang][key] || DICTIONARY["EN"][key] || key;
};

window.applySettings = () => {
  // Theme Toggle
  if (appSettings.theme === "light") {
    document.body.setAttribute("data-theme", "light");
  } else {
    document.body.removeAttribute("data-theme");
  }

  // Clock Toggle
  const clockContainer = document.querySelector(".time-widget-glass");
  if (clockContainer) {
    clockContainer.style.display = appSettings.showClock ? "flex" : "none";
  }

  // Update UI Text Translations (Static nav links)
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key === "search") {
      el.placeholder = window.t(key);
    } else {
      // Handle nodes carefully if there's an icon inside it. 
      // We assume data-i18n elements only contain text to be replaced for simplicity.
      // But if there's an icon inside, we can wrap the text.
      el.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
          child.textContent = window.t(key);
        }
      });
      if (el.childNodes.length === 0) {
          el.textContent = window.t(key);
      }
    }
  });

  // Re-render UI components that depend on currency/language
  // We trigger a custom event that app.js can listen to
  window.dispatchEvent(new Event("settingsChanged"));
};

// Expose open settings for HTML
window.openSettingsModal = () => {
  document.getElementById("settingsLanguage").value = appSettings.language;
  document.getElementById("settingsCurrency").value = appSettings.currency;
  document.getElementById("settingsClock").checked = appSettings.showClock;
  document.getElementById("settingsModal").classList.remove("hidden");
};

window.closeSettingsModal = () => {
  document.getElementById("settingsModal").classList.add("hidden");
};

window.saveSettingsFromUI = () => {
  const lang = document.getElementById("settingsLanguage").value;
  const cur = document.getElementById("settingsCurrency").value;
  const clock = document.getElementById("settingsClock").checked;
  const theme = "dark";

  const requiresReload = (lang !== appSettings.language || cur !== appSettings.currency);

  appSettings = { language: lang, currency: cur, showClock: clock, theme };
  localStorage.setItem("labh_settings", JSON.stringify(appSettings));
  
  applySettings();
  closeSettingsModal();

  if (requiresReload) {
      window.location.reload();
  }
};

// Initial apply
document.addEventListener("DOMContentLoaded", () => {
    applySettings();
});
