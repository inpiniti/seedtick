// src/services/modelPreferenceStorage.ts - 마지막으로 선택한 AI 모델/추론 수준을 기기에 기억한다.

const SELECTED_MODEL_KEY = 'reportist_video_selected_model';
const SELECTED_EFFORT_KEY = 'reportist_video_selected_effort';

export function getStoredSelectedModel(): string | null {
  try {
    return localStorage.getItem(SELECTED_MODEL_KEY);
  } catch {
    return null;
  }
}

export function setStoredSelectedModel(modelId: string | null): void {
  try {
    if (modelId) {
      localStorage.setItem(SELECTED_MODEL_KEY, modelId);
    } else {
      localStorage.removeItem(SELECTED_MODEL_KEY);
    }
  } catch {}
}

export function getStoredSelectedEffort(): string | null {
  try {
    return localStorage.getItem(SELECTED_EFFORT_KEY);
  } catch {
    return null;
  }
}

export function setStoredSelectedEffort(effort: string | null): void {
  try {
    if (effort) {
      localStorage.setItem(SELECTED_EFFORT_KEY, effort);
    } else {
      localStorage.removeItem(SELECTED_EFFORT_KEY);
    }
  } catch {}
}
