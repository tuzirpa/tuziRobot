<script setup lang="tsx">
import TitleBar from '@renderer/components/TitleBar.vue';
import BoxDraggable from '@renderer/components/BoxDraggable.vue';
import DirectiveTree from './components/DirectiveTree.vue';
import FlowEdit from './components/FlowEdit.vue';
import BtnTip from '@renderer/components/BtnTip.vue';
import { Column, ElAutoResizer, ElCheckbox, ElCheckboxGroup, ElDialog, ElIcon, ElInput, ElLoading, ElMessage, ElMessageBox, ElPopover, ElTable, ElTableColumn, ElTableV2 } from 'element-plus';
import { ref, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Action } from '@renderer/lib/action';
import type UserApp from 'src/main/userApp/UserApp';
import type { IBreakpoint } from 'src/main/userApp/devuserapp/DevNodeJs';
import { curFlowErrors, curFlowErrorsFilter, curShowFlowErrors } from './components/FlowEditStore';
import {
    closeFile, curUserApp, curWorkStatus, handleRunLogsContextMenu, levelMap, runLogs,
    runLogsFilter, runLogsContentFilter, showRunLogs, startRunLogs
} from './indexvue';
import { Alignment } from 'element-plus/es/components/table-v2/src/constants';
import CodeEdit from './components/CodeEdit.vue';
import type Flow from 'src/main/userApp/Flow';
import { showContextMenu } from '@renderer/components/contextmenu/ContextMenuPlugin';
import { DeleteFilled, Filter, Edit, CopyDocument, FullScreen } from '@element-plus/icons-vue';
import GlobalVariable from './components/GlobalVariable.vue';
import type { AppVariable } from 'src/main/userApp/types';
import { addElementLibrary, elementLibraryEditConfirm, propertyTabList, propertyTabsActiveName } from './propertyTabs';
import PropertyTabs from './components/PropertyTabs.vue';
import { getUserApps } from '@renderer/store/commonStore';


const route = useRoute();
const id = route.query.appId as string;

// 定义变量
const userAppDetail = ref<UserApp>();

const instance = getCurrentInstance();

async function getAppDetail() {
    // 获取应用详情
    // 这里应该调用后端接口获取应用详情
    const res = await Action.getUserApp(id);
    userAppDetail.value = res;

    curUserApp.value = userAppDetail.value;

    // 开始监听运行日志, 销毁后停止监听
    onUnmounted(startRunLogs(), instance);

    console.log(userAppDetail.value, 'userAppDetail');
    if (userAppDetail.value?.flows && userAppDetail.value.flows.length > 0) {
        curActiveFlowIndex.value = 0;
    }
}

onMounted(() => {
    init();
});

async function newSubFlow(subFlow: any) {
    await getAppDetail();
    curWorkStatus.value.openedFlows.push(subFlow.name);
    curWorkStatus.value.activeFlow = subFlow.name;
}

async function deleteSubFlow(subFlow: Flow) {

    // 这里应该调用后端接口删除子流程
    await Action.deleteSubFlow(userAppDetail?.value?.id ?? '', subFlow.name);
    //如果删除的流程在已打开中需要关闭文件
    if (curWorkStatus.value.openedFlows.includes(subFlow.name)) {
        closeFile(subFlow.name);
    }

    await getAppDetail();


}

const curActiveFlowIndex = ref(-1);
const loading = ref(true);

async function init() {
    //获取应用工作状态
    curWorkStatus.value = await Action.openUserApp(id);
    console.log(curWorkStatus.value, 'workStatus');

    await getAppDetail();
    // //全局变量暴露
    // if (userAppDetail.value) {
    //     curUserApp.value = userAppDetail.value;
    // }

    loading.value = false;
}


/* async function installPackage() {
    if (userAppDetail.value?.id) {
        await Action.installPackage(userAppDetail.value?.id);
    }
} */

async function run() {
    if (userAppDetail.value?.id) {
        if (isDev.value || isRun.value) {
            ElMessage.info('正在运行中...');
            return;
        }
        await Action.userAppRun(userAppDetail.value?.id);
        isRun.value = true;
        window.electron.ipcRenderer.on('breakpoint', breakpointCallback);
        window.electron.ipcRenderer.on('devRunEnd', devRunEndCallback);
    }
}

