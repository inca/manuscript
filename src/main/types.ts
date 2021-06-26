import { WorkspaceOptions } from './ConfigManager';

export interface Link {
    title: string;
    href: string;
}

export interface Page {
    // Filename relative to pagesDir, without extension (e.g. pages/index.md has `index` id)
    id: string;
    title: string;
    text: string;
    html: string;
    sourceFile: string,
    targetFile: string,
    opts: WorkspaceOptions;
}
