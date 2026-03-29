export type Plan = "free" | "pro";
export type Theme = "light" | "dark" | "system";
export type Language = "en" | "fr" | "es" | "de" | "it" | "pt" | "zh" | "ja" | "ko";
export interface CustomInstructions {
    aboutUser: string;
    customPrompt: string;
}

export interface Settings {
    theme: Theme;
    language: Language;
    customInstructions: CustomInstructions;
    plan: Plan;
    aiName: string;
}