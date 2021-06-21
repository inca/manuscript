import 'reflect-metadata';

import { Container } from 'inversify';

import { ConfigManager, WorkspaceOptions } from './ConfigManager';
import { DevServer } from './DevServer';
import { EventBus } from './EventBus';
import { managerClasses, ManagerService } from './manager';
import { PagesManager } from './PagesManager';
import { ScriptsManager } from './ScriptsManager';
import { StylesheetsManager } from './StylesheetsManager';
import { TemplateManager } from './TemplatesManager';

export class Workspace {
    container = new Container({ skipBaseClassChecks: true });

    constructor(rootDir: string, optionOverrides: Partial<WorkspaceOptions> = {}) {
        this.container.bind('rootDir').toConstantValue(rootDir);
        this.container.bind('optionOverrides').toConstantValue(optionOverrides);
        this.container.bind(ConfigManager).toSelf().inSingletonScope();
        this.container.bind(DevServer).toSelf().inSingletonScope();
        this.container.bind(EventBus).toSelf().inSingletonScope();
        this.container.bind(PagesManager).toSelf().inSingletonScope();
        this.container.bind(ScriptsManager).toSelf().inSingletonScope();
        this.container.bind(StylesheetsManager).toSelf().inSingletonScope();
        this.container.bind(TemplateManager).toSelf().inSingletonScope();

        for (const cl of managerClasses) {
            this.container.bind('manager').toService(cl);
        }
    }

    getManagers(): ManagerService[] {
        return this.container.getAll<ManagerService>('manager');
    }

    async init() {
        await Promise.all(this.getManagers().map(mgr => mgr.init()));
    }

    async build() {
        await Promise.all(this.getManagers().map(mgr => mgr.build()));
    }

    async watch() {
        await Promise.all(this.getManagers().map(mgr => mgr.watch()));
    }

    async serve(port: number) {
        await this.init();
        await this.watch();
        const devServer = this.container.get(DevServer);
        await devServer.serve(port);
    }

}
