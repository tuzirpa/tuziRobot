import { ElMessage } from 'element-plus';
import type { MainAction } from '../../../main/action/Action.d';

export const Action = new Proxy<MainAction>({} as any, {
    get(_target, prop) {
        return async function (...args: any[]) {
            const params = args.map((arg) => JSON.parse(JSON.stringify(arg)));
            const result = await window.electron.ipcRenderer.invoke(prop.toString(), ...params);
            if (result.error) {
                ElMessage.error(result.message);
                throw new Error(result.message);
            }
            return result.data;
        };
    }
});

