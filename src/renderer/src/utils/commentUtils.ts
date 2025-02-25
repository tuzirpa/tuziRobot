import type { DirectiveData } from '../pages/flowHome/components/types';

export function computeComment(block: DirectiveData) {
    if (!block.comment) return block.name;
    
    const context = {};
    for (const key in block.inputs) {
        context[key] = block.inputs[key].display || block.inputs[key].value;
    }
    for (const key in block.outputs) {
        context[key] = block.outputs[key].name;
    }
    
    return block.comment.replace(/\${.*?}/g, (substring: string) => {
        let varsCode = '';
        for (const key in context) {
            varsCode += `let ${key} = context['${key}'] || '';\n`;
        }
        const code = `(function(){${varsCode} \n return \`${substring}\`}())`;
        try {
            const val = eval(code);
            if (val) {
                const isGlobal = val.toString().startsWith('_GLOBAL_');
                const displayVal = isGlobal ? `🌐 ${val}` : val;
                return `<span class="variable${isGlobal ? ' global' : ''}">${displayVal}</span>`;
            }
        } catch (error) {
            console.error('计算变量预览失败:', error);
        }
        return '';
    });
} 