import { Workspace } from '../workspace';

export interface DevOptions {
    port: number;
    root: string;
}

export function dev(options: DevOptions) {
    const workspace = new Workspace({
        rootDir: options.root,
    });
    workspace.startDev();
}
