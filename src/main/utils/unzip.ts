import AdmZip from 'adm-zip';

const { zipFilePath, targetFolder, password } = {
    zipFilePath: process.argv[2],
    targetFolder: process.argv[3],
    password: process.argv[4]
};
function unzip(): void {
    // 创建一个新的 AdmZip 实例
    const zip = new AdmZip(zipFilePath);
    // 解压缩 ZIP 文件到指定目录
    zip.extractAllTo(targetFolder, /*overwrite*/ true, true, /*password*/ password ?? void 0);
}
unzip();

process.exit(0);
