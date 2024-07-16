import path from 'path';
import { Block, DirectiveInput, LogLevel } from '../types';
import { WebSocket } from 'ws';
import fs from 'fs';

export const olog = console.log;
export const oerror = console.error;
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

// 格式化时间
//@ts-ignore
Date.prototype.Format = function (fmt: string) {
    //author: meizz
    fmt = fmt || 'yyyy-MM-dd hh:mm:ss';
    var o = {
        'M+': this.getMonth() + 1, //月份
        'd+': this.getDate(), //日
        'h+': this.getHours(), //小时
        'm+': this.getMinutes(), //分
        's+': this.getSeconds(), //秒
        'q+': Math.floor((this.getMonth() + 3) / 3), //季度
        S: this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp('(' + k + ')').test(fmt))
            fmt = fmt.replace(
                RegExp.$1,
                RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length)
            );
    return fmt;
};

/**
 * 设置日志文件路径
 * @param filePath 日志文件路径
 */
export function setLogFile(filePath: string) {
    const logFileWriteStream = fs.createWriteStream(filePath);
    const levelMap = {
        debug: '调试',
        info: '信息',
        warn: '警告',
        error: '错误',
        fatalError: '致命'
    };
    function log(level: LogLevel, _block: Block, ...args: any[]) {
        const message = args.join(' ');
        const levelStr = levelMap[level];
        const content =
            // @ts-ignore
            `[${levelStr}] [${_block.flowName}:(行: ${_block.blockLine})] [${new Date().Format('yyyy-MM-dd hh:mm:ss.S')}]:` +
            message;
        logFileWriteStream.write(content + '\n');
        sendLog(level, message, _block);
    }
    console.log = function () {
        log.call(this, 'info', globalThis._block, ...arguments);
    };
    console.debug = function () {
        log.call(this, 'debug', globalThis._block, ...arguments);
    };
    console.info = function () {
        log.call(this, 'info', globalThis._block, ...arguments);
    };
    console.warn = function () {
        log.call(this, 'warn', globalThis._block, ...arguments);
    };
    console.error = function () {
        log.call(this, 'error', globalThis._block, ...arguments);
    };
    console['fatalError'] = function () {
        oerror(...arguments);
        const args = [...arguments];
        const block = args.shift();
        const errorMsg = args.shift();
        const errorObj = args.shift();
        log.call(this, 'fatalError', block, errorMsg + errorObj.stack);
    };
}
