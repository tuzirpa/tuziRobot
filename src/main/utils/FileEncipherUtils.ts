import crypto from 'crypto';
import fs from 'fs';

const iv = Buffer.from('1234567890123456'.slice(0, 16), 'utf-8'); // 使用前 16 个字符
const algorithm = 'aes-256-cbc';

/**
 * 加密文件
 * @param filePath 需要加密的文件路径
 * @param outputPath 加密后的文件路径
 * @param password 加密密码
 */
export async function fileEncipher(filePath: string, outputPath: string, password: string) {
    const key = crypto.createHash('sha256').update(password).digest();
    //@ts-ignore
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    fs.createReadStream(filePath).pipe(cipher).pipe(fs.createWriteStream(outputPath));
}

/**
 * 解密文件
 * @param filePath 需要解密的文件路径
 * @param password 解密密码
 * @param outputPath 解密后的文件路径
 */
export function fileDecipher(filePath: string, outputPath: string, password: string) {
    return new Promise((resolve, reject) => {
        const key = crypto.createHash('sha256').update(password).digest();
        //@ts-ignore
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        const output = fs.createWriteStream(outputPath);
        fs.createReadStream(filePath).pipe(decipher).pipe(output);
        output.on('finish', () => {
            console.log('Deciphered file saved to', outputPath);
            resolve('');
        });
        output.on('error', (err) => {
            reject(err);
        });
    });
}
