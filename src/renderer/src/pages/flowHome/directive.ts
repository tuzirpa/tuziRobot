import { Action } from '@renderer/lib/action';
import type { DirectiveTree, OutputTypeDetails } from 'src/main/userApp/types';
import { ref } from 'vue';

const directives = ref<Partial<DirectiveTree>[]>([]);

directives.value = [];

/**
 * 加载指令列表的loading状态
 */
export const directiveLoading = ref(false);

/**
 * 服务器加载的指令列表
 */
async function loadDirective() {
    directiveLoading.value = true;
    directives.value = await Action.getDirectives();
    directiveLoading.value = false;
    console.log(directives.value, 'directives');
}

/**
 * 获取一个指令列表
 * @returns {Array}
 */
export function useDirective() {
    loadDirective();
    return directives;
}

/**
 * 重新加载指令列表
 */
export async function reloadDirective() {
    await Action.reloadDirective();
    await loadDirective();
}

const outputTypeDetailsMap = new Map<string, OutputTypeDetails[] | null>();
/**
 * 获取指令的输出类型详情
 * @param directiveKey
 * @param name
 */
export async function getOutputTypeDetails(directiveKey: string, name: string) {
    const cacheKey = `${directiveKey}.${name}`;
    let outputTypeDetails = outputTypeDetailsMap.get(cacheKey);
    if (outputTypeDetails !== undefined) {
        return outputTypeDetails;
    }
    outputTypeDetails = await Action.getOutputTypeDetails(directiveKey, name);
    outputTypeDetailsMap.set(cacheKey, outputTypeDetails ?? null);
    return outputTypeDetails;
}


/**
 * 通过name 获取指令
 */
export function getDirectiveByKey(name: string) {
    // 偏平化指令列表
    const flatDirectives = directives.value.flatMap((directive) => directive.children);
    return flatDirectives.filter(directive=>!!directive).find((directive) => directive?.name === name);
}
