import { ChildProcess, fork } from 'child_process';
import { app } from 'electron';
import fs from 'fs';
import path, { join } from 'path';
import NodeEvbitonment from '../nodeEnvironment/NodeEvbitonment';
import StepWindow from '../window/StepWindow';
import { WindowManage } from '../window/WindowManage';
import Flow from './Flow';
import { DevNodeJs, IBreakpoint, IExecutionThrown } from './devuserapp/DevNodeJs';
import { AppVariable, ElementLibrary, FlowError, LogMessage } from './types';
import basePackagePath from '../../../resources/node_modules.zip?asset&asarUnpack';

import commonUtilContent from './robotUtil/commonUtil.ts?raw';
import typesContent from './types.ts?raw';

import { sleep, uuid } from '@shared/Utils';
import { unzip } from '../utils/zipUtils';
import startApiServer from './apiserver';
import { Conf } from 'electron-conf/main';
import { WorkStatus } from './WorkStatusConf';
import { getFlowNum } from '../utils/fileUtils';
import { lintFiles } from '../utils/flowEslintUtils';
import fetch from 'node-fetch';
import { AppConfig } from '../config/appConfig';

export type AppType = 'myCreate' | 'into' | '';

export type TuziAppData = {
    globalVariables: AppVariable[];
    elementLibrarys: ElementLibrary[];
};

/**
 * 应用类
 */
export default class UserApp {
    deleteBreakPoint(flowName: string, stepIndex: number) {
        if (this.#devNodeJs) {
            const flow = this.findFlow(flowName);
            if (flow) {
                const breakpoint = flow.step2Breakpoint(stepIndex);
                this.#devNodeJs.deleteBreakPoint(breakpoint);
            }
        }
    }
    setBreakPoint(flowName: string, stepIndex: number) {
        if (this.#devNodeJs) {
            const flow = this.findFlow(flowName);
            if (flow) {
                const breakpoint = flow.step2Breakpoint(stepIndex);
                this.#devNodeJs.setBreakpoint(breakpoint);
            }
        }
    }
    deleteSubFlow(flowName: string) {
        const flow = this.flows.find((flow) => flow.name === flowName);
        if (flow) {
            flow.delete();
        }
        this.flows = this.flows.filter((flow) => flow.name !== flowName);
        return flow;
    }

    delete() {
        // 销毁，这边回收app资源
        this.destroy();
        //删除本地目录
        fs.rmSync(this.appDir, { recursive: true, force: true });
    }

    closeUserAppStepTip() {
        if (this.#stepWindow) {
            this.#stepWindow.hide();
        }
    }
    static async init() {
        //解压基础包到userApp目录
        if (fs.existsSync(join(this.userAppLocalDir, 'package.json'))) {
            console.log('基础包已安装');
        } else {
            await unzip(basePackagePath, this.userAppLocalDir);
            console.log('安装基础包完成');
        }
        this.robotUtilInit();
        app.whenReady().then(async () => {
            startApiServer().then((server) => {
                app.on('quit', () => {
                    server.stop();
                });
            });
        });
    }

    static robotUtilInit() {
        // 写入robotUtil文件
        const robotUtilContent = fs.readFileSync(UserApp.rebotUtilPath, 'utf-8');
        fs.mkdirSync(path.join(this.userAppLocalDir, 'node_modules/tuzirobot'), {
            recursive: true
        });
        fs.writeFileSync(
            path.join(this.userAppLocalDir, 'node_modules/tuzirobot/index.js'),
            robotUtilContent
        );
        const logContent = fs.readFileSync(UserApp.rebotUtilLogPath, 'utf-8');
        const logFileName = path.basename(UserApp.rebotUtilLogPath);
        fs.writeFileSync(
            path.join(this.userAppLocalDir, `node_modules/tuzirobot/${logFileName}`),
            logContent
        );
        fs.writeFileSync(
            path.join(this.userAppLocalDir, `node_modules/tuzirobot/commonUtil.js`),
            logContent
        );
        // 写入robotUtil.d.ts文件

        fs.writeFileSync(
            path.join(this.userAppLocalDir, `node_modules/tuzirobot/commonUtil.ts`),
            (commonUtilContent as string).replace('../types', './types')
        );
        fs.writeFileSync(
            path.join(this.userAppLocalDir, `node_modules/tuzirobot/types.ts`),
            typesContent
        );
    }

