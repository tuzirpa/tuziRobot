<script setup lang="tsx">
import { Share, Upload } from '@element-plus/icons-vue';
import { showContextMenu } from '@renderer/components/contextmenu/ContextMenuPlugin';
import { Action } from '@renderer/lib/action';
import { ElButton, ElInput, ElMessage, ElMessageBox } from 'element-plus';
import { computed, ref, watch } from "vue";
import { shareUserAppToPlaza, UserAppInfo } from './MyApp';

const emit = defineEmits<{
    (e: 'toAppPlazas'): void
}>();

const userApps = ref<UserAppInfo[]>([])

async function newApp() {
    const res = await ElMessageBox.prompt('请输入应用名称', '新建应用');
    if (res.action === 'confirm') {
        const name = res.value;
        await Action.newUserApp(name);
        getUserApps();
    }
}

async function getUserApps() {
    const apps = await Action.getUserApps();
    userApps.value = apps;
}
getUserApps();

function runUserApp(id: string) {
    Action.userAppRun(id);
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
            label: '运行',
            onClick: () => {
                runUserApp(app.id);
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
                sharedAppDialog.value.userApp = await Action.getUserApp(app.id);
                sharedAppDialog.value.show = true;
            },
            icon: <el-icon><Share /></el-icon>,
            shortcut: ''
        }
    ]);
}

const sharedAppDialog = ref({
    show: false,
    userApp: {} as UserAppInfo,
    shareForm: {
        encipher: false,
        content: '',
        password: '123456',
    }
});

watch(() => sharedAppDialog.value.shareForm.password, () => {
    if (sharedAppDialog.value.show && sharedAppDialog.value.shareForm.encipher) {
        sharedAppDialogOpened();
    }
});

async function sharedAppDialogOpened() {
    let content = JSON.stringify(sharedAppDialog.value.userApp, null, 2);

    if (sharedAppDialog.value.shareForm.encipher) {
        if (!sharedAppDialog.value.shareForm.password) {
            content = '';
            ElMessage.error('请输入密码');
        } else {
            content = await Action.aesEncrypt(content, sharedAppDialog.value.shareForm.password);
            content = content.substring(0, 1) + '1' + content.substring(1);
        }
    } else {
        content = await Action.aesEncrypt(content);
        content = content.substring(0, 1) + '0' + content.substring(1);
    }

    sharedAppDialog.value.shareForm.content = content
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
    if (searchText.value) {
        return userApps.value.filter((app) => {
            return app.name.includes(searchText.value) || app.author.includes(searchText.value) || app.description.includes(searchText.value)
        });
    }
    return userApps.value;
})

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
            <div class="app-list p-2 grid gap-8 grid-cols-3">
                <div class="app-item" v-for="(app, index) in showUserApps" :key="index"
                    @contextmenu="showContextMenuByApp($event, app)"
                    @dblclick="$router.push('/flowHome/index?appId=' + app.id)">
                    <!-- <div class="app-name">
                    {{ app.name }}
                </div>
                <div class="operation flex justify-center items-center">
                    <el-button type="primary" link @click="runUserApp(app.id)">运行</el-button>
                    <el-button type="info" link @click="$router.push('/flowHome/index?appId=' + app.id)">编辑</el-button>
                    <el-button type="danger" link @click="deleteUserApp(app.id)" :loading="app.deleting">删除</el-button>
                    <el-button link @click="showContextMenuByApp($event, app)" :loading="app.deleting">
                        <el-icon>
                            <MoreFilled />
                        </el-icon>
                    </el-button>
                </div> -->
                    <el-card class="app-item-card hover:shadow-lg hover:border hover:border-blue-400">
                        <template #header>
                            <div class="flex justify-between items-center">
                                <div class="min-w-16 truncate">{{ index + 1 }} .</div>
                                <div class="operation flex justify-center items-center">
                                    <el-button type="primary" link @click="runUserApp(app.id)">运行</el-button>
                                    <el-button type="info" link
                                        @click="$router.push('/flowHome/index?appId=' + app.id)">编辑</el-button>

                                    <el-popconfirm title="确定删除么？" @confirm="deleteUserApp(app.id)">
                                        <template #reference>
                                            <el-button type="danger" link :loading="app.deleting">删除</el-button>
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
                                <div class="truncate">应用名称：{{ app.name }}</div>
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
            <el-dialog v-model="sharedAppDialog.show" @open="sharedAppDialogOpened" :title="`分享应用`">
                <div>
                    <div>应用名称：{{ sharedAppDialog.userApp.name }}</div>
                    <div>应用版本：{{ sharedAppDialog.userApp.version }}</div>
                    <div>应用作者：{{ sharedAppDialog.userApp.author }}</div>
                    <div>应用描述：{{ sharedAppDialog.userApp.description }}</div>
                    <div>流程数：{{ sharedAppDialog.userApp.flows.length }}</div>
                </div>
                <template #footer>
                    <div class="flex justify-end">
                        <ElButton type="primary" @click="() => { ElMessage('开发中...') }">生成分享文件</ElButton>
                        <ElButton type="primary" @click="() => { ElMessage('开发中...') }">发布生成应用页</ElButton>
                    </div>
                </template>
            </el-dialog>
        </Teleport>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
</style>
