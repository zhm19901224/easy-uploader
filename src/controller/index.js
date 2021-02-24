const fs = require('fs')
const path = require('path')
const promisify = require('util').promisify;
const stream = require('stream');
const { 
    betterPromisify, 
    mergeFiles, 
    formDataBufferParser, 
    veriryIntegrity,
    cleanTemp,
    getGetMethodParams,
    isFileExisted,
    isFolderExisted
} = require('../utils/index')
const uploadFileHistory = {};
const fsReadDir = betterPromisify(fs.readdir)
const querystring = require('querystring');

/*
uploadedFilesInfo,记录已经上传过的文件的位置、内容hash，实现秒传
数组成员格式为
{
    filePath: String,
    contentHash: String
}
*/ 
const uploadedFilesInfo = [];
module.exports = {
    // 站点服务
    uploaderController(req, res) {
        let htmlPath = path.join(__dirname, '../templates/multipleAsyncUploadPage.html')
        res.setHeader('Content-Type', 'text/html')
        res.statusCode = 200;
        fs.createReadStream(htmlPath).pipe(res)
    },
    multipleUploadHanlde(req, res) {
        let chunks = [];
        let promises = []
        req.on('data', chunk => {
            chunks.push(chunk)
        })
        req.on('end', () => {
            // 处理多文件异步上传
            let buffer = Buffer.concat(chunks)
            let fileInfos = formDataBufferParser(req, buffer);
            // 多文件上传，name是文件索引
            let files = Object.keys(fileInfos).map((name, index) => (fileInfos[name]))
            files.forEach(({ filename, file }) => {
                const uploadPath = path.resolve(__dirname, '../temp/', filename)
                const writeStream = fs.createWriteStream(uploadPath)
                const bufferStream = new stream.PassThrough();
                bufferStream.end(file).pipe(writeStream)
            });

            // 如果配置了静态资源服务的解析，可以将资源路径返回
            res.end('okok')
        })
    },

    // 处理前端要求合并分片的请求
    mergeRequest(req, res) {
        let chunks = []
        req.on('data', chunk => chunks.push(chunk)) 
        req.on('end', async () => {
            let { contentHash, filename } = JSON.parse(chunks.toString());
            let tempPath = path.resolve(__dirname, `../temp/${filename}`)
            let [ err, chunkFiles ] = await fsReadDir(tempPath)
            if (err) throw(new Error(err))  // 实际应该抛500，发送告警，这里做简化
            // 获取到根据文件名索引排完序的文件
            let sortedFiles = chunkFiles.sort((a, b) => a - b);
            // 在files文件夹下创建以basename为名字的文件夹，并在里面创建一个合并完文件的可写流
            let targetFilePath = path.join(__dirname, '../files', filename)
            let mergeFilePaths = sortedFiles.map(chunkName => path.resolve(__dirname, `../temp/${filename}/`, chunkName))

            let [mErr] = await mergeFiles(mergeFilePaths, targetFilePath)
            if (mErr) throw(new Error(mErr))

            // 进行完整性校验
            let isFileEqual = await veriryIntegrity(targetFilePath, contentHash)
            if (isFileEqual) {
                uploadedFilesInfo.push({
                    filePath: targetFilePath,
                    contentHash
                });
                // 清空temp目录下的临时chunk，避免再次上传，都是索引命名文件，产生干扰，merge后的contentHash就不一样了
                // cleanTemp(filename);
                // 给前端正确的返回信息
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200;
                res.end('{ "code": "0", "message": "success", "fileUrl": "XXX" }')
            } else {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 405;
                res.end('{ "code": "405", "message": "文件不完整"}')
            }
        })
    },

    // 处理分片上传
    chunkUpload: async(req, res) => {
        let chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', async () => {
            let buffer = Buffer.concat(chunks)
            let fileDetail = formDataBufferParser(req, buffer)
            let { filename, file } = fileDetail['myfile'];
            let contentHash = fileDetail['contentHash'].toString();
            // 妙传，根据contentHash判断有没有上传过，如果有，直接把资源链接返回
            let findFile = uploadedFilesInfo.find(fileInfo => fileInfo.contentHash === contentHash)
            if (findFile) {
                console.log('already uploaded')
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200;
                res.end(`{ "code": "200001", "message": "已经上传过了，在服务器的内部地址是${findFile.filePath}"}`)
            } else {
                let fileFullname = fileDetail['fileFullname'].toString();
                let tempFilePath = path.resolve(__dirname, `../temp/${fileFullname}`)
                // 如果当前文件对应的临时文件夹不存在，就创建一个
                let isExist = await isFolderExisted(tempFilePath)
                if (!isExist) {
                    // 此处不能用同步，因为还没等文件夹创建完，下个请求就已经过来了
                    fs.mkdir(tempFilePath, () => {});
                }
 
                // 将chunk写入到对应的temp/<filename>/ 临时文件夹内
                fs.writeFileSync(path.join(tempFilePath, '/', filename), file )
                res.end()
            }
        })
    },

    getRequestStatusAction: async (req, res) => {
        // filename是转码过的，防止中文，所以要转回来
        let { contentHash, filename } = getGetMethodParams(req);
        // 秒传判断
        let findFile = uploadedFilesInfo.find(fileInfo => fileInfo.contentHash === contentHash);
        if (findFile) {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200;
            res.end(`{ "code": "200001", "message": "已经上传过了，在服务器的内部地址是${findFile.filePath}"}`)
            return;
        }
        
        /* 续传判断，temp/<文件名>/<0-X chunk文件>如果有文件，说明上次上传断掉了(上传完会清空temp/<文件名> 下所有chunk)
            需要在temp/<文件名>下查找，看看上一次最后上传到哪个分片，告诉前端应该从哪个index继续上传
        */
        let chunkPath = path.resolve(__dirname, `../temp/${decodeURIComponent(filename)}`)
        let tempPathIsExist = await isFolderExisted(chunkPath)
        if (!tempPathIsExist) {
            // 连临时文件夹都不存在，而且也不是曾经上传完成的，说明是第一次上传
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200;
            res.end(`{ "code": "200003", "message": "没上传过，老老实实从0切片吧"}`)
        } else {
            // 没有上传完， 可能是断网了，或者暂停了
            let chunkNames = fs.readdirSync(chunkPath)
            if (chunkNames && chunkNames.length > 0) {
                const [recievedLastChunkName, ...rest ] = chunkNames.sort((a, b) => b - a)
                const nextChunkIndex = Number(recievedLastChunkName)+1;
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200;
                res.end(`{ 
                    "code": "200002", 
                    "message": "之前没上传完，只上传到${recievedLastChunkName}分片，请从${nextChunkIndex}继续传",
                    "data": ${nextChunkIndex}
                }`)
            } else {
                // 上传过，但一个分片都没上传成功的情况
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200;
                res.end(`{ "code": "200003", "message": "没上传过，老老实实从0切片吧"}`)                
            }
        }
    }
}

