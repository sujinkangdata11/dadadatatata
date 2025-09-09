// OAuth 토큰 자동 수신 서버
const express = require('express');
const { spawn } = require('child_process');

const app = express();
const PORT = 8080;

// Google OAuth 설정
const CLIENT_ID = '159046785658-07hf5ani7blsafsav0vrl19db7pkamdp.apps.googleusercontent.com';
const REDIRECT_URI = 'http://localhost:8080/auth/callback';
const SCOPES = 'https://www.googleapis.com/auth/drive';

let accessToken = null;
let folderId = null;
let clientSecret = null;

// 메인 페이지 - OAuth 시작
app.get('/', (req, res) => {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(SCOPES)}&` +
    `access_type=offline`;

  res.send(`
    <html>
      <head><title>YouTube Channel Data Sync</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h1>🚀 YouTube 채널 데이터 동기화</h1>
        <p>Google Drive 데이터를 Cloudflare KV Storage에 동기화합니다</p>
        
        <div style="margin: 40px 0;">
          <label>Google Drive 폴더 ID:</label><br>
          <input type="text" id="folderId" placeholder="1abc..." style="width: 400px; padding: 10px; margin: 10px;">
          <br><br>
          <label>Client Secret:</label><br>
          <input type="password" id="clientSecret" placeholder="GOCSPX-..." style="width: 400px; padding: 10px; margin: 10px;">
          <br><br>
          <button onclick="startAuth()" style="padding: 15px 30px; font-size: 16px; background: #4285f4; color: white; border: none; border-radius: 5px;">
            🔐 Google 로그인 후 동기화 시작
          </button>
        </div>

        <script>
          function startAuth() {
            const folderIdInput = document.getElementById('folderId');
            const clientSecretInput = document.getElementById('clientSecret');
            
            if (!folderIdInput.value) {
              alert('Google Drive 폴더 ID를 입력해주세요');
              return;
            }
            
            if (!clientSecretInput.value) {
              alert('Client Secret을 입력해주세요');
              return;
            }
            
            // 폴더 ID와 Client Secret을 state로 전달 (보안상 좋지 않지만 테스트용)
            const data = JSON.stringify({
              folderId: folderIdInput.value,
              clientSecret: clientSecretInput.value
            });
            
            window.location.href = '${authUrl}&state=' + encodeURIComponent(btoa(data));
          }
        </script>
      </body>
    </html>
  `);
});

// OAuth 콜백 - 토큰 받고 동기화 실행
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code not found');
  }

  try {
    // state에서 폴더 ID와 Client Secret 파싱
    const decodedData = JSON.parse(atob(state));
    folderId = decodedData.folderId;
    clientSecret = decodedData.clientSecret;
    
    if (!folderId || !clientSecret) {
      return res.status(400).send('Missing folder ID or client secret');
    }
  } catch (parseError) {
    return res.status(400).send('Invalid state parameter');
  }

  try {
    console.log('🔍 DEBUG: 토큰 교환 시작');
    console.log('🔍 DEBUG: Authorization code:', code.substring(0, 20) + '...');
    console.log('🔍 DEBUG: Folder ID:', folderId);
    
    // 토큰 교환
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    console.log('🔍 DEBUG: Token response status:', tokenResponse.status);
    
    const tokenData = await tokenResponse.json();
    console.log('🔍 DEBUG: Token data:', tokenData);
    
    accessToken = tokenData.access_token;

    if (!accessToken) {
      console.log('❌ DEBUG: No access token in response');
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    }
    
    console.log('✅ DEBUG: Access token received:', accessToken.substring(0, 20) + '...');

    res.send(`
      <html>
        <head>
          <title>동기화 진행중...</title>
          <style>
            body { font-family: Arial; padding: 40px; text-align: center; background: #f5f5f5; }
            .spinner { 
              border: 4px solid #f3f3f3; 
              border-top: 4px solid #4285f4; 
              border-radius: 50%; 
              width: 40px; 
              height: 40px; 
              animation: spin 1s linear infinite; 
              margin: 20px auto; 
              display: inline-block;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            #status { 
              background: white; 
              padding: 20px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
              margin: 20px auto; 
              max-width: 600px;
              min-height: 60px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-direction: column;
            }
            .completed { background: #e8f5e8 !important; }
          </style>
        </head>
        <body>
          <h1>🔄 동기화 진행중...</h1>
          <p>Google Drive에서 데이터를 읽어와서 KV Storage에 저장하고 있습니다.</p>
          <div id="status">
            <div class="spinner" id="spinner"></div>
            <div id="statusText">⏳ 시작 중...</div>
          </div>
          <script>
            setInterval(() => {
              fetch('/status').then(r => r.text()).then(status => {
                const statusDiv = document.getElementById('status');
                const spinner = document.getElementById('spinner');
                const statusText = document.getElementById('statusText');
                
                statusText.innerHTML = status;
                
                // 완료 상태일 때 스피너 숨기고 스타일 변경
                if (status.includes('🎉 동기화 완료') || status.includes('❌')) {
                  spinner.style.display = 'none';
                  statusDiv.className = 'completed';
                  document.title = '동기화 완료!';
                } else {
                  spinner.style.display = 'inline-block';
                }
              });
            }, 1000);
          </script>
        </body>
      </html>
    `);

    // 백그라운드에서 동기화 실행
    runSync();

  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).send('Failed to get access token: ' + error.message);
  }
});

let syncStatus = '⏳ 시작 중...';
let totalChannels = 0;

// 동기화 실행
function runSync() {
  syncStatus = '📊 Google Drive 데이터 읽는 중...';
  
  const syncProcess = spawn('node', ['sync-to-kv.js', folderId, accessToken], {
    cwd: __dirname
  });

  syncProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    syncStatus = output;
    console.log('Sync:', syncStatus);
    
    // 채널 개수 추출
    const channelMatch = output.match(/총 (\d+)개 채널 데이터 처리 완료/);
    if (channelMatch) {
      totalChannels = parseInt(channelMatch[1]);
    }
  });

  syncProcess.stderr.on('data', (data) => {
    syncStatus = `❌ 오류: ${data.toString().trim()}`;
    console.error('Sync error:', data.toString());
  });

  syncProcess.on('close', (code) => {
    if (code === 0) {
      syncStatus = '✅ Google Drive 데이터 수집 완료! KV에 업로드 중...';
      
      // KV 업로드 실행
      const kvProcess = spawn('wrangler', [
        'kv', 'key', 'put', 'channel-data',
        '--binding', 'CHANNEL_DATA',
        '--path', 'kv-data.json',
        '--remote'
      ], {
        cwd: __dirname
      });

      kvProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log('KV Upload:', output);
        if (output.includes('Writing the contents')) {
          syncStatus = '📤 KV Storage에 데이터 업로드 중...';
        }
      });

      kvProcess.stderr.on('data', (data) => {
        console.error('KV Upload Error:', data.toString());
      });

      kvProcess.on('close', (kvCode) => {
        if (kvCode === 0) {
          syncStatus = `🎉 동기화 완료!<br>📊 <a href="https://vidhunt-api.evvi-aa-aa.workers.dev/api/channels?limit=${totalChannels}" target="_blank">API에서 데이터 확인하기</a><br>✅ 총 ${totalChannels.toLocaleString()}개 채널 데이터가 전 세계 엣지에서 빠르게 제공됩니다!`;
          console.log('✅ KV 업로드 성공!');
        } else {
          syncStatus = `❌ KV 업로드 실패 (코드: ${kvCode})`;
          console.error('❌ KV 업로드 실패, 코드:', kvCode);
        }
      });
    } else {
      syncStatus = `❌ 동기화 실패 (코드: ${code})`;
    }
  });
}

// 상태 확인 엔드포인트
app.get('/status', (req, res) => {
  res.send(syncStatus);
});

app.listen(PORT, () => {
  console.log(`🚀 OAuth 서버 실행: http://localhost:${PORT}`);
  console.log('📋 브라우저에서 위 주소를 열어서 동기화를 시작하세요');
});