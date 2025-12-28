import { create } from "zustand";

type SettingsState = {
  notificationsEnabled: boolean;
  voiceEnabled: boolean;
  darkMode: boolean;
  toggleNotifications: () => void;
  toggleVoice: () => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  notificationsEnabled: true,
  voiceEnabled: true,
  darkMode: true,

  toggleNotifications: () =>
    set((s) => ({ notificationsEnabled: !s.notificationsEnabled })),

  toggleVoice: () =>
    set((s) => ({ voiceEnabled: !s.voiceEnabled })),
}));
