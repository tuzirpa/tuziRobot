import { WebSocket } from 'ws';

export interface IBreakpoint {
    url: string;
    line: number;
    id?: string;
    callFrame?: any;
    scopeChain?: any[];
}

export interface IConsoleApiCalled {
    type: string;
    args: any[];
    executionContextId: number;
    timestamp: number;
    stackTrace: any;
}

/**
 * {"blockLine":7,"flowName":"main.flow","directiveName":"web.create","directiveDisplayName":"启动浏览器","failureStrategy":"terminate","intervalTime":0,"retryCount":0}
 */
export interface IExecutionThrown {
    description: string;
    blockLine: number;
    flowName: string;
    directiveName: string;
    directiveDisplayName: string;
    failureStrategy: string;
}

export class DevNodeJs {
    private callFrameId: string = '';

    async runJs(code: string) {
        //编译脚本
        let evaluateRes = await this.sendCommand('Debugger.evaluateOnCallFrame', {
            expression: code,
            callFrameId: this.callFrameId
        });

        //返回执行结果
        return evaluateRes.result;
    }

    async deleteBreakPoint(breakpoint: IBreakpoint) {
        const creBreakpointIndex = this.breakpoints.findIndex(
            (value) => breakpoint.url === value.url && breakpoint.line === value.line
        );
        if (creBreakpointIndex > -1) {
            await this.sendCommand('Debugger.removeBreakpoint', {
                breakpointId: this.breakpoints[creBreakpointIndex].id
            });
            this.breakpoints.splice(creBreakpointIndex, 1);
        }
    }
    async getProperties(objectId: string) {
        const data = await this.sendCommand('Runtime.getProperties', {
            objectId,
            ownProperties: false,
            accessorPropertiesOnly: false,
            nonIndexedPropertiesOnly: false,
            generatePreview: true
        });
        return data.result;
    }
    stop() {
        this.ws.close();
    }
    close() {
        this.ws.close();
    }
    resume() {
        this.sendCommand('Debugger.resume', { terminateOnResume: false });
    }
    stepOver() {
        this.sendCommand('Debugger.stepOver', {});
    }

    private ws!: WebSocket;
    private commandId = 1;
    private sctipts = new Map();

    constructor(
        public wsUrl: string,
        public breakpoints: IBreakpoint[] = [],
        public breakpointCallbacks: ((breakpoint: IBreakpoint) => void)[] = [],
        public consoleApiCalledCallbacks: ((breakpoint: IConsoleApiCalled) => void)[] = [],
        public exceptionThrownCallbacks: ((exception: IExecutionThrown) => void)[] = []
    ) {}

    async start() {
        const ws = new WebSocket(this.wsUrl);
        this.ws = ws;
        ws.on('open', async () => {
            console.log('WebSocket opened');

            await this.sendCommand('Debugger.enable', {});
            await this.sendCommand('Runtime.enable', {});
            this.setBreakpoints();
        });

        ws.on('message', (data) => {
            // console.log('Received message:', data.toString());
            const cdpRes = JSON.parse(data.toString());

            if (cdpRes.method === 'Debugger.scriptParsed') {
                this.scriptParsed(cdpRes.params);
            } else if (cdpRes.method === 'Debugger.paused') {
                this.paused(cdpRes.params);
            } else if (cdpRes.method === 'Runtime.exceptionThrown') {
                this.exceptionThrown(cdpRes.params);
            } else if (cdpRes.method === 'Runtime.consoleAPICalled') {
                console.log('consoleAPICalled', cdpRes.params);
                this.consoleApiCalledCallbacks.forEach((callback) => {
                    callback(cdpRes.params);
                });
            }
        });

        ws.on('close', () => {
            console.log('WebSocket closed');
        });
        // 处理发生错误的事件
        ws.on('error', function error(err) {
            console.error('WebSocket error:', err);
        });
    }

