<script setup lang="ts">
import type { DirectiveTree, FlowVariable } from 'src/main/userApp/types';
import { sleep, uuid } from '@shared/Utils';
import { watch, computed, nextTick, onMounted, ref } from 'vue';
import { dragData } from '../dragVar';
import { showContextMenu } from '@renderer/components/contextmenu/ContextMenuPlugin';
import { ElCascader, ElMessage, ElScrollbar } from 'element-plus';
import { useDirective } from '../directive';
import { Shortcut } from './ShortcutRegister';
import AddDirective from './AddDirective.vue';
import type Flow from 'src/main/userApp/Flow';
import type UserApp from 'src/main/userApp/UserApp';
import type { IBreakpoint } from 'src/main/userApp/devuserapp/DevNodeJs';
import { Action } from '@renderer/lib/action';
import { showContextFlowMenu, checkError } from './FlowEditOps';
import { curShowFlowErrors } from './FlowEditStore';
import { DirectiveData, OpenFile } from './types'
import { closeFile, curWorkStatus } from '../indexvue'

const props = defineProps<{
    flows: Flow[];
    breakpointData: IBreakpoint;
    appInfo: UserApp;
    isDev: boolean;
}>();

const emit = defineEmits<{
    (
        e: 'historyChange',
        history: {
            curIndex: number;
            historys: { saveName: string; data: any[] }[];
            isRedo: boolean;
            isUndo: boolean;
        }
    ): void;
    (
        e: 'newSubFlow',
        newSubFlow: Flow
    ): void;
}>();


async function executeStep(step: DirectiveData, index: number) {
    console.log('executeStep');
    const res = await Action.executeStep(props.appInfo.id, step, index);
    console.log('调试运行结果', res);
}

async function disableCurDirective() {
    curBlocks.value.forEach((block) => {
        block.disabled = !block.disabled;
    });
    saveCurFlow('禁用当前指令');
}


const files = computed<OpenFile[]>(() => {
    return props.flows.map((item) => {
        const blocks = item.blocks.map((block) => {
            return {
                pdLvn: 0,
                id: uuid(),
                foldDesc: '',
                commentShow: '',
                ...block
            };
        });
        return {
            name: item.name,
            aliasName: item.aliasName ?? item.name,
            filePath: item.filePath,
            historys: [{ saveName: '初始加载', data: JSON.parse(JSON.stringify(blocks)) }],
            curHistoryIndex: 0,
            blocks: blocks
        };
    });
});


const openFiles = computed<OpenFile[]>(() => {
    const opFiles: OpenFile[] = [];
    curWorkStatus.value.openedFlows.forEach((item) => {
        const curFile = files.value.find((file) => file.name === item);
        if (curFile) {
            opFiles.push(curFile);
        }
    });
    return opFiles;
});

const aaa = new Set();
const editFiles = ref(aaa);


const curOpenFile = ref<OpenFile>(files.value[0]);
const curBlocks = ref([curOpenFile.value.blocks[0]]);

watch(() => curWorkStatus.value.activeFlow, () => {
    const curFile = openFiles.value.find((item) => curWorkStatus.value.activeFlow === item.name);
    if (!curFile) {
        curOpenFile.value = openFiles.value[0];
    } else {
        curOpenFile.value = curFile;
    }
    curBlocks.value = [curOpenFile.value.blocks[0]];
}, {
    immediate: true
})

/**
 * 指令描述
 * @param block 指令数据
 */
function commentCompute(block: DirectiveData) {
    if (block.comment) {
        const comment = block.comment.replace(/\${.*?}/g, (substring: string, ..._args: any[]) => {
            const valKey = substring.substring(2, substring.length - 1);
            let val = '';
            for (const key in block.inputs) {
                if (Object.prototype.hasOwnProperty.call(block.inputs, key)) {
                    if (key === valKey) {
                        val = block.inputs[key].display || block.inputs[key].value;
                        break;
                    }
                }
            }
            if (val === '') {
                for (const key in block.outputs) {
                    if (Object.prototype.hasOwnProperty.call(block.outputs, key)) {
                        if (key === valKey) {
                            val = block.outputs[key].name;
                        }
                    }
                }
            }
            if (val) {
                return `<span class="variable">${val}</span>`;
            }
            return '';
        });
        return comment;
    } else {
        return block.name;
    }
}

/**
 * 流程块列表
 */
