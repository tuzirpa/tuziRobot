<script setup lang="tsx">
import { Action } from '@renderer/lib/action';
import type UserApp from 'src/main/userApp/UserApp';
import type { Block, LogMessage } from 'src/main/userApp/types';

import { computed, ref } from 'vue';

//获取地址栏参数
const params = new URLSearchParams(window.location.search);
const userAppId = params.get('userAppId');
console.log(userAppId, 'userAppId');

const userAppDetail = ref<UserApp>();

if (userAppId) {
    Action.getUserApp(userAppId).then((res) => {
        userAppDetail.value = res;
    })
}

const steps = ref<LogMessage[]>([]);

const stepBlock = computed(() => {
    if (steps.value.length === 0) {
        const data: Block = {
            blockLine: 0,
            flowName: '流程名',
            flowAliasName: '流程名',
            directiveName: '',
            directiveDisplayName: '开始运行',
            failureStrategy: 'terminate',
            intervalTime: 0,
            retryCount: 0
        };
        return { data };
    }
    const step = steps.value[steps.value.length - 1];
    return step;
});

const runTime = ref(0);
let isRun = ref(false);
let runTimeSt: any;
function runStep(_event: any, step: LogMessage | LogMessage[]) {
    console.log('run step', step);
    if (Array.isArray(step)) {
        steps.value.push(...step);
        // 只保留最后1000条日志
        if (steps.value.length > 1000) {
            steps.value = steps.value.slice(-1000);
        }
    } else {
        if (step.data?.directiveName === 'startRun') {
            isRun.value = true;
            steps.value = [];
            clearInterval(runTimeSt);
            //开始计时
            runTimeSt = setInterval(() => {
                runTime.value++;
            }, 1000);
        } else if (step.data?.directiveName === 'endRun') {
            clearInterval(runTimeSt);
            runTime.value = 0;
            isRun.value = false;
        }
        steps.value.push(step);
        // 只保留最后1000条日志
        if (steps.value.length > 1000) {
            steps.value = steps.value.slice(-1000);
        }
    }
}

window.electron.ipcRenderer.on('run-step', runStep);

/**
 * 将时间转换成时分秒
 * @param {number} time 时间，单位秒
 * @returns {string} 时分秒
 */

function formatTime(time: number): string {
    const hour = Math.floor(time / 3600);
    const minute = Math.floor((time - hour * 3600) / 60);
    const second = time - hour * 3600 - minute * 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
}

function close() {
    if (isRun.value) {
        const isConfirm = window.confirm('程序还在运行中，是否停止运行？');
        if (!isConfirm) {
            return;
        }
        stopRun();
    }
    if (userAppDetail.value?.id) {
        Action.closeUserAppStepTip(userAppDetail.value?.id);
    }
}
function stopRun() {
    if (!isRun.value) {
        alert('程序未运行');
        return;
    }
    if (userAppDetail.value?.id) {
        Action.devStop(userAppDetail.value.id);
    }
}

</script>

<template>
    <div class="step-container draggable">
        <div class="app-name">
            <div>应用：{{ userAppDetail?.name }}</div>
            <div class="close-btn non-draggable" @click="close">关闭</div>
        </div>
        <div class="step-tip">
            {{ (stepBlock.data?.flowName) ?? '流程名' }} ：行 {{ stepBlock.data?.blockLine }} 指令{{
                stepBlock.data?.directiveDisplayName }}
        </div>
        <div class="run-time">
            <div>运行时长：{{ formatTime(runTime) }}</div>
            <div class="run-btn-group">
                <!-- <div class="run-btn non-draggable" @click="runStep">暂停</div> -->
                <div class="stop-btn non-draggable" @click="stopRun">停止</div>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
// 添加样式

.step-container {

    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 10px;
    background-color: #f5f5f5;
}

.step-tip {
    flex: 1;
    margin-top: 10px;
}

.app-name {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.close-btn {
    background-color: #797979;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        background-color: #da190b;
    }
}

.run-time {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.run-btn-group {
    display: flex;
    gap: 10px;

    .run-btn {
        background-color: #4CAF50;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
            background-color: #3e8e41;
        }
    }

    .stop-btn {
        background-color: #f44336;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
            background-color: #da190b;
        }
    }
}
</style>
