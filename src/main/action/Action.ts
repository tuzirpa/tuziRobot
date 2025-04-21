import { app, clipboard, dialog, shell } from 'electron';
import { getMachineCode, getRegStatus, verifyToken } from '../reg';
import Flow from '../userApp/Flow';
import UserAppManage from '../userApp/UserAppManage';
import {
    getDirectiveAddConfig,
    getOutputTypeDetails,
    reloadDirective,
    useDirective
} from '../userApp/directive/directive';
import { WindowManage, WindowNameType } from '../window/WindowManage';
import { AppConfig } from '../config/appConfig';
import User from '../api/User';
import Captcha from '../api/Captcha';
import { getPlazas } from '../api/appplaza';
import aes, { encrypt } from '../api/aes';
import { getRandom } from '../utils/RandomUtils';
import { getDeviceID } from '../utils/divice';
import { submitFeedback } from '../api/feedback';
import { WorkStatus } from '../userApp/WorkStatusConf';
import { AppVariable, DirectiveTree, ElementLibrary } from '../userApp/types';
import SystemDirectivePackageManage from '../systemDirective/SystemDirectivePackageManage';
import * as lzString from 'lz-string';

import tuziChromeEvbitonment from '../nodeEnvironment/TuziChromeEvbitonment';
import type { AppType } from '../userApp/UserApp';
import { browserManage } from '../browser/BrowserManage';
import { Packager } from '../packager/index';

class Action {
    static packApp(id: string, type: 'exe' | 'script', outputPath: string) {
        return Packager.packApp(id, type, outputPath);
    }
    static openLogsDir(appId: string) {
        return UserAppManage.openLogsDir(appId);
    }
    static async importApp() {
        const filePath = await this.selectFileOrFolder();
        return UserAppManage.importApp(filePath[0]);
    }
    static async executeStep(appId: string, step: DirectiveTree, index: number) {
        return UserAppManage.executeStep(appId, step, index);
    }
    static async updateUserAppDescription(appId: string, description: string) {
        return UserAppManage.updateUserAppDescription(appId, description);
    }
    static async deleteElementLibraryInfo(appId: string, elementInfo: ElementLibrary) {
        return UserAppManage.deleteElementLibraryInfo(appId, elementInfo);
    }
    static async saveElementLibraryInfo(appId: string, elementInfo: ElementLibrary) {
        return UserAppManage.saveElementLibraryInfo(appId, elementInfo);
    }
    static async checkElementByWsUrl(wsUrl: string, pageUrl: string, elementInfo: ElementLibrary) {
        return browserManage.checkElementByWsUrl(wsUrl, pageUrl, elementInfo);
    }
    static async addElementLibrary(userAppId: string, elementLibrary: ElementLibrary) {
        return UserAppManage.addElementLibrary(userAppId, elementLibrary);
    }

    static async getElementByWsUrl(wsUrl: string, pageUrl: string) {
        return browserManage.getElement(wsUrl, pageUrl);
    }

    /**
     * 获取当前运行的浏览器列表
     * @returns 浏览器列表
     */
    static async getBrowsers() {
        return browserManage.getBrowsers();
    }

    static async init() {
        // nodeEvbitonment.autoInstallNode();
        tuziChromeEvbitonment.autoInstall();
    }

    static async getOutputTypeDetails(directiveKey: string, name: string) {
        return getOutputTypeDetails(directiveKey, name);
    }
    static async getAddConfig(directiveKey: string, key: string) {
        return getDirectiveAddConfig(directiveKey, key);
    }

    /**
     * 最小化窗口
     * @param name 窗口名称
     */
    static async windowMinimize(name: WindowNameType) {
        WindowManage.getWindow(name).minimize();
    }

    static async windowMaximize(name: WindowNameType) {
        const window = WindowManage.getWindow(name);
        if (window.isMaximized()) {
            WindowManage.getWindow(name).unmaximize();
        } else {
            WindowManage.getWindow(name).maximize();
        }
    }

    static async windowShow(name: WindowNameType) {
        WindowManage.getWindow(name).show();
    }

    static async windowClose(name: WindowNameType) {
        WindowManage.getWindow(name).close();
    }

    /**
     * 获取注册信息
     * @returns 注册信息
     */
    static async getRegStatus() {
        return getRegStatus();
    }
    /**
     * 获取机器码
     */
    static async getMachineCode() {
        return getMachineCode();
    }

    /**
     * 注册机器
     */
    static async verifyToken(token: string) {
        return verifyToken(token);
    }

    /**
     * 打开文件夹
     */
    static async openFolder(path: string) {
        return shell.showItemInFolder(`file://${path}`);
    }

    /**
     * 打开网页
     */
    static async openExternal(url: string) {
        return shell.openExternal(url);
    }

    /**
     * 选择一个文件或文件夹
     */
    static async selectFileOrFolder(
        openDirectory: boolean = false,
        extensions: string[] = ['*'],
        title?: string
    ) {
        const properties = ['openFile'];
        openDirectory && properties.push('openDirectory');
        const dialogTitle = title ?? `${openDirectory ? '选择文件夹' : '选择文件'}`;
        const res = await dialog.showOpenDialog({
            //@ts-ignore
            properties: properties,
            message: dialogTitle,
            buttonLabel: '选择',
            filters: [{ name: '所有文件', extensions }]
        });
        return res.filePaths;
    }

