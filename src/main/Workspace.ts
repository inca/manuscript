import 'reflect-metadata';

import { Container } from 'inversify';

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
    container = new Container({ skipBaseClassChecks: true });

    constructor(public rootDir: string, optionOverrides: Partial<WorkspaceOptions> = {}) {
        this.container.bind('rootDir').toConstantValue(rootDir);
        this.container.bind('optionOverrides').toConstantValue(optionOverrides);
        this.container.bind(ConfigManager).toSelf().inSingletonScope();
        this.container.bind(DevServer).toSelf().inSingletonScope();
        this.container.bind(EventBus).toSelf().inSingletonScope();
        this.container.bind(PagesManager).toSelf().inSingletonScope();
        this.container.bind(ScriptsManager).toSelf().inSingletonScope();
        this.container.bind(StaticManager).toSelf().inSingletonScope();
        this.container.bind(StylesheetsManager).toSelf().inSingletonScope();
        this.container.bind(TemplateManager).toSelf().inSingletonScope();

        for (const cl of managerClasses) {
            this.container.bind('manager').toService(cl);
        }
    }

    getManagers(): ManagerService[] {
        return this.container.getAll<ManagerService>('manager');
    }

    async build() {
        await this.runInit();
        await this.runBuild();
    }

    async serve(port: number) {
        await this.runInit();
        await this.runWatch();
        const devServer = this.container.get(DevServer);
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