const blocks = computed(() => {
    if (!curOpenFile.value) {
        return [];
    }
    let pdLvn = 0;
    curOpenFile.value.blocks.forEach((block, index) => {
        block.commentShow = commentCompute(block);
        const errorObj = curShowFlowErrors.value.find((item) => curOpenFile.value.name === item.flowName && item.line === index + 1);
        block.error = errorObj?.message || '';
        block.errorLevel = errorObj?.errorLevel;

        curOpenFile.value.blocks[index].pdLvn = pdLvn;
        //是否有折叠
        curOpenFile.value.blocks[index].isFold = false;
        /* if (block.isElse) {
            pdLvn--;
            pdLvn = pdLvn < 0 ? 0 : pdLvn;
            curOpenFile.value.blocks[index].pdLvn = pdLvn;
            curOpenFile.value.blocks[index].isFold = true;
            curOpenFile.value.blocks[index].open = true;
            pdLvn++;
        }else */if (block.isControlEnd) {
            pdLvn--;
            pdLvn = pdLvn < 0 ? 0 : pdLvn;
            curOpenFile.value.blocks[index].pdLvn = pdLvn;
        }

        if (block.isControl) {
            curOpenFile.value.blocks[index].isFold = true;
            curOpenFile.value.blocks[index].open = curOpenFile.value.blocks[index].open === undefined ? true : curOpenFile.value.blocks[index].open;
            pdLvn++;
        }
    });

    return curOpenFile.value.blocks;
});


const dragenterBlock = ref<DirectiveData | null>(null);

const directives = useDirective();
const directivesData = computed(() => {
    function toOpsData(directive: DirectiveTree) {
        return {
            value: directive,
            label: directive.displayName,
            children: directive?.children?.map((item) => {
                return toOpsData(item);
            })
        };
    }

    return directives.value.map((item) => {
        //@ts-ignore
        return toOpsData(item);
    });
});

/**
 * 获取折叠节点的子节点
 * @param blockParam 当前点击的块
 */
function getFoldSub(blockParam: DirectiveData) {
    let foldNum = 0;
    let subBlocks: DirectiveData[] = [];
    const index = curOpenFile.value.blocks.findIndex((block) => block.id === blockParam.id);
    for (let i = index + 1; i < curOpenFile.value.blocks.length; i++) {
        const tempBlock = curOpenFile.value.blocks[i];
        // if (tempBlock.isElse) {
        //     break;
        // }
        subBlocks.push(tempBlock);
        if (blockParam.pdLvn >= tempBlock.pdLvn) {
            break;
        }
        foldNum++;
    }
    return {
        foldNum,
        subBlocks
    };
}

/**
 * 点击折叠节点
 * @param blockParam
 * @param _index
 */
function foldClick(blockParam: DirectiveData, _index: any) {
    blockParam.open = !blockParam.open;
    if (!blockParam.open) {
        const { foldNum, subBlocks } = getFoldSub(blockParam);
        subBlocks.forEach((item) => {
            item.hide = true;
        });
        blockParam.foldDesc = `${foldNum} 条指令`;
    } else {
        const { subBlocks } = getFoldSub(blockParam);
        subBlocks.forEach((item) => {
            item.hide = false;
        });
    }
}

/**
 * 设置断点
 * @param blockParam
 * @param _index
 */
function breakpointClick(blockParam: DirectiveData, _index: any) {
    blockParam.breakpoint = !blockParam.breakpoint;
    if (blockParam.breakpoint) {
        //断点
        Action.setBreakPoint(props.appInfo.id, curOpenFile.value.name, _index);
    } else {
        //取消断点
        Action.deleteBreakPoint(props.appInfo.id, curOpenFile.value.name, _index);
    }
    saveCurFlow('设置断点');
}

/**
 * 拖拽方向
 */
const dragDirection = ref<'top' | 'bottom'>('bottom');

async function flowEditDrag(event: any) {
    event.preventDefault();
    console.log(dragData.value, 'drag');
    let oldIndex = curOpenFile.value.blocks.findIndex(
        (block) => block.id === dragenterBlock.value?.id
    );

    if (dragData.value.add) {
        oldIndex = oldIndex === -1 ? curOpenFile.value.blocks.length - 1 : oldIndex;
        // curOpenFile.value.blocks.splice(oldIndex + 1, 0, directive);
        addBlock(dragData.value.data, oldIndex + 1);
    } else {
        /**
         * 移动，中间节点往后推
         */

        //把对应位置节点替换成站位元素 然后插入移动元素到对应位置，最后删除站位元素

        // if (!curBlocks.value.some((item) => item.id === dragenterBlock.value?.id)) {
        const tempBlocks = JSON.parse(JSON.stringify(curOpenFile.value.blocks));
        curBlocks.value.forEach((item) => {
            curOpenFile.value.blocks.forEach((item2, index) => {
                if (item2.id === item.id) {
                    tempBlocks[index] = null as any;
                }
            });
        });
        curBlocks.value.forEach((item) => {
            item.hide = false;
        });
        if (dragDirection.value === 'bottom') {
            tempBlocks.splice(oldIndex + 1, 0, ...curBlocks.value);
        } else {
            tempBlocks.splice(oldIndex, 0, ...curBlocks.value);
        }
        curOpenFile.value.blocks = tempBlocks.filter((item) => item !== null);

        // }
        saveCurFlow('移动节点');
    }

    dragenterBlock.value = null;
}

