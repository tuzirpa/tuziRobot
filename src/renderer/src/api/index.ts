import { ipcRenderer } from 'electron';

export interface PackAppOptions {
    type: 'exe' | 'script';
    outputPath: string;
    outputUpdateFile?: boolean;  // 是否输出更新文件
    outputVersionFile?: boolean;  // 是否输出版本文件
}

export const Action = {
    packApp: (appId: string, options: PackAppOptions) => {
        return ipcRenderer.invoke('packApp', appId, options);
    },
} 