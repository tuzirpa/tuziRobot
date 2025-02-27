import qiniu from 'qiniu';
import { createReadStream, statSync, ReadStream } from 'fs';
import { Request } from '../api/Request';
import path from 'path';

/**
 * 获取七牛云上传凭证
 */
export const getQiniuToken = async (keyToOverwrite: string = '') => {
    const res = await Request.post('/user/qiniuToken', { keyToOverwrite });
    return {
        token: res.data.token,
        fileUrl: res.data.fileUrl,
        key: res.data.key,
        fileName: res.data.fileUrl.split('/').pop()
    };
};

/**
 * 上传文件到七牛云
 */
export const uploadFileToQiniu = async (
    filePath: string,
    qiniuToken?: { token: string; key: string; fileUrl: string },
    onProgress?: (percent: number) => void
): Promise<string> => {
    let fileName: string | undefined;
    let { token, key, fileUrl }: { token: string; key: string; fileUrl: string } = qiniuToken || {
        token: '',
        key: '',
        fileUrl: ''
    };
    if (!qiniuToken) {
        fileName = path.basename(filePath);
        const res = await getQiniuToken(fileName);
        token = res.token;
        key = res.key;
        fileUrl = res.fileUrl;
    }
    const config = new qiniu.conf.Config();
    config.zone = qiniu.zone.Zone_z2;

    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();
    const filePathReadStream: ReadStream = createReadStream(filePath);
    if (onProgress) {
        const fileSize = statSync(filePath);
        let uploadedSize = 0;
        filePathReadStream.on('data', (chunk) => {
            uploadedSize += chunk.length;
            const percent = (uploadedSize / fileSize.size) * 100;
            onProgress(percent);
        });
    }

    return new Promise((resolve, reject) => {
        formUploader.putStream(
            token,
            key,
            filePathReadStream,
            putExtra,
            (respErr, respBody, respInfo) => {
                if (respErr) {
                    reject(respErr);
                } else {
                    if (respInfo.statusCode === 200) {
                        resolve(fileUrl);
                    } else {
                        reject(respBody);
                    }
                }
            }
        );
    });
};
