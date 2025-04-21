import * as path from 'path';
import * as fs from 'fs-extra';
import { shell } from 'electron';
import UserAppManage from '../userApp/UserAppManage';
import UserApp from '../userApp/UserApp';

export class Packager {

    static async packApp(appId: string, type: 'exe' | 'script', outputPath: string): Promise<void> {
        if (type === 'exe') {
            await this.packToExe(appId, outputPath);
        } else {
            await this.packToScript(appId, outputPath);
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

        const exeName = `${userApp.name || 'app'}_${userApp.version}.exe`;
        const finalOutputPath = path.join(outputPath, exeName);
        
        // 确保目标目录存在
        await fs.ensureDir(outputPath);
        
        try {
            // 复制应用文件到临时目录
            const tempDir = path.join(outputPath, '.temp');
            await fs.copy(userApp.appDir, tempDir, {
                filter: (src) => {
                    // 排除 dist 目录和 node_modules
                    return !src.includes('dist') && !src.includes('node_modules');
                }
            });

            // TODO: 实现exe打包逻辑
            // 这里先简单复制为示例
            await fs.copy(tempDir, finalOutputPath);
            
            // 清理临时文件
            await fs.remove(tempDir);
            
        } catch (error: any) {
            console.error('打包失败:', error);
            throw new Error('打包失败: ' + error.message);
        }
    }

    /**
     * 打包应用为脚本文件
     * @param appId 应用ID
     * @param outputPath 输出路径
     */
    static async packToScript(appId: string, outputPath: string): Promise<void> {
        const userApp = UserAppManage.findUserApp(appId);
        if (!userApp) {
            throw new Error('应用不存在');
        }

        const scriptName = `${userApp.name || 'app'}_${userApp.version}`;
        const finalOutputPath = path.join(outputPath, scriptName);
        
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
            
            shell.showItemInFolder(`file://${finalOutputPath}/start.bat`);
        } catch (error: any) {
            console.error('打包失败:', error);
            throw new Error('打包失败: ' + error.message);
        }
    }
} 