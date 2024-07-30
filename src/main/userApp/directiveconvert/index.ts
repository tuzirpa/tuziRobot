import Flow from '../Flow';
import { typeToCode } from '../directive/convertUtils';
import { directiveToCodeMap } from '../directive/directive';
import { Block, DirectiveTree } from '../types';

const defaultToCode = (directive: DirectiveTree, blockCode: string) => {
    let jsCode = '';

    let params = '';
    //拼写参数列表
    const inputKeys = Object.keys(directive.inputs);
    if (inputKeys.length === 0) {
        params = '{}';
    } else {
        const paramArr: string[] = [];
        paramArr.push('{');
        const inputValueArr: string[] = [];
        inputKeys.forEach((key) => {
            const input = directive.inputs[key];
            let codeValue = '';

            if (input.type === 'variable') {
                codeValue = input.value;
            } else if (input.type === 'array') {
                codeValue = `[${input.value}]`;
            } else {
                codeValue = typeToCode(input);
            }
            inputValueArr.push(`"${key}":${codeValue}`);
        });
        paramArr.push(inputValueArr.join(','));
        paramArr.push('}');
        params = paramArr.join('');
    }

    let returnVal = '';
    const outputKeys = Object.keys(directive.outputs);
    if (outputKeys.length === 0) {
        returnVal = '';
    } else {
        const paramArr: string[] = [];
        paramArr.push('{');
        const outputValueArr: string[] = [];
        outputKeys.forEach((key) => {
            const output = directive.outputs[key];
            outputValueArr.push(`"${key}":${output.name}`);
        });
        paramArr.push(outputValueArr.join(','));
        paramArr.push('}');
        returnVal = paramArr.join('');
    }
    const returnString = `var ${returnVal} = `;
    const key = directive.key || directive.name;
    jsCode = `${returnVal ? returnString : ''}await robotUtil.${key}(${params},${blockCode});`;
    return jsCode;
};

export async function convertDirective(directive: DirectiveTree, index: number, flow: Flow) {
    let toCode = directiveToCodeMap.get(directive.name);
    toCode = toCode || directive.toCode;
    const block: Block = {
        blockLine: index + 1,
        flowName: flow.name,
        directiveName: directive.name,
        directiveDisplayName: directive.displayName || directive.name,
        failureStrategy: directive.failureStrategy || 'terminate',
        intervalTime: directive.intervalTime || 0,
        retryCount: directive.retryCount || 0
    };
    const {
        blockLine,
        flowName,
        directiveName,
        directiveDisplayName,
        failureStrategy,
        intervalTime,
        retryCount
    } = block;
    const blockCode = `_block = generateBlock(${blockLine}, "${flowName}", "${directiveName}", "${directiveDisplayName}", "${failureStrategy}", ${intervalTime}, ${retryCount})`;
    if (toCode) {
        return await toCode(directive, blockCode);
    } else {
        //统一生成代码逻辑 根据指令名生成代码
        return defaultToCode(directive, blockCode);
    }
}