async function flowEditDragEnter(event: DragEvent) {
    event.preventDefault();

    if (!event.target) {
        return;
    }
    await sleep(0);
    const target = event.target as HTMLElement;
    const directiveBlock = target.closest('.directive-block');
    if (directiveBlock) {
        const blockId = directiveBlock.getAttribute('data-id');
        console.log(blockId, 'dragenter');
        const block = curOpenFile.value.blocks.find((block) => block.id === blockId);
        if (block) {
            console.log(block, 'dragenter');
            dragenterBlock.value = block;
            let oldIndex = curOpenFile.value.blocks.findIndex(
                (block) => block.id === dragenterBlock.value?.id
            );
            const newIndex = curOpenFile.value.blocks.findIndex(
                (block) => block.id === curBlocks.value[0].id
            );
            if (dragData.value.add) {
                dragDirection.value = 'bottom';
            } else {
                dragDirection.value = newIndex < oldIndex ? 'bottom' : 'top';
            }
        }
    }
}
function flowEditDragLeave(event: DragEvent) {
    event.preventDefault();
    dragenterBlock.value = null;
}

function flowEditDragOver(event: any) {
    event.dataTransfer.dropEffect = 'move';
    event.preventDefault();
}

function blockDragStart(block: DirectiveData, _index: number) {
    toggleCheckBlock(block);
    dragData.value = { add: false, data: curBlocks.value };
}

/**
 * 切换选中块处理 拖拽时选中块的处理 右击选中块的处理
 * @param block 当前点击的块
 */
function toggleCheckBlock(block: DirectiveData) {
    if (curBlocks.value.some((item) => item.id === block.id)) {
        // 循环当前选中块中是否有折叠节点
        const foldBlocks = curBlocks.value.filter((item) => item.isFold && !item.open);
        if (foldBlocks.length > 0) {
            // 存在折叠节点，将折叠节点的子节点都选中
            foldBlocks.forEach((item) => {
                const { subBlocks } = getFoldSub(item);
                curBlocks.value.push(...subBlocks);
            });
        }
    } else {
        if (block.isFold && !block.open) {
            const { subBlocks } = getFoldSub(block);
            curBlocks.value = [block, ...subBlocks];
        } else {
            curBlocks.value = [block];
        }
    }
}

/**
 * 流程块点击
 * @param event
 * @param block
 * @param _index
 */
function blockClick(event: MouseEvent, block: DirectiveData, _index: number) {
    // 判断是否按下了Ctrl键

    //点击的是折叠节点 并且是关闭的 需要将低下的所有都选中

    if (event && event.ctrlKey) {
        //键盘按下了Ctrl键 需要多选
        if (block.isFold && !block.open) {
            const { subBlocks } = getFoldSub(block);
            curBlocks.value.push(block, ...subBlocks);
        } else {
            curBlocks.value.push(block);
        }
    } else if (event && event.shiftKey) {
        //键盘按下了Shift键 需要一次多选到当前块
        const startIndex = curOpenFile.value.blocks.findIndex((item) => item.id === block.id);
        const endIndex = curOpenFile.value.blocks.findIndex(
            (item) => item.id === curBlocks.value[curBlocks.value.length - 1].id
        );
        const selectBlocks = curOpenFile.value.blocks.slice(
            Math.min(startIndex, endIndex),
            Math.max(startIndex, endIndex) + 1
        );
        curBlocks.value = selectBlocks;
    } else {
        if (block.isFold && !block.open) {
            const { subBlocks } = getFoldSub(block);
            curBlocks.value = [block, ...subBlocks];
        } else {
            curBlocks.value = [block];
        }
    }
}

/**
 * 双击进入编辑模式
 * @param _event
 * @param block
 * @param _index
 */
function blockDbClick(_event: MouseEvent, block: DirectiveData, index: number) {
    editBlock(block, index);
}

/**
 * 计算变量列表
 * @param directive 指令
 * @param index 
 */
async function variablesCompute(_directive: DirectiveTree, index: number) {
    const variablesTemp: FlowVariable[] = [];
    // 获取当前指令之前的指令
    const beforeBlocks = curOpenFile.value.blocks;
    for (let i = 0; i < beforeBlocks.length; i++) {
        const item = beforeBlocks[i];
        const itemIndex = i;
        // 获取指令的输出
        const outputs = item.outputs || {};
        for (const key in outputs) {
            if (Object.prototype.hasOwnProperty.call(outputs, key)) {
                const output = outputs[key];

                const typeDetails = await Action.getOutputTypeDetails(item.key ?? item.name, key);
                console.log(output, '输出', typeDetails);
                variablesTemp.push({
                    name: output.name,
                    type: output.type,
                    display: output.display,
                    typeDetails: typeDetails,
                    before: itemIndex < index
                });
            }
        }
    }
    variables.value = variablesTemp;
}


