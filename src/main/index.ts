import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import Action from './action/Action';
import MethodsUtils from '@shared/MethodsUtils';
import { registerAssetsProtocol } from './serve';
import { WindowManage } from './window/WindowManage';

import robotUtil from './userApp/robotUtil/robotUtil?modulePath';
import robotLog from './userApp/robotUtil/commonUtil?modulePath';
import UserApp from './userApp/UserApp';
import UserAppManage from './userApp/UserAppManage';
import { autoUpdateInit } from './autoUpdater/autoUpdater';

let mainWindow: BrowserWindow;
const gotTheLock = app.isPackaged ? app.requestSingleInstanceLock() : true; //仅生产环境生效

if (!is.dev) {
    for (let i = 0; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (
            arg.indexOf('--inspect') !== -1 ||
            arg.indexOf('--inspect-brk') !== -1 ||
            arg.indexOf('--remote-debugging-port') !== -1
        ) {
            //调试启动此程序不启动
            throw new Error('调试启动此程序不启动');
        }
    }
}

if (!gotTheLock) {
    app.quit();
} else {
    protocol.registerSchemesAsPrivileged([
        { scheme: 'assets', privileges: { secure: true, standard: true, supportFetchAPI: true } }
    ]);
    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
    start();
}
function start() {
    MethodsUtils.getStaticMethods(Action).forEach((item: any) => {
        const { name, method }: { name: string; method: Function } = item;
        ipcMain.handle(name, async (_e, ...args) => {
            try {
                const result = await method.call(Action, ...args);
                if (result) {
                    return { error: false, data: JSON.parse(JSON.stringify(result)) };
                }
                return { error: false };
            } catch (e: any) {
                console.error(e);
                return { error: true, message: e.message };
            }
        });
    });

    function createWindow() {
        console.log('createWindow');

        //判断是否登录
        const url = import.meta.env.DEV ? process.env['ELECTRON_RENDERER_URL'] : 'assets://app';
        //创建登录窗口
        mainWindow = WindowManage.createWindow('login');
        mainWindow.loadURL(url + '/#/login/index');
        if (import.meta.env.DEV) {
            setTimeout(() => {
                mainWindow.webContents.openDevTools();
            }, 5000);
        } else {
            console.log('生产环境下，启用自动更新');
            autoUpdateInit(mainWindow);
        }

        //扫码本地app
        UserApp.rebotUtilPath = robotUtil;
        UserApp.rebotUtilLogPath = robotLog;
        UserAppManage.scanLocalApp();

        mainWindow.on('closed', () => {
            app.quit();
        });
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.whenReady().then(() => {
        registerAssetsProtocol();
        createWindow();
        UserApp.init();
        // Set app user model id for windows
        electronApp.setAppUserModelId('com.tuzirpa.app');

        // Default open or close DevTools by F12 in development
        // and ignore CommandOrControl + R in production.
        // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
        app.on('browser-window-created', (_, window) => {
            optimizer.watchWindowShortcuts(window);
        });

        // IPC test
        // ipcMain.on('ping', () => console.log('pong'));

        // createWindow();

        app.on('activate', function () {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // In this file you can include the rest of your app"s specific main process
    // code. You can also put them in separate files and require them here.
}

function versionsPrint() {
    // electron 版本

    console.log('process.versions.electron', process.versions.electron);

    // ABI版本

    console.log('process.versions.modules', process.versions.modules);

    // NODE版本
    console.log('process.versions.node', process.versions.node);

    // V8 引擎版本
    console.log('process.versions.v8', process.versions.v8);

    // chrome版本
    console.log('process.versions.chrome', process.versions.chrome);

    // 架构信息
    console.log('process.env.PROCESSOR_ARCHITECTURE', process.env.PROCESSOR_ARCHITECTURE);
}
versionsPrint();