    static rebotUtilPath = '';
    static rebotUtilLogPath = '';

    id: string;
    version: string = '1.0.0';
    type: AppType = 'myCreate';
    sourceAppId: string = '';
    main: string = 'main.js';
    author: string = '';
    license: string = '';
    description: string = '';
    name: string = '';
    appDir: string = '';
    appDevDir: string = '';
    appRobotUtilDir: string = '';
    packageJson: any = {};
    lastRunLogId!: string;
    status: 'running' | 'pause' | 'stop' = 'stop';

    flows: Flow[] = [];
    #devNodeJs: DevNodeJs | null = null;
    #devPrecess: ChildProcess | null = null;
    #_initFlow: boolean = false;
    #stepWindow: StepWindow | null = null;
    /**
     * 工作状态配置
     */
    #workStatusConf!: Conf<WorkStatus>;
    #tuziAppDataConf!: Conf<TuziAppData>;
    elementLibraryDir: string = '';

    globalVariables: AppVariable[] = [];
    elementLibrarys: ElementLibrary[] = [];

    static get userAppLocalDir() {
        const userAppLocalDir = path.join(app.getPath('userData'), 'userApp');
        if (!fs.existsSync(userAppLocalDir)) {
            fs.mkdirSync(userAppLocalDir, { recursive: true });
        }
        return userAppLocalDir;
    }

    // 构造函数
    constructor(id: string) {
        this.id = id;
        this.appDir = path.join(UserApp.userAppLocalDir, this.id);
        this.appDevDir = path.join(this.appDir, 'dev');
        this.appRobotUtilDir = path.join(this.appDir, '../node_modules/tuzirobot');
        this.elementLibraryDir = path.join(this.appDir, 'elementLibrary');
        this.author = AppConfig.LOGIN_USER?.userName ?? '';
        this.init();
    }

    /**
     * 销毁
     */
    destroy() {
        // 销毁，这边回收app资源
        this.#stepWindow?.destroy();
        this.#stepWindow = null;
        this.flows.forEach((flow) => {
            flow.destroy();
        });
        this.flows = [];
        this.#devNodeJs?.close();
        this.#devNodeJs = null;
        this.#devPrecess?.kill();
        this.#devPrecess = null;
    }

    save() {
        // 保存
        // 写入package.json文件
        this.packageJson.name = this.name;
        this.packageJson.description = this.description;
        this.packageJson.type = this.type;
        this.packageJson.sourceAppId = this.sourceAppId;
        fs.writeFileSync(
            path.join(this.appDir, 'package.json'),
            JSON.stringify(this.packageJson, null, 2)
        );
        return true;
    }

    init() {
        // 初始化
        // 判断本地目录是否存在，如果存在项目，无需创建
        if (!fs.existsSync(this.appDir)) {
            this.create();
        }

        // 读取package.json文件
        const packageJsonPath = path.join(this.appDir, 'package.json');
        const packageJsonStr = fs.readFileSync(packageJsonPath, 'utf-8');
        this.packageJson = JSON.parse(packageJsonStr);
        this.name = this.packageJson.name;
        this.author = this.packageJson.author;
        this.description = this.packageJson.description;
        this.type = this.packageJson.type;

        this.loadTuziAppData();
        
        // this.initFlows();
    }

    generatePackageJson() {
        // 生成package.json文件
        this.packageJson = {
            id: this.id,
            name: this.name,
            version: this.version,
            main: this.main,
            author: this.author,
            license: this.license,
            description: this.description,
            dependencies: {}
        };
        fs.writeFileSync(
            path.join(this.appDir, 'package.json'),
            JSON.stringify(this.packageJson, null, 2)
        );
    }

