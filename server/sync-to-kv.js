// Google Drive → KV Storage 데이터 동기화 스크립트
// 사용법: node sync-to-kv.js YOUR_FOLDER_ID YOUR_ACCESS_TOKEN

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Google Drive에서 폴더 내 모든 파일 목록 조회 (pagination 지원)
async function getDriveFiles(folderId, accessToken) {
  let allFiles = [];
  let nextPageToken = null;
  
  do {
    const params = new URLSearchParams({
      q: `parents='${folderId}' and trashed=false`,
      fields: 'files(id,name),nextPageToken',
      pageSize: '1000' // 최대 1000개씩
    });
    
    if (nextPageToken) {
      params.append('pageToken', nextPageToken);
    }
    
    const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Drive API error: ${response.status}`);
    }
    
    const data = await response.json();
    allFiles.push(...(data.files || []));
    nextPageToken = data.nextPageToken;
    
    if (nextPageToken) {
      console.log(`📄 페이지 완료, 현재 ${allFiles.length}개 파일 발견...`);
    }
    
  } while (nextPageToken);
  
  return { files: allFiles };
}

// Google Drive에서 파일 내용 읽기 (재시도 + 타임아웃 지원)
async function getDriveFileContent(fileId, accessToken, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃
      
      const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Drive file read error: ${response.status}`);
      }
      
      return await response.text();
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`⚠️ 파일 읽기 재시도 ${attempt}/${maxRetries}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 백오프
    }
  }
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
    
    // 모든 JSON 파일 처리
    const filesToProcess = jsonFiles;
    
    for (const file of filesToProcess) {
      try {
        const content = await getDriveFileContent(file.id, accessToken);
        const channelData = JSON.parse(content);
        
        // 원본 JSON 데이터 그대로 저장 (변형 없이)
        if (channelData.channelId) {
          allChannels.push(channelData);
        }
        
        processedCount++;
        if (processedCount % 50 === 0) {
          console.log(`📊 처리 진행률: ${processedCount}/${filesToProcess.length}`);
        }
      } catch (parseError) {
        console.error(`❌ 파일 파싱 오류 ${file.name}:`, parseError.message);
      }
    }

    // 원본 순서 그대로 유지 (정렬하지 않음)
    
    console.log(`✅ 총 ${allChannels.length}개 채널 데이터 처리 완료`);
    console.log(`📊 처리된 채널: ${allChannels.length}개 (원본 JSON 구조 유지)`);
    
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