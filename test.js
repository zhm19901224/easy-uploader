

// 模拟请求
function request(url){
    return new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            resolve(url)
        }, 2000)
    })
}

function requestUnderMax(urls , requestFn, max) {
    return new Promise((resolve, reject) => {
        let i = 0;          // 一个i对应一个fulfilled结果, 让最终结果是有序的
        let isRejected = false
        let queue = [];     // 只能放num个promise成员
        let resArr = Array(urls.length);     // 存放fulfilled结果，有顺序的
        let error = false;
        function loop(urls) {
            // 一旦error是true，说明前面某个promise rejecte了。
            if (error) return;
            // 递归边界条件，urls处理完了，length === 0
            if (urls.length === 0 ) {
                Promise.all(queue).then(() => {
                    resolve(resArr);
                })
                return
            }
            if (queue.length < max && !error) {
                let p = requestFn(urls.shift())
                .then(res => {
                    // 1. 根据索引，记录结果
                    // 2. 如果urls还有没处理的，那么让当前promise从queue中出栈;
                    resArr[p.index] = res;
                    if (urls.length > 0) {
                        queue.splice(queue.indexOf(p), 1)
                        loop(urls)
                    }
                })
                .catch((err) => {
                    error = true
                    reject(err)
                })
                p.index = i;
                // 每次将promise添加到队列之后，就自增，带遍处理下一个
                i++;
                queue.push(p)
                return loop(urls)
            }
            return
        }
        loop([...urls]);
    })
}

let urls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
requestUnderMax(urls, request, 8).then((res) => {
    // 期望结果顺序一直， res [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    console.log('res', res)
})