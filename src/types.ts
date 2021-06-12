export interface WorkspaceOptions {
    title: string;
    themeColor: string;
    lang: string;
    description: string;
    charset: string;
    favicon: string;
    isProduction: boolean;
    cssLinks: string[];
    stylesheets: string[];
    [key: string]: any;
}
