

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



export const fileDownloader = async (url: string, savePath: string) => {
    try {
        // const response = await fetch(url);
        // if (!response.ok) {
        //     throw new Error(`网络请求失败，状态码: ${response.status}`);
        // }
        // const arrayBuffer = await response.arrayBuffer();
        // await Neutralino.filesystem.writeBinaryFile(savePath, arrayBuffer);
        // console.log('文件下载成功，保存至:', savePath);

        let command = '';
        if (NL_OS === 'Linux' || NL_OS === 'Darwin') {
            command = `curl -sL --max-time 60 "${url}" -o "${savePath}"`;
        } else if (NL_OS === 'Windows') {
            command = `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${savePath}' -UseBasicParsing"`;
        }
        const output = await Neutralino.os.execCommand(command);
        if (output.exitCode !== 0) {
            throw new Error(`系统命令执行失败: ${output.stdErr}`);
        }
        console.log('通过原生命令下载成功，保存至:', savePath);
        return true
    } catch (error) {
        console.error('下载文件失败:', error);
        throw error;
    }
}