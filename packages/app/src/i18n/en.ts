export const en = {
  // Language selection dialog
  "language.select.title": "Choose Language",
  "language.select.description": "Select your preferred language",
  "language.english": "English",
  "language.korean": "한국어",

  // Sidebar buttons
  "sidebar.openProject": "Open project",
  "sidebar.connectProvider": "Connect provider",

  // Notifications
  "notification.ready": "ANYON ready",
  "notification.error": "Session error",

  // Getting started
  "gettingStarted.title": "Getting started",
  "gettingStarted.freeModels": "ANYON includes free models so you can start immediately.",
  "gettingStarted.connectAny": "Connect any provider to use models, inc. Claude, GPT, Gemini etc.",

  // Home page
  "home.noProjects": "No recent projects",
  "home.getStarted": "Get started by opening a local project",

  // Git dialog
  "git.startProject": "Start project",
  "git.noRepo": "No Git repository found in this folder. How would you like to start?",
  "git.newStart": "New start",
  "git.emptyRepo": "Start with empty repository",
  "git.clone": "Clone",
  "git.cloneFromGithub": "Clone from GitHub",
  "git.repoUrl": "Repository URL",
  "git.cancel": "Cancel",
} as const

export type TranslationKey = keyof typeof en
