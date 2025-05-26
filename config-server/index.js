const express = require('express');
const bodyParser = require('body-parser');
const fsPromises = require('fs').promises;
const fs = require('fs');
const path = require('path');
const { exec, fork, spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const net = require('net');
const axios = require('axios');
const AdmZip = require('adm-zip');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const DEFAULT_PORT = 3000;

// 文件路径
const CONFIG_FILE = path.join(__dirname, '../app', 'tuziAppData.json');
const APP_INFO_FILE = path.join(__dirname, '../app', 'package.json');
const START_BAT = path.join(__dirname, '../run_app.bat');
const UPDATE_CONFIG_FILE = path.join(__dirname, 'updateConfig.json');
const TEMP_DIR = path.join(__dirname, '../temp');
const nodeDir = path.join(__dirname, '../node', 'node.exe');
const STARTINDEXJS = path.join(__dirname, '../app', 'main.js');

// 程序运行状态跟踪
let currentProcess = null;
let isRunning = false;

// WebSocket 连接管理
let connections = new Set();

wss.on('connection', (ws) => {
    connections.add(ws);
    ws.on('close', () => {
        connections.delete(ws);
    });
});

// 广播日志给所有连接的客户端
function broadcastLog(type, message) {
    const logMessage = JSON.stringify({
        type,
        message,
        timestamp: new Date().toISOString()
    });
    
    connections.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(logMessage);
        }
    });
}

// 设置模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public/static')));

// 检查端口是否可用
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', () => {
            resolve(false);
        });
        
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        
        server.listen(port);
    });
}

// 查找可用端口
async function findAvailablePort(startPort) {
    let port = startPort;
    while (!(await isPortAvailable(port))) {
        console.log(`端口 ${port} 已被占用，尝试下一个端口...`);
        port++;
    }
    return port;
}

