import { Action } from '@renderer/lib/action';
import { ElMessage } from 'element-plus';

/**
 * 发布到应用示例广场
 * @param appId 应用id
 */
export async function shareUserAppToPlaza(app: UserAppInfo) {
    console.log('shareUserAppToPlaza', app);
    const fileUrl = await Action.shareUserAppToPlaza(app.id);
    ElMessage.success(`导出成功,路径：${fileUrl}`);
}

/**
 * 分享应用
 * @param appId 应用id
 */
export function sharedApp(app: UserAppInfo) {
    console.log('分享', app);
}
