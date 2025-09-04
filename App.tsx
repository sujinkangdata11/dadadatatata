
import React, { useState, useEffect, useCallback, useRef } from 'react';

// Google Identity Services 및 gapi 전역 변수 타입 선언
declare global {
    const gapi: any;
    const google: any;
}
import { ChannelData, DriveFile, LogEntry, LogStatus, Snapshot } from './types';
import { fetchSelectedChannelData, findChannelsImproved, fetchShortsCount, fetchChannelIdByHandle } from './services/youtubeService';
import { findFileByName, getFileContent, createJsonFile, updateJsonFile, listFolders, updateOrCreateChannelFile, getOrCreateChannelIndex, getExistingChannelIds, createFolder } from './services/driveService';
import { Step } from './components/Step';
import { LogItem } from './components/LogItem';

// FIX: Define a type for data fields to resolve TypeScript errors with mixed-type arrays.
type ApiDataField = {
  id: string;
  label: string;
  example: string | boolean | string[];
};

// Google OAuth 설정은 UI에서 직접 입력받습니다.
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest', 'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

const subscriberTiers = [
    { value: '1000000000', label: '10억 이하' },
    { value: '500000000', label: '5억 이하' },
    { value: '100000000', label: '1억 이하' },
    { value: '50000000', label: '5000만 이하' },
    { value: '10000000', label: '1000만 이하' },
    { value: '5000000', label: '500만 이하' },
    { value: '1000000', label: '100만 이하' },
    { value: '500000', label: '50만 이하' },
    { value: '100000', label: '10만 이하' },
    { value: '50000', label: '5만 이하' },
    { value: '10000', label: '1만 이하' },
    { value: '1000', label: '1천 이하' },
];

const sortOptions: { value: 'viewCount' | 'videoCount_asc'; label: string }[] = [
    { value: 'viewCount', label: '조회수 높은 순' },
    { value: 'videoCount_asc', label: '영상 갯수 적은 순' },
];

const youtubeCategories = [
    { value: '', label: '전체 카테고리' },
    { value: '1', label: '영화 & 애니메이션' },
    { value: '2', label: '자동차 & 교통' },
    { value: '10', label: '음악' },
    { value: '15', label: '애완동물 & 동물' },
    { value: '17', label: '스포츠' },
    { value: '19', label: '여행 & 이벤트' },
    { value: '20', label: '게임' },
    { value: '22', label: '인물 & 블로그' },
    { value: '23', label: '코미디' },
    { value: '24', label: '엔터테인먼트' },
    { value: '25', label: '뉴스 & 정치' },
    { value: '26', label: '노하우 & 스타일' },
    { value: '27', label: '교육' },
    { value: '28', label: '과학 & 기술' }
];

const channelCountOptions = [
    { value: 1, label: '1개' },
    { value: 50, label: '50개' },
    { value: 100, label: '100개' },
    { value: 1000, label: '1000개' },
    { value: 5000, label: '5000개' }
];

const updateModes = [
    { value: 'new', label: '신규 데이터 수집', icon: '🆕', description: '새로운 채널들을 발굴하여 데이터베이스를 확장합니다' },
    { value: 'existing', label: '기존 데이터 업데이트', icon: '🔄', description: '이미 수집한 채널들의 최신 데이터를 업데이트합니다' }
];

const apiDataFields: { group: string; fields: ApiDataField[] }[] = [
  {
    group: '기본 정보 (Snippet)',
    fields: [
      { id: 'title', label: '채널 제목', example: 'MrBeast' },
      { id: 'description', label: '채널 설명', example: 'I make videos, subscribe or I will chase you.' },
      { id: 'customUrl', label: '사용자 지정 URL', example: '@MrBeast' },
      { id: 'publishedAt', label: '채널 개설일', example: '2012-02-20T13:42:00Z' },
      { id: 'country', label: '국가', example: 'US' },
      { id: 'defaultLanguage', label: '기본 언어', example: 'en' },
      { id: 'thumbnailUrl', label: '프로필 아이콘 (최고화질)', example: 'https://yt3.ggpht.com/ytc/AIdro_nE8Bc-NzYN1S2h0hKkrskxZnghFY_Q...' },
      { id: 'thumbnailDefault', label: '프로필 아이콘 (88×88)', example: 'https://yt3.ggpht.com/ytc/AIdro_nE8Bc-NzYN1S2h0hKkrskxZnghFY_Q...' },
      { id: 'thumbnailMedium', label: '프로필 아이콘 (240×240)', example: 'https://yt3.ggpht.com/ytc/AIdro_nE8Bc-NzYN1S2h0hKkrskxZnghFY_Q...' },
      { id: 'thumbnailHigh', label: '프로필 아이콘 (800×800)', example: 'https://yt3.ggpht.com/ytc/AIdro_nE8Bc-NzYN1S2h0hKkrskxZnghFY_Q...' },
    ]
  },
  {
    group: '통계 (시간별 스냅샷)',
    fields: [
      { id: 'subscriberCount', label: '구독자 수', example: '288000000' },
      { id: 'viewCount', label: '총 조회수', example: '53123456789' },
      { id: 'videoCount', label: '총 동영상 수', example: '799' },
      { id: 'hiddenSubscriberCount', label: '구독자 수 비공개', example: false },
    ]
  },
  {
    group: '브랜딩 정보 (Branding)',
    fields: [
      { id: 'keywords', label: '채널 키워드', example: 'challenge fun entertainment comedy' },
      { id: 'bannerExternalUrl', label: '배너 이미지 URL', example: 'https://yt3.ggpht.com/...' },
      { id: 'unsubscribedTrailer', label: '미구독자용 예고편 ID', example: '0e3GPea1Tyg' },
    ]
  },
  {
    group: '콘텐츠 상세 (Content Details)',
    fields: [
      { id: 'uploadsPlaylistId', label: '업로드 재생목록 ID', example: 'UUX6OQ3DkcsbYNE6H8uQQuVA' },
    ]
  },
  {
    group: '토픽 정보 (Topic Details)',
    fields: [
      { id: 'topicIds', label: '토픽 ID', example: ['/m/02jjt', '/m/04rlf'] },
      { id: 'topicCategories', label: '토픽 카테고리', example: ['https://en.wikipedia.org/wiki/Entertainment'] },
    ]
  },
  {
    group: '채널 상태 (Status)',
    fields: [
      { id: 'privacyStatus', label: '공개 상태', example: 'public' },
      { id: 'isLinked', label: '연결된 계정 여부', example: true },
      { id: 'longUploadsStatus', label: '장편 업로드 가능 상태', example: 'longUploadsUnspecified' },
      { id: 'madeForKids', label: '아동용 채널 여부', example: false },
      { id: 'selfDeclaredMadeForKids', label: '아동용 직접 선언 여부', example: false },
    ]
  },
];

const appliedDataFields = [
  {
    group: '성장 지표 (추정)',
    fields: [
      { id: 'averageViewsPerVideo', label: '영상당 평균 조회수', formula: 'channels.statistics.viewCount ÷ channels.statistics.videoCount', example: '94,080,649,435 ÷ 897 = 104,876,115' },
      { id: 'subscribersPerVideo', label: '구독 전환율 (%)', formula: '(channels.statistics.subscriberCount ÷ channels.statistics.viewCount) × 100', example: '(430,000,000 ÷ 94,080,649,435) × 100 = 0.457%' },
      { id: 'viewsPerSubscriber', label: '구독자 대비 조회수 (%)', formula: '(channels.statistics.viewCount ÷ channels.statistics.subscriberCount) × 100', example: '(94,080,649,435 ÷ 430,000,000) × 100 = 21,879%' },
      { id: 'channelAgeInDays', label: '채널 운영 기간 (일)', formula: '(현재날짜 - channels.snippet.publishedAt) ÷ 86400000', example: '(2025-09-04 - 2012-02-20) = 4,943일' },
      { id: 'uploadsPerWeek', label: '주당 평균 업로드 수', formula: 'channels.statistics.videoCount ÷ (channelAgeInDays ÷ 7)', example: '897 ÷ (4,943 ÷ 7) = 1.27개/주' },
      { id: 'subsGainedPerDay', label: '일일 평균 구독자 증가', formula: 'channels.statistics.subscriberCount ÷ channelAgeInDays', example: '430,000,000 ÷ 4,943 = 86,965명/일' },
      { id: 'viewsGainedPerDay', label: '일일 평균 조회수 증가', formula: 'channels.statistics.viewCount ÷ channelAgeInDays', example: '94,080,649,435 ÷ 4,943 = 19,031,194회/일' },
      { id: 'subsGainedPerMonth', label: '월간 평균 구독자 증가', formula: 'subsGainedPerDay × 30.44', example: '86,965 × 30.44 = 2,647,285명/월' },
      { id: 'subsGainedPerYear', label: '연간 평균 구독자 증가', formula: 'subsGainedPerDay × 365.25', example: '86,965 × 365.25 = 31,755,396명/년' },
      { id: 'viralIndex', label: '바이럴 지수', formula: '(구독전환율 × 100) + (영상당평균조회수 ÷ 1,000,000)', example: '(0.457 × 100) + (104.88) = 150.5' },
    ]
  },
  {
    group: '콘텐츠 분석',
    fields: [
      { id: 'shortsCount', label: '숏폼 갯수', formula: 'COUNT(videos WHERE parseISO8601Duration(videos.contentDetails.duration) ≤ 60) | 대상: MIN(channels.statistics.videoCount, 1000) 최신영상', example: '최신 1000개 영상 중 60초 이하 = 25개' },
      { id: 'longformCount', label: '롱폼 갯수', formula: 'MIN(channels.statistics.videoCount, 1000) - shortsCount | 분석된 범위 내에서만 계산', example: 'MIN(897, 1000) - 25 = 872개' },
      { id: 'totalShortsDuration', label: '숏폼 총 영상 길이 (추정)', formula: 'shortsCount × 60 (평균 길이)', example: '50 × 60 = 3,000초' },
    ]
  },
    {
    group: '조회수 분석 (추정)',
    fields: [
      { id: 'estimatedShortsViews', label: '숏폼 총 조회수 (실제)', formula: 'SUM(videos.statistics.viewCount WHERE duration ≤ 60초) | 분석된 1000개 영상 내 실제 숏폼 조회수 합계', example: '숏폼 25개의 실제 조회수 합계 = 3.2B' },
      { id: 'shortsViewsPercentage', label: '숏폼 조회수 비중 (%)', formula: '(실제숏폼총조회수 ÷ channels.statistics.viewCount) × 100', example: '(3.2B ÷ 94.08B) × 100 = 3.4%' },
      { id: 'estimatedLongformViews', label: '롱폼 총 조회수 (실제)', formula: 'channels.statistics.viewCount - 실제숏폼총조회수', example: '94.08B - 3.2B = 90.88B' },
      { id: 'longformViewsPercentage', label: '롱폼 조회수 비중 (%)', formula: '(실제롱폼총조회수 ÷ channels.statistics.viewCount) × 100', example: '(90.88B ÷ 94.08B) × 100 = 96.6%' },
    ]
  },
];