const breakpointData = ref<IBreakpoint>({
    line: 0,
    url: ''
});

async function getLoaclVariable() {
    const localScopeChain = breakpointData.value.scopeChain?.find(item => item.type === 'local');
    if (!localScopeChain || !userAppDetail.value?.id) {
        return;
    }
    const scopeChain = localScopeChain.object.objectId;
    const res = await Action.devGetProperties(userAppDetail.value?.id, scopeChain);
    console.log(res.result);
    devVariableData.value = res.result.map((item: any) => {
        const name = item.name;
        const type = item.value.type === 'object' ? item.value.className : (item.value.type ?? '未初始化');
        const value = item.value.type === 'object' ? `Object<${item.value.preview.description}>` : item.value.value;
        return {
            type: type,
            name,
            val: value
        };
    });
}
async function getGlobalVariable() {
    const localScopeChain = breakpointData.value.scopeChain?.find(item => item.type === 'global');
    if (!localScopeChain || !userAppDetail.value?.id) {
        return;
    }
    const scopeChain = localScopeChain.object.objectId;
    const res = await Action.devGetProperties(userAppDetail.value?.id, scopeChain);
    console.log(res.result);
    // const global = res.result.find(item => item.name === 'global');
    // const globalRes = await Action.devGetProperties(userAppDetail.value?.id, global.value.objectId);

    // console.log(globalRes.result);

    globalVariableData.value = res.result.filter(item => item.name.startsWith('_GLOBAL_')).map((item: { name: any; value: { type: any; value: any; }; }) => {
        const name = item.name;
        return {
            type: item.value.type ?? '未初始化',
            name,
            val: item.value.value
        };
    });
}

const breakpointCallback = async (_event: any, data: IBreakpoint) => {
    console.log(data, 'breakpoint');
    if (breakpointData.value.line === data.line && breakpointData.value.url === data.url) {
        devStepOver();
        return;
    }

    breakpointData.value = data;
    isDev.value = true;

    //获取断点变量列表
    if (
        userAppDetail.value?.id &&
        breakpointData.value.scopeChain &&
        breakpointData.value.scopeChain.length > 0
    ) {
        console.log(breakpointData.value);

        getLoaclVariable();
        getGlobalVariable();

    }
};

const devRunEndCallback = (_event: any) => {
    isDev.value = false;
    isRun.value = false;
    window.electron.ipcRenderer.removeAllListeners('breakpoint');
    window.electron.ipcRenderer.removeAllListeners('devRunEnd');
    breakpointData.value = { line: 0, url: '' };
    devVariableData.value = [];
};

async function devRun() {
    if (userAppDetail.value?.id) {
        if (isDev.value || isRun.value) {
            ElMessage.info('正在运行中...');
            return;
        }
        isDev.value = true;
        await Action.userAppDevRun(userAppDetail.value?.id);
        bottomTabsActiveName.value = 'dev-variable';
        window.electron.ipcRenderer.on('breakpoint', breakpointCallback);
        window.electron.ipcRenderer.on('devRunEnd', devRunEndCallback);
    }
}
async function devStepOver() {
    if (userAppDetail.value?.id) {
        await Action.devStepOver(userAppDetail.value?.id);
    }
}
async function devStop() {
    if (userAppDetail.value?.id) {
        await Action.devStop(userAppDetail.value?.id);
    }
}


async function devResume() {
    if (userAppDetail.value?.id) {
        await Action.devResume(userAppDetail.value?.id);
        breakpointData.value = { line: 0, url: '' };
    }
}


/**
 * 底部tab激活状态
 */
const bottomTabsActiveName = ref('run-logs');

/**
 * 调试变量列表
 */
const devVariableData = ref([]);

/**
 * 全局变量列表
 */
const globalVariableData = ref<any[]>([]);


/**
 * 是否处于调试状态
 */
const isDev = ref(false);
const isRun = ref(false);

const historys = ref<{
    curIndex: number;
    historys: { saveName: string; data: any[] }[];
    isRedo: boolean;
    isUndo: boolean;
}>({
    curIndex: 0,
    historys: [],
    isRedo: false,
    isUndo: false
});
const flowEditRef = ref<InstanceType<typeof FlowEdit>>();

/**
 * 日志行样式
 * @param param0 
 */
function runLogsRowClassName(row: { rowData: { level: any; }; }) {
    return row.rowData.level;
}

