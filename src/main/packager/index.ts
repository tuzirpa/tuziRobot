import * as path from 'path';
import * as fs from 'fs-extra';
import { shell } from 'electron';
import UserAppManage from '../userApp/UserAppManage';
import UserApp from '../userApp/UserApp';
import nodeEvbitonment from '../nodeEnvironment/NodeEvbitonment';
import configServerZip from '../../../resources/config-server.zip?asset&asarUnpack';
import { unzip, zip } from '../utils/zipUtils';
import { formatDate } from '../utils/dateUtils';

export interface PackOptions {
    type: 'exe' | 'script';
    outputPath: string;
    outputUpdateFile?: boolean;
    outputVersionFile?: boolean;
}

export class Packager {

    static async packAppToScript(appId: string, outputPath: string, options?: { outputUpdateFile?: boolean; outputVersionFile?: boolean }) {
        const userApp = UserAppManage.findUserApp(appId);
        if (!userApp) {
            throw new Error('应用不存在');
        }
        const scriptName = `${userApp.name || 'app'}_${userApp.version}`;
        const finalOutputPath = path.join(outputPath, scriptName);
        const appOutDir = path.join(finalOutputPath, 'app');
        await fs.ensureDir(finalOutputPath);
        await fs.ensureDir(appOutDir);

        // 复制应用文件到临时目录
        const excludeDirs = [
            'userData', 
            'logs',
            'data', 
            'images', 
            'download', 
            'screenshot',
            'dev',
            '.tuzi',
            'elementLibrary',
            'main.js',
            'browserCloseScript.js',
            'dist',
            'node_modules'
        ];

        // 复制应用文件
        const appCopy = fs.copy(userApp.appDir, appOutDir, {
            overwrite: true,
            preserveTimestamps: true,
            filter: (src) => {
                const relativePath = path.relative(userApp.appDir, src);
                return !excludeDirs.some(dir => relativePath.startsWith(dir));
            }
        });

        //重新生成main.js
        const mainJsContent = userApp.generatePackageMainJs();
        await fs.writeFile(path.join(appOutDir, 'main.js'), mainJsContent);

        // 复制必要的系统文件
        const nodeModules = fs.copy(path.join(UserApp.userAppLocalDir, 'node_modules'), path.join(appOutDir, 'node_modules'),{
            overwrite: true,
            preserveTimestamps: true,
        });
        const system = fs.copy(path.join(UserApp.userAppLocalDir, 'system'), path.join(appOutDir, 'system'),{
            overwrite: true,
            preserveTimestamps: true,
        });
        const extend = fs.copy(path.join(UserApp.userAppLocalDir, 'extend'), path.join(appOutDir, 'extend'),{
            overwrite: true,
            preserveTimestamps: true,
        });

        await Promise.all([appCopy, nodeModules, system, extend]);

        //解压配置文件
        await unzip(configServerZip, finalOutputPath);

        // 根据选项决定是否生成更新文件
        if (options?.outputUpdateFile) {
            const updateOutDir = path.join(finalOutputPath, 'update');
            await fs.ensureDir(updateOutDir);
            // 生成更新文件
            const updateFile = {
                version: userApp.version,
                lastTime: formatDate(new Date()),
                description: userApp.description,
                file: 'app.zip',
                updateModule: 'app'
            }
            
            // 生成app.zip
            await zip(path.join(updateOutDir, 'app.zip'), appOutDir);
            
            // 根据选项决定是否生成版本文件
            if (options?.outputVersionFile) {
                // 生成version.json
                await fs.writeFile(path.join(updateOutDir, 'version.json'), JSON.stringify(updateFile, null, 2));
            }
        }
    }

    static async packApp(appId: string, options: PackOptions): Promise<void> {
        if (options.type === 'exe') {
            await this.packToExe(appId, options.outputPath, options);
        } else {
            await this.packToScript(appId, options.outputPath, options);
        }
    }

    /**
     * 打包应用为独立exe
     * @param appId 应用ID
     * @param outputPath 输出路径
     */
    static async packToExe(appId: string, outputPath: string, options?: { outputUpdateFile?: boolean; outputVersionFile?: boolean }): Promise<void> {
        const userApp = UserAppManage.findUserApp(appId);
        if (!userApp) {
            throw new Error('应用不存在');
        }
        const scriptName = `${userApp.name || 'app'}_${userApp.version}`;
        const finalOutputPath = path.join(outputPath, scriptName);
        const nodeOutDir = path.join(finalOutputPath, 'node');
        await this.packAppToScript(appId, outputPath, options);
        await fs.ensureDir(nodeOutDir);

        //添加node执行文件 拷贝 软件自带node执行文件
        await fs.copy(nodeEvbitonment.nodeExeDir, nodeOutDir,{
            overwrite: true,
            preserveTimestamps: true,
        });

        // 创建启动应用脚本
        const runAppScript = `
@echo off
cd /d "%~dp0"
"./node/node.exe" ./app/main.js
        `.trim();

        await fs.writeFile(path.join(finalOutputPath, 'run_app.bat'), runAppScript);

        // 创建启动脚本
        const startScript = `
@echo off
cd /d "%~dp0"
"./node/node.exe" ./config-server/index.js
        `.trim();

        await fs.writeFile(path.join(finalOutputPath, 'start.bat'), startScript);

        shell.showItemInFolder(`file://${finalOutputPath}/start.bat`);
    }

    /**
     * 打包应用为脚本文件
     * @param appId 应用ID
     * @param outputPath 输出路径
     */
    static async packToScript(appId: string, outputPath: string, options?: { outputUpdateFile?: boolean; outputVersionFile?: boolean }): Promise<void> {
        const userApp = UserAppManage.findUserApp(appId);
        if (!userApp) {
            throw new Error('应用不存在');
        }
        const scriptName = `${userApp.name || 'app'}_${userApp.version}`;
        const finalOutputPath = path.join(outputPath, scriptName);
        await this.packAppToScript(appId, outputPath, options);
        
        // 创建启动应用脚本
        const runAppScript = `
@echo off
cd /d "%~dp0"
node ./app/main.js
        `.trim();
       
        await fs.writeFile(path.join(finalOutputPath, 'run_app.bat'), runAppScript);
       
        // 创建启动脚本
        const startScript = `
@echo off
cd /d "%~dp0"
node ./config-server/index.js
        `.trim();
       
        await fs.writeFile(path.join(finalOutputPath, 'start.bat'), startScript);

        shell.showItemInFolder(`file://${finalOutputPath}/start.bat`);
    }
} 