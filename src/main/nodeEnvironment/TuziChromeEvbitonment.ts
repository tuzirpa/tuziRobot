import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { downloadFileWithResume } from '../utils/download';
import { unzip } from '../utils/zipUtils';
import { sleep } from '@shared/Utils';
import { WindowManage } from '../window/WindowManage';

export class TuiziChromeEvbitonment {
    path: string;
    userDataDir: string;
    version: string;
    url: string;
    tempFile?: string;
    constructor() {
        this.version = '127.0.6533.88';
        //https://registry.npmmirror.com/-/binary/node/v18.20.3/node-v18.20.3-win-x64.zip
        this.url = `https://registry.npmmirror.com/-/binary/chrome-for-testing/${this.version}/win64/chrome-win64.zip`;
        // this.nodejsUrl = `https://nodejs.org/dist/v${this.version}/node-v${this.version}-x64.zip`;
        this.userDataDir = app.getPath('userData');
        this.path = path.join(this.userDataDir, 'tuziChrome');
    }

    /**
     * 自动安装node环境
     */
    async autoInstall() {
        if (this.checkingTheLocalEnvironment()) {
            console.log('本地环境已安装 tuziChrome');
            WindowManage.mainWindow.webContents.send('app-status', {
                name: '内置浏览器',
                value: `已安装`
            });
            return;
        }
        // 下载node环境并安装
        await this.install();
    }

    /**
     * 检测本地环境是否安装
     */
    checkingTheLocalEnvironment() {
        // 检测node环境是否安装
        return fs.existsSync(path.join(this.path, 'chrome-win64', 'chrome.exe'));
    }

    async install() {
        // 下载node环境
        await this.download();
        await sleep(1000);
        // 解压node环境
        await this.unzipNode();
        console.log('安装内置浏览器成功');
        WindowManage.mainWindow.webContents.send('app-status', {
            name: '内置浏览器',
            value: `已安装`
        });
        await sleep(1000);
    }
    async download() {
        //下载文件
        console.log('开始下载内置浏览器');
        //创建临时文件
        const tempDir = path.join(this.userDataDir, 'temp');
        fs.mkdirSync(tempDir, { recursive: true });
        this.tempFile = path.join(tempDir, 'chrome-win64.zip');
        if (!fs.existsSync(this.tempFile)) {
            await downloadFileWithResume(this.url, this.tempFile, (progress) => {
                console.log(`下载进度：${progress.percentage}%`);
                WindowManage.mainWindow.webContents.send('app-status', {
                    name: '内置浏览器',
                    value: `${Math.floor(progress.percentage)}%`
                });
                if (progress.percentage === 100) {
                    console.log('下载完成');
                    WindowManage.mainWindow.webContents.send('app-status', {
                        name: '内置浏览器',
                        value: `下载完成`
                    });
                }
            });
        }
    }
    async unzipNode() {
        if (!this.tempFile) {
            return;
        }

        // 解压文件
        console.log('开始解压chrome-win64');
        WindowManage.mainWindow.webContents.send('app-status', {
            name: '内置浏览器',
            value: `正在安装`
        });
        await unzip(this.tempFile, this.path);
    }
}

export default new TuiziChromeEvbitonment();
