import type { DirectiveTree } from 'src/main/userApp/types';
import type UserApp from 'src/main/userApp/UserApp';

export type MainUserApp = UserApp;

// 添加逻辑
export type DirectiveData = DirectiveTree & {
    foldDesc?: string;
    pdLvn: number;
    commentShow?: string;
    error?: string;
    errorLevel?: string;
};

export type OpenFile = {
    name: string;
    aliasName: string;
    filePath: string;
    edit?: boolean;
    historys: { saveName: string; data: any[] }[];
    curHistoryIndex: number;
    blocks: DirectiveData[];
};
