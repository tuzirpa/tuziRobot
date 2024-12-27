<script setup lang="ts">
import { RouterView } from 'vue-router';
import Update from './components/Update.vue';
import AppStatus from './components/AppStatus.vue';
import { Action } from '@renderer/lib/action';
import { getUserApps } from './store/commonStore';
// 添加逻辑

function init() {
    Action.init();
    // 这边本地全局数据初始化
    getUserApps();
    window.electron.ipcRenderer.on('userApps_update', () => {
        getUserApps();
    });
}
init();

</script>

<template>
    <div class="app viewbox flex">
        <router-view v-slot="{ Component }">
            <!-- 使用任何自定义过渡和回退到 `fade` -->
            <transition name="fade" mode="out-in">
                <component :is="Component" />
            </transition>
        </router-view>
        <Update></Update>
        <AppStatus class="h-6 bg-blue-400 text-white"></AppStatus>
    </div>
</template>

<style lang="less" scoped>
.fade-enter-active {
    transition: opacity 0.3s;
}

.fade-leave-active {
    transition: opacity 0.2s;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