async function editBlock(block: DirectiveData, index: number) {
    directiveAddTemp.value = JSON.parse(JSON.stringify(block));
    await variablesCompute(block, index);
    addTempIndex.value = index;
    addTempDialogVisible.value = true;
}

/**
 * 添加指令
 * @param directive 指令
 * @param index 插入的位置
 */
async function addBlock(directive: DirectiveTree, index?: number) {
    //获取当前选中的最后块位置
    if (index === undefined) {
        if (curBlocks.value.length === 0) {
            index = curOpenFile.value.blocks.length;
        } else {
            index =
                curOpenFile.value.blocks.findIndex(
                    (block) => block.id === curBlocks.value[curBlocks.value.length - 1].id
                ) + 1;
        }
    }
    index = index ?? 0;
    directiveAddTemp.value = JSON.parse(JSON.stringify(directive));
    addTempIndex.value = index;

    //计算当前指令能用的变量列表
    await variablesCompute(directive, index);

    addTempDialogVisible.value = true;
}

async function copyBlocksImpl() {
    let textHead = '//tuziRpa';
    let text = JSON.stringify(curBlocks.value);
    const textEncrypt = await Action.aesEncrypt(text);
    await Action.copyToClipboard(`${textHead}${textEncrypt}`);

}

/**
 * 复制选中的块
 */
async function copyBlocks() {
    copyBlocksImpl();
    ElMessage.success('复制成功');
}

/**
 * 选中所有块
 */
async function allBlocks() {
    curBlocks.value = curOpenFile.value.blocks;
}


/**
 * 粘贴选中的块
 */
async function pasteBlocks() {
    let clipboardText = await navigator.clipboard.readText();
    console.log(clipboardText, '粘贴内容');

    if (!clipboardText.startsWith('//tuziRpa')) {
        ElMessage.error('粘贴内容格式不对');
        return;
    }
    clipboardText = clipboardText.replace('//tuziRpa', '');
    clipboardText = await Action.aesDecrypt(clipboardText);
    console.log(clipboardText, '粘贴内容');
    const clipboardBlocks = JSON.parse(clipboardText);
    const newBlocks = clipboardBlocks.map((block) => {
        block.id = uuid();
        block.pdLvn = 0;
        block.isFold = false;
        block.open = false;
        block.hide = false;
        return block;
    });
    // 粘贴到当前最后选中块的后面
    if (curBlocks.value.length === 0) {
        curOpenFile.value.blocks.push(...newBlocks);
    } else {
        const index = curOpenFile.value.blocks.findIndex(
            (block) => block.id === curBlocks.value[curBlocks.value.length - 1].id
        );
        curOpenFile.value.blocks.splice(index + 1, 0, ...newBlocks);
        curBlocks.value = newBlocks;
    }
    ElMessage.success('粘贴成功');
    saveCurFlow('粘贴');
}

/**
 * 剪切选中的块
 */
async function cutBlocks() {
    //先复制 然后删除 就实现剪切
    await copyBlocksImpl();
    curOpenFile.value.blocks = curOpenFile.value.blocks.filter(
        (item) => !curBlocks.value.some((block) => block.id === item.id)
    );
    curBlocks.value = [];
    saveCurFlow('剪切');
    ElMessage.success('剪切成功');
}

/**
 * 删除选中的块
 */
function deleteBlocks() {
    curOpenFile.value.blocks = curOpenFile.value.blocks.filter(
        (item) => !curBlocks.value.some((block) => block.id === item.id)
    );
    curBlocks.value = [];
    saveCurFlow('删除');
}

function directiveShowContextMenu(event: any, block: DirectiveData, index: number) {
    event.preventDefault();
    toggleCheckBlock(block);
    console.log(props.isDev, '是否开发模式');

    showContextMenu(event, [
        {
            label: '执行此步骤(调试可用)',
            onClick: () => {
                executeStep(block, index);
            },
            icon: 'icon-yunxing',
            shortcut: '',
            // disabled: !props.isDev
        },
        {
            label: '禁用/启用当前指令',
            onClick: () => {
                disableCurDirective();
            },
            icon: 'icon-fuzhi',
            shortcut: 'Ctrl+/'
        },
        {
            label: '复制',
            onClick: copyBlocks,
            icon: 'icon-fuzhi',
            shortcut: 'Ctrl+C'
        },
        {
            label: '剪切',
            onClick: cutBlocks,
            icon: 'icon-jianqie',
            shortcut: 'Ctrl+X'
        },
        {
            label: '粘贴',
            onClick: pasteBlocks,
            icon: 'icon-niantie',
            shortcut: 'Ctrl+V'
        },
        {
            label: '编辑',
            onClick: () => {
                editBlock(
                    curBlocks.value[0],
                    curOpenFile.value.blocks.findIndex((item) => item.id === curBlocks.value[0].id)
                );
            },
            icon: 'icon-bianji',
            shortcut: 'F2'
        },
        {
            label: '删除',
            onClick: deleteBlocks,
            icon: 'icon-shanchu',
            shortcut: 'Delete'
        }
    ]);
}

