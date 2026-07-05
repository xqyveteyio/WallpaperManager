

export const loadLocalImageUsingBlob = async (filePath: string) => {
    try {
        const arrayBuffer = await Neutralino.filesystem.readBinaryFile(filePath);
        const ext = filePath.split('.').pop()?.toLowerCase();
        const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const blob = new Blob([arrayBuffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        return blobUrl
    } catch (err) {
        console.error(err);
    }
}



const fileExists = async (path: string): Promise<boolean> => {
    try {
        await Neutralino.filesystem.getStats(path);
        return true;
    } catch {
        return false;
    }
}

export const fileDownloader = async (url: string, savePath: string) => {
    try {
        const fileName = url.split('/').pop()?.split('?')[0] || `${Date.now()}`;
        const fullPath = savePath.endsWith('/') || savePath.endsWith('\\')
            ? `${savePath}${fileName}`
            : `${savePath}/${fileName}`;

        if (await fileExists(fullPath)) {
            console.log('文件已存在，跳过下载:', fullPath);
            return fullPath;
        }

        let command = '';
        if (NL_OS === 'Linux' || NL_OS === 'Darwin') {
            command = `curl -sL --max-time 60 "${url}" -o "${fullPath}"`;
        } else if (NL_OS === 'Windows') {
            command = `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${fullPath}' -UseBasicParsing"`;
        }
        const output = await Neutralino.os.execCommand(command);
        if (output.exitCode !== 0) {
            throw new Error(`系统命令执行失败: ${output.stdErr}`);
        }
        console.log('通过原生命令下载成功，保存至:', fullPath);
        return fullPath;
    } catch (error) {
        console.error('下载文件失败:', error);
        throw error;
    }
}