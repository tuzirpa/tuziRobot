import { showContextMenu } from '@renderer/components/contextmenu/ContextMenuPlugin';
import { Action } from '@renderer/lib/action';
import { OpenFile } from './types';
import { curFlowErrors } from './FlowEditStore';
import { closeFile, closeOtherFiles, closeRightFiles } from '../indexvue';
import { Folder, CopyDocument } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

export const showContextFlowMenu = (event: MouseEvent, file: OpenFile) => {
    showContextMenu(event, [
        {
            label: '关闭',
            onClick: () => {
                closeFile(file.name);
            },
            icon: '',
            shortcut: '',
            disabled: file.name === 'main.flow'
        },
        {
            label: '关闭其他文件',
            onClick: () => {
                closeOtherFiles(file.name);
            },
            icon: '',
            shortcut: ''
        },
        {
            label: '关闭右侧文件',
            onClick: () => {
                closeRightFiles(file.name);
            },
            icon: '',
            shortcut: ''
        },
        {
            icon: (
                <el-icon>
                    <CopyDocument />
                </el-icon>
            ),
            label: '复制文件名',
            shortcut: '',
            disabled: file.name === 'main.flow',
            onClick: async () => {
                await navigator.clipboard.writeText(file.name);
                ElMessage.success('复制成功');
            }
        },
        {
            icon: (
                <el-icon>
                    <CopyDocument />
                </el-icon>
            ),
            label: '复制完整路径文件名',
            shortcut: '',
            onClick: async () => {
                await navigator.clipboard.writeText(file.filePath);
                ElMessage.success('复制成功');
            }
        },
        {
            label: '在文件夹中打开',
            onClick: () => {
                Action.openFolder(file.filePath);
            },
            icon: (
                <el-icon>
                    <Folder />
                </el-icon>
            ),
            shortcut: ''
        }
    ]);
};

// /**
//  * 计算变量列表
//  * @param _directive 指令
//  * @param index
//  */
// function variablesCompute(directives: DirectiveData[], index: number) {
//     const variablesTemp: FlowVariable[] = [];
//     const beforeBlocks = directives.slice(0, index);
//     beforeBlocks.forEach((item, itemIndex) => {
//         // 获取指令的输出
//         const outputs = item.outputs || {};
//         for (const key in outputs) {
//             if (Object.prototype.hasOwnProperty.call(outputs, key)) {
//                 const output = outputs[key];
//                 variablesTemp.push({
//                     name: output.name,
//                     type: output.type,
//                     comment: output.display,
//                     before: itemIndex < index
//                 });
//             }
//         }
//     });
//     return variablesTemp;
// }

export const checkError = async (appId: string) => {
    curFlowErrors.value = [];
    console.log(appId, 'appId');

    curFlowErrors.value = await Action.lintError(appId);
    console.log(curFlowErrors.value, 'errors');
};
