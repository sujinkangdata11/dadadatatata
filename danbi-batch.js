// Danbi CSV 배치 처리 스크립트
// 사용법: node danbi-batch.js

const fs = require('fs');

// 설정
const CSV_FILE = 'danbi_channels.csv';
const PROGRESS_FILE = 'danbi_complete.json';

async function loadProgress() {
    try {
        const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.log('📄 새로운 진행 파일을 생성합니다.');
        return { complete: 0, total: 0, lastUpdated: null, comments: '0까지 완료되었음. 1부터 시작' };
    }
}

async function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`💾 진행상황 저장: ${progress.complete}/${progress.total} (${Math.round(progress.complete/progress.total*100)}%)`);
}

async function loadCSV() {
    const csvData = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = csvData.trim().split('\n');
    const channels = lines.slice(1).map(line => {
        const [channel_name, profile_url, source_url] = line.split(',');
        // URL에서 채널 ID 추출
        const urlParts = profile_url.split('/');
        const channelId = urlParts[urlParts.length - 1];
        return { channel_name, profile_url, source_url, channelId };
    });
    
    console.log(`📂 CSV 로드 완료: ${channels.length}개 채널`);
    return channels;
}

async function processDanbiChannels() {
    console.log('🚀 Danbi CSV 배치 처리 시작!');
    console.log('=' .repeat(50));
    
    try {
        // 1. CSV 및 진행상황 로드
        const channels = await loadCSV();
        let progress = await loadProgress();
        progress.total = channels.length;
        
        console.log(`📊 전체: ${progress.total}개, 완료: ${progress.complete}개`);
        console.log(`▶️  ${progress.complete + 1}번부터 시작합니다.`);
        console.log('');
        console.log('⚠️  아직 기존 함수 연결이 필요합니다.');
        console.log('💡 fetchSelectedChannelData와 updateOrCreateChannelFile 함수를 import해야 합니다.');
        
        // TODO: 기존 함수들 import하고 실제 처리 로직 구현
        
        // 2. 진행상황부터 시작
        for (let i = progress.complete; i < Math.min(channels.length, progress.complete + 3); i++) { // 테스트용으로 3개만
            const channel = channels[i];
            const channelNumber = i + 1;
            
            try {
                console.log(`[${channelNumber}/${channels.length}] 처리 중: ${channel.channel_name} (${channel.channelId})`);
                
                // TODO: 여기에 기존 함수 호출
                // const channelData = await fetchSelectedChannelData(channel.channelId, apiKey, fields);
                // await updateOrCreateChannelFile(channelData, folderId);
                
                console.log(`✅ [${channelNumber}] ${channel.channel_name} 완료 (임시)`);
                
            } catch (error) {
                console.log(`❌ [${channelNumber}] ${channel.channel_name} 실패: ${error.message}`);
            }
            
            // 진행상황 업데이트
            progress.complete = channelNumber;
            progress.lastUpdated = new Date().toISOString();
            progress.comments = `${channelNumber}도중 중단 혹은 ${channelNumber}까지 완료되었음. ${channelNumber + 1}부터 시작`;
            
            await saveProgress(progress);
            
            // API 호출 간격 조절
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('');
        console.log('🎉 배치 처리 완료! (테스트 모드)');
        
    } catch (error) {
        console.error('❌ 배치 처리 오류:', error.message);
        process.exit(1);
    }
}

// 메인 실행
if (require.main === module) {
    console.log('📊 Danbi CSV 배치 처리 스크립트');
    console.log('');
    
    processDanbiChannels();
}

module.exports = { processDanbiChannels };