// Google Drive API 설정
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

// Service Account JWT 토큰 생성
async function getServiceAccountAccessToken(env) {
  const serviceAccountEmail = env.SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.SERVICE_ACCOUNT_PRIVATE_KEY;
  
  if (!serviceAccountEmail || !privateKey) {
    throw new Error(`Service Account credentials not configured: email=${serviceAccountEmail ? 'present' : 'missing'}, key=${privateKey ? 'present' : 'missing'}, available_keys=${Object.keys(env).sort().join(',')}`);
  }

  // JWT 헤더
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  // JWT 페이로드
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // 1시간 후 만료
    iat: now
  };

  // Base64 URL 인코딩
  const base64UrlEncode = (str) => {
    return btoa(JSON.stringify(str))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  // JWT 서명을 위한 데이터
  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const signingInput = encodedHeader + '.' + encodedPayload;

  // RSA-SHA256 서명 - PEM 형식 처리
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const keyData = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // JWT 생성
  const jwt = signingInput + '.' + encodedSignature;

  // Google OAuth2 토큰 교환
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

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

// Cloudflare Workers API
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }

    // 기본 라우트
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'VidHunt API Server (Cloudflare Workers)',
        version: '1.0.0',
        status: 'running',
        edge: request.cf?.colo || 'unknown'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 채널 데이터 API (KV Storage에서 읽기)
    if (url.pathname === '/api/channels') {
      try {
        // KV Storage에서 데이터 조회
        const channelData = await env.CHANNEL_DATA.get('channel-data', { type: 'json' });
        
        if (!channelData) {
          return new Response(JSON.stringify({
            error: 'No channel data found in KV Storage',
            message: 'Please sync data first using sync-to-kv.js script',
            totalChannels: 0,
            channels: []
          }), {
            status: 404,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // URL 파라미터로 필터링 (선택사항)
        const limit = parseInt(url.searchParams.get('limit')) || 300000;
        const minSubs = parseInt(url.searchParams.get('minSubs')) || 0;
        const maxSubs = parseInt(url.searchParams.get('maxSubs')) || Infinity;
        
        // 순수 원본 JSON 그대로 반환 (프론트엔드 요구사항)
        const originalChannels = channelData.channels || [];
        
        // 필터링을 위한 임시 데이터 추출 (원본 데이터는 변경하지 않음)
        const filteredChannels = originalChannels.filter(channel => {
          const latestSnapshot = channel.snapshots?.[channel.snapshots.length - 1];
          const latestSubscriber = channel.subscriberHistory?.[channel.subscriberHistory.length - 1];
          
          if (!latestSnapshot) return false;
          
          const subscriberCount = parseInt(latestSubscriber?.count || '0');
          return subscriberCount >= minSubs && subscriberCount <= maxSubs;
        }).slice(0, limit);
        
        return new Response(JSON.stringify({
          message: 'Channel data from KV Storage (super fast!)',
          lastUpdated: channelData.lastUpdated,
          totalChannels: filteredChannels.length,
          totalInDatabase: channelData.totalChannels,
          filters: {
            limit,
            minSubs: minSubs > 0 ? minSubs : null,
            maxSubs: maxSubs < Infinity ? maxSubs : null
          },
          channels: filteredChannels,
          edge: request.cf?.colo || 'unknown'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Failed to fetch channel data from KV',
          details: error.message,
          edge: request.cf?.colo || 'unknown'
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // 개별 채널 조회 API (온디맨드)
    if (url.pathname.startsWith('/api/channel/')) {
      const channelId = url.pathname.split('/api/channel/')[1];
      
      if (!channelId) {
        return new Response(JSON.stringify({
          error: 'Channel ID is required',
          example: '/api/channel/UCX6OQ3DkcsbYNE6H8uQQuVA'
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      try {
        // 1. KV에서 온디맨드 캐시 확인
        const cacheKey = `channels:ondemand:${channelId}`;
        let cachedData = await env.CHANNEL_DATA.get(cacheKey, { type: 'json' });
        
        if (cachedData) {
          return new Response(JSON.stringify({
            message: 'Channel data from cache (fast!)',
            source: 'kv_cache',
            cacheTTL: '3 days',
            channel: cachedData,
            edge: request.cf?.colo || 'unknown'
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // 2. 배치 데이터에서 확인 (기존 13개 채널)
        const batchData = await env.CHANNEL_DATA.get('channel-data', { type: 'json' });
        if (batchData?.channels) {
          const batchChannel = batchData.channels.find(ch => ch.channelId === channelId);
          if (batchChannel) {
            return new Response(JSON.stringify({
              message: 'Channel data from batch (super fast!)',
              source: 'batch_sync',
              channel: batchChannel,
              edge: request.cf?.colo || 'unknown'
            }), {
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            });
          }
        }

        // 3. Drive API에서 실시간 로드 (온디맨드) - Service Account 사용
        const folderId = env.GOOGLE_DRIVE_FOLDER_ID;
        
        if (!folderId) {
          return new Response(JSON.stringify({
            error: 'Drive folder ID not configured',
            code: 'MISSING_CONFIG',
            message: 'Please configure GOOGLE_DRIVE_FOLDER_ID in Workers environment'
          }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // Service Account 토큰 생성
        const accessToken = await getServiceAccountAccessToken(env);

        // Drive에서 파일 찾기
        const fileName = `${channelId}.json`;
        const filesResponse = await getDriveFiles(folderId, accessToken);
        const targetFile = filesResponse.files?.find(f => f.name === fileName);
        
        if (!targetFile) {
          return new Response(JSON.stringify({
            error: 'Channel not found',
            code: 'NOT_FOUND',
            channelId: channelId,
            message: 'This channel does not exist in our database'
          }), {
            status: 404,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // 파일 내용 읽기
        const fileContent = await getDriveFileContent(targetFile.id, accessToken);
        const channelData = JSON.parse(fileContent);
        
        // 최신 스냅샷 데이터 추출 (기존 sync-to-kv.js 로직과 동일)
        const latestSnapshot = channelData.snapshots?.[channelData.snapshots.length - 1];
        if (!latestSnapshot) {
          throw new Error('No snapshot data found in channel file');
        }

        const processedChannel = {
          channelId: channelData.channelId,
          staticData: channelData.staticData || {},
          latestSnapshot: latestSnapshot,
          metadata: channelData.metadata || {},
          // 호환성을 위한 필드들
          title: channelData.staticData?.title || 'Unknown',
          subscriberCount: parseInt(latestSnapshot.subscriberCount) || 0,
          viewCount: parseInt(latestSnapshot.viewCount) || 0,
          videoCount: parseInt(latestSnapshot.videoCount) || 0,
          lastUpdated: latestSnapshot.timestamp || channelData.metadata?.lastUpdated,
          avgViews: latestSnapshot.gavg || 0,
          viralIndex: latestSnapshot.gvir || 0,
          subscriberPerDay: latestSnapshot.gspd || 0,
          publishedAt: channelData.staticData?.publishedAt
        };

        // KV에 3일 TTL로 캐시 저장
        await env.CHANNEL_DATA.put(cacheKey, JSON.stringify(processedChannel), {
          expirationTtl: 259200 // 3일 = 3 * 24 * 60 * 60 초
        });

        return new Response(JSON.stringify({
          message: 'Channel data loaded from Drive (first time)',
          source: 'drive_ondemand',
          cached: true,
          cacheTTL: '3 days',
          channel: processedChannel,
          edge: request.cf?.colo || 'unknown'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Failed to fetch channel data',
          code: 'DRIVE_ERROR',
          details: error.message,
          channelId: channelId,
          edge: request.cf?.colo || 'unknown'
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // 404 처리
    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  },
};