    create() {
        // 初始化
        console.log('UserApp init');
        // 创建本地目录
        if (!fs.existsSync(this.appDir)) {
            fs.mkdirSync(this.appDir, { recursive: true });
        }

        this.generatePackageJson();

        this.generateMainJs();

        // 写入dev目录
        fs.mkdirSync(this.appDevDir, { recursive: true });
        // 写入dev/main.flow文件
        new Flow(this.appDir, path.join(this.appDevDir, 'main.flow'), 'main.flow', '主流程');
        // fs.writeFileSync(path.join(this.appDevDir, 'main.flow'), '');
    }

    /**
     * 生成main.js文件
     */
    generateMainJs() {
        // 写入index.js文件
        const mainJsContent: string[] = [];

        mainJsContent.push(`let log = require("tuzirobot/commonUtil");`);
        mainJsContent.push(`let fs = require("fs");`);
        mainJsContent.push(`let { join } = require("path");`);
        mainJsContent.push(`globalThis._block = {};`);
        this.globalVariables.forEach((globalVar) => {
            mainJsContent.push(
                `globalThis._GLOBAL_${globalVar.name} = '${globalVar.value}';//${globalVar.display}`
            );
        });
        mainJsContent.push(
            `globalThis.curApp = {APP_ID: "${this.id}", APP_NAME: "${this.name}", APP_VERSION: "${this.version}", APP_DIR: "${this.appDir.replace(/\\/g, '/')}"};`
        );
        mainJsContent.push(
            `globalThis._tuziAppInfo = {SERSION: "${app.getVersion()}", INSTALL_DIR: "${app.getAppPath().replace(/\\/g, '/')}", USER_DIR: "${app.getPath('userData').replace(/\\/g, '/')}"};`
        );
        mainJsContent.push(
            `const logsDir = join(__dirname,'logs');if(!fs.existsSync(logsDir)){fs.mkdirSync(logsDir)}`
        );
        mainJsContent.push(
            `log.setLogFile(join(logsDir,(process.env.RUN_LOG_ID??Date.now()) + '.log'));`
        );
        mainJsContent.push(`// child.js
            process.on('uncaughtException', (err) => {
                console.error(err.stack);
                process.exit(1);
            });
            
            process.on("beforeExit", (code) => {
                console.debug("beforeExit");
                process.exit(code);
            });
            const isDebugging = process.execArgv.some(arg => arg.startsWith('--inspect'));
            if (isDebugging) {
                log.olog('Debugger listening on ws://127.0.0.1:' + process.debugPort)
                 if (process.send) {
                    process.send({ type: 'debugPort', data: process.debugPort });
                }
            }`);
        mainJsContent.push(`setTimeout(()=>{`);
        mainJsContent.push(`  const mainFlow = require('./main.flow');`);
        mainJsContent.push(`  mainFlow();`);
        mainJsContent.push(`}, 1000);`);
        fs.writeFileSync(path.join(this.appDir, 'main.js'), mainJsContent.join('\n'));
    }

    get workStatus() {
        return this.#workStatusConf.store;
    }

