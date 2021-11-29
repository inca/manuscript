import 'reflect-metadata';

import { Mesh } from 'mesh-ioc';

import { ConfigManager, WorkspaceOptions } from './ConfigManager';
import { DevServer } from './DevServer';
import { EventBus } from './EventBus';
import { managerClasses, ManagerService } from './manager';
import { PagesManager } from './PagesManager';
import { ScriptsManager } from './ScriptsManager';
import { StaticManager } from './StaticManager';
import { StylesheetsManager } from './StylesheetsManager';
import { TemplateManager } from './TemplatesManager';

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
        return [...managerClasses].map(_ => this.mesh.resolve(_));
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
        // Note: init run in order they're defined in container!
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
