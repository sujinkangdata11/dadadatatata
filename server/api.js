const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001; // 기존 5177과 다른 포트

// 미들웨어
app.use(cors());
app.use(express.json());

// 기본 라우트
app.get('/', (req, res) => {
    res.json({
        message: 'VidHunt API Server',
        version: '1.0.0',
        status: 'running'
    });
});

// 채널 데이터 API (추후 구현)
app.get('/api/channels', (req, res) => {
    res.json({
        message: 'Channel data endpoint - coming soon',
        totalChannels: 0,
        channels: []
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 VidHunt API Server running on http://localhost:${PORT}`);
    console.log(`📊 API Endpoints:`);
    console.log(`   GET /              - Server info`);
    console.log(`   GET /api/channels  - Channel data`);
});