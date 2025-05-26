import { AddConfig, AddConfigInputType, DirectiveTree, OutputTypeDetails } from '../types';
import UserApp from '../UserApp';
import { join } from 'path';

export const directiveToCodeMap = new Map<
    string,
    (directive: DirectiveTree, block: string) => Promise<string>
>();

let allDirectives: DirectiveTree[] = [];
const allDirectivesAddConfig = new Map<string, AddConfig<AddConfigInputType> | null>();

const allTypeDetails = new Map<string, OutputTypeDetails[] | undefined>();

let loadSystemDirectiveLoaded = false;
function loadSystemDirective() {
    if (loadSystemDirectiveLoaded) {
        return;
    }
    const extendDirective = {
        name: '',
        sort: 0,
        displayName: '系统指令',
        icon: 'icon-gugeliulanqi',
        children: [] as DirectiveTree[],
        inputs: {},
        outputs: {}
    };

    loadSystemDirectiveLoaded = true;

    const directiveJsonPath = join(UserApp.userAppLocalDir, 'system', 'directive.json');
    delete require.cache[directiveJsonPath];
    const extDirectivesJson = require(directiveJsonPath);

    const loadDirevtive = function (directiveGroup: DirectiveTree, directive: any) {
        if (directive.children) {
            const group = {
                name: directive.name,
                sort: 0,
                displayName: directive.name,
                children: [] as DirectiveTree[],
                icon: directive.icon
            } as DirectiveTree;
            directiveGroup.children?.push(group);
            directive.children.forEach((child) => {
                loadDirevtive(group, child);
            });
        } else {
            let directiveModule;
            try {
                const modulePath = join(UserApp.userAppLocalDir, 'system', directive.localFile);
                delete require.cache[modulePath];
                if (modulePath.indexOf('KeyCode') >= 0) {
                    console.log(modulePath);
                }
                directiveModule = require(modulePath);
            } catch (error: any) {
                throw new Error(`系统指令${directive.localFile}加载失败：${error.message}`);
            }
            const directiveTree = directiveModule.config as DirectiveTree;
            directiveTree.key = directiveTree.key || directiveTree.name;
            directiveTree.key = `system.${directiveTree.key}`;
            if (directiveTree.toCode) {
                directiveToCodeMap.set(directiveTree.key, directiveTree.toCode);
            }

            for (const key in directiveTree.inputs) {
                if (Object.prototype.hasOwnProperty.call(directiveTree.inputs, key)) {
                    const input = directiveTree.inputs[key];
                    allDirectivesAddConfig.set(
                        `${directiveTree.key}.${key}`,
                        input.addConfig ?? null
                    );
                    //@ts-ignore
                    delete input.addConfig;
                }
            }
            for (const key in directiveTree.outputs) {
                if (Object.prototype.hasOwnProperty.call(directiveTree.outputs, key)) {
                    const output = directiveTree.outputs[key];
                    allTypeDetails.set(`${directiveTree.key}.${key}`, output.typeDetails);
                    delete output.typeDetails;
                }
            }

            directiveGroup.children?.push(directiveTree);
        }
    };
    extDirectivesJson.forEach((directive) => {
        loadDirevtive(extendDirective, directive);
    });
    allDirectives.push(...extendDirective.children);
}

let loadExtendDirectiveLoaded = false;
function loadExtendDirective() {
    if (loadExtendDirectiveLoaded) {
        return;
    }
    const extendDirective = {
        name: '',
        sort: 0,
        displayName: '扩展指令',
        icon: 'icon-gugeliulanqi',
        children: [] as DirectiveTree[],
        inputs: {},
        outputs: {}
    };

    loadExtendDirectiveLoaded = true;
    const directiveJsonPath = join(UserApp.userAppLocalDir, 'extend', 'directive.json');
    delete require.cache[directiveJsonPath];
    const extDirectivesJson = require(directiveJsonPath);

    const loadDirevtive = function (directiveGroup: DirectiveTree, directive: any) {
        if (directive.children) {
            const group = {
                name: directive.name,
                sort: 0,
                displayName: directive.name,
                children: [] as DirectiveTree[],
                icon: directive.icon
            } as DirectiveTree;
            directiveGroup.children?.push(group);
            directive.children.forEach((child) => {
                loadDirevtive(group, child);
            });
        } else {
            let directiveModule;
            try {
                const modulePath = join(UserApp.userAppLocalDir, 'extend', directive.localFile);
                delete require.cache[modulePath];
                directiveModule = require(modulePath);
            } catch (error: any) {
                throw new Error(`扩展指令${directive.name}加载失败：${error.message}`);
            }
            const directiveTree = directiveModule.config as DirectiveTree;

            directiveTree.key = `extend.${directiveTree.name}`;
            if (directiveTree.toCode) {
                directiveToCodeMap.set(directiveTree.key, directiveTree.toCode);
                console.log(directiveTree.name + ' 有自己的toCode ');
            }

            /**
             * 输入项的addConfig 存入allDirectivesAddConfig, 做到只在编辑中使用，保存源代码不要 addConfig
             */
            for (const key in directiveTree.inputs) {
                if (Object.prototype.hasOwnProperty.call(directiveTree.inputs, key)) {
                    const input = directiveTree.inputs[key];
                    allDirectivesAddConfig.set(
                        `${directiveTree.key}.${key}`,
                        input.addConfig ?? null
                    );
                    //@ts-ignore
                    delete input.addConfig;
                }
            }

            /**
             * 输出项的typeDetails 存入allTypeDetails, 做到只在编辑中使用，保存源代码不要 typeDetails
             */
            for (const key in directiveTree.outputs) {
                if (Object.prototype.hasOwnProperty.call(directiveTree.outputs, key)) {
                    const output = directiveTree.outputs[key];
                    if (output.typeDetails) {
                        allTypeDetails.set(`${directiveTree.key}.${key}`, output.typeDetails);
                        delete output.typeDetails;
                    }
                }
            }

            directiveGroup.children?.push(directiveTree);
        }
    };
    extDirectivesJson.forEach((directive) => {
        loadDirevtive(extendDirective, directive);
    });
    allDirectives.push(extendDirective);
}

/**
 * 获取一个指令列表
 */
export function reloadDirective() {
    //清空指令列表
    allDirectives = [];
    loadSystemDirectiveLoaded = false;

    //加载系统指令
    loadSystemDirective();

    //加载扩展指令
    loadExtendDirectiveLoaded = false;
    loadExtendDirective();
}

/**
 * 获取一个指令列表
 */
export function useDirective() {
    if (allDirectives.length === 0) {
        reloadDirective();
    }
    return allDirectives;
}

export function getDirectiveAddConfig(directiveKey: string, key: string) {
    const addConfig = allDirectivesAddConfig.get(`${directiveKey}.${key}`);
    if (!addConfig) {
        console.warn(`找不到指令${directiveKey}.${key}的addConfig`);
        throw new Error(`找不到指令${directiveKey}.${key}的addConfig`);
    }
    if (addConfig.type === 'select') {
        addConfig.getOptions = addConfig.getOptions?.toString();
    }

    return addConfig;
}

export function getOutputTypeDetails(directiveKey: string, name: string) {
    const typeDetails = allTypeDetails.get(`${directiveKey}.${name}`);
    return typeDetails;
}
