<script setup lang="tsx">
import BtnTip from '@renderer/components/BtnTip.vue';
import { Action } from '@renderer/lib/action';
import { loginUserInfo } from '@renderer/store/commonStore';
import { useElementSize } from '@vueuse/core';
import { ElButton, ElDialog, ElInput, ElMessage, ElPopover, ElTree } from 'element-plus';
import Node from 'element-plus/es/components/tree/src/model/node';
import { FilterValue, TreeNodeData } from 'element-plus/es/components/tree/src/tree.type';
import type { SystemDirectiveVersion } from 'src/main/api/systemDirective';
import type { DirectiveTree } from 'src/main/userApp/types';
import { ref, watch } from 'vue';
import { directiveLoading, reloadDirective, useDirective } from '../directive';
import { dragData } from '../dragVar';

const emit = defineEmits<{
    (e: 'addDirective', data: DirectiveTree): void;
    (e: 'hideDirectiveTree', hideDirectiveTree: boolean): void;
}>();

const handleNodeClick = (data: DirectiveTree) => {
    console.log(data);
};

const el = ref(null)
const { width } = useElementSize(el)
watch(width, (newVal) => {
    if (newVal > 100) {
        hideDirectiveTree.value = false
    }
    if (newVal < 100) {
        hideDirectiveTree.value = true
    }
})

let data = useDirective();


const defaultProps = {
    children: 'children',
    label: 'name'
};

const hideDirectiveTree = ref(false);

watch(hideDirectiveTree, (newVal) => {
    emit('hideDirectiveTree', newVal);
})

const expandAll = ref(false);
function expandAllNodes() {
    expandAll.value = !expandAll.value;
    Object.values(treeRef.value!.store.nodesMap).forEach((node) => {
        if (!expandAll.value) {
            node.collapse();
        } else {
            node.expand();
        }
    });
}

const searchValue = ref('');
const searchIcon = <i class="iconfont icon-sousuo"></i>;

const treeRef = ref<InstanceType<typeof ElTree>>();

watch(searchValue, (val) => {
    treeRef.value!.filter(val);
});

const filterNode = (value: FilterValue, data: TreeNodeData, _node: Node): boolean => {
    if (!value) return true;
    console.log(data);
    const displayNameFilter = data.displayName?.toLocaleLowerCase().includes(value.toLocaleLowerCase());
    return !!displayNameFilter;
};

function handleDragStart(_event: DragEvent, data: DirectiveTree) {
    dragData.value = { add: true, data };
}

async function uploadNewVersion() {
    await Action.uploadNewVersionDirective(versionForm.value.verstion, versionForm.value.description);
    ElMessage.success('上传成功');
}

const dialogVisible = ref(false);


const versionForm = ref({
    verstion: '',
    description: '',
});

const versionRules = {
    verstion: [
        { required: true, message: '请输入版本号', trigger: 'blur' },
    ],
    description: [
        { required: true, message: '请输入版本描述', trigger: 'blur' },
    ],
};
const allVersions = ref<SystemDirectiveVersion[]>([]);
async function init() {
    //获取版本列表
    allVersions.value = await Action.getAllVersions();
}

init();
function uploadVersionOpen() {

    versionForm.value.verstion = '';
    versionForm.value.description = '';
}

async function useAppointVersionSystemDirective(item: SystemDirectiveVersion) {
    if (!item.localHas) {
        window.electron.ipcRenderer.on('system-directive-download-progress', (_e, progress) => {
            console.log(progress);
            item.downloadProgress = progress.percentage;
            if (item.downloadProgress === 100) {
                window.electron.ipcRenderer.removeAllListeners('system-directive-download-progress');
            }
        });
    }
    await Action.useVersionSystemDirective(item.version);
    await init();
    await reloadDirective();
    ElMessage.success('使用版本' + item.version + '成功');
}

</script>