    /**
     * 选择一个文件或文件夹
     */
    static async selectFileOrFolder1({
        openDirectory = false,
        extensions = ['*'],
        title
    }: {
        openDirectory?: boolean;
        extensions?: string[];
        title?: string;
    }) {
        const properties = ['openFile'];
        openDirectory && properties.push('openDirectory');
        title = title ?? `${openDirectory ? '选择文件夹' : '选择文件'}`;
        const res = await dialog.showOpenDialog({
            //@ts-ignore
            properties: properties,
            message: title,
            title,
            buttonLabel: '导出到此',
            filters: [{ name: '所有文件', extensions }]
        });
        return res.filePaths;
    }

    /**
     * aes加密
     * @param content 加密内容
     */
    static async aesEncrypt(content: string, password?: string) {
        content = lzString.compressToBase64(content);
        if (password) {
            content = aes.encrypt(content, password);
        }
        return content;
    }

    /**
     * aes解密
     */
    static async aesDecrypt(content: string, password?: string) {
        if (password) {
            content = aes.decrypt(content, password);
        }

        content = lzString.decompressFromBase64(content);
        return content;
    }

    /**
     * 复制内容到粘贴板
     */
    static async copyToClipboard(content: string) {
        return clipboard.writeText(content);
    }

    /**
     * 获取用户应用列表
     * @returns 用户应用列表
     */
    static async getUserApps(type?: AppType) {
        return UserAppManage.getUserApps(type);
    }

    static async getUserApp(id: string) {
        return UserAppManage.getUserApp(id);
    }

    /**
     * 打开用户应用
     */
    static async openUserApp(id: string) {
        return UserAppManage.openUserApp(id);
    }
    /**
     * 保存工作状态
     */

    static async saveWorkStatus(appId: string, status: WorkStatus) {
        return UserAppManage.saveWorkStatus(appId, status);
    }

    /**
     * 新建用户应用
     * @returns 用户应用
     */
    static async newUserApp(name: string) {
        return UserAppManage.newUserApp(name);
    }

    /**
     * 保存全局变量
     */
    static async saveGlobalVariables(appId: string, globalVariables: AppVariable[]) {
        return UserAppManage.saveGlobalVariables(appId, globalVariables);
    }

    /**
     * 导出到本地
     */

    static async shareUserAppToPlaza(appId: string) {
        const filePath = await this.selectFileOrFolder1({
            openDirectory: true,
            title: '选择导出到的文件夹'
        });
        if (!filePath || filePath.length === 0) {
            return;
        }
        return UserAppManage.shareUserAppToPlaza(appId, filePath[0]);
    }

    /**
     * 导入广场引用到本地应用
     */
    static async appPlazasToLocal(app: any) {
        return UserAppManage.appPlazasToLocal(app);
    }

    /**
     * 获取广场应用
     */
    static async getAppPlazas() {
        return getPlazas();
    }

    /**
     * 新建子流程
     */
    static async newSubFlow(appId: string) {
        return UserAppManage.newSubFlow(appId);
    }
    /**
     * 删除子流程
     */
    static async deleteSubFlow(appId: string, flowName: string) {
        return UserAppManage.deleteSubFlow(appId, flowName);
    }

    /**
     * 保存流程
     */
    static async saveFlow(appId: string, flow: Flow) {
        return UserAppManage.saveFlow(appId, flow);
    }

    /**
     * 保存流程名称
     */
    static async saveFlowAliName(appId: string, flow: Flow) {
        return UserAppManage.saveFlowAliName(appId, flow);
    }

    static async installPackage(appId: string) {
        return UserAppManage.installPackage(appId);
    }
    static async userAppRun(appId: string) {
        return UserAppManage.userAppRun(appId);
    }
    static async userAppDevRun(appId: string) {
        return UserAppManage.userAppDevRun(appId);
    }

    /**
     * 检查userApp代码错误
     */
    static async lintError(appId: string) {
        return UserAppManage.lintError(appId);
    }

    /**
     * 设置断点
     */

    static async setBreakPoint(appId: string, flowName: string, stepIndex: number) {
        return UserAppManage.setBreakPoint(appId, flowName, stepIndex);
    }

    /**
     * 删除断点
     */
    static async deleteBreakPoint(appId: string, flowName: string, stepIndex: number) {
        return UserAppManage.deleteBreakPoint(appId, flowName, stepIndex);
    }

    /**
     *
     * @param appId
     * @returns
     */
    static async devStepOver(appId: string) {
        return UserAppManage.devStepOver(appId);
    }
    static async devResume(appId: string) {
        return UserAppManage.devResume(appId);
    }
    static async devStop(appId: string) {
        return UserAppManage.devStop(appId);
    }
    static async copyUserApp(appId: string) {
        return UserAppManage.copyUserApp(appId);
    }
    static async closeUserAppStepTip(appId: string) {
        return UserAppManage.closeUserAppStepTip(appId);
    }
    static async devGetProperties(appId: string, objectId: string) {
        return UserAppManage.devGetProperties(appId, objectId);
    }