function handleRowEvent(..._args: any[]) {
    console.log(_args, 'handleRowEvent');
}

async function clickUserAppName() {
    if (!userAppDetail.value) {
        return;
    }
    const { value } = await ElMessageBox.prompt('请输入应用名称', '修改应用名称', {
        inputValue: userAppDetail.value?.name,
        inputType: 'text',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
    });
    if (value) {
        await Action.updateUserAppName(userAppDetail.value.id, value);
        userAppDetail.value.name = value;
    }
}
const hideDirective = ref(false);
const hideDirectiveTree = (e: boolean) => {
    hideDirective.value = e;
    directiveWidth.value = e ? 60 : 250;
};
const directiveWidth = ref(250);

const code = ref('');
const logDetailVisible = ref(false);
function viewDetailsLogMessage(message: string) {
    code.value = message;
    logDetailVisible.value = true;
}

const runLogsColumns: Column<any>[] = [
    {
        key: 'rowIndex',
        title: '序号',
        width: 50,
        align: 'center',
        cellRenderer: ({ rowIndex }) => (
            <div>
                {runLogs.value.length - rowIndex}
            </div>
        )
    },
    {
        key: 'level',
        title: '消息类型',
        dataKey: 'level',
        width: 100,
        align: 'center',
        headerCellRenderer: () => (
            <div class="flex justify-center items-center w-full">
                <div class="mr-2">消息类型</div>
                <ElPopover trigger="click" {...{ width: 100 }} v-slots={{
                    default: () => (
                        <div class="filter-wrapper">
                            <div class="filter-group">
                                <ElCheckboxGroup v-model={runLogsFilter.value}>
                                    <ElCheckbox label="信息" value="info" />
                                    <ElCheckbox label="警告" value="warn" />
                                    <ElCheckbox label="错误" value="error" />
                                    <ElCheckbox label="调试" value="debug" />
                                    <ElCheckbox label="致命错误" value="fatalError" />
                                </ElCheckboxGroup>
                            </div>
                        </div>
                    ),
                    reference: () => (
                        <ElIcon class="cursor-pointer">
                            <Filter />
                        </ElIcon>
                    ),
                }}>

                </ElPopover>

            </div>
        ),
        cellRenderer: ({ cellData: level }) => (
            <div>
                {levelMap[level]}
            </div>
        )
    },
    {
        key: 'time',
        title: '时间',
        dataKey: 'time',
        width: 150,
        align: Alignment.CENTER,
        cellRenderer: ({ cellData: time }) => (
            <div>
                {time}
            </div>
        )
    },
    {
        key: 'message',
        title: '内容',
        dataKey: 'message',
        class: 'log-message',
        headerClass: 'log-message',
        width: 150,
        align: Alignment.CENTER,
        headerCellRenderer: () => (
            <div class="flex justify-center items-center w-full">
                <div class="mr-2">日志内容</div>
                <div class="w-1/2">
                    <ElInput v-model={runLogsContentFilter.value} placeholder="输入关键字进行过滤" />
                </div>
            </div>
        ),
        cellRenderer: ({ cellData: message }) => (
            <div class="flex justify-center group items-center h-full w-full">
                <span class="truncate flex-1 w-0" v-html={message}></span>
                <div class="cursor-pointer" onclick={() => { viewDetailsLogMessage(message) }}>
                    <ElIcon class="text-gray-400 hidden group-hover:block">
                        <el-icon><FullScreen /></el-icon>
                    </ElIcon>
                </div>
            </div>
        )
    },
    {
        key: 'data',
        title: '流程名',
        dataKey: 'data',
        width: 150,
        maxWidth: 500,
        align: Alignment.CENTER,
        cellRenderer: ({ cellData: data }) => {
            /**
             * <el-auto-resizer>
                                        <template #default="{ height, width }">
             */
            // const slotsDefault = ({ height, width }) => {

            // }
            return (<div>
                {data?.flowAliasName}
            </div>)
        }
    },
    {
        key: 'line',
        title: '行号',
        dataKey: 'data',
        width: 80,
        align: Alignment.CENTER,
        cellRenderer: ({ cellData: data }) => (
            <div class="cursor-pointer underline decoration-1" onclick={() => {
                flowEditRef.value?.scrollIntoRow(data?.flowName, data?.blockLine)
            }}>
                {data?.blockLine}
            </div>
        )
    },
];