// 读取应用信息
async function readAppInfo() {
    try {
        const data = await fsPromises.readFile(APP_INFO_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取应用信息失败：', error.message);
        return {
            name: '未知应用',
            version: '0.0.0',
            description: '无描述'
        };
    }
}

// 确保配置目录存在
async function ensureConfigDir() {
    const configDir = path.dirname(CONFIG_FILE);
    try {
        await fsPromises.access(configDir);
        console.log('配置目录存在：', configDir);
        broadcastLog('info', '配置目录存在：' + configDir);
    } catch {
        console.log('创建配置目录：', configDir);
        broadcastLog('info', '创建配置目录：' + configDir);
        await fsPromises.mkdir(configDir, { recursive: true });
    }
}

// 读取配置文件
async function readConfig() {
    try {
        console.log('正在读取配置文件：', CONFIG_FILE);
        broadcastLog('info', '正在读取配置文件：' + CONFIG_FILE);
        const data = await fsPromises.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        console.log('成功读取配置文件');
        broadcastLog('success', '成功读取配置文件');
        return config;
    } catch (error) {
        console.error('读取配置文件失败：', error.message);
        broadcastLog('error', '读取配置文件失败：' + error.message);
        return {
            globalVariables: [],
            elementLibrarys: []
        };
    }
}

// 保存配置文件
async function saveConfig(config) {
    try {
        await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log('配置文件保存成功');
        broadcastLog('success', '配置文件保存成功');
    } catch (error) {
        console.error('保存配置文件失败：', error.message);
        broadcastLog('error', '保存配置文件失败：' + error.message);
        throw error;
    }
}

// 检查文件是否存在
async function checkFile(filePath) {
    try {
        await fsPromises.access(filePath);
        const stats = await fsPromises.stat(filePath);
        return {
            exists: true,
            isFile: stats.isFile(),
            size: stats.size,
            permissions: stats.mode
        };
    } catch (error) {
        return {
            exists: false,
            error: error.message
        };
    }
}

// 执行 start.bat
async function runStartBat() {
    if (isRunning) {
        throw new Error('程序已在运行中');
    }

    // 首先检查文件是否存在
    // const fileStatus = await checkFile(START_BAT);
    // console.log('start.bat 文件状态：', fileStatus);
    // broadcastLog('info', 'start.bat 文件状态：' + JSON.stringify(fileStatus));
    
    // if (!fileStatus.exists) {
    //     const error = `找不到文件：${START_BAT}`;
    //     broadcastLog('error', error);
    //     throw new Error(error);
    // }
    
    // if (!fileStatus.isFile) {
    //     const error = `${START_BAT} 不是一个有效的文件`;
    //     broadcastLog('error', error);
    //     throw new Error(error);
    // }
    //判断node是否存在
    const nodeExists = fs.existsSync(nodeDir);
    let nodeExeFile = 'node'
    if(nodeExists){
        nodeExeFile = nodeDir;
    }

    return new Promise((resolve, reject) => {
        console.log('开始执行：', `${nodeExeFile} ${STARTINDEXJS}`);
        broadcastLog('info', '执行文件：' + `${nodeExeFile} ${STARTINDEXJS}`);

        currentProcess = spawn(nodeExeFile, [STARTINDEXJS]);
        
        isRunning = true;
        broadcastLog('success', '程序已启动运行');
    

        currentProcess.stdout.on('data', (data) => {
            const outData = data.toString();
            console.log('输出：', outData);
            broadcastLog('output', outData);
        });

        currentProcess.stderr.on('data', (data) => {
            const errData = data.toString();
            console.error('错误：', errData);
            broadcastLog('error', errData);
        });

        currentProcess.on('close', (code) => {
            console.log('进程退出码：', code);
            broadcastLog('info', '进程退出码：' + code);
            isRunning = false;
            currentProcess = null;
        });

        currentProcess.on('error', (error) => {
            console.error('进程错误：', error);
            broadcastLog('error', '进程错误：' + error.message);
            isRunning = false;
            currentProcess = null;
            reject(error);
        });
        resolve();
    });
}

// 停止程序
async function stopProgram() {
    if (!isRunning || !currentProcess) {
        throw new Error('程序未在运行');
    }
    
    return new Promise((resolve, reject) => {
        try {
            currentProcess.kill();
            isRunning = false;
            currentProcess = null;
            resolve();
        } catch (error) {
            console.error('停止程序时发生错误：', error);
            broadcastLog('error', '停止程序时发生错误：' + error.message);
            reject(error);
        }
    });
}

// 路由
app.get('/', async (req, res) => {
    try {
        const [config, appInfo] = await Promise.all([
            readConfig(),
            readAppInfo()
        ]);
        console.log('配置数据：', JSON.stringify(config, null, 2));
        res.render('index', { config, appInfo });
    } catch (error) {
        console.error('渲染页面失败：', error.message);
        broadcastLog('error', '渲染页面失败：' + error.message);
        res.status(500).send('服务器错误：' + error.message);
    }
});

app.post('/save', async (req, res) => {
    try {
        const config = req.body;
        await saveConfig(config);
        res.json({ success: true });
    } catch (error) {
        console.error('保存配置失败：', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 添加运行 start.bat 的路由
app.post('/run', async (req, res) => {
    try {
        await runStartBat();
        res.json({ success: true, message: '程序已启动' });
    } catch (error) {
        const errorMessage = error.message || '未知错误';
        console.error('启动失败：', errorMessage);
        res.status(500).json({ error: errorMessage });
    }
});

// 添加获取程序状态的路由
app.get('/status', (req, res) => {
    res.json({ 
        isRunning,
        pid: currentProcess ? currentProcess.pid : null
    });
});

// 添加停止程序的路由
app.post('/stop', async (req, res) => {
    try {
        await stopProgram();
        res.json({ success: true, message: '程序已停止' });
    } catch (error) {
        const errorMessage = error.message || '未知错误';
        console.error('停止失败：', errorMessage);
        res.status(500).json({ error: errorMessage });
    }
});

// 读取更新配置
async function readUpdateConfig() {
    try {
        const exists = await fsPromises.access(UPDATE_CONFIG_FILE)
            .then(() => true)
            .catch(() => false);
        
        if (!exists) {
            return { 
                updateServerUrl: '',
                overwriteConfig: false // 默认不覆盖配置文件
            };
        }
        
        const data = await fsPromises.readFile(UPDATE_CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        // 确保有 overwriteConfig 字段
        return {
            ...config,
            overwriteConfig: config.overwriteConfig || false
        };
    } catch (error) {
        console.error('读取更新配置失败：', error.message);
        return { 
            updateServerUrl: '',
            overwriteConfig: false
        };
    }
}

// 保存更新配置
async function saveUpdateConfig(config) {
    try {
        await fsPromises.writeFile(UPDATE_CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log('更新配置保存成功');
        broadcastLog('success', '更新配置保存成功');
    } catch (error) {
        console.error('保存更新配置失败：', error.message);
        broadcastLog('error', '保存更新配置失败：' + error.message);
        throw error;
    }
}

// 检查更新
async function checkUpdate() {
    const config = await readUpdateConfig();
    if (!config.updateServerUrl) {
        throw new Error('未配置更新服务器地址');
    }

    try {
        const versionUrl =  `${config.updateServerUrl}/version.json?t=${Date.now()}`;
        console.log('版本号地址：', versionUrl);
        const response = await axios.get(versionUrl);
        const versionInfo = response.data;
        
        // 读取当前版本
        const appInfo = await readAppInfo();
        const currentVersion = appInfo.version;
        
        // 比较版本号
        const hasUpdate = compareVersions(versionInfo.version, currentVersion) > 0;
        
        return {
            success: true,
            hasUpdate,
            ...versionInfo
        };
    } catch (error) {
        console.error('检查更新失败：', error.message);
        throw error;
    }
}
// 版本号比较函数
function compareVersions(v1, v2) {
    // 处理版本号格式如 1.0.3.001 和 1.0.3
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    // 确保两个版本号数组长度一致，不足的补0
    const maxLength = Math.max(parts1.length, parts2.length);
    while (parts1.length < maxLength) parts1.push(0);
    while (parts2.length < maxLength) parts2.push(0);
    
    // 逐位比较版本号
    for (let i = 0; i < maxLength; i++) {
        if (parts1[i] > parts2[i]) return 1;
        if (parts1[i] < parts2[i]) return -1;
    }
    
    return 0;
}

// 执行更新
async function performUpdate(updateInfo) {
    try {
        // 创建临时目录
        await fsPromises.mkdir(TEMP_DIR, { recursive: true });
        
        // 下载更新文件
        console.log('开始下载更新文件...');
        broadcastLog('info', '开始下载更新文件...');
        
        const zipPath = path.join(TEMP_DIR, 'update.zip');

        // 获取更新配置
        const updateConfig = await readUpdateConfig();

        const updateUrl = updateInfo.file.startsWith('http') ? updateInfo.file : `${updateConfig.updateServerUrl}/${updateInfo.file}?t=${Date.now()}`;
        console.log('更新文件地址：', updateUrl);
        const response = await axios({
            method: 'get',
            url: updateUrl,
            responseType: 'stream'
        });
        
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        console.log('更新文件下载完成');
        broadcastLog('success', '更新文件下载完成');
        
        // 解压更新文件
        console.log('开始解压更新文件...');
        broadcastLog('info', '开始解压更新文件...');
        
        const zip = new AdmZip(zipPath);
        const targetDir = path.join(__dirname, '..', updateInfo.updateModule);

   
        
        // 解压前，如果不覆盖配置文件，先备份现有的配置文件
        const configFiles = ['tuziAppData.json']; // 可以添加更多配置文件
        const backupFiles = new Map();

        if (!updateConfig.overwriteConfig) {
            for (const configFile of configFiles) {
                const configPath = path.join(targetDir, configFile);
                try {
                    if (fs.existsSync(configPath)) {
                        const content = await fsPromises.readFile(configPath);
                        backupFiles.set(configFile, content);
                        console.log(`备份配置文件: ${configFile}`);
                        broadcastLog('info', `备份配置文件: ${configFile}`);
                    }
                } catch (error) {
                    console.error(`备份配置文件失败: ${configFile}`, error);
                    broadcastLog('error', `备份配置文件失败: ${configFile}`);
                }
            }
        }

        // 解压所有文件
        zip.extractAllTo(targetDir, true);
        
        // 如果不覆盖配置文件，还原之前的配置
        if (!updateConfig.overwriteConfig) {
            for (const [configFile, content] of backupFiles) {
                const configPath = path.join(targetDir, configFile);
                try {
                    await fsPromises.writeFile(configPath, content);
                    console.log(`还原配置文件: ${configFile}`);
                    broadcastLog('success', `还原配置文件: ${configFile}`);
                } catch (error) {
                    console.error(`还原配置文件失败: ${configFile}`, error);
                    broadcastLog('error', `还原配置文件失败: ${configFile}`);
                }
            }
        }
        
        console.log('更新文件解压完成');
        broadcastLog('success', '更新文件解压完成');
        
        // 清理临时文件
        await fsPromises.unlink(zipPath);
        
        return { success: true };
    } catch (error) {
        console.error('执行更新失败：', error.message);
        broadcastLog('error', '执行更新失败：' + error.message);
        throw error;
    }
}

// 添加更新相关的路由
app.get('/getUpdateConfig', async (req, res) => {
    try {
        const config = await readUpdateConfig();
        res.json({ success: true, ...config });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/saveUpdateConfig', async (req, res) => {
    try {
        await saveUpdateConfig(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/checkUpdate', async (req, res) => {
    try {
        const result = await checkUpdate();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/startUpdate', async (req, res) => {
    try {
        if (isRunning) {
            throw new Error('请先停止程序再进行更新');
        }
        
        const result = await performUpdate(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/appInfo', async (req, res) => {
    try {
        const appInfo = await readAppInfo();
        res.json({ success: true, data: appInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 启动服务器
async function start() {
    try {
        await ensureConfigDir();
        const port = await findAvailablePort(DEFAULT_PORT);
        
        server.listen(port, () => {
            console.log(`配置服务器运行在 http://localhost:${port}`);
            broadcastLog('info', `配置服务器运行在 http://localhost:${port}`);
        });
        
        // 在浏览器中打开
        exec(`start http://localhost:${port}`);

    } catch (error) {
        console.error('服务器启动失败：', error.message);
        broadcastLog('error', '服务器启动失败：' + error.message);
    }
}

start(); 