const App: React.FC = () => {
    const [googleAuth, setGoogleAuth] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    const [gapiScriptLoaded, setGapiScriptLoaded] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logCounter = useRef(0);

    const [clientId, setClientId] = useState(() => localStorage.getItem('YT_CLIENT_ID') || '');
    const [clientSecret, setClientSecret] = useState(() => localStorage.getItem('YT_CLIENT_SECRET') || '');
    const [youtubeApiKey, setYoutubeApiKey] = useState(() => localStorage.getItem('YT_API_KEY') || '');
    const [youtubeApiComplete, setYoutubeApiComplete] = useState(() => !!localStorage.getItem('YT_API_KEY'));
    
    const [selectedFolder, setSelectedFolder] = useState<DriveFile | null>(null);
    const [folders, setFolders] = useState<DriveFile[]>([]);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [showFolderSelect, setShowFolderSelect] = useState(false);

    const [step2Complete, setStep2Complete] = useState(false);
    const [minSubscribers, setMinSubscribers] = useState('1000000000');
    const [sortOrder, setSortOrder] = useState<'viewCount' | 'videoCount_asc'>('viewCount');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [channelCount, setChannelCount] = useState<number>(50);
    const [updateMode, setUpdateMode] = useState<'new' | 'existing'>('new');
    const [existingChannelsCount, setExistingChannelsCount] = useState<number>(0);
    const [isFinding, setIsFinding] = useState(false);
    const [foundChannels, setFoundChannels] = useState<string[]>([]);
    
    const [isStep3Open, setIsStep3Open] = useState(false);
    const [step3Complete, setStep3Complete] = useState(false);
    const [targetChannelIds, setTargetChannelIds] = useState<string[]>([]);
    const [manualChannelHandle, setManualChannelHandle] = useState('');
    const [isAddingChannel, setIsAddingChannel] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('popular');

    const [step4Complete, setStep4Complete] = useState(false);
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['title', 'subscriberCount', 'viewCount', 'videoCount', 'publishedAt']));
    const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set(['averageViewsPerVideo', 'subsGainedPerDay']));
    const [showExampleModal, setShowExampleModal] = useState(false);
    const [exampleJson, setExampleJson] = useState('');
    const [showViralIndexModal, setShowViralIndexModal] = useState(false);
    const [showShortsCountModal, setShowShortsCountModal] = useState(false);
    const [showLongformCountModal, setShowLongformCountModal] = useState(false);
    const [showShortsViewsModal, setShowShortsViewsModal] = useState(false);
    const [isProcessingStarted, setIsProcessingStarted] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    // FIX: Changed NodeJS.Timeout to number, as setInterval in browser environments returns a number, not a NodeJS.Timeout object.
    const processingInterval = useRef<number | null>(null);
    const currentChannelIndex = useRef(0);
    const [isPaused, setIsPaused] = useState(false);

    const addLog = useCallback((status: LogStatus, message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        logCounter.current += 1;
        setLogs(prev => [{ id: logCounter.current, status, message, timestamp }, ...prev]);
    }, []);

    useEffect(() => {
        // 새로운 Google Identity Services 스크립트 로드
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.async = true;
        gapiScript.defer = true;
        
        let scriptsLoaded = 0;
        const checkBothLoaded = () => {
            scriptsLoaded++;
            if (scriptsLoaded === 2) {
                setGapiScriptLoaded(true);
            }
        };
        
        gisScript.onload = checkBothLoaded;
        gapiScript.onload = checkBothLoaded;
        
        document.body.appendChild(gisScript);
        document.body.appendChild(gapiScript);
        
        return () => {
            if (document.body.contains(gisScript)) document.body.removeChild(gisScript);
            if (document.body.contains(gapiScript)) document.body.removeChild(gapiScript);
        };
    }, []);

    const updateSigninStatus = useCallback((isSignedIn: boolean) => {
        if (isSignedIn) {
            const authInstance = gapi.auth2.getAuthInstance();
            const profile = authInstance.currentUser.get().getBasicProfile();
            setUser({
                name: profile.getName(),
                email: profile.getEmail(),
                picture: profile.getImageUrl(),
            });
            addLog(LogStatus.SUCCESS, `${profile.getName()}님, Google 계정으로 로그인되었습니다.`);
        } else {
            setUser(null);
            addLog(LogStatus.INFO, 'Google 계정에서 로그아웃되었습니다.');
        }
    }, [addLog]);

    const handleLogin = useCallback(() => {
        console.log("`handleLogin` 함수가 호출되었습니다.");
        if (!clientId.trim()) {
            addLog(LogStatus.ERROR, "Google 클라이언트 ID를 입력해야 합니다.");
            return;
        }

        // Google Identity Services 로딩 확인
        if (typeof google === 'undefined' || typeof gapi === 'undefined') {
            addLog(LogStatus.ERROR, "Google API 스크립트가 아직 로드되지 않았습니다.");
            return;
        }

        // 키를 로컬 스토리지에 저장
        localStorage.setItem('YT_CLIENT_ID', clientId);
        localStorage.setItem('YT_CLIENT_SECRET', clientSecret);

        addLog(LogStatus.PENDING, "새로운 Google 인증을 시작합니다...");

        // 새로운 Google Identity Services 방식
        const handleCredentialResponse = (response: any) => {
            console.log("인증 성공:", response);
            // JWT 토큰 디코딩하여 사용자 정보 추출
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            setUser({
                name: payload.name,
                email: payload.email,
                picture: payload.picture,
            });
            addLog(LogStatus.SUCCESS, `${payload.name}님, Google 계정으로 로그인되었습니다.`);
        };

        // Google Identity Services 초기화
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
        });

        // 바로 OAuth 2.0 방식 사용 (One Tap 건너뛰기)
        addLog(LogStatus.INFO, "OAuth 2.0 로그인 창을 표시합니다.");
        
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            prompt: 'consent', // 항상 동의 화면 표시
            include_granted_scopes: true, // 기존 권한도 포함
            callback: async (response: any) => {
                console.log("OAuth 인증 성공:", response);
                
                try {
                    // 사용자 프로필 정보 가져오기 (fetch API 사용)
                    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: {
                            'Authorization': `Bearer ${response.access_token}`
                        }
                    });
                    
                    if (userResponse.ok) {
                        const userInfo = await userResponse.json();
                        console.log("사용자 정보:", userInfo);
                        setUser({
                            name: userInfo.name,
                            email: userInfo.email,
                            picture: userInfo.picture,
                        });
                        const authData = { access_token: response.access_token };
                        setGoogleAuth(authData);
                        addLog(LogStatus.SUCCESS, `${userInfo.name}님, Google 계정으로 로그인되었습니다.`);
                        
                        // gapi 클라이언트 초기화 후 Drive 폴더 목록 가져오기
                        setTimeout(async () => {
                            try {
                                await initializeGapiClient(response.access_token);
                                loadDriveFolders();
                            } catch (error) {
                                console.error('Drive 초기화 실패, 로그인은 성공:', error);
                                addLog(LogStatus.WARNING, 'Drive 연동에 실패했지만 로그인은 완료되었습니다.');
                            }
                        }, 100);
                    } else {
                        // 사용자 정보를 가져올 수 없는 경우 기본값 사용
                        console.warn("사용자 정보를 가져올 수 없습니다. 기본값을 사용합니다.");
                        setUser({
                            name: "Google User",
                            email: "unknown@gmail.com", 
                            picture: "https://via.placeholder.com/40"
                        });
                        const authData = { access_token: response.access_token };
                        setGoogleAuth(authData);
                        addLog(LogStatus.SUCCESS, "Google 계정으로 로그인되었습니다.");
                        setTimeout(async () => {
                            try {
                                await initializeGapiClient(response.access_token);
                                loadDriveFolders();
                            } catch (error) {
                                console.error('Drive 초기화 실패:', error);
                                addLog(LogStatus.WARNING, 'Drive 연동 실패, 로그인은 완료');
                            }
                        }, 100);
                    }
                } catch (error) {
                    console.error("사용자 정보 가져오기 실패:", error);
                    // 오류가 발생해도 로그인은 성공으로 처리
                    setUser({
                        name: "Google User",
                        email: "unknown@gmail.com",
                        picture: "https://via.placeholder.com/40"
                    });
                    const authData = { access_token: response.access_token };
                    setGoogleAuth(authData);
                    addLog(LogStatus.SUCCESS, "Google 계정으로 로그인되었습니다.");
                    setTimeout(async () => {
                        try {
                            await initializeGapiClient(response.access_token);
                            loadDriveFolders();
                        } catch (error) {
                            console.error('Drive 초기화 실패:', error);
                            addLog(LogStatus.WARNING, 'Drive 연동 실패, 로그인은 완료');
                        }
                    }, 100);
                }
            },
            error_callback: (error: any) => {
                console.error("OAuth 인증 실패:", error);
                addLog(LogStatus.ERROR, `OAuth 인증 실패: ${error.error}`);
            }
        });
        
        tokenClient.requestAccessToken();

    }, [clientId, youtubeApiKey, clientSecret, addLog]);

    const handleYouTubeApiSubmit = useCallback(() => {
        if (!youtubeApiKey.trim()) {
            addLog(LogStatus.ERROR, "YouTube API 키를 입력해주세요.");
            return;
        }
        
        localStorage.setItem('YT_API_KEY', youtubeApiKey);
        setYoutubeApiComplete(true);
        addLog(LogStatus.SUCCESS, "YouTube API 키가 저장되었습니다.");
    }, [youtubeApiKey, addLog]);

    const initializeGapiClient = useCallback(async (accessToken?: string) => {
        try {
            console.log('gapi 클라이언트 초기화 시작...');
            console.log('받은 액세스 토큰:', accessToken ? '있음' : '없음');
            
            // gapi가 로드되었는지 확인
            if (typeof gapi === 'undefined') {
                throw new Error('gapi가 로드되지 않았습니다');
            }
            
            // gapi.client가 준비될 때까지 기다림
            if (!gapi.client) {
                console.log('gapi.client 로드 중...');
                await new Promise((resolve, reject) => {
                    gapi.load('client', {
                        callback: resolve,
                        onerror: reject
                    });
                });
            }
            
            // Drive API만 초기화 (OAuth 사용하므로 API 키 불필요)
            await gapi.client.init({
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            
            // OAuth 토큰 설정 - 매개변수로 받은 토큰 우선 사용
            const token = accessToken || googleAuth?.access_token;
            if (token) {
                console.log('토큰 설정 중...');
                gapi.client.setToken({
                    access_token: token
                });
                console.log('토큰 설정 완료');
            } else {
                console.warn('설정할 토큰이 없습니다');
            }
            
            console.log('gapi 클라이언트 초기화 완료');
        } catch (error) {
            console.error('gapi 클라이언트 초기화 실패:', error);
            throw error;
        }
    }, [googleAuth]);

    const loadDriveFolders = useCallback(async () => {
        setLoadingFolders(true);
        addLog(LogStatus.PENDING, "Google Drive 폴더 목록을 불러오는 중...");
        
        // Root 폴더를 항상 기본값으로 설정
        const rootFolder = { id: 'root', name: '내 Drive (루트)', mimeType: 'application/vnd.google-apps.folder' };
        setSelectedFolder(rootFolder);
        
        try {
            const folderList = await listFolders();
            setFolders([rootFolder, ...folderList]);
            addLog(LogStatus.SUCCESS, `${folderList.length + 1}개의 폴더를 찾았습니다.`);
        } catch (error: any) {
            console.error("폴더 로드 오류:", error);
            // 실패해도 루트 폴더만 사용
            setFolders([rootFolder]);
            addLog(LogStatus.WARNING, `폴더 목록 로드 실패, 루트 폴더만 사용합니다: ${error.message}`);
        } finally {
            setLoadingFolders(false);
        }
    }, [addLog]);

    const handleGoogleDriveImport = useCallback(async () => {
        if (!user) {
            addLog(LogStatus.ERROR, "먼저 Google 계정에 로그인해주세요.");
            return;
        }

        try {
            addLog(LogStatus.PENDING, "Google Drive 폴더 목록을 불러오는 중...");
            await loadDriveFolders();
            setShowFolderSelect(true);
            addLog(LogStatus.SUCCESS, "폴더 선택 창을 열었습니다.");
        } catch (error: any) {
            addLog(LogStatus.ERROR, `폴더 목록 로드 실패: ${error.message}`);
        }
    }, [user, loadDriveFolders, addLog]);

    const handleFolderSelect = useCallback(async (folder: DriveFile | null) => {
        setSelectedFolder(folder);
        setShowFolderSelect(false);
        
        const folderName = folder ? folder.name : '루트 폴더';
        const folderId = folder ? folder.id : 'root';
        addLog(LogStatus.SUCCESS, `'${folderName}' 폴더를 선택했습니다.`);
        
        // 기존 채널 수 로드
        try {
            addLog(LogStatus.PENDING, '기존 채널 데이터 확인 중...');
            const channelIndex = await getOrCreateChannelIndex(folderId);
            setExistingChannelsCount(channelIndex.totalChannels || 0);
            
            if (channelIndex.totalChannels > 0) {
                addLog(LogStatus.SUCCESS, `기존 채널 ${channelIndex.totalChannels}개를 발견했습니다.`);
            } else {
                addLog(LogStatus.INFO, '기존 채널 데이터가 없습니다. 신규 데이터 수집을 시작할 수 있습니다.');
            }
        } catch (error) {
            console.error('기존 채널 데이터 확인 오류:', error);
            addLog(LogStatus.WARNING, '기존 채널 데이터 확인에 실패했습니다.');
            setExistingChannelsCount(0);
        }
    }, [addLog]);

    const handleSignOutClick = () => {
        if (googleAuth) {
            googleAuth.signOut();
        }
    };

    const handleResetKeys = () => {
        addLog(LogStatus.WARNING, '저장된 모든 키를 삭제하고 상태를 초기화합니다.');
        localStorage.removeItem('YT_CLIENT_ID');
        localStorage.removeItem('YT_CLIENT_SECRET');
        localStorage.removeItem('YT_API_KEY');
        
        // Google OAuth 토큰도 완전히 제거
        if (googleAuth && googleAuth.signOut) {
            googleAuth.signOut();
        }
        
        // Google 계정 revoke (권한 완전 취소)
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        
        // 페이지를 새로고침하여 모든 상태를 완전히 리셋합니다.
        window.location.reload();
    };

    const handleFindChannels = async () => {
        if (!user || !youtubeApiKey) {
            addLog(LogStatus.ERROR, '로그인하고 API 키를 설정해야 채널을 탐색할 수 있습니다.');
            return;
        }
        setIsFinding(true);
        const categoryLabel = youtubeCategories.find(cat => cat.value === selectedCategory)?.label || '전체 카테고리';
        
        try {
            if (updateMode === 'existing') {
                // 기존 채널 업데이트 모드
                addLog(LogStatus.PENDING, `기존 채널 확인 중... (${existingChannelsCount}개)`);
                const ids = await getExistingChannelIds(selectedFolder.id);
                if (ids.length === 0) {
                    addLog(LogStatus.WARNING, '기존 채널이 없습니다. 신규 데이터 수집 모드로 전환해주세요.');
                    return;
                }
                setFoundChannels(ids);
                setTargetChannelIds(prev => [...new Set([...prev, ...ids])]);
                setStep2Complete(true);
                addLog(LogStatus.SUCCESS, `✅ ${ids.length}개의 기존 채널을 대상으로 설정했습니다.`);
            } else {
                // 신규 채널 수집 모드
                addLog(LogStatus.PENDING, `🔍 신규 채널 탐색 중... (구독자 ${parseInt(minSubscribers).toLocaleString()}명 이하, ${sortOptions.find(o => o.value === sortOrder)?.label} 정렬, ${categoryLabel})`);
                
                const existingIds = await getExistingChannelIds(selectedFolder.id);
                const ids = await findChannelsImproved(youtubeApiKey, parseInt(minSubscribers, 10), sortOrder, channelCount, selectedCategory, existingIds, searchKeyword);
                
                if (ids.length === 0) {
                    if (existingIds.length > 0) {
                        addLog(LogStatus.WARNING, '해당 조건에서 새로운 채널을 더 이상 발견할 수 없습니다. 다른 조건을 시도해보세요.');
                    } else {
                        addLog(LogStatus.WARNING, '조건에 맞는 채널을 찾을 수 없습니다.');
                    }
                    return;
                }
                
                setFoundChannels(ids);
                setTargetChannelIds(prev => [...new Set([...prev, ...ids])]);
                setStep2Complete(true);
                addLog(LogStatus.SUCCESS, `✨ ${ids.length}개의 새로운 채널을 발견하고 대상 목록에 추가했습니다.`);
            }
        } catch (error: any) {
            addLog(LogStatus.ERROR, `채널 탐색 실패: ${error.message}`);
        } finally {
            setIsFinding(false);
        }
    };
    
    const handleAddChannelByHandle = async () => {
        const trimmedHandle = manualChannelHandle.trim();
        if (!trimmedHandle) return;

        if (!user || !youtubeApiKey) {
            addLog(LogStatus.ERROR, '로그인하고 API 키를 설정해야 채널을 추가할 수 있습니다.');
            return;
        }

        setIsAddingChannel(true);
        addLog(LogStatus.PENDING, `'${trimmedHandle}' 핸들을 채널 ID로 변환 중...`);

        try {
            const channelId = await fetchChannelIdByHandle(trimmedHandle, youtubeApiKey);
            if (!targetChannelIds.includes(channelId)) {
                setTargetChannelIds(prev => [channelId, ...prev]);
                addLog(LogStatus.SUCCESS, `채널 추가 성공: ${trimmedHandle} (${channelId})`);
            } else {
                addLog(LogStatus.WARNING, `채널 '${trimmedHandle}' (${channelId})는 이미 목록에 존재합니다.`);
            }
            setManualChannelHandle('');
        } catch (error: any) {
            addLog(LogStatus.ERROR, `채널 추가 실패: ${error.message}`);
        } finally {
            setIsAddingChannel(false);
        }
    };
    
    const handleRemoveChannel = (idToRemove: string) => {
        setTargetChannelIds(prev => prev.filter(id => id !== idToRemove));
    };

    const handleConfirmTargetChannels = () => {
        if (targetChannelIds.length > 0) {
            setStep3Complete(true);
            addLog(LogStatus.SUCCESS, `3단계 완료: 총 ${targetChannelIds.length}개의 채널이 처리 대상으로 확정되었습니다.`);
        } else {
            addLog(LogStatus.ERROR, '최소 1개 이상의 채널을 처리 대상으로 추가해야 합니다.');
        }
    };

    const handleFieldChange = (fieldId: string, group: 'basic' | 'applied') => {
        const updater = group === 'basic' ? setSelectedFields : setAppliedFields;
        updater(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fieldId)) {
                newSet.delete(fieldId);
            } else {
                newSet.add(fieldId);
            }
            return newSet;
        });
    };

    const handleConfirmFieldsAndProcess = async () => {
        if (selectedFields.size === 0) {
            addLog(LogStatus.ERROR, '최소 1개 이상의 기본 데이터 필드를 선택해야 합니다.');
            return;
        }

        if (!youtubeApiKey) {
            addLog(LogStatus.ERROR, 'YouTube API 키가 필요합니다.');
            return;
        }

        if (!selectedFolder) {
            addLog(LogStatus.ERROR, 'Google Drive 폴더를 선택해주세요.');
            return;
        }

        try {
            setStep4Complete(true);
            setIsProcessingStarted(true);
            addLog(LogStatus.SUCCESS, `4단계 완료: 필드 선택이 확정되었으며, 5단계 데이터 처리를 시작합니다.`);

            // 1단계: 채널 ID 준비 (모드에 따라 다르게 처리)
            let targetChannelIds: string[] = [];
            
            if (updateMode === 'existing') {
                // 기존 채널 업데이트 모드
                addLog(LogStatus.PENDING, `기존 채널 데이터 업데이트 중... (${existingChannelsCount}개)`);
                targetChannelIds = await getExistingChannelIds(selectedFolder.id);
                
                if (targetChannelIds.length === 0) {
                    addLog(LogStatus.WARNING, '기존 채널이 없습니다. 신규 데이터 수집 모드로 전환해주세요.');
                    return;
                }
            } else {
                // 신규 채널 수집 모드 - 개선된 로직
                const categoryLabel = youtubeCategories.find(cat => cat.value === selectedCategory)?.label || '전체 카테고리';
                
                // 1단계: 기존 채널 목록 먼저 가져오기
                addLog(LogStatus.PENDING, '기존 채널 목록 확인 중...');
                const existingIds = await getExistingChannelIds(selectedFolder.id);
                
                // 2단계: 스마트 검색 - 기존 채널을 제외하고 검색
                addLog(LogStatus.PENDING, `🔍 신규 채널 발굴 중... (기존 ${existingIds.length}개 제외, ${categoryLabel})`);
                
                const foundChannelIds = await findChannelsImproved(
                    youtubeApiKey,
                    parseInt(minSubscribers),
                    sortOrder,
                    channelCount,
                    selectedCategory,
                    existingIds, // 기존 채널 제외
                    searchKeyword
                );

                if (foundChannelIds.length === 0) {
                    if (existingIds.length > 0) {
                        addLog(LogStatus.WARNING, '해당 조건에서 새로운 채널을 더 이상 발견할 수 없습니다. 다른 카테고리나 조건을 시도해보세요.');
                    } else {
                        addLog(LogStatus.WARNING, '조건에 맞는 채널을 찾을 수 없습니다. 구독자수 범위나 카테고리를 조정해보세요.');
                    }
                    return;
                }

                targetChannelIds = foundChannelIds;
                addLog(LogStatus.SUCCESS, `✨ ${targetChannelIds.length}개의 새로운 채널을 발견했습니다!`);
            }

            addLog(LogStatus.SUCCESS, `처리할 채널: ${targetChannelIds.length}개`);

            // 2단계: 선택된 필드로 데이터 추출
            addLog(LogStatus.PENDING, '채널 데이터 추출 중...');
            const channelDataList = [];

            for (let i = 0; i < targetChannelIds.length; i++) {
                const channelId = targetChannelIds[i];
                addLog(LogStatus.PENDING, `채널 데이터 추출 중... (${i + 1}/${targetChannelIds.length})`);

                try {
                    const { staticData, snapshotData } = await fetchSelectedChannelData(
                        channelId,
                        youtubeApiKey,
                        selectedFields
                    );

                    channelDataList.push({
                        channelId,
                        staticData,
                        snapshot: snapshotData
                    });
                    
                    addLog(LogStatus.SUCCESS, `채널 ${staticData.title || channelId} 데이터 추출 완료`);
                } catch (error) {
                    addLog(LogStatus.WARNING, `채널 ${channelId} 데이터 추출 실패: ${error}`);
                }
            }

            // 3단계: 채널별 파일 생성/업데이트 및 Google Drive 저장
            addLog(LogStatus.PENDING, '채널별 파일 생성/업데이트 중...');
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const collectionInfo = {
                exportId: `export-${timestamp}`,
                filters: {
                    maxSubscribers: parseInt(minSubscribers),
                    sortOrder: sortOrder,
                    category: selectedCategory || 'all'
                },
                selectedFields: Array.from(selectedFields)
            };

            // 각 채널을 개별 파일로 저장/업데이트
            for (let i = 0; i < channelDataList.length; i++) {
                const channelData = channelDataList[i];
                addLog(LogStatus.PENDING, `채널 파일 처리 중... (${i + 1}/${channelDataList.length}): ${channelData.staticData?.title || channelData.channelId}`);
                
                try {
                    await updateOrCreateChannelFile(channelData, selectedFolder.id, collectionInfo);
                    addLog(LogStatus.SUCCESS, `✓ ${channelData.staticData?.title || channelData.channelId} 파일 처리 완료`);
                } catch (error) {
                    addLog(LogStatus.WARNING, `⚠ ${channelData.channelId} 파일 처리 실패: ${error}`);
                }
            }

            // collections 폴더 생성 및 메타데이터 파일 생성
            let collectionsFolder = await findFileByName('collections', selectedFolder.id);
            if (!collectionsFolder) {
                collectionsFolder = await createFolder('collections', selectedFolder.id);
                addLog(LogStatus.SUCCESS, '📁 collections 폴더를 생성했습니다.');
            }

            const metadataFileName = `${timestamp}.json`;
            const metadataContent = {
                collectionInfo: {
                    ...collectionInfo,
                    timestamp: new Date().toISOString(),
                    totalChannels: channelDataList.length,
                    updateMode: updateMode
                },
                channels: channelDataList.map(ch => ({
                    channelId: ch.channelId,
                    title: ch.staticData?.title || 'Unknown',
                    processed: true
                }))
            };

            await createJsonFile(metadataFileName, collectionsFolder.id, metadataContent);
            addLog(LogStatus.SUCCESS, `📋 수집 메타데이터 파일 생성: collections/${metadataFileName}`);
            addLog(LogStatus.SUCCESS, `🎉 처리 완료: 총 ${channelDataList.length}개 채널을 ${updateMode === 'existing' ? '업데이트' : '신규 수집'}했습니다.`);

        } catch (error: any) {
            console.error('데이터 처리 오류:', error);
            addLog(LogStatus.ERROR, `데이터 처리 실패: ${error.message}`);
            setStep4Complete(false);
            setIsProcessingStarted(false);
        }
    };

    const handleShowExample = () => {
        // 새로운 채널 기반 파일 구조에 맞는 예시 생성
        const sampleSnapshot: Partial<Snapshot> = {};
        const sampleStaticData: any = {};
        const allFields = [...selectedFields, ...appliedFields];

        // 선택된 필드들의 예시 데이터 생성
        allFields.forEach(fieldId => {
            const allDataFields = [...apiDataFields.flatMap(g => g.fields), ...appliedDataFields.flatMap(g => g.fields)];
            const field = allDataFields.find(f => f.id === fieldId);
            if (field) {
                // 정적 데이터와 스냅샷 데이터 분리
                if (['title', 'description', 'customUrl', 'publishedAt', 'defaultLanguage', 'country', 'thumbnailUrl', 'thumbnailDefault', 'thumbnailMedium', 'thumbnailHigh'].includes(field.id)) {
                    sampleStaticData[field.id] = field.example;
                } else {
                    (sampleSnapshot as any)[field.id] = field.example;
                }
            }
        });

        // 새로운 채널 파일 구조
        const sampleChannelFile = {
            channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA",
            staticData: sampleStaticData,
            snapshots: [
                {
                    timestamp: new Date().toISOString(),
                    ...sampleSnapshot,
                    collectionInfo: {
                        exportId: `export-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
                        filters: {
                            maxSubscribers: parseInt(minSubscribers),
                            sortOrder: sortOrder,
                            category: selectedCategory || 'all'
                        },
                        selectedFields: Array.from(selectedFields)
                    }
                }
            ],
            metadata: {
                firstCollected: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                totalCollections: 1
            }
        };

        setExampleJson(JSON.stringify(sampleChannelFile, null, 2));
        setShowExampleModal(true);
    };

    
    const calculateAndAddAppliedData = (snapshot: Snapshot, publishedAt?: string, shortsCountData?: { shortsCount: number; totalShortsViews: number }): Snapshot => {
        const newSnapshot: Snapshot = { ...snapshot };
        
        const subscriberCount = snapshot.subscriberCount ? parseInt(snapshot.subscriberCount, 10) : undefined;
        const viewCount = snapshot.viewCount ? parseInt(snapshot.viewCount, 10) : undefined;
        const videoCount = snapshot.videoCount ? parseInt(snapshot.videoCount, 10) : undefined;

        let channelAgeDays: number | undefined;
        if (publishedAt) {
            const publishedDate = new Date(publishedAt);
            const now = new Date();
            channelAgeDays = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
            if(appliedFields.has('channelAgeInDays')) newSnapshot.channelAgeInDays = channelAgeDays;
        }

        if (subscriberCount !== undefined && viewCount !== undefined && videoCount !== undefined && videoCount > 0) {
            if(appliedFields.has('averageViewsPerVideo')) newSnapshot.averageViewsPerVideo = Math.round(viewCount / videoCount);
            if(appliedFields.has('subscribersPerVideo')) {
                newSnapshot.subscribersPerVideo = parseFloat(((subscriberCount / viewCount) * 100).toFixed(4));
            }
        }
        if (subscriberCount !== undefined && viewCount !== undefined && subscriberCount > 0) {
             if(appliedFields.has('viewsPerSubscriber')) newSnapshot.viewsPerSubscriber = parseFloat(((viewCount / subscriberCount) * 100).toFixed(2));
        }
        if (subscriberCount !== undefined && viewCount !== undefined && viewCount > 0) {
            if(appliedFields.has('subscriberToViewRatioPercent')) newSnapshot.subscriberToViewRatioPercent = parseFloat(((subscriberCount / viewCount) * 100).toFixed(4));
        }

        if (channelAgeDays !== undefined && channelAgeDays > 0) {
            if (videoCount !== undefined) {
                if(appliedFields.has('uploadsPerWeek')) newSnapshot.uploadsPerWeek = parseFloat((videoCount / (channelAgeDays / 7)).toFixed(2));
            }
            if (subscriberCount !== undefined) {
                const subsPerDay = subscriberCount / channelAgeDays;
                if(appliedFields.has('subsGainedPerDay')) newSnapshot.subsGainedPerDay = Math.round(subsPerDay);
                if(appliedFields.has('subsGainedPerMonth')) newSnapshot.subsGainedPerMonth = Math.round(subsPerDay * 30.44);
                if(appliedFields.has('subsGainedPerYear')) newSnapshot.subsGainedPerYear = Math.round(subsPerDay * 365.25);
            }
             if (viewCount !== undefined) {
                const viewsPerDay = viewCount / channelAgeDays;
                if(appliedFields.has('viewsGainedPerDay')) newSnapshot.viewsGainedPerDay = Math.round(viewsPerDay);

                if (subscriberCount !== undefined) {
                     const subsPerDay = subscriberCount / channelAgeDays;
                     if(appliedFields.has('viralIndex')) {
                        const conversionRate = subscriberCount / viewCount;
                        const videoCount = snapshot.videoCount ? parseInt(snapshot.videoCount, 10) : 1;
                        const avgViewsPerVideo = viewCount / videoCount;
                        newSnapshot.viralIndex = Math.round((conversionRate * 100) + (avgViewsPerVideo / 1000000));
                     }
                }
            }
        }
        
        // Content Analysis
        if (appliedFields.has('shortsCount') && shortsCountData) {
            newSnapshot.shortsCount = shortsCountData.shortsCount;
        }
        if (appliedFields.has('longformCount') && videoCount !== undefined && shortsCountData) {
            const analyzedVideoCount = Math.min(videoCount, 1000); // 1000개 제한 적용
            newSnapshot.longformCount = analyzedVideoCount - shortsCountData.shortsCount;
        }
        if (appliedFields.has('totalShortsDuration') && shortsCountData) {
            newSnapshot.totalShortsDuration = shortsCountData.shortsCount * 60;
        }
        
        // View Analysis
        if (appliedFields.has('estimatedShortsViews') || appliedFields.has('estimatedLongformViews') || appliedFields.has('shortsViewsPercentage') || appliedFields.has('longformViewsPercentage')) {
            if (viewCount !== undefined && shortsCountData) {
                // Use actual shorts views instead of estimation
                if(appliedFields.has('estimatedShortsViews')){
                    newSnapshot.estimatedShortsViews = shortsCountData.totalShortsViews;
                }
                
                const longformViews = Math.max(0, viewCount - shortsCountData.totalShortsViews);
                if(appliedFields.has('estimatedLongformViews')){
                    newSnapshot.estimatedLongformViews = longformViews;
                }
                // Calculate shorts views percentage of total views
                if(appliedFields.has('shortsViewsPercentage')){
                    newSnapshot.shortsViewsPercentage = parseFloat(((shortsCountData.totalShortsViews / viewCount) * 100).toFixed(2));
                }
                // Calculate longform views percentage of total views
                if(appliedFields.has('longformViewsPercentage')){
                    newSnapshot.longformViewsPercentage = parseFloat(((longformViews / viewCount) * 100).toFixed(2));
                }
            }
        }

        return newSnapshot;
    };

    const handleStartProcess = useCallback(async () => {
        if (isProcessing) return;
        
        addLog(LogStatus.INFO, `=== 데이터 수집 프로세스 시작 === (대상: ${targetChannelIds.length}개 채널)`);
        setIsProcessing(true);
        setIsPaused(false);
        currentChannelIndex.current = 0;

        const processChannel = async (channelId: string) => {
            addLog(LogStatus.INFO, `[${currentChannelIndex.current + 1}/${targetChannelIds.length}] ${channelId} 처리 시작...`);
            
            try {
                // 1. Fetch channel data
                const allFields = new Set([...selectedFields, ...appliedFields]);
                // Ensure dependent fields are fetched
                if (appliedFields.has('longformCount')) {
                   allFields.add('videoCount');
                }
                if (allFields.has('shortsCount') || allFields.has('longformCount') || allFields.has('totalShortsDuration') || allFields.has('estimatedShortsViews') || allFields.has('estimatedLongformViews')) {
                    allFields.add('uploadsPlaylistId');
                }
                if (Array.from(appliedFields).some(f => f.includes('Gained') || f.includes('uploadsPer') || f.includes('Age'))) {
                    allFields.add('publishedAt');
                }

                const { staticData, snapshotData } = await fetchSelectedChannelData(channelId, youtubeApiKey, allFields);
                addLog(LogStatus.SUCCESS, `기본 데이터 수집 완료: ${staticData.title || channelId}`);

                // 2. Fetch shorts count if needed
                let shortsCountData: { shortsCount: number; totalShortsViews: number } | undefined;
                const uploadsPlaylistId = staticData.uploadsPlaylistId;
                const needsShortsCount = allFields.has('shortsCount') || allFields.has('longformCount') || allFields.has('totalShortsDuration') || allFields.has('estimatedShortsViews') || allFields.has('estimatedLongformViews');

                if (needsShortsCount && uploadsPlaylistId) {
                    addLog(LogStatus.PENDING, '콘텐츠 분석 중 (숏폼 갯수 집계)... 이 작업은 채널의 영상 수에 따라 몇 분 정도 소요될 수 있습니다.');
                    try {
                        shortsCountData = await fetchShortsCount(uploadsPlaylistId, youtubeApiKey);
                        addLog(LogStatus.SUCCESS, `콘텐츠 분석 완료: 숏폼 ${shortsCountData.shortsCount}개 발견.`);
                    } catch (e: any) {
                        addLog(LogStatus.ERROR, `숏폼 갯수 집계 실패: ${e.message}`);
                    }
                }

                // 3. Calculate applied data
                const newSnapshotWithAppliedData = calculateAndAddAppliedData(snapshotData, staticData.publishedAt, shortsCountData);

                // 4. Find or create file in Google Drive
                const fileName = `${channelId}.json`;
                const folderId = selectedFolder?.id || 'root';
                let existingFile: DriveFile | null = null;
                try {
                    existingFile = await findFileByName(fileName, folderId);
                } catch(e: any) {
                    addLog(LogStatus.WARNING, `Drive 파일 검색 중 오류 발생 (새 파일 생성 시도): ${e.message}`);
                }

                let channelData: ChannelData;
                if (existingFile) {
                    addLog(LogStatus.INFO, `기존 파일 '${fileName}' 발견. 데이터를 업데이트합니다.`);
                    const content = await getFileContent(existingFile.id);
                    channelData = JSON.parse(content);
                    // Add new snapshot
                    channelData.snapshots.push(newSnapshotWithAppliedData);
                    // Update static data
                    Object.assign(channelData, staticData);
                    await updateJsonFile(existingFile.id, channelData);
                } else {
                    addLog(LogStatus.INFO, `새 파일 '${fileName}'을(를) 생성합니다.`);
                    channelData = {
                        channelId,
                        ...staticData,
                        snapshots: [newSnapshotWithAppliedData]
                    };
                    await createJsonFile(fileName, folderId, channelData);
                }
                addLog(LogStatus.SUCCESS, `[${currentChannelIndex.current + 1}/${targetChannelIds.length}] ${channelId} 처리 완료. Drive에 저장되었습니다.`);

            } catch (error: any) {
                addLog(LogStatus.ERROR, `[${currentChannelIndex.current + 1}/${targetChannelIds.length}] ${channelId} 처리 중 오류 발생: ${error.message}`);
            }
        };

        const run = () => {
            if (isPaused || currentChannelIndex.current >= targetChannelIds.length) {
                if (currentChannelIndex.current >= targetChannelIds.length) {
                    addLog(LogStatus.SUCCESS, '=== 모든 채널 처리 완료 ===');
                    setIsProcessing(false);
                }
                if (processingInterval.current) {
                    clearInterval(processingInterval.current);
                    processingInterval.current = null;
                }
                return;
            }

            const channelId = targetChannelIds[currentChannelIndex.current];
            processChannel(channelId).finally(() => {
                currentChannelIndex.current++;
            });
        };
        
        // Start immediately, then set interval
        run();
        processingInterval.current = setInterval(run, 5000); // 5초 간격

    }, [isProcessing, isPaused, targetChannelIds, addLog, youtubeApiKey, selectedFields, appliedFields]);

    useEffect(() => {
        if (isProcessingStarted) {
            handleStartProcess();
        }
    }, [isProcessingStarted, handleStartProcess]);


    const handlePauseProcess = () => {
        if (!isProcessing) return;
        setIsPaused(true);
        if (processingInterval.current) {
            clearInterval(processingInterval.current);
            processingInterval.current = null;
        }
        addLog(LogStatus.WARNING, '프로세스가 일시 중지되었습니다.');
    };
    
    const handleResumeProcess = () => {
        if (!isProcessing || !isPaused) return;
        setIsPaused(false);
        addLog(LogStatus.INFO, '프로세스를 재개합니다.');
        handleStartProcess();
    };

    const handleStopProcess = () => {
        setIsProcessing(false);
        setIsPaused(false);
        if (processingInterval.current) {
            clearInterval(processingInterval.current);
            processingInterval.current = null;
        }
        addLog(LogStatus.ERROR, '프로세스가 사용자에 의해 중지되었습니다.');
    };

    const allStepsComplete = !!user && step2Complete && step3Complete && step4Complete;
    const totalApiFields = apiDataFields.flatMap(group => group.fields).length;
    const totalAppliedFields = appliedDataFields.flatMap(group => group.fields).length;

    // 공용 InfoButton 컴포넌트
    const InfoButton = ({ onClick }: { onClick: () => void }) => (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
        >
            안내 내용
        </button>
    );

    return (
        <div className="min-h-screen container mx-auto p-4 md:p-8 space-y-8">
            <header className="text-center">
                <h1 className="text-4xl font-bold text-white mb-2">YouTube 채널 데이터 추출기</h1>
                <p className="text-slate-400 text-lg">YouTube 채널 데이터를 분석하여 Google Drive에 저장합니다.</p>
            </header>

            {/* Setup Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Auth Section */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-full flex flex-col justify-center">
                    {user ? (
                        <div className="flex items-center gap-4">
                            <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full" />
                            <div className="flex-1">
                                <p className="font-semibold text-white text-lg">{user.name}</p>
                                <p className="text-base text-slate-400">{user.email}</p>
                            </div>
                            <button onClick={handleSignOutClick} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 rounded-lg transition-colors text-base h-12 flex items-center justify-center">
                                로그아웃
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="text-xl font-semibold text-white">Google 계정으로 로그인</h3>
                                <p className="text-slate-300 text-base mt-1">시작하려면 인증 키를 입력하고 로그인하세요.</p>
                            </div>
                            
                            {/* Google 콘솔 섹션 */}
                            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                                <h4 className="text-lg font-medium text-white mb-3">1. Google Console 키</h4>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                        placeholder="Google 클라이언트 ID"
                                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base h-12"
                                    />
                                    <input
                                        type="text"
                                        value={clientSecret}
                                        onChange={(e) => setClientSecret(e.target.value)}
                                        placeholder="클라이언트 보안 비밀"
                                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base h-12"
                                    />
                                    <button onClick={handleLogin} disabled={!gapiScriptLoaded || !clientId.trim()} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-wait text-white font-bold px-4 rounded-lg transition-colors text-lg h-12">
                                        {gapiScriptLoaded ? '구글로그인' : 'API 로딩 중...'}
                                    </button>
                                    {user && (
                                        <div className="text-center mt-2">
                                            <span className="text-green-400 font-medium">✅ 로그인 완료!</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* YouTube API 키 및 Drive 폴더 선택 섹션 */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-full flex flex-col justify-center">
                    <h3 className="text-xl font-semibold text-white mb-4">설정</h3>
                    <div className="space-y-4">
                        {/* YouTube API 키 입력 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">YouTube API 키</label>
                            <input
                                type="text"
                                value={youtubeApiKey}
                                onChange={(e) => setYoutubeApiKey(e.target.value)}
                                placeholder="YouTube API 키"
                                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base h-12"
                            />
                            <button onClick={handleYouTubeApiSubmit} disabled={!youtubeApiKey.trim()} className="w-full mt-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold px-4 rounded-lg transition-colors text-lg h-12">
                                유튜브데이터입력완료
                            </button>
                            {youtubeApiComplete && (
                                <div className="text-center mt-2">
                                    <span className="text-green-400 font-medium">✅ 유튜브 키 완료!</span>
                                </div>
                            )}
                        </div>

                        {/* Drive 폴더 선택 */}
                        {user && (
                            <div>
                                <button 
                                    onClick={handleGoogleDriveImport}
                                    disabled={loadingFolders}
                                    className="w-full px-4 py-2 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition-colors disabled:bg-blue-300"
                                >
                                    {loadingFolders ? '폴더 목록 불러오는 중...' : '📁 Google Drive에서 폴더 선택'}
                                </button>
                                
                                {showFolderSelect && (
                                    <div className="border border-slate-600 bg-slate-700 rounded-lg p-3 max-h-64 overflow-y-auto mt-2">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm font-medium text-slate-300">폴더 선택</span>
                                            <button 
                                                onClick={() => setShowFolderSelect(false)}
                                                className="text-slate-400 hover:text-slate-200"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleFolderSelect(null)}
                                                className="w-full text-left px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-slate-200 transition-colors"
                                            >
                                                📁 루트 폴더
                                            </button>
                                            {folders.map(folder => (
                                                <button
                                                    key={folder.id}
                                                    onClick={() => handleFolderSelect(folder)}
                                                    className="w-full text-left px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-slate-200 transition-colors"
                                                >
                                                    📁 {folder.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {selectedFolder && (
                                    <div className="text-center mt-2">
                                        <span className="text-blue-400 font-medium">📁 선택된 폴더: {selectedFolder.name}</span>
                                    </div>
                                )}
                                {selectedFolder === null && folders.length > 0 && (
                                    <div className="text-center mt-2">
                                        <span className="text-blue-400 font-medium">📁 선택된 폴더: 루트 폴더</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <button onClick={handleResetKeys} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold px-4 rounded-lg transition-colors text-base h-12">
                            모든 키 초기화
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="space-y-8">
                {/* Step 2: Find Channels */}
                <Step
                    stepNumber={2}
                    title="분석 대상 채널 탐색"
                    description="특정 기준(구독자 수, 정렬 순서)에 맞는 채널을 자동으로 탐색하거나, 채널 ID를 수동으로 추가합니다."
                    isComplete={step2Complete}
                >
                    <div className="space-y-6">
                        <div>
                            <label className="block text-base font-medium text-slate-300 mb-2">데이터 수집 모드</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {updateModes.map(mode => (
                                    <button
                                        key={mode.value}
                                        onClick={() => setUpdateMode(mode.value as 'new' | 'existing')}
                                        className={`p-4 text-left rounded-lg border-2 transition-all ${
                                            updateMode === mode.value
                                                ? 'border-blue-500 bg-blue-500/10 text-white'
                                                : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl">{mode.icon}</span>
                                            <span className="font-semibold">{mode.label}</span>
                                        </div>
                                        <p className="text-sm text-slate-400">{mode.description}</p>
                                        {mode.value === 'existing' && existingChannelsCount > 0 && (
                                            <p className="text-xs text-blue-400 mt-1">기존 채널: {existingChannelsCount.toLocaleString()}개</p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-base font-medium text-slate-300 mb-2">최소 구독자 수</label>
                            <div className="flex flex-wrap gap-2">
                                {subscriberTiers.map(tier => (
                                    <button
                                        key={tier.value}
                                        onClick={() => setMinSubscribers(tier.value)}
                                        className={`px-4 py-2 text-base rounded-md transition-colors font-medium ${
                                            minSubscribers === tier.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                        }`}
                                    >
                                        {tier.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-base font-medium text-slate-300 mb-2">정렬 순서</label>
                            <div className="flex flex-wrap gap-2">
                                {sortOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSortOrder(opt.value)}
                                        className={`px-4 py-2 text-base rounded-md transition-colors font-medium ${
                                            sortOrder === opt.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-base font-medium text-slate-300 mb-2">검색 키워드</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    placeholder="예: popular, trending, viral, music..."
                                    className="flex-1 px-4 py-2 rounded-md bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                                />
                                <div className="text-sm text-slate-400">
                                    YouTube 검색에 사용할 키워드
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-base font-medium text-slate-300 mb-2">YouTube 카테고리</label>
                            <div className="flex flex-wrap gap-2">
                                {youtubeCategories.map(category => (
                                    <button
                                        key={category.value}
                                        onClick={() => setSelectedCategory(category.value)}
                                        className={`px-4 py-2 text-base rounded-md transition-colors font-medium ${
                                            selectedCategory === category.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                        }`}
                                    >
                                        {category.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-base font-medium text-slate-300 mb-2">수집할 채널 개수</label>
                            <div className="flex flex-wrap gap-2">
                                {channelCountOptions.map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => setChannelCount(option.value)}
                                        className={`px-4 py-2 text-base rounded-md transition-colors font-medium ${
                                            channelCount === option.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleFindChannels}
                            disabled={!user || isFinding}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-bold px-4 rounded-lg transition-colors flex items-center justify-center text-lg h-[50px]"
                        >
                            {isFinding ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {updateMode === 'existing' ? '기존 채널 확인 중...' : '신규 채널 탐색 중...'}
                                </>
                            ) : (
                                updateMode === 'existing' 
                                    ? `🔄 기존 ${existingChannelsCount}개 채널 선택` 
                                    : '🔍 신규 채널 탐색 시작'
                            )}
                        </button>
                    </div>
                </Step>
                
                {/* Step 3: Confirm Target Channels */}
                <Step
                    stepNumber={3}
                    title="직접 채널 입력"
                    description="탐색된 채널 목록을 확인하고, 원하는 채널의 @핸들을 직접 입력하여 추가하거나 제거할 수 있습니다."
                    isComplete={step3Complete}
                    collapsible={true}
                    isOpen={isStep3Open}
                    onToggle={() => setIsStep3Open(!isStep3Open)}
                >
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                value={manualChannelHandle}
                                onChange={(e) => setManualChannelHandle(e.target.value)}
                                placeholder="채널 @핸들 입력 (예: @MrBeast)"
                                className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            />
                            <button 
                                onClick={handleAddChannelByHandle} 
                                disabled={isAddingChannel}
                                className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center disabled:bg-slate-500 disabled:cursor-not-allowed"
                            >
                                {isAddingChannel ? (
                                     <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        추가 중...
                                    </>
                                ) : '수동 추가'}
                            </button>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-md border border-slate-700">
                            {targetChannelIds.length > 0 ? (
                                targetChannelIds.map(id => (
                                    <div key={id} className="flex items-center justify-between p-2 hover:bg-slate-700/50 rounded">
                                        <span className="font-mono text-base text-slate-300">{id}</span>
                                        <button onClick={() => handleRemoveChannel(id)} className="text-red-400 hover:text-red-300 text-base font-bold h-[50px] flex items-center justify-center">제거</button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-center text-base py-4">처리할 채널이 없습니다.</p>
                            )}
                        </div>
                        <p className="text-base text-slate-400">총 {targetChannelIds.length}개 채널 선택됨</p>
                        <button
                            onClick={handleConfirmTargetChannels}
                            disabled={step3Complete || targetChannelIds.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center"
                        >
                           {step3Complete ? '대상 확정 완료' : '이 채널들로 확정'}
                        </button>
                    </div>
                </Step>

                {/* Step 4: Select Data Fields */}
                 <Step
                    stepNumber={4}
                    title="추출할 데이터 필드 선택"
                    description="저장할 데이터 필드를 선택합니다. API 사용량과 처리 시간을 고려하여 신중하게 선택하세요."
                    isComplete={step4Complete}
                >
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold text-slate-100 mb-3 border-b border-slate-600 pb-2">
                                YouTube API 제공 데이터 <span className="text-base font-normal text-slate-400 ml-2">({selectedFields.size} / {totalApiFields})</span>
                            </h3>
                            
                            {/* 프리셋 선택 버튼들 */}
                            <div className="mb-4 p-3 bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium text-slate-300 mb-2">빠른 선택 프리셋</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            const preset1Fields = new Set([
                                                'title', 'publishedAt', 'country', 'customUrl', 'thumbnailDefault',
                                                'subscriberCount', 'videoCount', 'viewCount', 'topicCategories', 'uploadsPlaylistId'
                                            ]);
                                            setSelectedFields(preset1Fields);
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors font-medium"
                                    >
                                        옵션값 1 (10개 필드)
                                    </button>
                                    <button
                                        onClick={() => setSelectedFields(new Set())}
                                        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-md transition-colors"
                                    >
                                        전체 해제
                                    </button>
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                    옵션값 1: 채널제목, 개설일, 국가, 지정URL, 프로필아이콘88×88, 구독자수, 총영상수, 총조회수, 토픽카테고리, 업로드플레이리스트ID
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {apiDataFields.flatMap(group => group.fields).map(field => (
                                    <label key={`basic-${field.id}`} className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors h-[120px] ${selectedFields.has(field.id) ? 'bg-slate-700' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedFields.has(field.id)}
                                            onChange={() => handleFieldChange(field.id, 'basic')}
                                            className="mt-1 flex-shrink-0 h-4 w-4 rounded border-slate-500 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="text-base text-slate-300 font-medium">{field.label}</span>
                                            <p className={`text-sm text-sky-300/80 mt-1 font-mono break-all ${field.id === 'viralIndex' ? 'whitespace-pre-line' : ''}`}>
                                                {field.id} = {field.id === 'viralIndex' ? field.example : JSON.stringify(field.example)}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold text-slate-100 mb-3 border-b border-slate-600 pb-2">
                                응용 데이터 (가공) <span className="text-base font-normal text-slate-400 ml-2">({appliedFields.size} / {totalAppliedFields})</span>
                            </h3>
                            <p className="text-base text-slate-400 mb-4">API로부터 수집된 기본 데이터를 바탕으로 계산되는 2차 지표입니다.</p>
                            
                            <div className="flex flex-wrap gap-2 mb-4">
                                <button
                                    onClick={() => {
                                        const allAppliedFieldIds = appliedDataFields.flatMap(group => group.fields.map(f => f.id));
                                        setAppliedFields(new Set(allAppliedFieldIds));
                                    }}
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors font-medium"
                                >
                                    응용데이터 전체 선택 (17개)
                                </button>
                                <button
                                    onClick={() => setAppliedFields(new Set())}
                                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-md transition-colors"
                                >
                                    전체 해제
                                </button>
                            </div>
                            <div className="space-y-4">
                                {appliedDataFields.map(group => (
                                    <div key={group.group}>
                                        <h4 className="text-lg font-semibold text-slate-200 mb-2">{group.group}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {group.fields.map(field => (
                                                <label 
                                                    key={`applied-${field.id}`} 
                                                    className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors h-[180px] ${
                                                        field.id === 'viralIndex' ? 'md:col-span-2 lg:col-span-3' : ''
                                                    } ${appliedFields.has(field.id) ? 'bg-slate-700' : 'bg-slate-700/50 hover:bg-slate-700'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={appliedFields.has(field.id)}
                                                        onChange={() => handleFieldChange(field.id, 'applied')}
                                                        className="mt-1 flex-shrink-0 h-4 w-4 rounded border-slate-500 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base text-slate-300 font-medium">{field.label}</span>
                                                            {field.id === 'viralIndex' && (
                                                                <InfoButton onClick={() => setShowViralIndexModal(true)} />
                                                            )}
                                                            {field.id === 'shortsCount' && (
                                                                <InfoButton onClick={() => setShowShortsCountModal(true)} />
                                                            )}
                                                            {field.id === 'longformCount' && (
                                                                <InfoButton onClick={() => setShowLongformCountModal(true)} />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-400 mt-1 font-mono">{field.formula}</p>
                                                        <p className={`text-sm text-sky-300/80 mt-1 font-mono ${field.id === 'viralIndex' ? 'whitespace-pre-line' : ''}`}>
                                                            {field.id} = {field.id === 'viralIndex' ? field.example : JSON.stringify(field.example)}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <button
                                onClick={handleShowExample}
                                disabled={step4Complete}
                                className="w-full bg-slate-600 hover:bg-slate-700 disabled:bg-slate-600/50 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center"
                            >
                               랜덤으로 예시 뽑기
                            </button>
                            <button
                                onClick={handleConfirmFieldsAndProcess}
                                disabled={step4Complete || selectedFields.size === 0}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center"
                            >
                            {step4Complete ? '필드 선택 완료' : '이 필드로 확정하고 처리 시작'}
                            </button>
                        </div>
                    </div>
                </Step>
                
                {/* Step 5: Process and Log */}
                 {(isProcessingStarted || allStepsComplete) && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-white mb-4">실행 및 로그</h3>
                        <div className="flex gap-4 mb-4">
                            {!isProcessing ? (
                                <button onClick={handleStartProcess} disabled={!allStepsComplete} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center">
                                    처리 시작
                                </button>
                            ) : (
                                <>
                                    {isPaused ? (
                                        <button onClick={handleResumeProcess} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center">
                                            재개
                                        </button>
                                    ) : (
                                        <button onClick={handlePauseProcess} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center">
                                            일시정지
                                        </button>
                                    )}
                                    <button onClick={handleStopProcess} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center">
                                        중지
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="bg-slate-900/50 rounded-md p-2 h-96 overflow-y-auto border border-slate-700 flex flex-col-reverse">
                            <div>
                                {logs.map((log) => <LogItem key={log.id} log={log} />)}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Example JSON Modal */}
            {showExampleModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowExampleModal(false)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-semibold text-white">
                                JSON 결과 예시 
                                <span className="ml-2 text-sm text-sky-400 font-normal">
                                    (~{Math.ceil(new Blob([exampleJson]).size / 1024)}KB)
                                </span>
                            </h3>
                             <button onClick={() => setShowExampleModal(false)} className="text-slate-400 hover:text-white">&times;</button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <pre className="text-sm bg-slate-900/50 p-4 rounded-md text-sky-300 whitespace-pre-wrap break-all">
                                <code>
                                    {exampleJson}
                                </code>
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Viral Index Info Modal */}
            {showViralIndexModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowViralIndexModal(false)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">🌟 바이럴 지수 완전 가이드</h3>
                            <button onClick={() => setShowViralIndexModal(false)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-blue-400 mb-2">📊 공식</h4>
                                <p className="text-slate-200 font-mono text-lg">
                                    바이럴 지수 = (구독전환율 × 100) + (영상당평균조회수 ÷ 1,000,000)
                                </p>
                            </div>
                            
                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-green-400 mb-3">🔍 구성 요소 분해</h4>
                                <div className="space-y-2 text-slate-200">
                                    <p><span className="text-yellow-400 font-semibold">전환 성능:</span> 구독전환율 × 100</p>
                                    <p><span className="text-purple-400 font-semibold">조회 파워:</span> 영상당평균조회수 ÷ 1,000,000</p>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-orange-400 mb-3">🌟 실제 예시 (미스터비스트)</h4>
                                <div className="space-y-2 text-slate-200">
                                    <p>• 구독자: 4억 3천만 명</p>
                                    <p>• 총조회수: 940억 8천만 회</p>
                                    <p>• 영상 개수: 897개</p>
                                    <hr className="border-slate-600 my-3"/>
                                    <p><span className="text-yellow-400">전환 성능:</span> (4.3억 ÷ 940.8억) × 100 = 45.7점</p>
                                    <p><span className="text-purple-400">조회 파워:</span> (940.8억 ÷ 897) ÷ 100만 = 104.8점</p>
                                    <p className="text-green-400 font-bold text-lg">→ 바이럴 지수: 150.5점</p>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-cyan-400 mb-3">📈 등급 기준</h4>
                                <div className="grid grid-cols-2 gap-3 text-slate-200">
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="text-red-400 font-bold">30점 미만</p>
                                        <p className="text-sm">일반 채널</p>
                                    </div>
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="text-yellow-400 font-bold">50~100점</p>
                                        <p className="text-sm">인기 채널</p>
                                    </div>
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="text-green-400 font-bold">100~200점</p>
                                        <p className="text-sm">메가 채널</p>
                                    </div>
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="text-purple-400 font-bold">200점 이상</p>
                                        <p className="text-sm">전설급 바이럴</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-white mb-2">💡 해석 방법</h4>
                                <div className="space-y-2 text-slate-200">
                                    <p><span className="text-blue-400 font-semibold">전환력:</span> 1000명이 영상을 보면 몇 명이 구독하는가?</p>
                                    <p><span className="text-purple-400 font-semibold">조회력:</span> 영상 1개당 얼마나 많은 조회수를 얻는가?</p>
                                    <p className="text-green-400 font-medium">→ 높을수록 바이럴 잠재력이 뛰어남!</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Shorts Count Info Modal */}
            {showShortsCountModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowShortsCountModal(false)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">📺 숏폼 갯수 API 할당량 가이드</h3>
                            <button onClick={() => setShowShortsCountModal(false)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-gradient-to-r from-blue-600/20 to-green-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-white mb-2">📊 처리 과정 Overview</h4>
                                <p className="text-slate-200">
                                    숏폼 갯수 계산은 각 영상의 길이를 개별 확인해야 하므로 추가 API 호출이 필요합니다. 
                                    1000개 영상 제한으로 API 할당량을 효율적으로 관리합니다.
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-700/50 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-blue-400 mb-3">🎬 1단계: PlaylistItems API</h4>
                                    <div className="space-y-2 text-slate-200">
                                        <p><span className="font-semibold">API:</span> playlistItems.list</p>
                                        <p><span className="font-semibold">목적:</span> 영상 ID 목록 수집</p>
                                        <p><span className="font-semibold">배치:</span> 50개씩 처리</p>
                                        <p><span className="font-semibold">제한:</span> 최신 1000개 영상</p>
                                        <hr className="border-slate-600 my-3"/>
                                        <p><span className="text-green-400 font-semibold">호출 횟수:</span> 1000 ÷ 50 = 20회</p>
                                        <p><span className="text-green-400 font-semibold">할당량:</span> 20 units</p>
                                    </div>
                                </div>

                                <div className="bg-slate-700/50 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-purple-400 mb-3">⏱️ 2단계: Videos API</h4>
                                    <div className="space-y-2 text-slate-200">
                                        <p><span className="font-semibold">API:</span> videos.list</p>
                                        <p><span className="font-semibold">목적:</span> 영상 길이 정보 조회</p>
                                        <p><span className="font-semibold">배치:</span> 50개씩 처리</p>
                                        <p><span className="font-semibold">파트:</span> contentDetails</p>
                                        <hr className="border-slate-600 my-3"/>
                                        <p><span className="text-green-400 font-semibold">호출 횟수:</span> 1000 ÷ 50 = 20회</p>
                                        <p><span className="text-green-400 font-semibold">할당량:</span> 20 units</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-green-600/20 to-cyan-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-white mb-3">💰 총 할당량 계산</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="text-2xl font-bold text-blue-400">20</p>
                                        <p className="text-sm text-slate-300">PlaylistItems</p>
                                    </div>
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="text-2xl font-bold text-purple-400">20</p>
                                        <p className="text-sm text-slate-300">Videos</p>
                                    </div>
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="text-3xl font-bold text-green-400">40</p>
                                        <p className="text-sm text-slate-300">총 units</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-orange-400 mb-3">⚡ 1000개 제한의 이유</h4>
                                <div className="space-y-2 text-slate-200">
                                    <p><span className="text-yellow-400 font-semibold">• API 할당량 절약:</span> 대형 채널(10만+ 영상)도 최대 40 units로 제한</p>
                                    <p><span className="text-cyan-400 font-semibold">• 최신 트렌드 반영:</span> 숏폼은 주로 최근에 제작되므로 충분한 데이터</p>
                                    <p><span className="text-green-400 font-semibold">• 처리 속도 향상:</span> 예측 가능한 처리 시간</p>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-red-400 mb-3">📈 할당량 비교</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-600">
                                            <tr>
                                                <th className="p-2 text-left">영상 수</th>
                                                <th className="p-2 text-center">제한 없음</th>
                                                <th className="p-2 text-center">1000개 제한</th>
                                                <th className="p-2 text-center">절약량</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-200">
                                            <tr className="border-b border-slate-600">
                                                <td className="p-2">897개 (미스터비스트)</td>
                                                <td className="p-2 text-center">36 units</td>
                                                <td className="p-2 text-center">40 units</td>
                                                <td className="p-2 text-center text-red-400">-4 units</td>
                                            </tr>
                                            <tr className="border-b border-slate-600">
                                                <td className="p-2">5,000개 (대형 채널)</td>
                                                <td className="p-2 text-center">200 units</td>
                                                <td className="p-2 text-center">40 units</td>
                                                <td className="p-2 text-center text-green-400">160 units 절약</td>
                                            </tr>
                                            <tr>
                                                <td className="p-2">50,000개 (메가 채널)</td>
                                                <td className="p-2 text-center">2,000 units</td>
                                                <td className="p-2 text-center">40 units</td>
                                                <td className="p-2 text-center text-green-400">1,960 units 절약</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Longform Count Info Modal */}
            {showLongformCountModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowLongformCountModal(false)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">📹 롱폼 갯수 계산 가이드</h3>
                            <button onClick={() => setShowLongformCountModal(false)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-white mb-2">🎯 핵심 개념</h4>
                                <p className="text-slate-200">
                                    롱폼 갯수는 분석된 영상 범위 내에서만 계산됩니다. 
                                    숏폼 분석이 1000개 제한이므로, 롱폼도 동일한 범위에서 계산해야 수학적으로 정확합니다.
                                </p>
                            </div>
                            
                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-blue-400 mb-3">📊 공식 설명</h4>
                                <div className="space-y-3">
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="font-mono text-lg text-green-400 mb-2">
                                            롱폼 갯수 = MIN(총영상수, 1000) - 숏폼갯수
                                        </p>
                                        <p className="text-slate-300 text-sm">
                                            분석 범위 내 영상 수에서 숏폼을 제외한 나머지
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-orange-400 mb-3">🔍 계산 과정</h4>
                                <div className="space-y-4">
                                    <div>
                                        <h5 className="font-semibold text-cyan-400 mb-2">1단계: 분석 대상 영상 수 결정</h5>
                                        <div className="bg-slate-600 rounded p-3 space-y-1 text-sm">
                                            <p>• 총 영상 ≤ 1000개: 전체 영상 분석</p>
                                            <p>• 총 영상 &gt; 1000개: 최신 1000개만 분석</p>
                                            <p className="text-green-400">→ 분석대상 = MIN(총영상수, 1000)</p>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h5 className="font-semibold text-purple-400 mb-2">2단계: 숏폼 갯수 계산</h5>
                                        <div className="bg-slate-600 rounded p-3 text-sm">
                                            <p>분석 대상 영상들 중 60초 이하 영상 카운트</p>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h5 className="font-semibold text-red-400 mb-2">3단계: 롱폼 갯수 계산</h5>
                                        <div className="bg-slate-600 rounded p-3 text-sm">
                                            <p>분석대상 - 숏폼갯수 = 롱폼갯수</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-green-400 mb-3">📈 실제 사례</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="font-semibold text-blue-400 mb-2">미스터비스트 (897개)</p>
                                        <div className="text-sm space-y-1">
                                            <p>• 총 영상: 897개</p>
                                            <p>• 분석 대상: MIN(897, 1000) = 897개</p>
                                            <p>• 숏폼: 25개</p>
                                            <p className="text-green-400">• 롱폼: 897 - 25 = 872개</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-600 rounded p-3">
                                        <p className="font-semibold text-purple-400 mb-2">대형 채널 (5000개)</p>
                                        <div className="text-sm space-y-1">
                                            <p>• 총 영상: 5000개</p>
                                            <p>• 분석 대상: MIN(5000, 1000) = 1000개</p>
                                            <p>• 숏폼: 150개</p>
                                            <p className="text-green-400">• 롱폼: 1000 - 150 = 850개</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-white mb-2">⚠️ 주의사항</h4>
                                <div className="space-y-2 text-slate-200">
                                    <p><span className="text-red-400 font-semibold">• 전체 롱폼이 아님:</span> 분석된 범위 내의 롱폼만 표시</p>
                                    <p><span className="text-orange-400 font-semibold">• 1000개 제한:</span> 대형 채널의 경우 최신 영상만 반영</p>
                                    <p><span className="text-yellow-400 font-semibold">• 상대적 지표:</span> 같은 분석 범위에서 비교해야 의미 있음</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
