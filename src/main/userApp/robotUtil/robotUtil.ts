import fs from 'fs';
import type { Block } from '../types';
import { sendLog, blockContext } from './commonUtil';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extendDirective = require('../../extend');
const extend = extendDirective || {};

const systemDirective = require('../../system');
const system = systemDirective || {};

export const robotUtil = {
    sendLog,
    // dataProcessing,
    // web,
    // flowControl,
    // wait,
    extend,
    system
};

// 异常类：支持堆栈叠加
class WrappedError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'WrappedError';
        if (cause && cause.stack) {
            this.stack += '\n\n↓ Caused by ↓\n' + cause.stack;
        }
    }
}


// 核心处理器：拦截 + 异常策略封装
function forRobotUtil(obj: any) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];

            if (typeof value === 'function') {
                obj[key] = async function wrappedFn(...args: any[]) {
                    const blockInfo = args[args.length - 1] as Block;
                    let retryCountNum = 0;

                    return await blockContext.run({ block: blockInfo }, async () => {
                        while (true) {
                            try {
                                console['runStep']?.(`执行指令 ${blockInfo.directiveDisplayName}`);

                                const result = await (value as Function).apply(this, args);
                                return result;

                            } catch (error: any) {
                                const wrapped = new WrappedError(
                                    `${blockInfo.flowAliasName}[行: ${blockInfo.blockLine}] 执行指令 ${blockInfo.directiveDisplayName} 出错`,
                                    error
                                );

                                console.error(wrapped); // 注意：打印的是堆叠后的异常

                                if (blockInfo.failureStrategy === 'terminate') {
                                    console.error(`终止流程：${wrapped.stack}`);
                                    process.exit(1);

                                } else if (blockInfo.failureStrategy === 'throw') {
                                    throw wrapped;

                                } else if (blockInfo.failureStrategy === 'ignore') {
                                    console.warn(`忽略异常：${wrapped.message}`);
                                    return {};

                                } else {
                                    retryCountNum++;
                                    if (retryCountNum > blockInfo.retryCount) {
                                        console.error(`重试次数已达上限`);
                                        throw new WrappedError(
                                            `执行指令 ${blockInfo.directiveDisplayName} 重试失败`,
                                            wrapped
                                        );
                                    } else {
                                        console.warn(`第 ${retryCountNum} 次重试将在 ${blockInfo.intervalTime} 秒后进行`);
                                        await sleep(blockInfo.intervalTime * 1000);
                                        // 重试继续
                                    }
                                }
                            }
                        }
                    });
                };
            } else if (typeof value === 'object' && value !== null) {
                forRobotUtil(value); // 递归处理嵌套
            }
        }
    }
}

forRobotUtil(robotUtil);

/**
 * 生成指令块
 * @param blockLine
 * @param flowName
 * @param directiveName
 * @param directiveDisplayName
 * @param failureStrategy
 * @param intervalTime
 * @param retryCount
 * @returns
 */
export const generateBlock = (
    blockLine,
    flowName,
    flowAliasName,
    directiveName,
    directiveDisplayName,
    failureStrategy,
    intervalTime,
    retryCount
) => {
    return {
        blockLine,
        flowName,
        flowAliasName,
        directiveName,
        directiveDisplayName,
        failureStrategy,
        intervalTime,
        retryCount
    };
};

export const fatalError = (error: any, fileName: string) => {
    const reg = new RegExp(`\\(${fileName.replace(/\\/g, '\\\\')}:(\\d+):(\\d+)\\)`);
    const match = error.stack.match(reg);
    const lineNumber = match[1];
    const curFileContent = fs.readFileSync(fileName, 'utf8');
    const lineContent = curFileContent.split('\n')[lineNumber - 1];
    const generateBlockCode = lineContent.trim().match(/generateBlock\(.*?\)/);
    if (generateBlockCode && generateBlockCode[0]) {
        globalThis._block = eval(generateBlockCode[0]);
        console['fatalError'](error.stack);
    } else {
        globalThis._block = {
            blockLine: -1,
            flowName: '未知流程',
            flowAliasName: '未知流程',
            directiveName: '',
            directiveDisplayName: '',
            failureStrategy: 'terminate',
            intervalTime: 0,
            retryCount: 0
        };
        console['fatalError'](error.stack);
    }
};

export default robotUtil;