const editNode = ref<HTMLElement>();
onMounted(() => {
    if (editNode.value) {
        //注册快捷键
        const shortcut = new Shortcut(editNode.value);
        shortcut.register({ keys: ['Z', 'z'], ctrlKey: true }, undo);
        shortcut.register({ keys: ['Z', 'z'], ctrlKey: true, shiftKey: true }, redo);
        shortcut.register({ keys: ['A', 'a'], ctrlKey: true }, allBlocks);
        shortcut.register({ keys: ['C', 'c'], ctrlKey: true }, copyBlocks);
        shortcut.register({ keys: ['V', 'v'], ctrlKey: true }, pasteBlocks);
        shortcut.register({ keys: ['X', 'x'], ctrlKey: true }, cutBlocks);
        shortcut.register({ keys: ['Delete'] }, deleteBlocks);
        shortcut.register({ keys: ['/'], ctrlKey: true }, disableCurDirective);
        shortcut.register({ keys: ['F2'] }, () => {
            editBlock(
                curBlocks.value[0],
                curOpenFile.value.blocks.findIndex((item) => item.id === curBlocks.value[0].id)
            );
        });
    }
});

const addBlockDialogVisible = ref(false);
const addBlockDirective = ref<any[]>([]);
function addBlockComfig() {
    if (!addBlockDirective.value) {
        return;
    }
    //获取最后一个
    const tempDirective = addBlockDirective.value[addBlockDirective.value.length - 1];
    addBlock(tempDirective);
    addBlockDialogVisible.value = false;
}

const directiveAddTemp = ref<DirectiveData>();
const addTempDialogVisible = ref(false);
const addTempIndex = ref(0);

function addBlockTemp() {
    const addDirective: DirectiveData = JSON.parse(JSON.stringify(directiveAddTemp.value));
    console.log(addDirective, '添加节点确定');
    let hasError = false;
    for (const key in addDirective.inputs) {
        if (Object.prototype.hasOwnProperty.call(addDirective.inputs, key)) {
            const input = addDirective.inputs[key];
            if (input.addConfig.required && !input.value) {
                ElMessage.error(`必填字段：${input.addConfig.label}未填写`);
                hasError = true;
            }
        }
    }

    if (hasError) {
        return;
    }
    if (!addDirective.id) {
        addDirective.id = uuid();
        curOpenFile.value.blocks.splice(addTempIndex.value, 0, addDirective);
        addTempDialogVisible.value = false;
        //添加完节点如果只有一个自动选中
        if (curOpenFile.value.blocks.length === 1) {
            curBlocks.value = [curOpenFile.value.blocks[0]];
        } else {
            curBlocks.value = [curOpenFile.value.blocks[addTempIndex.value]];
        }

        //判断如果添加的是控制流程开始需要自动添加控制流程结束

        if (addDirective.isControl && addDirective.name === 'flowControl.if') {

            const controlEnd: DirectiveData = {
                id: uuid(),
                pdLvn: 0,
                name: 'flowControl.if.end',
                key: 'system.flowControl.if.end',
                displayName: 'END IF',
                comment: '结束条件判断',
                isControl: false,
                isControlEnd: true,
                inputs: {},
                outputs: {}
            };
            curOpenFile.value.blocks.splice(addTempIndex.value + 1, 0, controlEnd);
        }
        if (addDirective.isControl && addDirective.isLoop) {
            const controlEnd: DirectiveData = {
                id: uuid(),
                pdLvn: 0,
                name: 'flowControl.for.end',
                key: 'system.flowControl.for.end',
                displayName: '循环结束标记',
                comment: '表示循环区域的尾部',
                isControl: false,
                isControlEnd: true,
                inputs: {},
                outputs: {}
            };
            curOpenFile.value.blocks.splice(addTempIndex.value + 1, 0, controlEnd);
        }


        saveCurFlow('添加');
    } else {
        //有id 说明是编辑节点
        const index = curOpenFile.value.blocks.findIndex((block) => block.id === addDirective.id);
        curOpenFile.value.blocks.splice(index, 1, addDirective);
        addTempDialogVisible.value = false;
        curBlocks.value = [addDirective];
        saveCurFlow('编辑');
    }
}

/**
 * 变量列表
 */
const variables = ref<FlowVariable[]>([]);

