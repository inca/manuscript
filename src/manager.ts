export const managerClasses = new Set<ManagerClass>();

export interface ManagerService {
    init(): void | Promise<void>;
    watch(): void | Promise<void>;
}

export interface ManagerClass {
    new (...args: any[]): ManagerService;
}

export function manager() {
    return (target: ManagerClass) => {
        managerClasses.add(target);
    };
}
