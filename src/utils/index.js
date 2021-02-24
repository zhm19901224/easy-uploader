const fs = require('fs')
const path = require('path')
const promisify = require('util').promisify;
const crypto = require('crypto');
const url = require('url');
// 将最后一个参数是callback的api转换成promise对象，同时满足错误优先原则
const betterPromisify = (fn) => {
    return function(...args) {
        return new Promise((resolve, reject) => {
            promisify(fn)(...args)
            .then((res) => {
                resolve([null, res])
            })
            .catch((err) => {
                resolve([err])
            })
        })
    }
}

// 为Buffer添加拆分的方法
Buffer.prototype.split = function (boundary){
    let arr = [];
    let cur = 0;
    let n = 0;
    while((n = this.indexOf(boundary,cur)) != -1){
      arr.push(this.slice(cur,n));
      cur= n + boundary.length
    }
    arr.push(this.slice(cur))
    return arr
}

// 将formdata里面全部的name对应关系，转换成字典
const formDataBufferParser = (req, buffer) => {
    let res = {};
    let str = req.headers['content-type'].split('; ')[1]
    let boundary = '--'+str.split('=')[1]
    let bufferArr = buffer.split(boundary)
    bufferArr.shift()
    bufferArr.pop()
    bufferArr = bufferArr.map(buffer => buffer.slice(2, buffer.length - 2))
    // formData append几项目 就有继承成员
    bufferArr.forEach((buffer, index) =>{
    // 判断是不是文件数据
        let n = buffer.indexOf('\r\n\r\n');
        let disposition = buffer.slice(0,n).toString();
        let content = buffer.slice(n + 4)
        if(disposition.indexOf('\r\n') !== -1) {
            // 当前 buffer存储的是文件
            let [line1, line2] = disposition.split('\r\n'); // line1 Content-Disposition: form-data; name="file"; filename="0"
            let [, name, filename] = line1.split('; ');
            name = name.split('=')[1]
            name = name.slice(1, name.length - 1);
            filename = filename.split('=')[1]
            filename = filename.slice(1,filename.length-1);
            let mime = line2.split(': ')[1]
            res[name] = {
                filename,
                mime,
                file: content
            }
        } else {
            // 当前buffer存储的是文本信息
            let [line1] = disposition.split('\r\n');
            let [, name] = line1.split('; ');    // name="aaa"
            name = name.split('=')[1]
            // 去掉引号
            name = name.slice(1, name.length - 1) 
            res[name] = content
        }
    })

    return res
}

// 将多个chunk文件，合并到目标文件中去
const mergeFiles = (filePaths, targetFilePath) => {
    return new Promise((resolve, reject) => {
        let writeStream = fs.createWriteStream(targetFilePath)
        writeStream.on('finish', () => {
            console.log('mergeFinish')
            resolve([null, 'ok'])
        })

        function merge(paths){
            if (!paths.length) {
                return writeStream.end();
            }
            let readPath = filePaths.shift()
            let readStream = fs.createReadStream(readPath)
            readStream.on('end', () => {
                merge(paths)

            })
            readStream.on('error', (err) => {
                resolve([err])
                writeStream.close();
            });
            readStream.pipe(writeStream, { end: false })
        }

        merge(filePaths)
    })
}

const veriryIntegrity = (filePath, contentHash) => {
    return new Promise((resolve, reject) => {
        let readStream = fs.createReadStream(filePath)
        let hash = crypto.createHash('md5')
    
        readStream.on('data', hash.update.bind(hash))
    
        readStream.on('end', () => {
            let hex = hash.digest('hex') 
            console.log('diff', filePath, hex, contentHash)
            if (hex === contentHash) {
                resolve(true)
            } else {
                resolve(false)
            }
        })
    })
}

// 清空临时目录下的临时文件
const cleanTemp = (fileFullname) => {
    let unlinkPath = path.resolve(__dirname, `../temp/${fileFullname}`)
    let timpFilePaths = fs.readdirSync(unlinkPath)
    timpFilePaths.forEach((filename) => {
        fs.unlinkSync(path.resolve(unlinkPath, filename))
    })
}

// 判断文件是否存在
const isFileExisted = (path) => {
    return new Promise(function(resolve, reject) {
        fs.access(path, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        })
    })
}

// 判断文件夹是否存在
const isFolderExisted = (path) => {
    return new Promise(function(resolve, reject) {
        fs.stat(path, (err, stats) => {
            if (stats && stats.isDirectory()) {
                resolve(true)
            } else {
                resolve(false)
            }
        });
    })
}
// var stat = fs.statSync(path.join(__dirname,'content'));
// l(stat.isDirectory())
const getGetMethodParams = (req) => {
    let param = {}
    const paramArr = url.parse(req.url).query.split('&');
    paramArr.forEach(item => {
        let [key, value] = item.split('=')
        param[key] = value
    })
    return param
}

module.exports = {
    betterPromisify,
    mergeFiles,
    formDataBufferParser,
    veriryIntegrity,
    cleanTemp,
    getGetMethodParams,
    isFileExisted,
    isFolderExisted
}