    open() {
        // 打开 创建工作状态文件
        const workStatusDir = path.join(this.appDir, '.tuzi');
        if (!fs.existsSync(workStatusDir)) {
            fs.mkdirSync(workStatusDir, { recursive: true });
        }

        //元素存储目录
        if (!fs.existsSync(this.elementLibraryDir)) {
            fs.mkdirSync(this.elementLibraryDir, { recursive: true });
        }

        this.#workStatusConf = new Conf<WorkStatus>({
            dir: workStatusDir,
            name: 'workStatus',
            defaults: {
                openedFlows: ['main.flow'],
                activeFlow: 'main.flow'
            }
        });
  
        // 加载flows
        this.initFlows();
        this.generateMainJs();

        return this.workStatus;
    }

    //加载全局变量
    async loadTuziAppData() {
        //应用数据配置
        this.#tuziAppDataConf = new Conf<TuziAppData>({
            dir: this.appDir,
            name: 'tuziAppData',
            defaults: {
                globalVariables: [],
                elementLibrarys: []
            }
        });

        this.globalVariables = this.#tuziAppDataConf.get('globalVariables');
        this.elementLibrarys = this.#tuziAppDataConf.get('elementLibrarys');

    }

    async saveGlobalVariables(globalVariables: AppVariable[]) {
        // 保存全局变量
        this.#tuziAppDataConf.set('globalVariables', globalVariables);
        this.globalVariables = this.#tuziAppDataConf.get('globalVariables');
        this.generateMainJs();
    }

    async saveElementLibrarys(globalVariables: ElementLibrary[]) {
        // 保存全局变量
        this.#tuziAppDataConf.set('elementLibrarys', globalVariables);
        this.elementLibrarys = this.#tuziAppDataConf.get('elementLibrarys');
        this.generateMainJs();
    }

    setWorkStatus(status: WorkStatus) {
        this.#workStatusConf.store = status;
    }

    /**
     * 加载 flows
     */
    async initFlows() {
        // 初始化flows
        if (this.#_initFlow) {
            return;
        }
        this.#_initFlow = true;
        await this.getFlows();
    }

    newSubFlow() {
        // 新建子流程
        const lastFlow = this.flows[this.flows.length - 1];
        const lastFlowName = lastFlow?.name ?? '';
        //提取名字数字
        const index = getFlowNum(lastFlowName);
        const flowName = `subFlow${index + 1}`;
        const aliasName = `子流程${index + 1}`;
        const file = `${flowName}.flow`;
        // fs.writeFileSync(path.join(this.appDevDir, file), '');
        this.flows.push(new Flow(this.appDir, path.join(this.appDevDir, file), file, aliasName));
        return this.findFlow(file);
    }

    async getFlows() {
        const files = fs.readdirSync(this.appDevDir);
        files.sort((a, b) => {
            const numA = getFlowNum(a);
            const numB = getFlowNum(b);
            return numA - numB;
        });
        files.forEach((file) => {
            if (file.endsWith('.flow')) {
                this.flows.push(new Flow(this.appDir, path.join(this.appDevDir, file), file));
            }
        });
    }

    findFlow(name: string) {
        return this.flows.find((flow) => flow.name === name);
    }

    get breakpoints() {
        const breakpoints: IBreakpoint[] = [];
        this.flows.forEach((flow) => {
            breakpoints.push(...flow.breakpoints);
        });
        return breakpoints;
    }

    shellExeCmd(cmds: string[], stdCallback?: (msg: any) => void) {
        this.lastRunLogId = Date.now() + '_' + uuid();
        const child = fork(path.join(this.appDir, 'main.js'), [], {
            cwd: this.appDir,
            env: {
                RUN_LOG_ID: this.lastRunLogId,
                TUZI_ENV: 'app'
            },
            execArgv: cmds
        });

        child.on('message', (msg: any) => {
            stdCallback && stdCallback(msg);
        });

        child.on('error', (err) => {
            console.error('Child process error:', err);
        });
        // 监听子进程的调试端口
        child.stderr?.on('data', (data) => {
            const message = data.toString();
            console.log(message);

            // const webSocketDebuggerUrl = message.match(/ws:\/\/.*\/([0-9]+)\//)[0];
            // console.log(`子进程的调试端口: ${webSocketDebuggerUrl}`);
        });

        child.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
        return child;
    }

    npmInstall() {
        // 安装依赖
        const npmCmd = path.join(NodeEvbitonment.nodeExeDir, 'npm.cmd');
        // process.chdir(this.appDir);
        console.log(process.env);

        const cmd = `${npmCmd}`;
        // const cmd = `dir`;
        console.log('执行安装命令', cmd);
        this.shellExeCmd([cmd, 'install']);
    }

    run() {
        // 运行
        return this.start();
    }

    stop() {
        // 停止
        return this.devStop();
    }

    async devStepOver() {
        if (this.#devNodeJs) {
            this.#devNodeJs.stepOver();
        }
    }
    async devResume() {
        if (this.#devNodeJs) {
            this.#devNodeJs.resume();
        }
    }
    devStop() {
        if (!this.#devPrecess) {
            return;
        }
        if (this.#devNodeJs) {
            this.#devNodeJs.stop();
        }
        if (this.#devPrecess) {
            this.#devPrecess.send({ action: 'close' }, async () => {
                console.log('关闭调试进程');
                await new Promise((resolve) => {
                    setTimeout(resolve, 100);
                });
                const exitRes = this.#devPrecess && this.#devPrecess.kill();
                WindowManage.mainWindow.webContents.send('userApps_update');
                console.log('退出结果', exitRes);
            });
        }

        this.sendRunLogs({
            level: 'info',
            time: Date.now(),
            message: `停止流程`
        });
        WindowManage.mainWindow.webContents.send('devRunEnd');
    }

    async devGetProperties(objectId: string) {
        if (!this.#devNodeJs) {
            throw new Error('DevNodeJs is not inited');
        }
        return this.#devNodeJs.getProperties(objectId);
    }

    async dev() {
        // 调试启动 带断点启动
        return this.start(this.breakpoints, true);
    }

    #logsData: LogMessage[] = [];
    #lastLogsOutIndex: number = 0;
    #logsOutSt: string | number | NodeJS.Timeout | undefined;

    _sendRunLogs(data: LogMessage[]) {
        const dataTemp = data.map((item) => {
            return { ...item, appId: this.id };
        });
        WindowManage.mainWindow.webContents.send('run-logs', dataTemp);
        WindowManage.mainWindow.webContents.send('run-logs-' + this.id, dataTemp);
    }

    sendRunLogs(data: LogMessage | LogMessage[]) {
        if (Array.isArray(data)) {
            this.#logsData.push(...data);
        } else {
            this.#logsData.push(data);
        }
    }

    sendRunStep(data: LogMessage | LogMessage[]) {
        this.#stepWindow?.webContents.send('run-step', data);
    }

    async start(breakpoints: IBreakpoint[] = [], isDebug: boolean = false) {
        if (this.status === 'running') {
            throw new Error('流程正在运行，请先停止流程，后再启动');
        }
        this.#stepWindow = this.#stepWindow || new StepWindow(this.id);
        // this.#stepWindow.once('show', async () => {});
        if (!this.#stepWindow?.isVisible()) this.#stepWindow?.show();
        await sleep(1000);
        this.startRun(breakpoints, isDebug);
        return this;
    }
    startRun(breakpoints: IBreakpoint[] = [], isDebug: boolean = false) {
        this.status = 'running';
        WindowManage.mainWindow.webContents.send('userApps_update');

        // let breakpoints: IBreakpoint[] = [];
        // breakpoints = this.breakpoints;
        this.sendRunLogs({
            level: 'info',
            time: Date.now(),
            message: `流程正在启动...`
        });
        this.sendRunStep({
            level: 'info',
            message: '启动流程',
            time: Date.now(),
            data: {
                directiveName: 'startRun',
                flowName: '启动流程'
            } as any
        });

        const cmds: string[] = [];
        if (isDebug) {
            cmds.push(`--inspect`);
        }

        //启动日志输出进程
        this.#logsOutSt = setInterval(() => {
            if (this.#logsData.length <= this.#lastLogsOutIndex) {
                return;
            }
            const data = this.#logsData.splice(this.#lastLogsOutIndex, this.#logsData.length);
            this.#lastLogsOutIndex = this.#logsData.length;
            this._sendRunLogs(data);
        }, 300);

        this.#devPrecess = this.shellExeCmd(cmds, (data: any) => {
            if (data.type === 'log') {
                this.sendRunLogs(data.data);
            } else if (data.type === 'step') {
                this.sendRunStep(data.data);
            } else if (data.type === 'debugPort') {
                const port = data.data;
                fetch(`http://127.0.0.1:${port}/json`)
                    .then((res) => {
                        return res.json();
                    })
                    .then((json) => {
                        const wsUrl2 = json[0].webSocketDebuggerUrl;
                        this.#devNodeJs = new DevNodeJs(wsUrl2, breakpoints);
                        this.#devNodeJs.onBreakpoint((breakpoint: IBreakpoint) => {
                            //发给前端需要从1开始
                            breakpoint.line = breakpoint.line + 1 - Flow.headLinkCount;
                            WindowManage.mainWindow.webContents.send('breakpoint', breakpoint);
                        });
                        // this.devNodeJs.onConsoleApiCalled((params: IConsoleApiCalled) => {
                        //     console.log(params.type, params.args, params.timestamp);
                        //     if (params.args[0].value === 'robotUtilLog') {
                        //         this.sendRunLogs(JSON.parse(params.args[1].value));
                        //     }
                        // });
                        this.#devNodeJs.onExecutionThrown((context: IExecutionThrown) => {
                            this.sendRunLogs({
                                level: 'fatalError',
                                time: Date.now(),
                                message: context.description,
                                data: context as any
                            });
                        });
                        this.#devNodeJs.start();
                    });
            }
        });
        this.#devPrecess.on('exit', (code) => {
            this.status = 'stop';
            WindowManage.mainWindow.webContents.send('userApps_update');

            console.log(`子进程已退出，退出码 ${code}`);
            if (this.#devNodeJs) {
                this.#devNodeJs.close();
            }
            this.#devNodeJs = null;
            this.sendRunLogs({
                level: 'info',
                time: Date.now(),
                message: `流程结束`
            });

            this.sendRunStep({
                level: 'info',
                message: '结束流程',
                time: Date.now(),
                data: {
                    directiveName: 'endRun'
                } as any
            });
            WindowManage.mainWindow.webContents.send('devRunEnd');

            this.#devPrecess = null;
            this.#stepWindow?.hide();

            this.#logsOutSt && clearInterval(this.#logsOutSt);
            const data = this.#logsData.splice(this.#lastLogsOutIndex, this.#logsData.length);
            this.#lastLogsOutIndex = this.#logsData.length;
            this._sendRunLogs(data);
        });
    }

    async devRunJs(code: string) {
        // 调试运行js代码
        if (!this.#devNodeJs) {
            throw new Error('调试进程未启动');
        }
        return this.#devNodeJs.runJs(code);
    }

    async lintError() {
        // 代码检查
        const files = this.flows.map((flow) => flow.jsFilePath);
        const globals = { _block: true };
        this.globalVariables.forEach((globalVar) => {
            globals[`_GLOBAL_${globalVar.name}`] = true;
        });
        const lintResult = await lintFiles(files, globals);
        console.log(lintResult);
        const errorList: FlowError[] = [];
        lintResult.forEach((result) => {
            const flow = this.flows.find((flow) => flow.jsFilePath === result.filePath);
            if (!flow) {
                return;
            }
            const messages = result.messages
                .filter((item) => item.line - Flow.headLinkCount > 0)
                .map((message) => {
                    const line = message.line - Flow.headLinkCount;
                    message.line = line;
                    return message;
                });
            messages.forEach((message) => {
                const msg = message.message;
                const aMsg = msg.split('is');
                const varName = aMsg[0];
                errorList.push({
                    flowName: flow.name,
                    flowAliasName: flow.aliasName,
                    line: message.line,
                    message: `${varName} ${message.ruleId === 'no-undef' ? '未定义' : '未使用'}`,
                    ruleId: message.ruleId,
                    errorLevel: message.ruleId === 'no-undef' ? 'error' : 'warning',
                    messageObject: message
                });
            });
        });
        return errorList;
    }
}
