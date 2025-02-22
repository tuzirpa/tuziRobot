<script setup lang="tsx">
import { Share, Upload, Setting } from '@element-plus/icons-vue';
import { showContextMenu } from '@renderer/components/contextmenu/ContextMenuPlugin';
import { Action } from '@renderer/lib/action';
import { ElButton, ElInput, ElMessage, ElMessageBox } from 'element-plus';
import { computed, ref, watch } from "vue";
import { shareUserAppToPlaza } from './MyApp';
import { getUserApps, UserAppInfo, userApps } from '@renderer/store/commonStore';
import AppLogs from './AppLogs.vue';
import type { AppVariable } from 'src/main/userApp/types';
import { levelMap } from '@renderer/src/pages/flowHome/indexvue';

const emit = defineEmits<{
    (e: 'toAppPlazas'): void
}>();

async function newApp() {
    const res = await ElMessageBox.prompt('请输入应用名称', '新建应用');
    if (res.action === 'confirm') {
        const name = res.value;
        await Action.newUserApp(name);
        getUserApps();
    }
}


async function runUserApp(id: string) {
    await Action.userAppRun(id);
}

async function stopUserApp(id: string) {
    await Action.devStop(id);
    getUserApps();
}

function deleteUserApp(id: string) {

    userApps.value.find((app) => app.id === id)!.deleting = true;
    Action.deleteUserApp(id);
    getUserApps();
    ElMessage.success('删除成功');

}

/**
 * 显示右键菜单
 * @param event 
 * @param app 
 */
function showContextMenuByApp(event: MouseEvent, app: UserAppInfo) {
    showContextMenu(event, [
        {
            label: `${app.status === 'running' ? '停止' : '运行'}`,
            onClick: () => {
                if (app.status === 'running') {
                    stopUserApp(app.id);
                } else {
                    runUserApp(app.id);
                }
            },
            icon: 'icon-yunxing',
            shortcut: ''
        },


        /**/
        {
            label: '导出应用',
            onClick: () => {
                // if (!loginUserInfo.value.isAdmin) {
                //     ElMessage.error('只有管理员才能分享应用');
                //     return;
                // }
                shareUserAppToPlaza(app);
            },
            icon: <el-icon><Upload /></el-icon>,
            shortcut: ''
        },

        {
            label: '分享',
            onClick: async () => {
                //打开应用 加载应用信息
                await Action.openUserApp(app.id);
                optionAppDialog.value.userApp = await Action.getUserApp(app.id);
                optionAppDialog.value.showShared = true;
            },
            icon: <el-icon><Share /></el-icon>,
            shortcut: ''
        },

        {
            label: '配置',
            onClick: () => {
                openConfig(app);
            },
            icon: <el-icon><Setting /></el-icon>,
            shortcut: ''
        }
    ]);
}

const optionAppDialog = ref({
    showShared: false,
    showLogs: false,
    userApp: {} as UserAppInfo,
    shareForm: {
        encipher: false,
        content: '',
        password: '123456',
    }
});

watch(() => optionAppDialog.value.shareForm.password, () => {
    if (optionAppDialog.value.showShared && optionAppDialog.value.shareForm.encipher) {
        sharedAppDialogOpened();
    }
});

async function sharedAppDialogOpened() {
    let content = JSON.stringify(optionAppDialog.value.userApp, null, 2);

    if (optionAppDialog.value.shareForm.encipher) {
        if (!optionAppDialog.value.shareForm.password) {
            content = '';
            ElMessage.error('请输入密码');
        } else {
            content = await Action.aesEncrypt(content, optionAppDialog.value.shareForm.password);
            content = content.substring(0, 1) + '1' + content.substring(1);
        }
    } else {
        content = await Action.aesEncrypt(content);
        content = content.substring(0, 1) + '0' + content.substring(1);
    }

    optionAppDialog.value.shareForm.content = content
}

/**
 * 修改描述
 */
async function editDescription(app: UserAppInfo) {
    const res = await ElMessageBox.prompt('请输入应用描述', `修改 "${app.name}" 描述`, {
        inputValue: app.description,
        inputType: 'textarea',

        confirmButtonText: '确定',
        cancelButtonText: '取消'
    });
    if (res.action === 'confirm') {
        await Action.updateUserAppDescription(app.id, res.value);
        app.description = res.value;
        ElMessage.success('更改描述成功');
    }
}

// function copyContent() {
//     const content = sharedAppDialog.value.shareForm.content;
//     navigator.clipboard.writeText(content);
//     ElMessage.success('复制成功');
// }

const searchText = ref('');

defineExpose({
    newApp
});

