import { showContextMenu } from '@renderer/components/contextmenu/ContextMenuPlugin';
import type { Block, LogLevel } from 'src/main/userApp/types';
import type UserApp from 'src/main/userApp/UserApp';
import type { WorkStatus } from 'src/main/userApp/WorkStatusConf';
import { computed, ref } from 'vue';

/**
 * 当前打开的应用
 */
export const curUserApp = ref<UserApp>(null as any);

/**
 * 当前打开应用工作状态
 */
export const curWorkStatus = ref<WorkStatus>({
    openedFlows: [],
    activeFlow: ''
});

/**
 * 关闭已打开的流程
 */
export function closeFile(fileName: string) {
    console.log(fileName, 'fileName');

    const index = curWorkStatus.value.openedFlows.findIndex((item) => item === fileName);
    curWorkStatus.value.openedFlows = curWorkStatus.value.openedFlows.filter(
        (item) => item !== fileName
    );
    curWorkStatus.value.activeFlow =
        curWorkStatus.value.openedFlows[
            Math.min(curWorkStatus.value.openedFlows.length - 1, index)
        ];
    console.log(curWorkStatus.value.activeFlow);
    setTimeout(() => {
        console.log(curWorkStatus.value.activeFlow);
    }, 1000);
}

/**
 * 关闭其他文件
 */
export function closeOtherFiles(fileName: string) {
    const index = curWorkStatus.value.openedFlows.findIndex((item) => item === fileName);
    curWorkStatus.value.openedFlows = curWorkStatus.value.openedFlows.filter(
        (item) => item === fileName || item === 'main.flow'
    );
    curWorkStatus.value.activeFlow =
        curWorkStatus.value.openedFlows[
            Math.min(curWorkStatus.value.openedFlows.length - 1, index)
        ];
}

/**
 * 关闭右侧文件
 */
export function closeRightFiles(fileName: string) {
    const curIndex = curWorkStatus.value.openedFlows.findIndex((item) => item === fileName);
    curWorkStatus.value.openedFlows = curWorkStatus.value.openedFlows.filter(
        (_item, index) => index <= curIndex
    );
    curWorkStatus.value.activeFlow =
        curWorkStatus.value.openedFlows[
            Math.min(curWorkStatus.value.openedFlows.length - 1, curIndex)
        ];
}

/**
 * 运行日志
 */
export const runLogs = ref<{ level: LogLevel; message: string; time: number; data: Block }[]>([]);

/**
 * 运行日志过滤器
 */
export const runLogsFilter = ref<string[]>(['info', 'warn', 'error', 'fatalError']);

/**
 * 运行日志内容过滤器
 */
export const runLogsContentFilter = ref<string>('');

export const levelMap = {
    debug: '调试',
    info: '信息',
    warn: '警告',
    error: '错误',
    fatalError: '致命'
};

export const showRunLogs = computed(() => {
    let logs = runLogs.value
        .filter((item) => runLogsFilter.value.includes(item.level))
        .filter(
            (item) =>
                !runLogsContentFilter.value || item.message.includes(runLogsContentFilter.value)
        );
    if (runLogsContentFilter.value) {
        logs = logs.map((item) => {
            const reg = new RegExp(runLogsContentFilter.value, 'gi');
            const message = item.message.replace(
                reg,
                `<span style="color:red">${runLogsContentFilter.value}</span>`
            );
            return { ...item, message };
        });
    }
    console.log(logs, 'logs');

    return logs;
});

export function startRunLogs() {
    window.electron.ipcRenderer.on('run-logs', (_event, log) => {
        console.log(log, 'run-logs');
        if (Array.isArray(log)) {
            log.forEach((item) => {
                item.time = new Date(item.time).toLocaleString();
            });
            //倒序
            log.reverse();
            runLogs.value.unshift(...log);
            // 只保留最后500条日志
            if (runLogs.value.length > 500) {
                runLogs.value = runLogs.value.slice(0, 500);
            }
        } else {
            log.time = new Date(log.time).toLocaleString();
            runLogs.value.unshift(log);
            // 只保留最后500条日志
            if (runLogs.value.length > 500) {
                runLogs.value = runLogs.value.slice(0, 500);
            }
        }
    });
    return () => {
        console.log('移除监听');
        window.electron.ipcRenderer.removeAllListeners('run-logs');
    };
}

/**
 * 运行日志右键菜单
 * @param event 鼠标右键事件
 */
export const handleRunLogsContextMenu = (event: MouseEvent) => {
    showContextMenu(event, [
        {
            label: '清空运行日志',
            onClick: () => {
                runLogs.value = [];
            },
            icon: '',
            shortcut: ''
        }
    ]);
};
