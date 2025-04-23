import * as path from 'path';
import * as fs from 'fs-extra';
import { shell } from 'electron';
import UserAppManage from '../userApp/UserAppManage';
import UserApp from '../userApp/UserApp';
import nodeEvbitonment from '../nodeEnvironment/NodeEvbitonment';

export class Packager {

    static async packApp(appId: string, type: 'exe' | 'script', outputPath: string): Promise<void> {
        if (type === 'exe') {
            await this.packToExe(appId, outputPath);
        } else {
            await this.packToScript(appId, outputPath, true);
        }
    }

    /**
     * 打包应用为独立exe
     * @param appId 应用ID
     * @param outputPath 输出路径
     */
    static async packToExe(appId: string, outputPath: string): Promise<void> {
       
        const userApp = UserAppManage.findUserApp(appId);
        if (!userApp) {
            throw new Error('应用不存在');
        }
        const scriptName = `${userApp.name || 'app'}_${userApp.version}`;
        const finalOutputPath = path.join(outputPath, scriptName);
        const nodeOutDir = path.join(finalOutputPath, 'node');
        const appOutDir = path.join(finalOutputPath, 'app');
        await fs.ensureDir(finalOutputPath);
        await fs.ensureDir(nodeOutDir);
        await fs.ensureDir(appOutDir);

        //添加node执行文件 拷贝 软件自带node执行文件

        await fs.copy(nodeEvbitonment.nodeExeDir, nodeOutDir,{
            overwrite: true,
            preserveTimestamps: true,
        });

        // 复制必要的系统文件
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

        
        // 创建启动脚本
        const startScript = `
@echo off
cd /d "%~dp0"
"./node/node.exe" ./app/main.js
        `.trim();

        await fs.writeFile(path.join(finalOutputPath, 'start.bat'), startScript);

        shell.showItemInFolder(`file://${finalOutputPath}/start.bat`);
    }

    /**
     * 打包应用为脚本文件
     * @param appId 应用ID
     * @param outputPath 输出路径
     */
    static async packToScript(appId: string, outputPath: string, openFolder: boolean = false): Promise<void> {
        const userApp = UserAppManage.findUserApp(appId);
        if (!userApp) {
            throw new Error('应用不存在');
        }

        const scriptName = `${userApp.name || 'app'}_${userApp.version}`;
        const finalOutputPath = path.join(outputPath, scriptName, 'app');
        
        // 确保目标目录存在
        await fs.ensureDir(finalOutputPath);
        
        try {
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
                'browserCloseScript.js',
                'dist',
                'node_modules'
            ];

            // 复制应用文件
            const appCopy = fs.copy(userApp.appDir, finalOutputPath, {
                overwrite: true,
                preserveTimestamps: true,
                filter: (src) => {
                    const relativePath = path.relative(userApp.appDir, src);
                    return !excludeDirs.some(dir => relativePath.startsWith(dir));
                }
            });

            // 复制必要的系统文件
            const nodeModules = fs.copy(path.join(UserApp.userAppLocalDir, 'node_modules'), path.join(finalOutputPath, 'node_modules'),{
                overwrite: true,
                preserveTimestamps: true,
            });
            const system = fs.copy(path.join(UserApp.userAppLocalDir, 'system'), path.join(finalOutputPath, 'system'),{
                overwrite: true,
                preserveTimestamps: true,
            });
            const extend = fs.copy(path.join(UserApp.userAppLocalDir, 'extend'), path.join(finalOutputPath, 'extend'),{
                overwrite: true,
                preserveTimestamps: true,
            });

            await Promise.all([appCopy, nodeModules, system, extend]);
            
            // 创建启动脚本
            const startScript = `
@echo off
cd /d "%~dp0"
node main.js %*
            `.trim();
            
            await fs.writeFile(path.join(finalOutputPath, 'start.bat'), startScript);
            if(openFolder) {
                shell.showItemInFolder(`file://${finalOutputPath}/start.bat`);
            }
        } catch (error: any) {
            console.error('打包失败:', error);
            throw new Error('打包失败: ' + error.message);
        }
    }
} 