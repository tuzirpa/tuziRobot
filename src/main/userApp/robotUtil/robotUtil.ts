import type { Block } from '../types';
import { sendLog, olog } from './commonUtil';
import fs from 'fs';

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

//循环执行指令 给指令套上一层 异常处理
function forRobotUtil(obj: any) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'function') {
                let retryCountNum = 0;
                obj[key] = async function aaa(...args: any[]) {
                    const blockInfo = args[args.length - 1] as Block;
                    try {
                        console['runStep'](`执行指令${blockInfo.directiveDisplayName}`);

                        const result = await (value as Function).apply(this, args);
                        return result;
                    } catch (error: any) {
                        // olog(error);
                        console.error(
                            'error',
                            `执行指令 ${blockInfo.directiveDisplayName} 异常: ${error.message}`,
                            blockInfo,
                            error
                        );
                        if (blockInfo.failureStrategy === 'terminate') {
                            console.error(
                                'error',
                                `执行指令 ${blockInfo.directiveDisplayName} 异常,终止流程`,
                                blockInfo
                            );
                            process.exit(1);
                        } else if (blockInfo.failureStrategy === 'ignore') {
                            console.error(
                                'error',
                                `执行指令 ${blockInfo.directiveDisplayName} 异常 ,忽略错误`,
                                blockInfo
                            );
                            return {};
                        } else {
                            retryCountNum++;

                            if (retryCountNum > blockInfo.retryCount) {
                                console.error(
                                    'error',
                                    `执行指令 ${blockInfo.directiveDisplayName} 异常 ,重试次数达到上限`,
                                    blockInfo
                                );
                                process.exit(1);
                            } else {
                                console.error(
                                    'error',
                                    `执行指令 ${blockInfo.directiveDisplayName} 异常 ,${blockInfo.intervalTime} 秒后重试第${retryCountNum}次`,
                                    blockInfo
                                );
                            }
                            await sleep(blockInfo.intervalTime * 1000);
                            console.log('重试执行指令', this, ...args);
                            return aaa.apply(this, args);
                        }
                    }
                };
            } else {
                forRobotUtil(value);
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
    directiveName,
    directiveDisplayName,
    failureStrategy,
    intervalTime,
    retryCount
) => {
    return {
        blockLine,
        flowName,
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
    olog(error);
    if (generateBlockCode && generateBlockCode[0]) {
        console['fatalError'](eval(generateBlockCode[0]), '致命错误,退出流程:', error);
    } else {
        console['fatalError']('致命错误,退出流程:' + error.message, {
            blockLine: -1,
            flowName: '未知流程',
            directiveName: '',
            directiveDisplayName: '',
            failureStrategy: 'terminate',
            intervalTime: 0,
            retryCount: 0
        });
    }
};

export default robotUtil;
