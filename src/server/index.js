const http = require('http')
const router = require('../router/index')

const server = http.createServer((req, res) => {
    router(req.url, req, res)
})

server.listen(8080, '127.0.0.1', () => {
    console.info('server is listening on 8080')
})