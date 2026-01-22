import type { TranslationKey } from "./en"

export const ko: Record<TranslationKey, string> = {
  // Language selection dialog
  "language.select.title": "언어 선택",
  "language.select.description": "사용할 언어를 선택하세요",
  "language.english": "English",
  "language.korean": "한국어",

  // Sidebar buttons
  "sidebar.openProject": "프로젝트 열기",
  "sidebar.connectProvider": "프로바이더 연결",

  // Notifications
  "notification.ready": "ANYON 준비됨",
  "notification.error": "세션 오류",

  // Getting started
  "gettingStarted.title": "시작하기",
  "gettingStarted.freeModels": "ANYON에는 무료 모델이 포함되어 있어 바로 시작할 수 있습니다.",
  "gettingStarted.connectAny": "Claude, GPT, Gemini 등 다양한 모델을 사용하려면 프로바이더를 연결하세요.",

  // Home page
  "home.noProjects": "최근 프로젝트 없음",
  "home.getStarted": "로컬 프로젝트를 열어 시작하세요",

  // Git dialog
  "git.startProject": "프로젝트 시작",
  "git.noRepo": "이 폴더에 Git 저장소가 없습니다. 어떻게 시작할까요?",
  "git.newStart": "새로 시작",
  "git.emptyRepo": "빈 저장소로 시작",
  "git.clone": "Clone",
  "git.cloneFromGithub": "GitHub에서 복제",
  "git.repoUrl": "Repository URL",
  "git.cancel": "취소",
}