function emitHistoryChange() {
    const isRedo = curOpenFile.value.curHistoryIndex !== curOpenFile.value.historys.length - 1;
    const isUndo = curOpenFile.value.curHistoryIndex !== 0;
    emit('historyChange', {
        curIndex: curOpenFile.value.curHistoryIndex,
        historys: curOpenFile.value.historys,
        isRedo,
        isUndo
    });
}


const saveFlowDebounce = (() => {
    let st: any;
    return function () {
        clearTimeout(st);
        editFiles.value.add(curOpenFile.value.name);

        st = setTimeout(() => {
            const saveObj: any = JSON.parse(JSON.stringify(curOpenFile.value));
            saveObj.blocks = saveObj.blocks.map((item) => {
                delete item.commentShow;
                delete item.foldDesc;
                delete item.error;
                return item;
            });
            console.log(saveObj, '保存流程');

            Action.saveFlow(props.appInfo.id, saveObj);

            checkError(props.appInfo.id);
            editFiles.value.delete(curOpenFile.value.name);
        }, 1000);
    }
})();

/**
 * 保存流程
 */
async function saveCurFlow(saveName?: string) {
    const saveObj: any = JSON.parse(JSON.stringify(curOpenFile.value));
    const curIndex = curOpenFile.value.curHistoryIndex;
    const history = curOpenFile.value.historys;
    if (curIndex < history.length - 1) {
        history.splice(curIndex + 1);
    }

    history.push({
        saveName: saveName || '未命名',
        data: JSON.parse(JSON.stringify(saveObj.blocks))
    });
    console.log(history, '历史记录');


    if (history.length > 20) {
        history.shift();
    }
    curOpenFile.value.curHistoryIndex = history.length - 1;

    saveFlowDebounce();
    emitHistoryChange();

}

/**
 * 保存流程 不处理历史
 */
async function saveCurFlowNoHistory() {
    saveFlowDebounce();
}


/**
 * 撤销
 */
const undo = () => {
    console.log('撤销');

    if (curOpenFile.value.curHistoryIndex === 0) {
        return;
    }
    curOpenFile.value.curHistoryIndex--;

    curOpenFile.value.blocks = curOpenFile.value.historys[curOpenFile.value.curHistoryIndex].data;
    curBlocks.value = [];
    saveCurFlowNoHistory();
    emitHistoryChange();
};

/**
 * 重做
 */
const redo = () => {
    if (curOpenFile.value.curHistoryIndex >= curOpenFile.value.historys.length - 1) {
        return;
    }
    curOpenFile.value.curHistoryIndex++;
    curOpenFile.value.blocks = curOpenFile.value.historys[curOpenFile.value.curHistoryIndex].data;
    saveCurFlowNoHistory();
    emitHistoryChange();
};

const editScrollNode = ref<HTMLElement>();
async function scrollIntoRow(flowName: string, rowNum: number) {
    //判断当前文件是否打开，未打开给他打开，然后滚动到指定行
    const opened = curWorkStatus.value.openedFlows.includes(flowName);
    if (!opened) {
        curWorkStatus.value.openedFlows.push(flowName);
    }
    if (curWorkStatus.value.activeFlow !== flowName) {
        curWorkStatus.value.activeFlow = flowName;
    }
    await nextTick();
    // await new Promise((resolve) => { setTimeout(resolve, 3000); });
    // document.getElementById(`row-${rowNum}`)?.scrollIntoView({
    //     behavior: 'smooth',
    //     block: 'center',
    //     inline: 'center'
    // });
    // curBlocks.value = [curOpenFile.value.blocks[rowNum - 1]];

    let top = document.getElementById(`row-${rowNum}`)?.offsetTop ?? 0;
    top = top > 100 ? top - 100 : top;
    editScrollNode.value?.scrollTo({
        top,
    });

    curBlocks.value = [curOpenFile.value.blocks[rowNum - 1]];
}

/**
 * 新建子流程
 */
async function newSubFlow() {
    const newSubFlow = await Action.newSubFlow(props.appInfo.id);
    console.log(newSubFlow, '新建子流程');

    if (!newSubFlow) {
        ElMessage.error('新建子流程失败');
        return;
    }

    emit('newSubFlow', newSubFlow);
}

const filesScrollbarRef = ref<InstanceType<typeof ElScrollbar>>();
const scrollLeftValue = ref(0);

function initHandleWheel() {
    // const maxWidth = filesScrollbarRef!.value!.wrapRef?.scrollLeft ?? 0;

    const scrollContainer = document.getElementById('files');
    if (!scrollContainer) {
        return;
    }
    scrollContainer.addEventListener('wheel', (event) => {
        // 横向滚动距离
        const scrollDistance = event.deltaY;
        // 根据滚动方向调整横向滚动位置
        scrollLeftValue.value += scrollDistance;

        // if (scrollLeftValue.value >= maxWidth) {
        //     scrollLeftValue.value = maxWidth;
        // } else if (scrollLeftValue.value <= 0) {
        //     scrollLeftValue.value = 0;
        // }
        filesScrollbarRef.value!.setScrollLeft(scrollLeftValue.value);
        scrollLeftValue.value = filesScrollbarRef!.value!.wrapRef!.scrollLeft;

        // 阻止默认滚动事件
        event.preventDefault();
    });
}

