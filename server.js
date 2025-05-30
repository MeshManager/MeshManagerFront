const express = require('express');
const path = require('path');
const app = express();

// CORS 설정 추가
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// 정적 파일 제공
app.use(express.static(__dirname));

// 모든 요청을 index.html로 리다이렉션
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 포트 3000에서 서버 실행
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 