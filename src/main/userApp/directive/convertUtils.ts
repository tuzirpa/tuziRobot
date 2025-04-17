import { DirectiveInput } from '../types';

export function typeToCode(inputItem: DirectiveInput) {
    
    if (inputItem.type === 'string' || inputItem.type === 'textarea') {
        inputItem.value = inputItem.value || '';
        let value = inputItem.value;
        // value = inputItem.value.replace(/\\/g, '\\\\');
        value = String(value).replace(/\`/g, '\\`');
        return `String(\`${value}\`)`;
    } else if (inputItem.type === 'number') {
        return `Number(String(\`${inputItem.value}\`))`;
    } else if (inputItem.type === 'boolean') {
        return `String(\`${inputItem.value ?? ''}\`).toLowerCase() == 'true'`;
    } else if (inputItem.type === 'object') {
        
        if (inputItem.objectMode) {
            if (inputItem.objectMode === 'string') {
                return `String(\`${inputItem.value ?? ''}\`)`;
            } else if (inputItem.objectMode === 'expression') {
                return `${inputItem.value ?? ''}`;
            } else if (inputItem.objectMode === 'stringRaw') {
                inputItem.value = inputItem.value || '';
                return JSON.stringify(inputItem.value);
            }
        }
        // 保留旧的 enableExpression 配置，兼容旧版本
        if (!inputItem.enableExpression) {
            return `String(\`${inputItem.value ?? ''}\`)`;
        }
        return `${inputItem.value ?? ''}`;
    }
    return '';
}
