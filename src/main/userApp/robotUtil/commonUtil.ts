import path from 'path';
import { Block, DirectiveInput, LogLevel } from '../types';
import { WebSocket } from 'ws';
import fs from 'fs';

export const olog = console.log;
export const oerror = console.error;
export const sendLog = (level: LogLevel = 'info', message: string, data: Block, error?: Error) => {
    if (process.env.TUZI_ENV === 'app') {
        // olog(
        //     `robotUtilLog-` +
        //         `${encodeURIComponent(JSON.stringify({ level, time: Date.now(), message, data, error }))}`
        // );
        if (process.send) {
            process.send({ type: 'log', data: { level, time: Date.now(), message, data, error } });
        }
    }
};

export const sendStepLog = (message: any) => {
    if (process.env.TUZI_ENV === 'app') {
        // olog(`robotUtilRunStep-` + `${encodeURIComponent(message)}`);
        if (process.send) {
            process.send({ type: 'step', data: message });
        }
    }
};

export function typeToCode(inputItem?: DirectiveInput) {
    if(!inputItem){
        return 'undefined';
    }

    if (inputItem.type === 'string' || inputItem.type === 'textarea') {
        inputItem.value = inputItem.value || '';
        let value = inputItem.value;
        // value = inputItem.value.replace(/\\/g, '\\\\');
        value = String(value).replace(/\`/g, '\\`');
        return `String(\`${value}\`)`;
    } else if (inputItem.type === 'number') {
        return `Number(String(\`${inputItem.value}\`))`;
    } else if (inputItem.type === 'boolean') {
        return `String(\`${inputItem.value ?? ''}\`).toLowerCase() == 'true'`;
    } else if (inputItem.type === 'object') {
        
        if (inputItem.objectMode) {
            if (inputItem.objectMode === 'string') {
                return `String(\`${inputItem.value ?? ''}\`)`;
            } else if (inputItem.objectMode === 'expression') {
                return `${inputItem.value ?? ''}`;
            } else if (inputItem.objectMode === 'stringRaw') {
                inputItem.value = inputItem.value || '';
                return JSON.stringify(inputItem.value);
            }
        }
        // 保留旧的 enableExpression 配置，兼容旧版本
        if (!inputItem.enableExpression) {
            return `String(\`${inputItem.value ?? ''}\`)`;
        }
        return `${inputItem.value ?? ''}`;
    }
    return '';
}

declare const curApp: {
    APP_ID: string;
    APP_NAME: string;
    APP_VERSION: string;
    APP_DIR: string;
    startRunTime: number;
};

/**
 * 获取当前运行的应用信息
 */
export function getCurApp() {
    return curApp;
}

/**
 * 兔子RPA软件信息
 */
declare const _tuziAppInfo: {
    /**
     * 版本
     */
    VSERION: string;
    /**
     * 安装目录
     */
    INSTALL_DIR: string;
    /**
     * 用户目录
     */
    USER_DIR: string;
};

/**
 * 获取当前运行的应用信息
 */
export function getTuziAppInfo() {
    return _tuziAppInfo;
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
        S: this.getMilliseconds().toString().padStart(3, '0') //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp('(' + k + ')').test(fmt))
            fmt = fmt.replace(
                RegExp.$1,
                // @ts-ignore
                RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length)
            );
    return fmt;
};

declare const globalThis: {
    _block: Block;
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
            `[${levelStr}] [${_block.flowAliasName}:(行: ${_block.blockLine})] [${new Date().Format('yyyy-MM-dd hh:mm:ss.S')}]:` +
            message;
        logFileWriteStream.write(content + '\n');
        if (process.env.TUZI_ENV === 'app') {
            sendLog(level, message, _block);
        } else {
            olog(content);
        }
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
    // @ts-ignore
    console['fatalError'] = function () {
        log.call(this, 'fatalError', globalThis._block, ...arguments);
    };
    // @ts-ignore
    console['runStep'] = function () {
        log.call(this, 'debug', globalThis._block, ...arguments);
        const content = {
            level: 'info',
            time: Date.now(),
            message: `执行指令${globalThis._block.directiveDisplayName}`,
            data: globalThis._block
        };
        sendStepLog(content);
    };
}
