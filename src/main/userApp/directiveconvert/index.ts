import Flow from '../Flow';
import { typeToCode } from '../directive/convertUtils';
import {
    directiveToCodeMap,
    getDirectiveAddConfig,
    getOutputTypeDetails
} from '../directive/directive';
import { Block, DirectiveTree } from '../types';

const defaultToCode = (directive: DirectiveTree, blockCode: string) => {
    let jsCode = '';

    let params = '';
    //拼写参数列表
    const inputKeys = Object.keys(directive.inputs);
    const paramArr: string[] = [];
    paramArr.push('{');
    const inputValueArr: string[] = [];
    if (inputKeys.length > 0) {
        inputKeys.forEach((key) => {
            const input = directive.inputs[key];
            let codeValue = '';
            if (input.type === 'variable') {
                codeValue = input.value === '' ? 'undefined' : input.value;
            } else if (input.type === 'array') {
                codeValue = `[${input.value}]`;
            } else if (input.type === 'arrayObject') {
                codeValue = `${input.value}`;
            } else {
                codeValue = typeToCode(input);
            }
            inputValueArr.push(`"${key}":${codeValue}`);
        });
    }
    if(directive.inputs2){
        const inputKeys2 = Object.keys(directive.inputs2);
        if (inputKeys2.length > 0) {
            inputKeys2.forEach((key) => {
                //@ts-ignore
                const input = directive.inputs2[key];
                let inputCode: string[] = [];
                input.values?.forEach(ivalue=>{
                    let iInputCode: string[] = [];
                    ivalue.forEach(item=>{
                        let codeValue = '';
                        if (item.type === 'variable') {
                            codeValue = item.value === '' ? 'undefined' : item.value;
                        } else if (item.type === 'array') {
                            codeValue = `[${item.value}]`;
                        } else if (item.type === 'arrayObject') {
                            codeValue = `${item.value}`;
                        } else {
                            codeValue = typeToCode(item);
                        }
                        iInputCode.push(`${codeValue}`);
                    })
                    inputCode.push(`[${iInputCode.join(',')}]`);
                })
                inputValueArr.push(`"${key}":[${inputCode}]`);
            });
        }
    }
    paramArr.push(inputValueArr.join(','));
    paramArr.push('}');
    params = paramArr.join('');

    let thenRes = '';
    const outputKeys = Object.keys(directive.outputs);
    if (outputKeys.length === 0) {
        thenRes = '';
    } else {
        const outputValueArr: string[] = [];
        outputKeys.forEach((key) => {
            const output = directive.outputs[key];
            outputValueArr.push(`${output.name}`);
            thenRes += `${output.name} = res.${key}; `;
        });
    }
    const key = directive.key || directive.name;
    jsCode = `await robotUtil.${key}(${params},${blockCode}).then(res=>{ ${thenRes}});`;
    return jsCode;
};

export async function convertDirective(directive: DirectiveTree, index: number, flow?: Flow) {
    let toCode = directiveToCodeMap.get(directive.key ?? directive.name);
    toCode = toCode || directive.toCode;
    const block: Block = {
        blockLine: index + 1,
        flowAliasName: flow?.aliasName ?? flow?.name ?? '调试代码',
        flowName: flow?.name ?? '调试代码',
        directiveName: directive.name,
        directiveDisplayName: directive.displayName || directive.name,
        failureStrategy: directive.failureStrategy || 'terminate',
        intervalTime: directive.intervalTime || 0,
        retryCount: directive.retryCount || 0
    };
    const {
        blockLine,
        flowName,
        flowAliasName,
        directiveName,
        directiveDisplayName,
        failureStrategy,
        intervalTime,
        retryCount
    } = block;
    const blockCode = `_block = generateBlock(${blockLine}, "${flowName}", "${flowAliasName}", "${directiveName}", "${directiveDisplayName}", "${failureStrategy}", ${intervalTime}, ${retryCount})`;

    // 由于保存代码时不存 inputs的addConfig 和 outputs的typeDetails 字段，所以在这里补全
    //补全 addConfig 字段
    for (const key in directive.inputs) {
        if (Object.prototype.hasOwnProperty.call(directive.inputs, key)) {
            const input = directive.inputs[key];
            input.addConfig = getDirectiveAddConfig(directive.key ?? directive.name, key);
        }
    }
    //补全 typeDetails 字段
    for (const key in directive.outputs) {
        if (Object.prototype.hasOwnProperty.call(directive.outputs, key)) {
            const output = directive.outputs[key];
            output.typeDetails = getOutputTypeDetails(directive.key ?? directive.name, key);
        }
    }

    if (toCode) {
        if (directive.key?.includes('if.end')) {
            console.log(directive.key);
        }
        return await toCode(directive, blockCode);
    } else {
        //统一生成代码逻辑 根据指令名生成代码
        return defaultToCode(directive, blockCode);
    }
}
