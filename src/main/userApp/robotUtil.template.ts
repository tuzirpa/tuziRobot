import puppeteer from 'puppeteer';
import type { Block, LogLevel } from './types';

export const sendLog = (level: LogLevel = 'info', message: string, data: Block) => {
    console.log(`robotUtilLog`, `${JSON.stringify({ level, time: Date.now(), message, data })}`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const robotUtil = {
    dataProcessing: {
        async log(content: string, block: Block) {
            sendLog('info', content, block);
        }
    },
    openBrowser: async function (options: any, block: Block) {
        console.log('openBrowser985981598', options, block);
        const isaa = true;
        if (isaa) {
            throw new Error('openBrowser error');
        }
        return puppeteer.launch({ headless: false });
    }
};
//循环执行指令 给指令套上一层 异常处理

function forRobotUtil(obj: any) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'function') {
                let retryCountNum = 0;
                obj[key] = async function aaa(...args: any[]) {
                    try {
                        const result = await (value as Function).apply(this, args);
                        return result;
                    } catch (error) {
                        const blockInfo = args[args.length - 1] as Block;
                        sendLog('error', `执行指令 ${blockInfo.directiveName} 异常`, blockInfo);
                        if (blockInfo.failureStrategy === 'terminate') {
                            sendLog(
                                'error',
                                `执行指令 ${blockInfo.directiveDisplayName} 异常,终止流程`,
                                blockInfo
                            );
                            process.exit(1);
                        } else if (blockInfo.failureStrategy === 'ignore') {
                            sendLog(
                                'error',
                                `执行指令 ${blockInfo.directiveDisplayName} 异常 ,忽略错误`,
                                blockInfo
                            );
                            return '';
                        } else {
                            sendLog(
                                'error',
                                `执行指令 ${blockInfo.directiveDisplayName} 异常 ,${blockInfo.intervalTime} 秒后重试第${retryCountNum}次`,
                                blockInfo
                            );
                            await sleep(blockInfo.intervalTime * 1000);
                            retryCountNum++;
                            if (retryCountNum > blockInfo.retryCount) {
                                sendLog(
                                    'error',
                                    `执行指令 ${blockInfo.directiveDisplayName} 异常 ,重试次数达到上限`,
                                    blockInfo
                                );
                                process.exit(1);
                            }
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

export default robotUtil;
