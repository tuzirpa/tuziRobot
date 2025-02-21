<script setup lang="ts">
import TitleBar from '@renderer/components/TitleBar.vue';
import BoxDraggable from '@renderer/components/BoxDraggable.vue';
import { ElAvatar, ElButton, ElImage, ElMessageBox } from 'element-plus';

import { Action } from '@renderer/lib/action';
import { clearUserInfo, loginUserInfo } from '@renderer/store/commonStore';
import BtnTip from '@renderer/components/BtnTip.vue';
import { useRouter } from 'vue-router';
import MyApp from "./components/MyApp.vue";
import DownLoadApp from "./components/DownLoadApp.vue";
import AppPlazas from "./components/AppPlazas.vue";
import qqImageUrl from '@renderer/assets/QQ.png';
import { ref } from 'vue';

const router = useRouter();

async function logout() {
    await Action.logout();
    clearUserInfo();
    router.push('/login/index');
}

window.electron.ipcRenderer.on('login-out', async () => {
    try {
        console.log('您的登录已失效，请重新登录');

        await ElMessageBox.alert('您的登录已失效，请重新登录');
    } finally {
        clearUserInfo();
        router.push('/login/index');
    }

});

async function feekbackClick() {
    const result = await ElMessageBox.prompt('请输入您的反馈建议或问题', '反馈建议/问题', {
        inputPlaceholder: '请输入您的反馈建议或问题',
        inputType: 'textarea',
        confirmButtonText: '提交',
        cancelButtonText: '取消',
        customClass: 'feekback-box',
    })
    if (result.action === 'confirm') {
        const content = result.value;
        if (content) {
            await Action.submitFeekback(content);
            ElMessageBox.alert('感谢您的反馈，我们会尽快处理');
        }
    }
}

const myApp = ref<InstanceType<typeof MyApp>>();
const curMenu = ref('myApp');

</script>

<template>
    <div class="viewbox">
        <TitleBar :title="'首页'">
            <div class="flex flex-1 justify-between">
                <div>首页</div>
                <div class="user-info flex items-center non-draggable">
                    <ElButton class="m-2" link @click="feekbackClick">反馈建议/问题</ElButton>
                    <el-popover placement="bottom" :width="300" trigger="hover">
                        <template #reference>
                            <ElButton class="m-2" link>QQ交流群</ElButton>
                        </template>
                        <div class="user-info-content flex flex-col gap-2">
                            <ElImage :src="qqImageUrl"></ElImage>
                        </div>
                    </el-popover>
                    <!--    <el-popover placement="bottom" :width="200" trigger="hover">
                        <template #reference>
                            <ElButton class="m-2" link>微信</ElButton>
                        </template>
                        <div class="user-info-content flex flex-col gap-2">

                        </div>
                    </el-popover> -->
                    <el-popover placement="bottom" :width="200" trigger="hover">
                        <template #reference>
                            <ElButton class="m-2" link>{{ loginUserInfo.userName }}</ElButton>
                        </template>
                        <div class="user-info-content flex flex-col gap-2">
                            <!-- 用户信息 -->
                            <div class="user-info-item flex items-center gap-1">
                                <ElAvatar>{{ loginUserInfo.userName }}</ElAvatar>
                                <div>
                                    <div>{{ loginUserInfo.userName }}</div>
                                    <div>{{ loginUserInfo.mobile }}</div>
                                </div>
                            </div>
                            <!-- 退出登录 -->
                            <BtnTip class="btn-item flex justify-start text-lg" :iconClass="'text-lg'"
                                :icon="'icon-tuichudenglu'" :text="'退出登录'" @click="logout">退出登录
                            </BtnTip>
                        </div>
                    </el-popover>
                </div>
            </div>
        </TitleBar>
        <div class="home-container flex flex-1 overflow-hidden">
            <BoxDraggable class="menu-box border-r flex flex-col" :width="250" :resize-right="true">
                <div class="home-left flex justify-center items-center">
                    <div class="p-2 flex flex-1 text-center">
                        <ElButton class="flex-1" type="primary" @click="myApp?.newApp">新建应用</ElButton>
                    </div>
                </div>
                <div class="home-right home-menu flex justify-center items-center">
                    <el-menu @select="curMenu = $event" :default-active="curMenu" class="w-full">
                        <!-- <el-sub-menu index="1">
                            <template #title>
                                <el-icon>
                                    <location />
                                </el-icon>
                                <span>Navigator One</span>
                            </template>
                            <el-menu-item-group>
                                <template #title><span>Group One</span></template>
                                <el-menu-item index="1-1">item one</el-menu-item>
                                <el-menu-item index="1-2">item two</el-menu-item>
                            </el-menu-item-group>
                            <el-menu-item-group title="Group Two">
                                <el-menu-item index="1-3">item three</el-menu-item>
                            </el-menu-item-group>
                            <el-sub-menu index="1-4">
                                <template #title><span>item four</span></template>
                                <el-menu-item index="1-4-1">item one</el-menu-item>
                            </el-sub-menu>
                        </el-sub-menu> -->
                        <el-menu-item index="myApp">
                            <el-icon>
                                <Menu />
                            </el-icon>
                            <template #title>我开发的应用</template>
                        </el-menu-item>
                        <!-- <el-menu-item index="3" disabled>
                            <el-icon>
                                <document />
                            </el-icon>
                            <template #title>Navigator Three</template>
                        </el-menu-item> -->
                        <!--   <el-menu-item index="appPlazas">
                            <el-icon>
                                <Location />
                            </el-icon>
                            <template #title>示例应用广场</template>
                        </el-menu-item> -->
                        <!----> <el-menu-item index="downloadApp">
                            <el-icon>
                                <Download />
                            </el-icon>
                            <template #title>我获取的应用</template>
                        </el-menu-item>

                    </el-menu>
                </div>
            </BoxDraggable>
            <BoxDraggable class="content-box flex flex-col border-r flex-1 bg-gray-100 p-2">
                <!-- <div class="top-bar flex justify-between items-center">
                    <div class="title">帮助中心</div>
                </div> -->
                <div class="content-container flex flex-col rounded bg-white h-full">
                    <!-- 内容区域 -->
                    <!-- 应用列表 -->
                    <MyApp ref="myApp" v-if="curMenu === 'myApp'" @to-app-plazas="() => curMenu = 'appPlazas'"></MyApp>
                    <AppPlazas v-if="curMenu === 'appPlazas'"></AppPlazas>
                    <DownLoadApp v-if="curMenu === 'downloadApp'"></DownLoadApp>
                </div>
            </BoxDraggable>
        </div>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
</style>
<style lang="less">
.feekback-box {
    max-width: 80vw !important;
    width: 80vw !important;

    .el-textarea__inner {
        min-height: 60vh !important;
        height: 60vh !important;
    }
}
</style>
