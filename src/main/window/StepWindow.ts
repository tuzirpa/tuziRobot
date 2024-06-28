import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

export default class StepWindow extends BrowserWindow {
    constructor() {
        //获取屏幕尺寸 然后减去窗口大小 得到窗口的位置
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const x = width - 400;
        const y = height - 300;

        super({
            width: 400,
            height: 300,
            autoHideMenuBar: import.meta.env.DEV ? false : true,
            webPreferences: {
                preload: join(__dirname, '../preload/index.js'),
                sandbox: false,
                contextIsolation: false
            },
            x,
            y
        });
        const url = import.meta.env.DEV ? process.env['ELECTRON_RENDERER_URL'] : 'assets://app';
        this.loadURL(url + '/steptip.html');
        this.setAlwaysOnTop(true, 'floating');
    }
}