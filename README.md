# easy-uploader
原生nodejs处理文件上传，涵盖多文件异步上传、拖拽上传、本地预览、大文件分片断点续传、秒传。各种各样上传都有了！

### 安装
```
npm install 
or
yarn
```

### 运行
```
npm run server
```
> 打开浏览器 http://127.0.0.1:8080/multipleAsyncUploadPage


### 核心文件目录

> src/server/index.js  ——————————————  服务的入口，将请求交给router处理      
> src/router/index.js  ——————————————  处理不同接口的路由，让路由被不同的controller方法处理
> src/controller/index.js ———————————  所有路由的控制器都在里面，处理上传逻辑的方法都在其中
> src/utils/index.js ————————————————  工具函数，封装很多处理上传文件的方法
> src/templates/index.html ——————————  页面，前端上传的业务逻辑都在里面
> src/temp ——————————————————————————  保存chunk分片的临时文件，第一次上传时，会在里面新建一个文件名命名的文件夹子
> src.files —————————————————————————  文件处理后最终保存的目录


### 设计思路解读