function addBlockDialogOpened() {
    //@ts-ignore
    window.document.querySelector('.addBlockDialog input').focus()
}

function filterMethod(node: any, key: string) {
    return !!node.value?.displayName.toLocaleLowerCase().includes(key.toLocaleLowerCase());
}

onMounted(() => {
    initHandleWheel();
    checkError(props.appInfo.id);
});



defineExpose({
    undo,
    redo,
    addBlock,
    scrollIntoRow
});
</script>

<template>
    <div class="viewbox rounded bg-white flex-1">
        <div class="flow-header flex items-center gap-2 bg-gray-100">
            <el-scrollbar :noresize="true" ref="filesScrollbarRef" id="files">
                <div class="files flex items-center shrink-0">
                    <div class="file relative group w-30 flex py-2 px-4 cursor-pointer border border-transparent shrink-0 hover:bg-white/60 hover:border-white/60"
                        v-for="file in openFiles" :key="file.name"
                        :class="{ 'bg-white border-white': file.name === curOpenFile.name }"
                        @click="curWorkStatus.activeFlow = file.name; emitHistoryChange()"
                        @contextmenu="showContextFlowMenu($event, file)">
                        <div class="flow-name text-sm max-w-40 truncate">
                            <!-- {{ file.aliasName }} -->
                            <el-popover placement="bottom-start" effect="dark" :show-after="1000" :showArrow="false"
                                trigger="hover" :content="file.aliasName">
                                <template #reference>
                                    <span class="m-2">{{ file.aliasName }}</span>
                                </template>
                            </el-popover>
                        </div>
                        <div class="flow-edit ml-1" v-show="editFiles.has(file.name)">
                            *
                        </div>

                        <div v-if="file.name !== 'main.flow'" class="close-btn hidden group-hover:flex hover:bg-gray-200 rounded justify-center items-center w-6 h-6
                            absolute top-0 right-0 cursor-pointer text-red-500" @click.stop="closeFile(file.name);">
                            <el-icon>
                                <Close />
                            </el-icon>
                        </div>
                    </div>
                    <div class="file w-30 flex py-2 px-4 cursor-pointer shrink-0 hover:bg-white/60" @click="newSubFlow">
                        +
                    </div>
                </div>
            </el-scrollbar>
        </div>
        <div class="viewbox relative">
            <div class="flex flex-row overflow-auto flex-1" ref="editScrollNode" v-rememberScroll="curOpenFile.name">
                <div class="col-number flex flex-col items-center mt-2 pb-10 border-r border-gray-300"
                    v-if="blocks.length > 0">
                    <div class="flex justify-between items-center row-number w-20" v-show="!block.hide"
                        v-for="(block, index) in blocks" :key="`row-${index + 1}`" :id="`row-${index + 1}`">
                        <div class="text-center h-16 flex items-center pl-2">
                            <div @click="breakpointClick(block, index)" :class="block.errorLevel">
                                <el-tooltip v-if="block.error" class="box-item" :show-arrow="false" effect="dark"
                                    :content="block.error" placement="bottom-start">
                                    {{ index + 1 }}
                                </el-tooltip>
                                <span v-else>{{ index + 1 }}</span>
                            </div>
                            <div class="flex justify-center items-center ml-2 w-6 h-6 cursor-pointer"
                                @click="breakpointClick(block, index)">
                                <div class="w-3 h-3 rounded-full border-2 border-red-400 bg-red-300"
                                    v-if="block.breakpoint"></div>
                            </div>
                        </div>

                        <div v-if="block.isFold" class="cursor-pointer" @click="foldClick(block, index)">
                            <i class="iconfont text-sm hover:text-blue-800" :class="{
                                'icon-jianhaoshouqi': block.open,
                                'icon-jiahaozhankai': !block.open
                            }"></i>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col flex-1 pt-2 pb-10 outline-none" tabindex="0" ref="editNode" @drop="flowEditDrag"
                    @dragenter="flowEditDragEnter" @dragover="flowEditDragOver" @dragleave="flowEditDragLeave">
                    <template v-if="blocks.length > 0">
                        <div class="directive-block" v-for="(element, index) in blocks" :data-id="element.id"
                            :class="[`border-${element.errorLevel} border-l`, index + 1 === breakpointData.line ? 'bg-red-200/60' : '']"
                            :key="element.id" draggable="true" @dragstart="blockDragStart(element, index)"
                            @contextmenu="directiveShowContextMenu($event, element, index)">
                            <div class="row flex items-center" :class="{ 'text-gray-400/50': element.disabled }">
                                <div class="flex flex-1 h-16" v-show="!element.hide">
                                    <div class="h-full row-content group relative hover:bg-gray-100/50 flex-1 has-[.add:hover]:border-b-2 has-[.add:hover]:border-blue-500"
                                        :class="[
                                            curBlocks.some((item) => item && item.id === element.id)
                                                ? 'bg-gray-200/60 hover:bg-gray-200/60 '
                                                : '',
                                            dragenterBlock && dragenterBlock.id === element.id
                                                ? dragDirection === 'top'
                                                    ? 'border-t-2 border-red-500'
                                                    : 'border-b-2 border-blue-500'
                                                : ''
                                        ]" @click="blockClick($event, element, index)"
                                        @dblclick="blockDbClick($event, element, index)">
                                        <div class="flex h-full">
                                            <div class="flex h-full">
                                                <div class="border-gray-300 border-r" v-for="i in element.pdLvn" :key="i"
                                                    :style="[
                                                        `width:1px;`,
                                                        element.pdLvn > 0
                                                            ? `border-left:1px solid rgb(229 231 235,0.3);margin-left:24px;`
                                                            : ''
                                                    ]"></div>
                                            </div>
                                            <div class="py-2 flex flex-col w-0 flex-1 pl-3">
                                                <div class="operation flex items-center gap-1">
                                                    <i class="iconfont" :class="element.icon"></i>
                                                    <div class="font-bold">
                                                        {{ element.displayName }}
                                                        <span v-show="element.isFold && !element.open">
                                                            <span>[...]</span>
                                                            <span class="ml-2 text-xs text-gray-400">{{ element.foldDesc
                                                            }}</span>
                                                        </span>
                                                        <span class="ml-2 text-xs text-red-600">
                                                            {{ element.remark }}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="description flex-1 ml-6 text-xs text-gray-400 truncate"
                                                    v-html="element.commentShow"></div>
                                            </div>
                                        </div>
                                        <div @click="addBlockDialogVisible = true"
                                            class="add hidden cursor-pointer group-hover:flex absolute left-0 w-6 h-6 bottom-0 -translate-x-1/2 translate-y-1/2 z-10">
                                            <div
                                                class="flex items-center justify-center border border-gray-300 text-gray-400 bg-white text-sm rounded-full overflow-hidden hover:bg-blue-500 hover:text-white">
                                                <i class="iconfont icon-jiahao text-2xl"></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                    <div v-show="blocks.length === 0"
                        class="flex flex-1 justify-center items-center text-center text-gray-400">
                        从左侧拖入指令或
                        <span class="text-blue-500 cursor-pointer hover:underline" @click="addBlockDialogVisible = true">
                            点我添加
                        </span>
                        ，像搭积木一样完成自动化流程。
                    </div>
                </div>

                <!-- <div class="absolute top-2 h-full left-14 w-0.5  border-l border-gray-300"></div> -->
            </div>
        </div>
        <!-- 添加指令弹框 -->
        <el-dialog v-model="addBlockDialogVisible" title="添加指令" @opened="addBlockDialogOpened" width="500" align-center
            draggable>
            <div class="flex flex-col">
                <ElCascader class="addBlockDialog" ref="directiveCascader" v-model="addBlockDirective"
                    placeholder="选择要添加的指令" @change="addBlockComfig" :options="directivesData" filterable
                    :filter-method="filterMethod" clearable autofocus />
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="addBlockDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="addBlockComfig"> 确定 </el-button>
                </div>
            </template>
        </el-dialog>
        <!-- 确认添加指令弹框 -->
        <el-dialog v-if="directiveAddTemp" v-model="addTempDialogVisible" @close="directiveAddTemp = void 0"
            :title="`${directiveAddTemp.id ? '编辑' : '添加'}指令`" draggable>
            <div class="flex flex-col">
                <AddDirective :directive="directiveAddTemp" :variables="variables" />
            </div>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="addTempDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="addBlockTemp"> 确定 </el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<style lang="less" scoped>
// 添加样式

.row-number {
    position: relative;

    &::after {
        position: absolute;
        content: '';
        display: block;
        width: 1px;
        height: 100%;
        // background-color: #ff0000;
        top: 0;
        right: -1px;
        background-color: rgb(209 213 219);
    }
}
</style>
<style>
.color,
.variable {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #0c89ff;
}

.variable {
    border-radius: 9999px;
    background-color: #f0f0f0;
    padding: 2px 4px;
}

.error {
    color: red;
}

.border-error {
    border-color: red;
}

.warning {
    color: #ff9900;
}

.border-warning {
    border-color: #ff9900;
}
</style>