const showUserApps = computed(() => {
    let userAppsTemp = userApps.value.filter(item => !item.type || item.type === 'myCreate')
    if (searchText.value) {
        userAppsTemp = userAppsTemp.filter((app) => {
            return app.name.includes(searchText.value)
                || app.author.includes(searchText.value)
                || app.description.includes(searchText.value)
        });
    }
    return userAppsTemp;
})

async function openLogsDir(appId: string) {
    Action.openLogsDir(appId);
}
const showLogsMask = ref(false);
const showLogsAppId = ref('');

const configDialogVisible = ref(false);
const currentAppConfig = ref<{id: string, variables: AppVariable[]}>(); 

async function openConfig(app: UserAppInfo) {
    // 这边需要获取应用的全局变量
    await Action.openUserApp(app.id);
    currentAppConfig.value = {
        id: app.id,
        variables: app.globalVariables?.filter((v: AppVariable) => v.exposed) || []
    };
    configDialogVisible.value = true;
}

async function saveConfig() {
    if (!currentAppConfig.value) return;
    
    await Action.updateAppConfig(currentAppConfig.value.id, currentAppConfig.value.variables);
    configDialogVisible.value = false;
    ElMessage.success('配置保存成功');
    getUserApps(); // 刷新应用列表
}

async function editAppName(app: UserAppInfo) {
    const res = await ElMessageBox.prompt('请输入应用名称', `修改应用名称`, {
        inputValue: app.name,
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    });
    if (res.action === 'confirm') {
        await Action.updateUserAppName(app.id, res.value);
        app.name = res.value;
        ElMessage.success('更改名称成功');
    }
}

// 改为使用 Map 存储每个应用的日志级别过滤器
const appLogLevelFilters = ref(new Map<string, string[]>());

function getAppLogLevelFilter(appId: string) {
    if (!appLogLevelFilters.value.has(appId)) {
        appLogLevelFilters.value.set(appId, ['info', 'warn', 'error', 'fatalError']);
    }
    return appLogLevelFilters.value.get(appId)!;
}

const logLevelOptions = [
    { label: '调试', value: 'debug' },
    { label: '信息', value: 'info' },
    { label: '警告', value: 'warn' },
    { label: '错误', value: 'error' },
    { label: '致命', value: 'fatalError' }
];

function updateAppLogFilter(appId: string, value: string[]) {
    appLogLevelFilters.value.set(appId, value);
}

</script>