    static async updateUserAppName(appId: string, name: string) {
        return UserAppManage.updateUserAppName(appId, name);
    }
    
    static async updateUserAppVersion(appId: string, version: string) {
        return UserAppManage.updateUserAppVersion(appId, version);
    }

    /**
     * 删除用户应用
     */
    static async deleteUserApp(appId: string) {
        return UserAppManage.deleteUserApp(appId);
    }

    /**
     * 获取用户应用指令列表
     * @returns 用户应用指令列表
     */
    static async getDirectives() {
        // await new Promise((resolve) => setTimeout(resolve, 3000));
        return useDirective();
    }
    static async reloadDirective() {
        reloadDirective();
        return useDirective();
    }

    /**
     * 获取用户信息
     * @returns 用户信息
     */
    static async getUserInfo(): Promise<{
        uid: number;
        userName: string;
        mobile: string;
        avatarUrl: string;
        vipLevel: number;
        vipExpireTime: string;
    }> {
        let userInfo = { ...AppConfig.LOGIN_USER };
        if (!AppConfig.LOGIN_USER?.offline) {
            try {
                if (AppConfig.LOGIN_USER && !AppConfig.LOGIN_USER.uid) {
                    await AppConfig.LOGIN_USER.getVipInfo();
                    userInfo = { ...AppConfig.LOGIN_USER };
                }
            } catch (e) {
                return {} as any;
            }
        }
        delete userInfo.password;
        delete userInfo.loginToken;
        console.log(userInfo);

        return userInfo as any;
    }

    /**
     * 用户注册
     * @param username 用户名手机号
     * @param password 用户密码
     * @returns
     */
    static async userRegister(
        mobile: string,
        userName: string,
        password: string,
        captcha: string,
        captchaId: string
    ) {
        const user = new User(mobile, userName, password);
        return user.register(captcha, captchaId);
    }

    /**
     * 用户登录
     * @returns
     */
    static async userLogin(
        mobile: string,
        userName: string,
        password: string,
        captcha: string,
        captchaId: string,
        remember: boolean
    ) {
        const user = new User(mobile, userName, password);
        return user.login(captcha, captchaId, remember);
    }

    static async getCaptcha() {
        return Captcha.getCaptcha();
    }

    /**
     * 登出
     * @returns 是否登出成功
     */
    static async logout() {
        if (AppConfig.LOGIN_USER) {
            if (!AppConfig.LOGIN_USER.offline) {
                await AppConfig.LOGIN_USER.logout();
            }
        }
        AppConfig.LOGIN_USER = null;
        // app.exit();
        return true;
    }

    /**
     * 重启应用
     */
    static async relaunchApp() {
        app.relaunch();
        app.quit();
    }

    /**
     * 获取离线验证图片
     */
    static async getOffLineVerificationImg() {
        //通过设备码生成验证码
        const machineCode = await getDeviceID();
        //生成验证码 6位随机数+设备码
        const loginCode = getRandom(100000, 1000000) + '';
        const code = `${loginCode}-${machineCode}-${Date.now()}`;
        AppConfig.OFFLINE_CODE = loginCode;
        const encryptedCode = encrypt(code);
        const imgUrl = `${AppConfig.API_URL}/offlinelogin?code=${encryptedCode}`;
        return imgUrl;
    }
    /**
     * 离线登录
     */
    static async offLineLogin(code: string) {
        if (AppConfig.OFFLINE_CODE === code) {
            AppConfig.LOGIN_USER = new User('1**********', '离线登录', '123456');
            AppConfig.LOGIN_USER.offline = true;
            return true;
        }
        throw new Error('验证码错误');
    }

    /**
     * 提交反馈
     */
    static async submitFeekback(content: string) {
        return submitFeedback({ content });
    }

    /**
     * 上传系统指令包
     */
    static async uploadNewVersionDirective(version: string, description: string) {
        return SystemDirectivePackageManage.uploadSystemDirectivePackage(version, description);
    }

    /**
     * 获取所有系统指令包版本
     */
    static async getAllVersions() {
        // return SystemDirectivePackageManage.getAllVersions();
        return [];
    }

    /**
     * 使用自定版本的系统指令
     * @param version 版本号
     */
    static async useVersionSystemDirective(version: string) {
        return SystemDirectivePackageManage.useVersionSystemDirective(version);
    }

    static async updateAppConfig(appId: string, variables: AppVariable[]) {
        const app = await this.getUserApp(appId);
        if (!app) return;
        
        // 更新暴露变量的值
        app.globalVariables = app.globalVariables.map(v => {
            const updatedVar = variables.find(uv => uv.name === v.name);
            if (updatedVar && v.exposed) {
                v.value = updatedVar.value;
            }
            return v;
        });
        
        // 保存全局变量
        await this.saveGlobalVariables(appId, app.globalVariables);
    }
}

export default Action;
