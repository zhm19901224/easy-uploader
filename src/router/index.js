const { 
    uploaderController,
    multipleUploadHanlde,
    mergeRequest, 
    chunkUpload,
    getRequestStatusAction
} = require('../controller/index') 

module.exports = (url, req, res) => {
    if (url === '/multipleAsyncUploadPage') {
        uploaderController(req, res)
    }
    if (url === '/multiUpload') {
        multipleUploadHanlde(req, res)
    }
    if (url === '/mergeRequest') {
        mergeRequest(req, res)
    }
    if (url === '/chunkUpload') {
        chunkUpload(req, res)
    }

    if (url.indexOf('/getRequestStatus') !== -1) {
        
        getRequestStatusAction(req, res)
    }
}