/**
 * 打开流程
 */
function openFlowByName(flowName: string) {
    console.log(flowName, 'openFlowByName');
    const opened = curWorkStatus.value.openedFlows.includes(flowName);
    if (!opened) {
        curWorkStatus.value.openedFlows.push(flowName);
    }
    curWorkStatus.value.activeFlow = flowName;
}
const router = useRouter();
/**
 * 返回首页
 */
async function onBackHome() {
    const loading = ElLoading.service({
        lock: true,
        text: '正在退出项目...',
        background: 'rgba(0, 0, 0, 0.1)'
    });
    await Action.saveWorkStatus(userAppDetail.value?.id ?? '', curWorkStatus.value);
    loading.close();
    router.back();
}

/**
 * 流程右键菜单
 */
async function handleFlowContextMenu(e: MouseEvent, flow: Flow, _index: number) {
    showContextMenu(e, [
        {
            icon: <el-icon><CopyDocument /></el-icon>,
            label: '复制文件名',
            shortcut: '',
            disabled: flow.name === 'main.flow',
            onClick: async () => {
                console.log('复制流程名', flow.name);
                await navigator.clipboard.writeText(flow.name);
                ElMessage.success('复制成功');
            }
        },
        {
            icon: <el-icon><DeleteFilled /></el-icon>,
            label: '删除流程',
            shortcut: '',
            disabled: flow.name === 'main.flow',
            onClick: async () => {
                console.log('删除流程', flow.name);
                const res = await ElMessageBox.confirm(`确认删除 [${flow.aliasName}] 该流程吗？`);
                console.log(res);

                if (res === 'confirm') {
                    deleteSubFlow(flow);
                }
            }
        },
        {
            icon: <ElIcon><Edit /></ElIcon>,
            label: '重命名',
            shortcut: '',
            disabled: flow.name === 'main.flow',
            onClick: async () => {
                const res = await ElMessageBox.prompt('请输入新的流程名称', {
                    inputValue: flow.aliasName,
                    inputValidator: (val) => {
                        if (val === null || val.length < 1) {
                            return '名称不能为空';
                        }
                        if (val.length > 200) {
                            return '最多可输入200个字符';
                        }
                        return true;
                    },
                    inputType: 'text',
                    confirmButtonText: '确定',
                    cancelButtonText: '取消'
                });

                if (res.action === 'confirm') {
                    console.log(res.value, 'newName');
                    if (!res.value) {
                        ElMessage.error('名称不能为空');
                        return;
                    }
                    flow.aliasName = res.value;
                    await Action.saveFlowAliName(userAppDetail.value?.id ?? '', flow);
                    ElMessage.success('重命名成功');
                }
            }
        }
    ])
}

async function saveGlobalVariable(gvars: AppVariable[]) {
    
    console.log(gvars, 'globalVariableData');
    if (userAppDetail.value?.id) {
        userAppDetail.value.globalVariables = gvars;
        await Action.saveGlobalVariables(userAppDetail.value.id, gvars);
        ElMessage.success('保存成功');
        getUserApps();
    }
}

// 添加逻辑
</script>