<template>
    <div class="viewbox">
        <div class="app-list-title flex gap-8 font-bold text-lg items-center p-2">
            <div>
                我的应用列表
            </div>
            <div>
                <ElInput v-model="searchText" placeholder="搜索应用" clearable />
            </div>

        </div>
        <div class="overflow-auto">
            <div class="mask" v-show="showLogsMask"></div>
            <div class="app-list p-2 grid gap-8 grid-cols-3">
                <div class="app-item" :class="{ showLogs: app.id === showLogsAppId }" v-for="(app, index) in showUserApps"
                    :key="index" @contextmenu="showContextMenuByApp($event, app)"
                    @dblclick="$router.push('/flowHome/index?appId=' + app.id)">
                    <!-- 遮挡层 -->


                    <el-card class="app-item-card hover:shadow-lg hover:border hover:border-blue-400">
                        <template #header>
                            <div class="flex justify-between items-center">
                                <div class="min-w-16 truncate">{{ index + 1 }} .</div>
                                <div class="operation flex justify-center items-center">
                                    <el-button type="primary" link @click="runUserApp(app.id)"
                                        v-show="app.status === 'stop'">运行</el-button>
                                    <el-button type="primary" link @click="stopUserApp(app.id)"
                                        v-show="app.status === 'running'">停止</el-button>
                                    <el-button type="info" link
                                        @click="$router.push('/flowHome/index?appId=' + app.id)">编辑</el-button>

                                    <el-popconfirm title="确定删除么？" @confirm="deleteUserApp(app.id)">
                                        <template #reference>
                                            <el-button type="danger" link :disabled="app.status !== 'stop'"
                                                :loading="app.deleting">删除</el-button>
                                        </template>
                                    </el-popconfirm>
                                    <el-button link @click="showContextMenuByApp($event, app)" :loading="app.deleting">
                                        <el-icon>
                                            <MoreFilled />
                                        </el-icon>
                                    </el-button>
                                </div>
                            </div>
                        </template>
                        <div class="app-item-content">
                            <div>
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-2">
                                        <span class="truncate">应用名称：{{ app.name }}</span>
                                        <el-icon class="text-gray-400 hover:text-gray-800 cursor-pointer" @click.stop="editAppName(app)">
                                            <EditPen />
                                        </el-icon>
                                    </div>
                                    <el-button v-if="app.globalVariables?.some(v => v.exposed)"
                                              type="primary" 
                                              link 
                                              size="small"
                                              @click.stop="openConfig(app)">
                                        <el-icon><Setting /></el-icon>
                                        配置
                                    </el-button>
                                </div>
                                <div>应用版本：{{ app.version }}</div>
                                <div>应用作者：{{ app.author }}</div>
                                <div class="flex justify-between items-center">
                                    <div class="truncate">应用描述：<span :class="{ 'text-gray-400': !app.description }">{{
                                        app.description ?
                                        app.description :
                                        '暂无描述' }}</span></div>
                                    <el-icon class="ml-2 text-gray-400 hover:text-gray-800 cursor-pointer"
                                        @click="editDescription(app)">
                                        <EditPen />
                                    </el-icon>
                                </div>
                                <div class="logs mt-2">
                                    <div class="flex justify-between items-center">
                                        <div>运行日志：</div>
                                        <div class="py-1 flex items-center gap-2">
                                            <el-popover trigger="click" :width="200">
                                                <template #reference>
                                                    <el-button link type="primary">
                                                        日志级别
                                                        <el-icon class="ml-1"><Filter /></el-icon>
                                                    </el-button>
                                                </template>
                                                <el-checkbox-group 
                                                    :model-value="getAppLogLevelFilter(app.id)"
                                                    @update:model-value="value => updateAppLogFilter(app.id, value)"
                                                >
                                                    <div class="flex flex-col gap-2">
                                                        <el-checkbox 
                                                            v-for="option in logLevelOptions" 
                                                            :key="option.value"
                                                            :label="option.value"
                                                        >
                                                            {{ option.label }}
                                                        </el-checkbox>
                                                    </div>
                                                </el-checkbox-group>
                                            </el-popover>
                                            <ElButton link type="primary" @click="() => {
                                                showLogsMask = !showLogsMask;
                                                if (showLogsMask) {
                                                    showLogsAppId = app.id;
                                                } else {
                                                    showLogsAppId = '';
                                                }
                                            }">
                                                {{ app.id === showLogsAppId ? '收起' : '查看' }}
                                            </ElButton>
                                            <ElButton link type="primary" @click="openLogsDir(app.id)">打开日志目录</ElButton>
                                        </div>
                                    </div>
                                    <AppLogs :app-id="app.id" 
                                            :rows="app.id === showLogsAppId ? 18 : 3"
                                            :level-filter="getAppLogLevelFilter(app.id)">
                                    </AppLogs>
                                </div>
                            </div>

                        </div>
                    </el-card>
                </div>
                <div class="flex justify-center items-center flex-1" v-show="userApps.length === 0">
                    <div class="app-item flex justify-center items-center p-2 text-xl">
                        可以<span class="text-blue-400 cursor-pointer" @click="newApp">开始创建</span>你的第一个应用
                        <!--  或去<span class="text-blue-400 cursor-pointer" @click="emit('toAppPlazas')">示例广场</span>下载应用 -->
                    </div>
                </div>

            </div>
        </div>

        <Teleport to="body">
            <el-dialog v-model="optionAppDialog.showShared" @open="sharedAppDialogOpened" :title="`分享应用`">
                <div>
                    <div>应用名称：{{ optionAppDialog.userApp.name }}</div>
                    <div>应用版本：{{ optionAppDialog.userApp.version }}</div>
                    <div>应用作者：{{ optionAppDialog.userApp.author }}</div>
                    <div>应用描述：{{ optionAppDialog.userApp.description }}</div>
                    <div>流程数：{{ optionAppDialog.userApp.flows.length }}</div>
                </div>
                <template #footer>
                    <div class="flex justify-end">
                        <ElButton type="primary" @click="() => { ElMessage('开发中...') }">生成分享文件</ElButton>
                        <ElButton type="primary" @click="() => { ElMessage('开发中...') }">发布生成应用页</ElButton>
                    </div>
                </template>
            </el-dialog>
        </Teleport>

        <el-dialog v-model="configDialogVisible" title="应用配置" width="600px">
            <div v-if="currentAppConfig?.variables.length === 0" class="text-center text-gray-400 py-4">
                暂无可配置的变量，请先在应用编辑页面设置需要暴露的变量
            </div>
            <el-form v-else label-width="120px">
                <el-form-item v-for="variable in currentAppConfig?.variables" 
                             :key="variable.name"
                             :label="variable.display || variable.name">
                    <el-input v-model="variable.value" 
                             :placeholder="variable.display || '请输入值'"
                             :type="variable.type === 'number' ? 'number' : 'text'" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">保存</el-button>
            </template>
        </el-dialog>

    </div>
</template>

<style lang="less" scoped>
// 添加样式
.mask {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 10;
}

.showLogs {
    position: absolute;
    width: 80%;
    height: 80%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
}
</style>
