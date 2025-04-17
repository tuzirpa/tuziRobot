<script setup lang="ts">
import type { LogMessage } from 'src/main/userApp/types';
import { onMounted, onUnmounted, ref } from 'vue';

//设置属性默认值

const props = withDefaults(defineProps<{
    appId: string,
    rows?: number,
    levelFilter: string[]
}>(), {
    rows: 3
});

const runLogs = ref<any[]>([]);

type LogMessageApp = LogMessage & {
    appId: string,
    timeString: string,
    seqNumber?: number
}
const levelMap = {
    debug: '调试',
    info: '信息',
    warn: '警告',
    error: '错误',
    fatalError: '致命'
};

const logCounter = ref(0);

function log2Content(logMessage: LogMessageApp) {
    const levelStr = levelMap[logMessage.level];
    const flowAliasName = logMessage.data?.flowAliasName ?? '';
    const blockLine = logMessage.data?.blockLine ?? '';
    const message = logMessage.message;
    const seqNumber = logMessage.seqNumber?.toString().padStart(4, ' ') || ''; // 使用消息自带序号
    const content =
        // @ts-ignore
        `${seqNumber} [${levelStr}] [${flowAliasName}:(行: ${blockLine})] [${logMessage.timeString}]:` +
        message;
    return content;
}

const acceptLogs = (_event, log: LogMessageApp | LogMessageApp[]) => {
    console.log(log,props.levelFilter, 'run-logs -- 日志窗口');

    if (Array.isArray(log)) {
        log = log.filter(item => props.levelFilter.includes(item.level));
        log.forEach((item) => {
            item.timeString = new Date(item.time).toLocaleString();
            if (item.data?.directiveName === 'startRun') {
                logCounter.value = 0;
            }
            item.seqNumber = ++logCounter.value;
        });
        //倒序
        log.reverse();
        runLogs.value.unshift(...log);
        // 只保留最后500条日志
        if (runLogs.value.length > 500) {
            runLogs.value = runLogs.value.slice(0, 500);
        }
    } else {
        if (log.appId !== props.appId) return;
        if (!props.levelFilter.includes(log.level)) return;
        log.timeString = new Date(log.time).toLocaleString();
        if (log.data?.directiveName === 'startRun') {
            logCounter.value = 0;
        }
        log.seqNumber = ++logCounter.value;
        runLogs.value.unshift(log);
        // 只保留最后500条日志
        if (runLogs.value.length > 500) {
            runLogs.value = runLogs.value.slice(0, 500);
        }
    }
    content.value = runLogs.value.map(log2Content).join('\n');
}

let unlisten = () => { }
// 监听数据变化
onMounted(() => {
    unlisten = window.electron.ipcRenderer.on(`run-logs-${props.appId}`, acceptLogs);
})
onUnmounted(() => {
    unlisten();
})


// 添加逻辑
const content = ref('')



</script>

<template>
    <div class="app-logs">
        <ElInput type="textarea" v-model="content" :rows="rows"></ElInput>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
.app-logs {
    widows: 100%;
    height: 100%;
}
</style>
