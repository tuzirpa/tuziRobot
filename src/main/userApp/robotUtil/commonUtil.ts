import path from 'path';
import { Block, DirectiveInput, LogLevel } from '../types';
import { WebSocket } from 'ws';

export const olog = console.log;
export const sendLog = (level: LogLevel = 'info', message: string, data: Block, error?: Error) => {
    olog(
        `robotUtilLog-` +
            `${encodeURIComponent(JSON.stringify({ level, time: Date.now(), message, data, error }))}`
    );
};

export const sendStepLog = (message: string) => {
    olog(`robotUtilRunStep-` + `${encodeURIComponent(message)}`);
};

export function typeToCode(inputItem: DirectiveInput) {
    if (inputItem.type === 'string') {
        return `String(\`${inputItem.value}\`)`;
    } else if (inputItem.type === 'number') {
        return `Number(String(\`${inputItem.value}\`))`;
    } else if (inputItem.type === 'boolean') {
        return `String(\`${inputItem.value}\`).toLowerCase() == 'true'`;
    }
    return '';
}

declare const curApp: {
    APP_ID: string;
    APP_NAME: string;
    APP_VERSION: string;
    APP_DIR: string;
};

/**
 * 获取当前运行的应用信息
 */
export function getCurApp() {
    return curApp;
}

/**
 * 导入子流程
 * @param appDir 应用目录
 * @param moduleName 模块名
 * @returns
 */
export function flowModuleImport(appDir: string, moduleName: string) {
    const module = path.join(appDir, moduleName);
    // delete require.cache[module];
    return require(module);
}

let messageId = 0;

/**
 * 导入子流程
 * @returns
 */
export function invokeApi(method: string, params: { [key: string]: any }) {
    return new Promise((resolve, reject) => {
        const id = ++messageId;
        const ws = new WebSocket(`ws://localhost:4046`);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id, appId: curApp.APP_ID, method, params }));

            ws.once('message', (data: any) => {
                const res = JSON.parse(data.toString());
                if (res.code === 1) {
                    resolve(res.result);
                } else {
                    reject(new Error(res.result));
                }
                ws.close();
            });
        });

        ws.on('error', (error: any) => {
            reject(error);
        });
    });
}
