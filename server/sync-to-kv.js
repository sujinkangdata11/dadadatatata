// Google Drive → KV Storage 데이터 동기화 스크립트
// 사용법: node sync-to-kv.js YOUR_FOLDER_ID YOUR_ACCESS_TOKEN

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Google Drive에서 폴더 내 파일 목록 조회
async function getDriveFiles(folderId, accessToken) {
  const response = await fetch(`${DRIVE_API_BASE}/files?q=parents='${folderId}' and trashed=false&fields=files(id,name)`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Drive API error: ${response.status}`);
  }
  
  return response.json();
}

// Google Drive에서 파일 내용 읽기
async function getDriveFileContent(fileId, accessToken) {
  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Drive file read error: ${response.status}`);
  }
  
  return response.text();
}

async function syncDataToKV() {
  const [folderId, accessToken] = process.argv.slice(2);
  
  if (!folderId || !accessToken) {
    console.log('사용법: node sync-to-kv.js YOUR_FOLDER_ID YOUR_ACCESS_TOKEN');
    process.exit(1);
  }

  try {
    console.log('🔍 Google Drive에서 데이터 수집 시작...');
    
    // 입력받은 폴더가 이미 channels 폴더이므로 직접 JSON 파일들 조회
    const channelFiles = await getDriveFiles(folderId, accessToken);
    const jsonFiles = channelFiles.files?.filter(f => f.name.endsWith('.json')) || [];
    
    console.log(`📁 발견된 채널 파일: ${jsonFiles.length}개`);
    
    const allChannels = [];
    let processedCount = 0;
    
    // 모든 파일 처리 (최대 1000개)
    const filesToProcess = jsonFiles.slice(0, 1000);
    
    for (const file of filesToProcess) {
      try {
        const content = await getDriveFileContent(file.id, accessToken);
        const channelData = JSON.parse(content);
        
        // 최신 스냅샷 데이터 추출
        const latestSnapshot = channelData.snapshots?.[channelData.snapshots.length - 1];
        if (latestSnapshot) {
          // 모든 데이터를 포함하는 완전한 채널 객체
          allChannels.push({
            // 기본 정보
            channelId: channelData.channelId,
            
            // Static Data (모든 필드 포함)
            staticData: channelData.staticData || {},
            
            // 최신 스냅샷 (모든 지표 포함) 
            latestSnapshot: latestSnapshot,
            
            // 메타데이터
            metadata: channelData.metadata || {},
            
            // 편의를 위한 주요 필드들 (호환성)
            title: channelData.staticData?.title || 'Unknown',
            subscriberCount: parseInt(latestSnapshot.subscriberCount) || 0,
            viewCount: parseInt(latestSnapshot.viewCount) || 0,
            videoCount: parseInt(latestSnapshot.videoCount) || 0,
            lastUpdated: latestSnapshot.timestamp || channelData.metadata?.lastUpdated,
            avgViews: latestSnapshot.gavg || 0,
            viralIndex: latestSnapshot.gvir || 0,
            subscriberPerDay: latestSnapshot.gspd || 0,
            publishedAt: channelData.staticData?.publishedAt
          });
        }
        
        processedCount++;
        if (processedCount % 50 === 0) {
          console.log(`📊 처리 진행률: ${processedCount}/${filesToProcess.length}`);
        }
      } catch (parseError) {
        console.error(`❌ 파일 파싱 오류 ${file.name}:`, parseError.message);
      }
    }

    // 구독자 수로 정렬
    allChannels.sort((a, b) => b.subscriberCount - a.subscriberCount);
    
    console.log(`✅ 총 ${allChannels.length}개 채널 데이터 처리 완료`);
    console.log(`📊 상위 채널: ${allChannels[0]?.title} (${allChannels[0]?.subscriberCount.toLocaleString()}명)`);
    
    // KV에 저장할 데이터 준비
    const kvData = {
      lastUpdated: new Date().toISOString(),
      totalChannels: allChannels.length,
      channels: allChannels
    };
    
    // JSON 파일로 출력 (KV 업로드 전 확인용)
    const fs = require('fs');
    fs.writeFileSync('kv-data.json', JSON.stringify(kvData, null, 2));
    console.log('💾 kv-data.json 파일로 저장 완료');
    console.log('📤 이제 다음 명령어로 KV에 업로드하세요:');
    console.log('wrangler kv key put "channel-data" --path kv-data.json');
    
  } catch (error) {
    console.error('❌ 동기화 오류:', error.message);
    process.exit(1);
  }
}

syncDataToKV();