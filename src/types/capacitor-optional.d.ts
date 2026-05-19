declare module "@capacitor/keyboard" {
  export enum KeyboardResize {
    None = "none",
    Native = "native",
    Body = "body",
    Ionic = "ionic",
  }
  export const Keyboard: {
    setResizeMode(options: { mode: KeyboardResize | string }): Promise<void>;
    setScroll(options: { isDisabled: boolean }): Promise<void>;
    setAccessoryBarVisible(options: { isVisible: boolean }): Promise<void>;
    addListener(eventName: string, listenerFunc: (info?: any) => void): Promise<{ remove: () => Promise<void> }>;
  };
}

declare module "@capacitor/preferences" {
  export const Preferences: {
    get(options: { key: string }): Promise<{ value: string | null }>;
    set(options: { key: string; value: string }): Promise<void>;
    remove(options: { key: string }): Promise<void>;
  };
}

declare module "@capacitor-community/speech-recognition" {
  export const SpeechRecognition: {
    available(): Promise<{ available?: boolean }>;
    checkPermissions(): Promise<{ speechRecognition?: string }>;
    requestPermissions(): Promise<{ speechRecognition?: string }>;
    addListener(eventName: string, listenerFunc: (data?: any) => void): Promise<{ remove: () => Promise<void> }>;
    removeAllListeners(): Promise<void>;
    start(options: Record<string, any>): Promise<{ matches?: string[] } | void>;
    stop(): Promise<void>;
  };
}

declare module "@capacitor/push-notifications" {
  export const PushNotifications: {
    requestPermissions(): Promise<{ receive?: string }>;
    addListener(eventName: string, listenerFunc: (data?: any) => void): Promise<{ remove: () => Promise<void> }>;
    register(): Promise<void>;
  };
}

declare module "@capacitor/device" {
  export const Device: {
    getInfo(): Promise<Record<string, any>>;
  };
}

declare module "@capacitor/local-notifications" {
  export const LocalNotifications: {
    requestPermissions(): Promise<{ display?: string }>;
    schedule(options: Record<string, any>): Promise<void>;
  };
}

declare module "@capacitor/haptics" {
  export enum ImpactStyle {
    Light = "LIGHT",
    Medium = "MEDIUM",
    Heavy = "HEAVY",
  }
  export const Haptics: {
    impact(options: { style: ImpactStyle | string }): Promise<void>;
  };
}