<template>
    <div class="tree-container viewbox text-xs font-sans" ref="el" v-loading="directiveLoading"
        element-loading-text="指令加载中...">
        <div class="px-2 py-1 viewbox gap-4">
            <div class="header flex justify-between items-center mt-2 gap-1">
                <template v-if="!hideDirectiveTree">
                    <div class="w-8 font-bold text-sm">指令</div>
                    <div class="flex-1">
                        <ElInput class="h-6 overflow-hidden" :prefix-icon="searchIcon" v-model="searchValue"
                            placeholder="搜索指令" clearable />
                    </div>
                    <BtnTip :icon="'icon-zhankai'" :class="{ '-scale-y-100': expandAll }" text="展开/收缩全部指令"
                        @click="expandAllNodes" class="px-0.5 py-0.5 text-xs text-gray-400" />
                    <ElPopover placement="bottom" title="选择版本加载" :width="250" trigger="click" @show="init">
                        <div class="version-list flex flex-col gap-2 max-h-80 overflow-auto">
                            <ElButton v-if="loginUserInfo.isAdmin" type="primary" link size="small"
                                @click="dialogVisible = true">上传新版本</ElButton>
                            <ElButton type="primary" link size="small" @click="reloadDirective">重载本地指令</ElButton>
                            <div v-for="(item, _index) in allVersions"
                                class="version-item group flex justify-between items-center gap-1 cursor-pointer p-2">
                                <el-popover placement="top" title="版本描述" :show-after="500" :width="200" trigger="hover">
                                    <span class="version-desc whitespace-pre">{{ item.description }}</span>
                                    <template #reference>
                                        <div class="version-name">
                                            版本 {{ item.version }}
                                            <span class="text-xs text-gray-400">（{{ `${item.localHas ? '已下载' : '未下载'}`
                                            }}）</span>
                                            <span v-if="item.downloadProgress > 0 && item.downloadProgress < 100">{{
                                                item.downloadProgress.toFixed(2) }} %</span>
                                        </div>

                                    </template>
                                </el-popover>
                                <ElButton class="hidden group-hover:block" type="primary" link size="small"
                                    @click="useAppointVersionSystemDirective(item)">使用</ElButton>
                            </div>

                        </div>
                        <template #reference>
                            <BtnTip :class="{ '-scale-x-100': hideDirectiveTree }" class="text-xs p-0">重载
                            </BtnTip>
                        </template>
                    </ElPopover>

                </template>
                <BtnTip :icon="'icon-fanhui'" text="隐藏" v-if="!hideDirectiveTree" @click="hideDirectiveTree = true"
                    class="px-0.5 p-0.5 text-xs text-gray-400" />
                <BtnTip :icon="'icon-fanhui'" :class="{ '-scale-x-100': hideDirectiveTree }" text="指令" v-else
                    @click="hideDirectiveTree = false" class="px-0.5 p-0.5 text-xs text-gray-400" />

            </div>
            <div class="wrapbox" v-show="!hideDirectiveTree">
                <el-tree ref="treeRef" style="--el-tree-node-content-height: 34px" :data="data" :props="defaultProps"
                    @node-click="handleNodeClick" :filterNodeMethod="filterNode" :default-expand-all="expandAll">
                    <template #default="{ node, data }">
                        <template v-if="node.isLeaf">
                            <div class="flex-1 flex justify-between items-center" draggable="true"
                                @dblclick="emit('addDirective', data)" @dragstart="handleDragStart($event, data)">
                                <div class="tree-node py-2 flex items-center gap-1 align-middle">
                                    <i class="iconfont text-xl" :class="data.icon"></i>
                                    <span>{{ data.displayName }}</span>
                                </div>
                                <div v-if="node.isLeaf" @click.stop="emit('addDirective', data)">
                                    <i class="iconfont icon-tianjia mr-1"></i>
                                </div>
                            </div>
                        </template>
                        <template v-else>
                            <div class="flex-1 flex justify-between items-center">
                                <div class="tree-node py-2 flex items-center gap-1 align-middle">
                                    <i class="iconfont text-xl" :class="data.icon"></i>
                                    <span>{{ data.displayName }}</span>
                                </div>
                                <div v-if="node.isLeaf">
                                    <i class="iconfont icon-tianjia mr-1"></i>
                                </div>
                            </div>
                        </template>
                    </template>
                </el-tree>
            </div>
        </div>
        <ElDialog v-model="dialogVisible" title="上传新版本" @opend="uploadVersionOpen">
            <div class="dialog-body flex flex-col gap-1">
                <ElForm ref="registerFormRef" :model="versionForm" :rules="versionRules" label-width="80px">
                    <ElFormItem label="版本号" prop="verstion">
                        <ElInput v-model="versionForm.verstion" placeholder="请输入版本号"></ElInput>
                    </ElFormItem>
                    <ElFormItem label="版本描述" prop="description">
                        <ElInput type="textarea" v-model="versionForm.description" placeholder="请输入版本描述"></ElInput>
                    </ElFormItem>
                </ElForm>
            </div>
            <template #footer>
                <ElButton type="primary" @click="uploadNewVersion">确定</ElButton>
                <ElButton @click="dialogVisible = false">取消</ElButton>
            </template>
        </ElDialog>
    </div>
</template>

<style lang="less" scoped>
// 添加样式

:deep(.el-tree-node__label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:deep(.el-tree-node) {
    border-radius: 6px;
    overflow: hidden;
}
</style>
