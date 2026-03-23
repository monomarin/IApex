import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "dashboard": "Dashboard",
      "new_issue": "New Issue",
      "inbox": "Inbox",
      "work": "Work",
      "issues": "Issues",
      "goals": "Goals",
      "projects": "Projects",
      "agents": "Agents",
      "company": "Company",
      "org": "Org",
      "costs": "Cost Tracker",
      "activity": "Activity",
      "settings": "Settings",
      "chat": "Chat with IApex"
    }
  },
  es: {
    translation: {
      "dashboard": "Panel de Control",
      "new_issue": "Nuevo Ticket",
      "inbox": "Bandeja de Entrada",
      "work": "Trabajo",
      "issues": "Tickets",
      "goals": "Metas",
      "projects": "Proyectos",
      "agents": "Agentes IA",
      "company": "Compañía",
      "org": "Organigrama",
      "costs": "Costos API",
      "activity": "Actividad",
      "settings": "Configuración",
      "chat": "Chat con IApex"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es', // Puedes usar navigator.language para auto-detectar
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
