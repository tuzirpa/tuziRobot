import { BrowserWindow } from 'electron';
import { join } from 'path';

const WindowName = ['main', 'login'] as const;

export type WindowNameType = (typeof WindowName)[number];

/**
 * 程序窗口管理器
 */
export class WindowManage {
    static setWindowResizeable(name: WindowNameType, resizeable: boolean) {
        this.getWindow(name).setResizable(resizeable);
    }
    static windows: { [key in string]: BrowserWindow } = {};

    static get mainWindow() {
        return this.getWindow('login');
    }

    /**
     * 创建窗口
     * @param name
     * @returns
     */
    static createWindow(name: WindowNameType) {
        if (this.hasWindow(name)) {
            console.warn(`Window ${name} already exists`);
            return this.getWindow(name);
        }
        const window = new BrowserWindow({
            width: 1400,
            height: 860,
            minWidth: 800,
            minHeight: 600,
            show: true,
            resizable: true,
            frame: false,
            webPreferences: {
                preload: join(__dirname, '../preload/index.js'),
                sandbox: false,
                contextIsolation: false
            }
        });
        window.setMenu(null);
        this.addWindow(name, window);
        return window;
    }

    static addWindow(name: WindowNameType, window: any) {
        if (this.windows[name]) {
            console.warn(`Window ${name} already exists`);
            return;
        }
        this.windows[name] = window;
    }

    static getWindow(name: WindowNameType) {
        return this.windows[name];
    }

    static removeWindow(name: WindowNameType) {
        delete this.windows[name];
    }

    static hasWindow(name: WindowNameType) {
        return this.windows[name] !== undefined;
    }

    static clearWindows() {
        this.windows = {};
    }

    static getAllWindows() {
        return this.windows;
    }
}
