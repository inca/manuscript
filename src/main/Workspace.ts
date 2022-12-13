import 'reflect-metadata';

import { Mesh } from '@nodescript/mesh';

import { ConfigManager, WorkspaceOptions } from './ConfigManager.js';
import { DevServer } from './DevServer.js';
import { EventBus } from './EventBus.js';
import { managerClasses, ManagerService } from './manager.js';
import { PagesManager } from './PagesManager.js';
import { ScriptsManager } from './ScriptsManager.js';
import { StaticManager } from './StaticManager.js';
import { StylesheetsManager } from './StylesheetsManager.js';
import { TemplateManager } from './TemplatesManager.js';

/**
 * The composition root.
 */
export class Workspace {
    mesh = new Mesh('Workspace');

    constructor(public rootDir: string, optionOverrides: Partial<WorkspaceOptions> = {}) {
        this.mesh.constant('rootDir', rootDir);
        this.mesh.constant('optionOverrides', optionOverrides);
        this.mesh.service(ConfigManager);
        this.mesh.service(DevServer);
        this.mesh.service(EventBus);
        this.mesh.service(PagesManager);
        this.mesh.service(ScriptsManager);
        this.mesh.service(StaticManager);
        this.mesh.service(StylesheetsManager);
        this.mesh.service(TemplateManager);
    }

    getManagers(): ManagerService[] {
        return managerClasses.map(_ => this.mesh.resolve(_));
    }

    async build() {
        await this.runInit();
        await this.runBuild();
    }

    async serve(port: number) {
        await this.runInit();
        await this.runWatch();
        const devServer = this.mesh.resolve(DevServer);
        await devServer.serve(port);
    }

    protected async runInit() {
        for (const mgr of this.getManagers()) {
            await mgr.init();
        }
    }

    protected async runBuild() {
        await Promise.all(this.getManagers().map(mgr => mgr.build()));
    }

    protected async runWatch() {
        await Promise.all(this.getManagers().map(mgr => mgr.watch()));
    }

}
