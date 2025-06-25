function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // 정적 파일들은 그대로 통과
    if (uri.includes('.')) {
        return request;
    }
    
    // 루트 경로는 index.html로
    if (uri === '/') {
        request.uri = '/index.html';
        return request;
    }
    
    // 다른 경로들은 해당하는 HTML 파일로 변환
    // /canary-deploy -> /canary-deploy.html
    // /dark-release -> /dark-release.html
    if (uri.startsWith('/')) {
        var path = uri.substring(1); // 첫 번째 '/' 제거
        
        // 쿼리 파라미터가 있는 경우 제거
        if (path.includes('?')) {
            path = path.split('?')[0];
        }
        
        // 경로 끝의 슬래시 제거
        if (path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        // HTML 파일로 변환
        if (path) {
            request.uri = '/' + path + '.html';
        } else {
            request.uri = '/index.html';
        }
    }
    
    return request;
} 