    // 发送调试指令的函数
    sendCommand(method, params): Promise<any> {
        return new Promise((resolve) => {
            const id = this.commandId++;
            const command = JSON.stringify({
                id: id,
                method: method,
                params: params
            });

            console.log('Sending command:', command);
            const listener = (data) => {
                // 解析收到的消息
                const message = JSON.parse(data.toString());
                if (message.id === id) {
                    console.log('Received response:', message);
                    resolve(message);
                    this.ws.off('message', listener);
                }
            };
            this.ws.on('message', listener);

            this.ws.send(command);
        });
    }

    async scriptParsed(params) {
        this.sctipts.set(params.scriptId, params);
    }
    async paused(params) {
        console.log('断点暂停:', params);
        const callFrames = params.callFrames;
        const callFrame = callFrames[0];
        this.callFrameId = callFrame.callFrameId;
        const location = callFrame.location;
        const scriptId = location.scriptId;
        const lineNumber = location.lineNumber;
        const columnNumber = location.columnNumber;

        //不是流程js文件， 自动跳过
        let noFlowJsBreakpoint = false;
        const script = this.sctipts.get(scriptId);
        console.log('断点行号:', lineNumber, '列号:', columnNumber);
        if (!script.url.includes('flow.js')) {
            noFlowJsBreakpoint = true;
            this.resume();
        }
        if (noFlowJsBreakpoint) {
            return;
        }
        // 获取当前变量
        const scopeChain = callFrame.scopeChain;
        // 触发断点回调
        this.breakpointCallbacks.forEach((callback) => {
            callback({
                scopeChain,
                callFrame,
                url: script.url,
                line: lineNumber
            });
        });
    }

    /**
     * 设置单个断点
     * @param breakpoint {url: string, line: number}
     */
    async setBreakpoint(breakpoint: IBreakpoint) {
        const res = await this.sendCommand('Debugger.setBreakpointByUrl', {
            url: breakpoint.url,
            lineNumber: breakpoint.line
        });
        breakpoint.id = res.result.breakpointId;
        this.breakpoints.push(breakpoint);
    }

    async setBreakpoints() {
        const setBreakpointPromises = this.breakpoints.map((value) => {
            return this.sendCommand('Debugger.setBreakpointByUrl', {
                url: value.url,
                lineNumber: value.line
            });
        });
        const res = await Promise.all(setBreakpointPromises);
        res.forEach((value, index) => {
            this.breakpoints[index].id = value.result.breakpointId;
        });
    }

    onBreakpoint(borakpointBackCall: (breakpoint: IBreakpoint) => void) {
        this.breakpointCallbacks.push(borakpointBackCall);
    }

    onConsoleApiCalled(callback: (breakpoint: IConsoleApiCalled) => void) {
        this.consoleApiCalledCallbacks.push(callback);
    }

    onExecutionThrown(callback: (breakpoint) => void) {
        this.exceptionThrownCallbacks.push(callback);
    }

    async exceptionThrown(params) {
        console.log('exceptionThrown', params);
        const description = params.exceptionDetails.exception.description;
        // const lineNumber = params.exceptionDetails.lineNumber;
        // const scriptId = params.exceptionDetails.scriptId;
        // const res = await this.sendCommand('Debugger.getScriptSource', {
        //     scriptId: scriptId
        // });
        // const scriptLines = res.result.scriptSource.split('\n');
        // const lineContent = scriptLines[lineNumber];
        //代码中匹配出流程名称 等块信息
        //{"blockLine":8,"flowName":"main.flow","directiveName":"web.openBarClose","directiveDisplayName":"关闭浏览器","failureStrategy":"terminate","intervalTime":0,"retryCount":0}

        // const blockLine = lineContent.match(/blockLine:\s*(\d+)/)?.[1];
        this.exceptionThrownCallbacks.forEach((callback) => {
            callback({
                description,
                blockLine: 0,
                flowName: '',
                directiveName: '',
                directiveDisplayName: '',
                failureStrategy: ''
            });
        });
    }
}
