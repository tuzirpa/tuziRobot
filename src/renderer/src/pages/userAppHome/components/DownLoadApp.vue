<script setup lang="ts">
import { computed, ref } from "vue";
import { Action } from '@renderer/lib/action';
import type UserApp from 'src/main/userApp/UserApp';
import { ElButton, ElInput, ElMessage, ElMessageBox } from 'element-plus';

// 添加逻辑


type UserAppInfo = UserApp & { deleting?: boolean };
const userApps = ref<UserAppInfo[]>([])

// async function newApp() {
//     getUserApps();
// }

async function getUserApps() {
    const apps = await Action.getUserApps('into');
    userApps.value = apps;
}
getUserApps();

function runUserApp(id: string) {
    Action.userAppRun(id);
}
function deleteUserApp(id: string) {

    ElMessageBox.confirm('确认删除该应用吗？').then(async (confirm) => {
        if (confirm === 'confirm') {
            userApps.value.find((app) => app.id === id)!.deleting = true;
            Action.deleteUserApp(id);
            getUserApps();
            ElMessage.success('删除成功');
        }
    });

}

const sharedAppDialog = ref({
    show: false,
    userApp: {},
    shareForm: {
        encipher: false,
        content: '',
        password: '',
    }
});

const encipher = computed(() => {
    const content = sharedAppDialog.value.shareForm.content;
    if (content.length > 10) {
        return content.charAt(1) === '1';
    }
    return false;
});


async function intoAppToLocal() {
    let content = sharedAppDialog.value.shareForm.content;
    const password = sharedAppDialog.value.shareForm.password;
    content = content.slice(0, 1) + content.slice(2);
    if (encipher.value) {
        content = await Action.aesDecrypt(content, password);
    } else {
        content = await Action.aesDecrypt(content);
    }
    const appInfo = JSON.parse(content);
    console.log(appInfo);

    //创建应用
    // const newApp = await Action.newUserApp(appInfo.name);

    //创建流程列表

    //创建全局变量

    //最后生成代码

    // Action.intoAppToLocal(content);
    sharedAppDialog.value.show = false;
}

async function fileImport() {
    const appInfo = await Action.importApp();
    console.log(appInfo);

}

</script>

<template>
    <div class="viewbox">
        <div class="flex justify-between items-center mr-1">
            <div class="app-list-title flex font-bold text-lg items-center p-2">
                我导入的应用列表
            </div>
            <div>
                <ElButton type="primary" @click="sharedAppDialog.show = true">导入新应用</ElButton>
            </div>
        </div>
        <div class="app-list flex flex-col p-2 gap-1">
            <div class="app-item flex justify-between items-center border p-2 rounded" v-for="(app, index) in userApps"
                :key="index">
                <div class="app-name">
                    {{ app.name }}
                </div>
                <div class="operation flex justify-center items-center">
                    <el-button class="text-blue-400" link @click="runUserApp(app.id)">运行</el-button>
                    <el-button class="text-blue-400" link
                        @click="$router.push('/flowHome/index?appId=' + app.id)">编辑</el-button>
                    <el-button class="text-blue-400" link @click="deleteUserApp(app.id)"
                        :loading="app.deleting">删除</el-button>
                </div>
            </div>
        </div>
        <Teleport to="body">
            <el-dialog class="w-11/12 h-4/5" :style="{ '--el-dialog-margin-top': '10vh' }" v-model="sharedAppDialog.show"
                :title="`导入应用`">
                <div>
                    <el-form :model="sharedAppDialog.shareForm" label-width="auto">
                        <el-form-item label="">
                            <el-input v-model="sharedAppDialog.shareForm.content" type="textarea" placeholder="请输入分享内容"
                                input-style="height: 60vh;" />
                        </el-form-item>
                    </el-form>
                </div>
                <template #footer>
                    <div class="flex justify-end gap-3">
                        <div class="flex items-center gap-2 text-red-500" v-if="encipher">
                            <div class="w-28">需要密码：</div>
                            <ElInput type="password" v-model="sharedAppDialog.shareForm.password" placeholder="请输入密码" />
                        </div>
                        <ElButton type="primary" :disabled="!sharedAppDialog.shareForm.content" @click="intoAppToLocal">导入
                        </ElButton>
                        <ElButton type="primary" @click="fileImport">从文件导入</ElButton>
                    </div>
                </template>
            </el-dialog>
        </Teleport>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
</style>