<template>
    <div class="viewbox flex-col">
        <TitleBar :title="'应用编辑'">
            <div class="viewbox flex flex-1 flex-row justify-between items-center">
                <div class="viewbox flex flex-row justify-end items-center gap-2">
                    <div class="btn-group flex justify-end items-center p-1 gap-2 text-gray-900">
                        <el-tooltip class="box-item" effect="dark" content="返回" placement="bottom">
                            <div @click="onBackHome"
                                class="btn-item non-draggable flex justify-center items-center rounded py-1 px-2 cursor-pointer hover:bg-slate-400/30">
                                <i class="iconfont icon-fanhui"></i>
                            </div>
                        </el-tooltip>

                        <el-tooltip class="box-item" effect="dark" content="编辑应用信息" placement="bottom-start"
                            :show-after="100">
                            <div @click="clickUserAppName"
                                class="btn-item group non-draggable flex justify-center items-center gap-2 rounded py-1 px-2 pr-8 cursor-pointer hover:bg-slate-400/30">
                                <i class="iconfont icon-yingyongming"></i>
                                <div class="w-20 truncate group-hover:text-gray-800">{{ userAppDetail?.name }}</div>
                                <i class="iconfont icon-bianji opacity-30 group-hover:opacity-100"></i>
                            </div>
                        </el-tooltip>
                        <!-- <BtnTip class="btn-item" :icon="'icon-baocun'" :text="'保存'"></BtnTip> -->
                        <div class="border-r border-gray-200 border-solid w-1 py-3"></div>
                    </div>
                    <div class="btn-group flex justify-end items-center p-1 gap-2 text-gray-900">
                        <BtnTip class="btn-item text-gray-400" :class="{ 'text-gray-800': historys.isUndo }"
                            :icon="'icon-chexiao'" :text="'撤销'" @click="flowEditRef?.undo()"></BtnTip>
                        <BtnTip class="btn-item text-gray-400 chongzuo" :class="{ 'text-gray-800': historys.isRedo }"
                            :icon="'icon-chexiao'" :text="'重做'" @click="flowEditRef?.redo()">
                        </BtnTip>

                        <!-- <BtnTip :icon="'icon-zhedie'" :text="'折叠'"></BtnTip> -->
                        <template v-if="!isDev">
                            <!--   <BtnTip class="bg-slate-400/20 rounded" :icon-class="'text-green-500'" :icon="'icon-tiaoshi'"
                                :text="'安装依赖包'" @click="installPackage">
                                安装包
                            </BtnTip> -->
                            <BtnTip class="bg-slate-400/20 rounded" :class="{ 'text-gray-300': isRun || isDev }"
                                :icon-class="'text-green-500'" :icon="'icon-yunxing'" :text="'运行流程'" @click="run">
                                运行
                            </BtnTip>
                            <BtnTip class="bg-slate-400/20 rounded" :class="{ 'text-gray-300': isRun || isDev }"
                                :icon-class="'text-green-500'" :icon="'icon-tiaoshi'" :text="'调试流程'" @click="devRun">
                                调试
                            </BtnTip>
                        </template>
                        <template v-else>
                            <BtnTip class="bg-slate-400/20 rounded" :icon-class="'text-green-500'" :icon="'icon-yunxing'"
                                :text="'运行到下一个断点'" @click="devResume">
                                继续
                            </BtnTip>
                            <BtnTip class="bg-slate-400/20 rounded" :icon-class="'text-green-500'" :text="'下一步'"
                                :icon="'icon-xiayibu'" @click="devStepOver">
                                下一步
                            </BtnTip>
                        </template>
                        <BtnTip class="bg-slate-400/20 rounded text-gray-300" :icon="'icon-stop'" :text="'停止'"
                            @click="devStop" :class="{ 'text-red-600': isDev || isRun }">
                            停止
                        </BtnTip>
                    </div>
                </div>
                <div class="viewbox flex flex-row justify-end items-center gap-2">
                    <BtnTip class="bg-slate-400/15 rounded" :icon="'icon-wenhao'" :text="'帮助、教程、学习资料'">
                        学习中心
                    </BtnTip>
                    <BtnTip :icon="'icon-tongzhi'" :text="'消息通知'"> </BtnTip>
                    <BtnTip :icon="'icon-sandian'" :text="'插件、交流、分享'"> </BtnTip>
                    <div class="border-r border-gray-200 border-solid w-1 py-3"></div>
                </div>
            </div>
        </TitleBar>
        <div class="viewbox">
            <div class="flex flex-1 flex-row viewbox">
                <!-- 指令区 -->
                <BoxDraggable class="viewbox left-sidebar border-r" :width="directiveWidth" :min-width="60"
                    :resize-right="true">
                    <DirectiveTree @hide-directive-tree="hideDirectiveTree" class="directive-edit flex-1 wrapbox p-1"
                        @add-directive="flowEditRef?.addBlock($event)">
                    </DirectiveTree>
                </BoxDraggable>
                <div class="flex flex-1 flex-row viewbox" v-loading="loading" element-loading-text="应用数据加载中...">
                    <div class="main-content viewbox flex-1 bg-gray-100">
                        <div class="flow-edit flex-1 viewbox p-2">
                            <FlowEdit v-if="userAppDetail" :app-info="userAppDetail" :flows="userAppDetail.flows"
                                :isDev="isDev" @new-sub-flow="newSubFlow" @history-change="(e) => {
                                    console.log(e);
                                    historys = e;
                                }
                                    " ref="flowEditRef" :breakpointData="breakpointData"
                                :curActiveFlowIndex="curActiveFlowIndex">
                            </FlowEdit>
                        </div>
                        <BoxDraggable class="viewbox left-sidebar border-t" :height="270" :resize-top="true">
                            <el-tabs v-model="bottomTabsActiveName" :size="'small'" class="viewbox flex-1">
                                <el-tab-pane label="运行日志" name="run-logs">
                                    <div style="width: 100%;
                                                height: calc(var(--draggable-height) - 60px);
                                            ">
                                        <el-auto-resizer @contextmenu="handleRunLogsContextMenu($event)">
                                            <template #default="{ height, width }">
                                                <ElTableV2 :columns="runLogsColumns" :row-class="runLogsRowClassName"
                                                    @row-event-handlers="handleRowEvent" :data="showRunLogs" :width="width"
                                                    :height="height">
                                                    <template #empty>
                                                        <div class="flex justify-center items-center pt-3 text-gray-400">
                                                            暂无数据
                                                        </div>
                                                    </template>

                                                </ElTableV2>
                                            </template>
                                        </el-auto-resizer>
                                    </div>
                                </el-tab-pane>
                                <el-tab-pane label="调试变量" name="dev-variable">
                                    <el-table :data="[...devVariableData, ...globalVariableData]" :border="true" style="
                                        width: 100%;
                                        height: calc(var(--draggable-height) - 60px);
                                    ">
                                        <el-table-column prop="name" label="变量名" width="180" />
                                        <el-table-column prop="val" label="变量值" />
                                        <el-table-column prop="type" label="变量类型" width="180" />
                                    </el-table>
                                </el-tab-pane>
                                <el-tab-pane class="error-list" label="错误列表" name="error-list">
                                    <template #label>
                                        <div class="error-list-title flex items-center gap-2"
                                            :class="{ 'cornerMark': curFlowErrors.length }">
                                            错误/警告列表
                                            <ElPopover trigger="click">
                                                <ElCheckboxGroup v-model="curFlowErrorsFilter">
                                                    <ElCheckbox label="警告" value="warning" />
                                                    <ElCheckbox label="错误" value="error" />
                                                </ElCheckboxGroup>
                                                <template #reference>
                                                    <ElIcon class="cursor-pointer w-4 h-4 hover:bg-gray-200">
                                                        <Filter />
                                                    </ElIcon>
                                                </template>
                                            </ElPopover>
                                        </div>
                                    </template>
                                    <ElTable :data="curShowFlowErrors" :row-class-name="({ row }) => row.errorLevel"
                                        style="width: 100%;height: calc(var(--draggable-height) - 60px);">
                                        <ElTableColumn label="流程名" prop="flowAliasName" width="180">

                                        </ElTableColumn>

                                        <ElTableColumn label="错误描述" prop="message">

                                        </ElTableColumn>
                                        <ElTableColumn prop="line" label="行号" width="180">
                                            <template #default="scope">
                                                <a class="cursor-pointer underline decoration-1 text-blue-500"
                                                    @click="flowEditRef?.scrollIntoRow(scope.row.flowName, scope.row.line)">
                                                    {{ scope.row.flowAliasName }}: {{ scope.row.line }} 
                                                </a>
                                            </template>
                                        </ElTableColumn>
                                    </ElTable>
                                </el-tab-pane>
                            </el-tabs>
                        </BoxDraggable>
                    </div>
                    <BoxDraggable class="border-l viewbox" :width="250" :resize-left="true">
                        <div class="property-edit flex-1 p-2 gap-1 flex flex-col overflow-hidden">
                            <div class="property-edit-title flex gap-1 items-center">
                                <div class="px-2 py-1 rounded"
                                    :class="{ 'bg-slate-100 font-bold': propertyTabsActiveName === item.name }"
                                    v-for="(item, _index) in propertyTabList" @click="propertyTabsActiveName = item.name">{{
                                        item.label }}</div>

                            </div>

                            <div class="flow-list-container flex flex-col gap-1 overflow-auto"
                                v-show="propertyTabsActiveName === 'flow'">
                                <div class="flow-list flex flex-1 group rounded hover:bg-slate-200"
                                    :class="{ 'bg-slate-100': curActiveFlowIndex === index }"
                                    v-for="(flow, index) in userAppDetail?.flows" @click="curActiveFlowIndex = index"
                                    @dblclick="openFlowByName(flow.name)"
                                    @contextmenu="handleFlowContextMenu($event, flow, index)" :key="index">
                                    <el-tooltip placement="bottom-start" effect="dark" :show-after="1000" :showArrow="false"
                                        trigger="hover" :content="flow.aliasName">
                                        <div class="flow-item flex-1 pl-6 p-2  truncate">
                                            <span class="m-2">{{ flow.aliasName }}</span>
                                        </div>
                                    </el-tooltip>
                                    <el-button class="text-blue-400 hidden group-hover:block mr-1" link
                                        @click="handleFlowContextMenu($event, flow, index)">
                                        <el-icon>
                                            <MoreFilled />
                                        </el-icon>
                                    </el-button>
                                </div>
                            </div>
                            <div class="flow-list-container flex flex-col gap-1 overflow-auto"
                                v-if="propertyTabsActiveName === 'elementLibrary' && userAppDetail && userAppDetail.elementLibrarys.length > 0">
                                <div @click="addElementLibrary"
                                    class="p-2 rounded flex flex-1 justify-center items-center hover:bg-gray-100 hover:text-blue-500 cursor-pointer gap-2">
                                    <el-icon>
                                        <Plus />
                                    </el-icon>
                                    <div>去浏览器捕获元素</div>
                                </div>
                                <div class="flow-list flex flex-1 group rounded hover:bg-slate-200"
                                    @dblclick="elementLibraryEditConfirm(element)"
                                    v-for="(element, index) in userAppDetail?.elementLibrarys" :key="index">
                                    <el-tooltip placement="bottom-start" effect="dark" :show-after="1000" :showArrow="false"
                                        trigger="hover" :content="element.description">
                                        <div class="flow-item flex-1 pl-6 p-2  truncate">
                                            <span class="m-2">{{ element.name }}</span>
                                        </div>
                                    </el-tooltip>
                                    <el-button class="text-blue-400 hidden group-hover:block mr-1" link>
                                        <el-icon>
                                            <MoreFilled />
                                        </el-icon>
                                    </el-button>
                                </div>

                            </div>
                            <div class="flex flex-1 justify-center items-center"
                                v-if="propertyTabsActiveName === 'elementLibrary' && userAppDetail && userAppDetail.elementLibrarys.length === 0">
                                <div class="text-center text-gray-400">
                                    还没有元素库 <span class="text-blue-500 hover:cursor-pointer"
                                        @click="addElementLibrary">点我去浏览器选择元素</span>
                                </div>
                            </div>

                        </div>

                        <BoxDraggable class="left-sidebar border-t" :height="400" :min-height="100" :resize-top="true">
                            <GlobalVariable v-if="userAppDetail" :userAppDetail="userAppDetail"
                                :global-variable-data="globalVariableData"
                                @updateGlobalVariable="(data) => saveGlobalVariable(data)"></GlobalVariable>
                        </BoxDraggable>
                    </BoxDraggable>
                </div>
            </div>
        </div>
        <ElDialog v-model="logDetailVisible" :title="'日志详情'">
            <CodeEdit :code="code"></CodeEdit>
        </ElDialog>
        <PropertyTabs></PropertyTabs>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
.chongzuo {
    transform: scaleX(-1);
}

.cornerMark {
    position: relative;

    &::after {
        position: absolute;
        content: "";
        display: block;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background-color: #f56c6c;
        top: 0;
        right: 0;
        transform: translateX(100%);
    }
}

::v-deep(.log-message) {
    flex: 1 !important;
}

::v-deep(.el-table-v2 .error) {
    color: red;
}

::v-deep(.el-table-v2 .info) {
    color: blue;
}

::v-deep(.el-table-v2 .fatalError) {
    //动画闪烁
    color: red;
}



::v-deep(.el-tabs__content) {
    overflow: auto;
    margin-bottom: 4px;
    margin-left: 4px;
    margin-right: 4px;
}

::v-deep(.el-tabs__header) {
    background-color: #fff;
    margin-bottom: 4px;
}

::v-deep(.el-tabs--top .el-tabs__item.is-top:nth-child(2)) {
    padding-left: 4px;
}
</style>
