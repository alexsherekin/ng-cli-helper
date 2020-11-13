export interface ComponentSettings {
    "change-detection": "Default" | "OnPush";
    "display-block": boolean;
    "inline-template": boolean;
    "inline-style": boolean;
    "prefix": string;
    "style": "css" | "scss" | "sass" | "less" | "styl";
    "view-encapsulation": "Emulated" | "Native" | "None" | "ShadowDom";
}

export interface ComponentConfig extends ComponentSettings {
    get<T extends keyof ComponentConfig>(key: T): ComponentConfig[T];
}
