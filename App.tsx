
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { ChannelData, DriveFile, LogEntry, LogStatus, Snapshot } from './types';
import { fetchSelectedChannelData, findChannelsImproved, fetchShortsCount, fetchChannelIdByHandle } from './services/youtubeService';
import { findFileByName, getFileContent, createJsonFile, updateJsonFile, listFolders, updateOrCreateChannelFile, getOrCreateChannelIndex, getExistingChannelIds } from './services/driveService';
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
      { id: 'channelUrl', label: '채널 URL', example: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA' },
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

// 응용 데이터 필드 축약 매핑
const getShortKey = (fieldId: string): string => {
    const mapping: { [key: string]: string } = {
        // Growth Metrics (g로 시작)
        'averageViewsPerVideo': 'gavg',
        'subscribersPerVideo': 'gsub', 
        'viewsPerSubscriber': 'gvps',
        'channelAgeInDays': 'gage',
        'uploadsPerWeek': 'gupw',
        'subsGainedPerDay': 'gspd',
        'viewsGainedPerDay': 'gvpd',
        'subsGainedPerMonth': 'gspm',
        'subsGainedPerYear': 'gspy',
        // 'subscriberToViewRatioPercent': 'gsvr', // 제거됨 - gsub와 중복
        'viralIndex': 'gvir',
        // Content Analysis (c로 시작)
        'shortsCount': 'csct',
        'longformCount': 'clct',
        'totalShortsDuration': 'csdr',
        // View Analysis (v로 시작)
        'estimatedShortsViews': 'vesv',
        'shortsViewsPercentage': 'vsvp',
        'estimatedLongformViews': 'velv',
        'longformViewsPercentage': 'vlvp'
    };
    return mapping[fieldId] || fieldId;
};

// 예시용 응용 데이터 계산 함수 (실제 calculateAndAddAppliedData와 동일한 로직)
const calculateMockAppliedData = (fieldId: string, mockStats: any): number => {
    const subscriberCount = parseInt(mockStats.subscriberCount, 10);
    const viewCount = parseInt(mockStats.viewCount, 10);
    const videoCount = parseInt(mockStats.videoCount, 10);
    const publishedAt = mockStats.publishedAt;
    
    // 채널 나이 계산
    const channelAgeDays = Math.floor((new Date().getTime() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24));
    
    // 모의 숏폼 데이터
    const mockShortsData = {
        shortsCount: 25,
        totalShortsViews: 3200000000
    };

    switch (fieldId) {
        case 'averageViewsPerVideo':
            return Math.round(viewCount / videoCount);
        case 'subscribersPerVideo':
            return parseFloat(((subscriberCount / viewCount) * 100).toFixed(4));
        case 'viewsPerSubscriber':
            return parseFloat(((viewCount / subscriberCount) * 100).toFixed(2));
        case 'channelAgeInDays':
            return channelAgeDays;
        case 'uploadsPerWeek':
            return parseFloat((videoCount / (channelAgeDays / 7)).toFixed(2));
        case 'subsGainedPerDay':
            return Math.round(subscriberCount / channelAgeDays);
        case 'viewsGainedPerDay':
            return Math.round(viewCount / channelAgeDays);
        case 'subsGainedPerMonth':
            return Math.round((subscriberCount / channelAgeDays) * 30.44);
        case 'subsGainedPerYear':
            return Math.round((subscriberCount / channelAgeDays) * 365.25);
        // case 'subscriberToViewRatioPercent': // 제거됨 - gsub와 중복
        //     return parseFloat(((subscriberCount / viewCount) * 100).toFixed(4));
        case 'viralIndex':
            const subRate = (subscriberCount / viewCount) * 100;
            const avgViews = viewCount / videoCount;
            return parseFloat((subRate * 100 + avgViews / 1000000).toFixed(1));
        case 'shortsCount':
            return mockShortsData.shortsCount;
        case 'longformCount':
            return Math.min(videoCount, 1000) - mockShortsData.shortsCount;
        case 'totalShortsDuration':
            return mockShortsData.shortsCount * 60;
        case 'estimatedShortsViews':
            return mockShortsData.totalShortsViews;
        case 'shortsViewsPercentage':
            return parseFloat(((mockShortsData.totalShortsViews / viewCount) * 100).toFixed(2));
        case 'estimatedLongformViews':
            return Math.max(0, viewCount - mockShortsData.totalShortsViews);
        case 'longformViewsPercentage':
            const longformViews = Math.max(0, viewCount - mockShortsData.totalShortsViews);
            return parseFloat(((longformViews / viewCount) * 100).toFixed(2));
        default:
            return 0;
    }
};

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

    const [youtubeApiKey, setYoutubeApiKey] = useState(() => localStorage.getItem('YT_API_KEY') || '');
    const [youtubeApiComplete, setYoutubeApiComplete] = useState(() => !!localStorage.getItem('YT_API_KEY'));
    
    const [selectedFolder, setSelectedFolder] = useState<DriveFile | null>(null);
    const [folders, setFolders] = useState<DriveFile[]>([]);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [showFolderSelect, setShowFolderSelect] = useState(false);
    const [driveFolderId, setDriveFolderId] = useState<string>(() => localStorage.getItem('DRIVE_FOLDER_ID') || '');

    const [step2Complete, setStep2Complete] = useState(false);
    const [minSubscribers, setMinSubscribers] = useState('1000000000');
    const [sortOrder, setSortOrder] = useState<'viewCount' | 'videoCount_asc'>('viewCount');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [channelCount, setChannelCount] = useState<number>(50);
    const [updateMode, setUpdateMode] = useState<'new' | 'existing'>('new');
    const [existingChannelsCount, setExistingChannelsCount] = useState<number>(0);
    const [isFinding, setIsFinding] = useState(false);
    const [foundChannels, setFoundChannels] = useState<string[]>([]);
    
    const [step3Complete, setStep3Complete] = useState(false);
    const [targetChannelIds, setTargetChannelIds] = useState<string[]>([]);
    const [manualChannelHandle, setManualChannelHandle] = useState('');
    const [isAddingChannel, setIsAddingChannel] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('popular');

    // 2번/3번 블럭 토글 상태 (기본적으로 2번 블럭이 활성화)
    const [activeChannelMethod, setActiveChannelMethod] = useState<'search' | 'manual'>('search');

    // Danbi CSV 배치 처리를 위한 상태들
    const [danbiProgress, setDanbiProgress] = useState({ complete: 0, total: 35446, lastUpdated: null, comments: '' });
    const [isDanbiBatchRunning, setIsDanbiBatchRunning] = useState(false);
    const [danbiCsvData, setDanbiCsvData] = useState<any[]>([]);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [lastChannelId, setLastChannelId] = useState<string>('');
    const [isProcessingCsv, setIsProcessingCsv] = useState(false);
    const [updatedCompleteJson, setUpdatedCompleteJson] = useState<string | null>(null);
    const [isDanbiMode, setIsDanbiMode] = useState(false);
    const [isDanbiAnalyzing, setIsDanbiAnalyzing] = useState(false);
    const [danbiStartIndex, setDanbiStartIndex] = useState(0);

    const [step4Complete, setStep4Complete] = useState(false);
    
    // 진행상황 추적 상태
    const [processingProgress, setProcessingProgress] = useState({
        currentIndex: 0,
        totalCount: 0,
        currentChannelName: '',
        currentStep: '',
        isActive: false
    });
    // 디폴트로 "옵션값 1" 11개 필드 모두 선택 (채널제목, 개설일, 국가, 지정URL, 채널URL, 프로필아이콘88×88, 구독자수, 총영상수, 총조회수, 토픽카테고리, 업로드플레이리스트ID)
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set([
        'title',              // 채널제목
        'publishedAt',        // 개설일
        'country',           // 국가
        'customUrl',         // 지정URL
        'channelUrl',        // 채널URL
        'thumbnailDefault',  // 프로필아이콘 (88×88)
        'subscriberCount',   // 구독자수
        'videoCount',        // 총영상수
        'viewCount',         // 총조회수
        'topicCategories',   // 토픽카테고리
        'uploadsPlaylistId'  // 업로드플레이리스트ID
    ]));
    // 디폴트로 응용데이터 17개 모두 선택
    const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set([
        // 성장 지표 (추정) - 10개
        'averageViewsPerVideo',      // 1. 영상당 평균 조회수 (기본 선택)
        'subscribersPerVideo',       // 2. 구독 전환율 (%)
        'viewsPerSubscriber',        // 3. 구독자 대비 조회수 (%)
        'channelAgeInDays',         // 4. 채널 운영 기간 (일)
        'uploadsPerWeek',           // 5. 주당 평균 업로드 수
        'subsGainedPerDay',         // 6. 일일 평균 구독자 증가
        'viewsGainedPerDay',        // 7. 일일 평균 조회수 증가
        'subsGainedPerMonth',       // 8. 월간 평균 구독자 증가
        'subsGainedPerYear',        // 9. 연간 평균 구독자 증가
        // 'subscriberToViewRatioPercent', // 제거됨 - gsub와 중복
        'viralIndex',               // 11. 바이럴 지수
        // 콘텐츠 분석 - 3개
        'shortsCount',              // 12. 숏폼 갯수
        'longformCount',            // 13. 롱폼 갯수
        'totalShortsDuration',      // 14. 숏폼 총 영상 길이 (추정)
        // 조회수 분석 (추정) - 4개
        'estimatedShortsViews',     // 15. 숏폼 총 조회수 (실제)
        'shortsViewsPercentage',    // 16. 숏폼 조회수 비중 (%)
        'estimatedLongformViews',   // 17. 롱폼 총 조회수 (실제)
        'longformViewsPercentage'   // 18. 롱폼 조회수 비중 (%)
    ]));
    const [showExampleModal, setShowExampleModal] = useState(false);
    const [exampleJson, setExampleJson] = useState('');
    const [showViralIndexModal, setShowViralIndexModal] = useState(false);
    const [showShortsCountModal, setShowShortsCountModal] = useState(false);
    const [showLongformCountModal, setShowLongformCountModal] = useState(false);
    const [showShortsViewsModal, setShowShortsViewsModal] = useState(false);
    const [showFieldMappingModal, setShowFieldMappingModal] = useState(false);
    const [isProcessingStarted, setIsProcessingStarted] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    // FIX: Changed NodeJS.Timeout to number, as setInterval in browser environments returns a number, not a NodeJS.Timeout object.
    const processingInterval = useRef<number | null>(null);
    const currentChannelIndex = useRef(0);
    const [isPaused, setIsPaused] = useState(false);

    const addLog = useCallback((status: LogStatus, message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setLogs(prev => [{ id: uniqueId, status, message, timestamp }, ...prev]);
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

    // Danbi CSV 파일 및 진행상황 로드
    useEffect(() => {
        const loadDanbiData = async () => {
            try {
                // CSV 파일 로드
                const csvResponse = await fetch('./danbi_channels.csv');
                const csvText = await csvResponse.text();
                const lines = csvText.trim().split('\n');
                const headers = lines[0].split(',');
                const data = lines.slice(1).map(line => {
                    const values = line.split(',');
                    return {
                        channel_name: values[0],
                        profile_url: values[1],
                        source_url: values[2]
                    };
                });
                setDanbiCsvData(data);
                
                // 진행상황 파일 로드
                try {
                    const progressResponse = await fetch('./danbi_complete.json');
                    const progressData = await progressResponse.json();
                    setDanbiProgress(progressData);
                } catch (error) {
                    console.log('danbi_complete.json이 없거나 읽을 수 없습니다. 기본값 사용.');
                    setDanbiProgress({ complete: 0, total: data.length, lastUpdated: null, comments: '0까지 완료되었음. 1부터 시작' });
                }
            } catch (error) {
                console.error('Danbi CSV 로드 실패:', error);
                addLog(LogStatus.ERROR, 'danbi_channels.csv 파일을 로드할 수 없습니다.');
            }
        };
        
        if (updateMode === 'danbi_batch') {
            loadDanbiData();
        }
    }, [updateMode, addLog]);



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
        if (!youtubeApiKey) {
            addLog(LogStatus.ERROR, 'YouTube API 키를 설정해야 채널을 탐색할 수 있습니다.');
            return;
        }
        setIsFinding(true);
        const categoryLabel = youtubeCategories.find(cat => cat.value === selectedCategory)?.label || '전체 카테고리';
        
        try {
            if (updateMode === 'existing') {
                // 기존 채널 업데이트 모드
                addLog(LogStatus.PENDING, `기존 채널 확인 중... (${existingChannelsCount}개)`);
                const ids = await getExistingChannelIds(driveFolderId);
                if (ids.length === 0) {
                    addLog(LogStatus.WARNING, '기존 채널이 없습니다. 신규 데이터 수집 모드로 전환해주세요.');
                    return;
                }
                setFoundChannels(ids);
                setTargetChannelIds(prev => {
                    const newIds = [...new Set([...prev, ...ids])];
                    // 채널이 설정되면 자동으로 3단계도 완료 처리
                    if (newIds.length > 0) {
                        setStep3Complete(true);
                    }
                    return newIds;
                });
                setStep2Complete(true);
                addLog(LogStatus.SUCCESS, `✅ ${ids.length}개의 기존 채널을 대상으로 설정했습니다.`);
            } else {
                // 신규 채널 수집 모드
                addLog(LogStatus.PENDING, `🔍 신규 채널 탐색 중... (구독자 ${parseInt(minSubscribers).toLocaleString()}명 이하, ${sortOptions.find(o => o.value === sortOrder)?.label} 정렬, ${categoryLabel})`);
                
                const existingIds = await getExistingChannelIds(driveFolderId);
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
                setTargetChannelIds(prev => {
                    const newIds = [...new Set([...prev, ...ids])];
                    // 채널이 설정되면 자동으로 3단계도 완료 처리
                    if (newIds.length > 0) {
                        setStep3Complete(true);
                    }
                    return newIds;
                });
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
        const trimmedInput = manualChannelHandle.trim();
        if (!trimmedInput) return;

        if (!youtubeApiKey) {
            addLog(LogStatus.ERROR, 'YouTube API 키를 설정해야 채널을 추가할 수 있습니다.');
            return;
        }

        setIsAddingChannel(true);
        
        try {
            // 콤마로 구분된 여러 핸들 처리
            const handles = trimmedInput.split(',').map(handle => handle.trim()).filter(handle => handle.length > 0);
            
            if (handles.length === 1) {
                addLog(LogStatus.PENDING, `'${handles[0]}' 핸들을 채널 ID로 변환 중...`);
            } else {
                addLog(LogStatus.PENDING, `${handles.length}개의 핸들을 채널 ID로 변환 중: ${handles.join(', ')}`);
            }

            let successCount = 0;
            let errorCount = 0;
            
            for (const handle of handles) {
                try {
                    const channelId = await fetchChannelIdByHandle(handle, youtubeApiKey);
                    if (!targetChannelIds.includes(channelId)) {
                        setTargetChannelIds(prev => {
                            const newIds = [channelId, ...prev];
                            // 채널이 추가되면 자동으로 3단계 완료 처리
                            if (!step3Complete && newIds.length > 0) {
                                setStep3Complete(true);
                            }
                            return newIds;
                        });
                        addLog(LogStatus.SUCCESS, `✅ 채널 추가 성공: ${handle} → ${channelId}`);
                        successCount++;
                    } else {
                        addLog(LogStatus.WARNING, `⚠️ 채널 '${handle}' (${channelId})는 이미 목록에 존재합니다.`);
                    }
                } catch (error: any) {
                    addLog(LogStatus.ERROR, `❌ 채널 '${handle}' 추가 실패: ${error.message}`);
                    errorCount++;
                }
            }
            
            // 최종 결과 요약
            if (handles.length > 1) {
                if (errorCount === 0) {
                    addLog(LogStatus.SUCCESS, `🎉 모든 채널 처리 완료: ${successCount}개 성공`);
                } else {
                    addLog(LogStatus.WARNING, `⚡ 채널 처리 완료: ${successCount}개 성공, ${errorCount}개 실패`);
                }
            }
        } catch (error: any) {
            addLog(LogStatus.ERROR, `채널 추가 중 오류 발생: ${error.message}`);
        } finally {
            setManualChannelHandle('');
            setIsAddingChannel(false);
        }
    };
    
    const handleRemoveChannel = (idToRemove: string) => {
        setTargetChannelIds(prev => {
            const newIds = prev.filter(id => id !== idToRemove);
            // 모든 채널이 제거되면 3단계 완료 상태 해제
            if (newIds.length === 0 && step3Complete) {
                setStep3Complete(false);
            }
            return newIds;
        });
    };

    // CSV 파일 처리 함수
    const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setCsvFile(file);
        
        try {
            const text = await file.text();
            const lines = text.trim().split('\n');
            
            // 헤더 제거하고 데이터 파싱
            const channels = lines.slice(1).map((line, index) => {
                const [channel_name, profile_url, source_url] = line.split(',');
                
                // URL에서 채널 ID 추출
                const urlParts = profile_url?.split('/') || [];
                const channelId = urlParts[urlParts.length - 1];
                
                return {
                    index: index + 1,
                    channel_name: channel_name?.trim() || '',
                    profile_url: profile_url?.trim() || '',
                    source_url: source_url?.trim() || '',
                    channelId: channelId?.trim() || ''
                };
            }).filter(channel => channel.channelId); // 유효한 채널 ID가 있는 것만

            setDanbiCsvData(channels);
            addLog(LogStatus.SUCCESS, `📂 CSV 파일 로드 완료: ${channels.length}개 채널 (${file.name})`);

        } catch (error) {
            addLog(LogStatus.ERROR, `CSV 파일 처리 오류: ${error.message}`);
        }
    };

    // 채널 ID로 CSV에서 위치 찾기 함수
    const handleFindChannelPosition = async () => {
        if (!lastChannelId.trim()) {
            addLog(LogStatus.ERROR, '채널 ID를 입력해주세요.');
            return;
        }

        if (danbiCsvData.length === 0) {
            addLog(LogStatus.ERROR, 'CSV 파일을 먼저 업로드해주세요.');
            return;
        }

        setIsProcessingCsv(true);
        addLog(LogStatus.PENDING, `🔍 채널 ID "${lastChannelId}"를 CSV에서 검색 중...`);

        try {
            // CSV 데이터에서 채널 ID 찾기
            const channelIndex = danbiCsvData.findIndex(channel => 
                channel.channelId === lastChannelId || 
                channel.profile_url.includes(lastChannelId)
            );

            if (channelIndex === -1) {
                addLog(LogStatus.ERROR, `❌ 채널 ID "${lastChannelId}"를 CSV에서 찾을 수 없습니다.`);
                return;
            }

            const channelPosition = channelIndex + 1; // 1부터 시작
            const nextPosition = channelPosition + 1;

            // 진행상황 업데이트
            const updatedProgress = {
                complete: channelPosition,
                total: danbiCsvData.length,
                lastUpdated: new Date().toISOString(),
                comments: `${channelPosition}번째까지 완료. ${nextPosition}번째부터 시작`
            };

            setDanbiProgress(updatedProgress);
            setDanbiStartIndex(channelIndex + 1); // 다음 채널부터 시작

            addLog(LogStatus.SUCCESS, `✅ 채널 "${danbiCsvData[channelIndex].channel_name}" 발견!`);
            addLog(LogStatus.SUCCESS, `📍 위치: ${channelPosition}번째`);
            addLog(LogStatus.INFO, `▶️ ${nextPosition}번째부터 시작하겠습니다.`);
            
        } catch (error) {
            addLog(LogStatus.ERROR, `검색 중 오류 발생: ${error}`);
        } finally {
            setIsProcessingCsv(false);
        }
    };

    // 단비 CSV 채널 ID 확인 함수
    const handleDanbiCsvCheck = async () => {
        if (danbiCsvData.length === 0) {
            addLog(LogStatus.ERROR, 'CSV 파일을 먼저 업로드해주세요.');
            return;
        }

        // JSON 파일 체크 제거됨 - 채널 ID 방식으로 변경
        
        // 로딩 시작
        setIsDanbiAnalyzing(true);
        addLog(LogStatus.PENDING, '📊 Danbi CSV 분석 중...');
        
        // 진행상황 분석 - 주석을 통해 다음 처리할 번호 결정
        let startIndex = danbiProgress.complete;
        let nextNumber = startIndex + 1;
        
        // 주석 분석을 통한 시작 위치 결정
        if (danbiProgress.comments) {
            if (danbiProgress.comments.includes('진행중 오류')) {
                // 오류가 발생한 경우 해당 번호부터 다시 시작
                nextNumber = startIndex + 1;
                addLog(LogStatus.WARNING, `⚠️ 이전 오류 발생 감지 - ${nextNumber}번부터 재시작 예정`);
            } else if (danbiProgress.comments.includes('완료')) {
                // 정상 완료된 경우 다음 번호부터 시작
                nextNumber = startIndex + 1;
                addLog(LogStatus.SUCCESS, `✅ ${startIndex}번까지 완료됨 - ${nextNumber}번부터 시작 예정`);
            }
        } else if (startIndex === 0) {
            // 처음 시작하는 경우
            nextNumber = 1;
            addLog(LogStatus.INFO, `🆕 새로운 배치 처리 - 1번부터 시작 예정`);
        }

        // 단비 CSV 데이터를 targetChannelIds에 설정 (다음 번호부터)
        const remainingChannels = danbiCsvData.slice(startIndex);
        const channelIds = remainingChannels.map(channel => channel.channelId);
        setTargetChannelIds(channelIds);
        
        // 단비 모드 활성화
        setIsDanbiMode(true);
        setDanbiStartIndex(startIndex);
        
        // 진행상황 정보 로그
        addLog(LogStatus.SUCCESS, `📊 단비 CSV 분석 완료!`);
        addLog(LogStatus.INFO, `📂 총 ${danbiCsvData.length}개 채널 중 ${startIndex}개 완료됨`);
        addLog(LogStatus.INFO, `▶️ ${nextNumber}번부터 ${danbiCsvData.length}번까지 ${remainingChannels.length}개 채널 처리 예정`);
        addLog(LogStatus.INFO, `💡 아래 "처리 시작" 버튼을 눌러 실제 배치 처리를 시작하세요.`);
        
        // Step 3 완료 표시 및 단비 모드 표시
        setStep3Complete(true);
        
        // 로딩 완료
        setIsDanbiAnalyzing(false);
    };

    // 순차 처리 함수
    const processDanbiChannelsSequentially = async (startIndex: number) => {
        const preset1Fields = new Set([
            'title', 'publishedAt', 'country', 'customUrl', 'channelUrl', 'thumbnailDefault',
            'subscriberCount', 'videoCount', 'viewCount', 'topicCategories', 'uploadsPlaylistId'
        ]);

        for (let i = startIndex; i < danbiCsvData.length; i++) {
            const channel = danbiCsvData[i];
            const channelNumber = i + 1;

            try {
                addLog(LogStatus.PENDING, `[${channelNumber}/${danbiCsvData.length}] 처리 중: ${channel.channel_name} (${channel.channelId})`);

                // 1. YouTube 데이터 추출
                const result = await fetchSelectedChannelData(channel.channelId, youtubeApiKey, preset1Fields);
                
                // 2. 데이터 구조화
                const channelData = {
                    channelId: channel.channelId,
                    staticData: result.staticData,
                    snapshot: result.snapshotData
                };

                // 3. Google Drive 저장
                await updateOrCreateChannelFile(channelData, driveFolderId || 'root');

                // 4. 진행상황 업데이트
                const newProgress = {
                    complete: channelNumber,
                    total: danbiCsvData.length,
                    lastUpdated: new Date().toISOString(),
                    comments: `// ${channelNumber}번 완료 ${channelNumber + 1}번 시작`
                };

                setDanbiProgress(newProgress);

                addLog(LogStatus.SUCCESS, `✅ [${channelNumber}] ${channel.channel_name} 완료`);

            } catch (error) {
                const errorProgress = {
                    complete: i, // 현재 인덱스로 설정 (실패한 것은 완료로 치지 않음)
                    total: danbiCsvData.length,
                    lastUpdated: new Date().toISOString(),
                    comments: `// ${channelNumber}번 진행중 오류: ${error.message}`
                };

                setDanbiProgress(errorProgress);
                
                // 업데이트된 progress JSON을 다운로드용으로 저장
                setUpdatedCompleteJson(JSON.stringify(errorProgress, null, 2));

                addLog(LogStatus.ERROR, `❌ [${channelNumber}] ${channel.channel_name} 실패: ${error.message}`);
                addLog(LogStatus.INFO, `💾 업데이트된 danbi_complete.json 다운로드 가능`);
                
                // 오류 발생 시 중단
                setIsDanbiBatchRunning(false);
                return;
            }

            // API 호출 간격 조절 (1초)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 모든 채널 처리 완료
        const finalProgress = {
            complete: danbiCsvData.length,
            total: danbiCsvData.length,
            lastUpdated: new Date().toISOString(),
            comments: `// 모든 처리 완료 (${danbiCsvData.length}/${danbiCsvData.length})`
        };
        
        setDanbiProgress(finalProgress);
        setUpdatedCompleteJson(JSON.stringify(finalProgress, null, 2));
        
        addLog(LogStatus.SUCCESS, `🎉 단비 배치 처리 완료! 총 ${danbiCsvData.length}개 채널 처리됨`);
        addLog(LogStatus.INFO, `💾 업데이트된 danbi_complete.json 다운로드 가능`);
        setIsDanbiBatchRunning(false);
    };

    // danbi_complete.json 다운로드 함수
    const downloadCompleteJson = () => {
        if (!updatedCompleteJson) return;
        
        const blob = new Blob([updatedCompleteJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'danbi_complete.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addLog(LogStatus.SUCCESS, '📥 danbi_complete.json 파일이 다운로드되었습니다.');
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
        console.log('=== handleConfirmFieldsAndProcess 호출됨 ===');
        console.log('selectedFields.size:', selectedFields.size);
        console.log('youtubeApiKey:', youtubeApiKey ? '설정됨' : '없음');
        console.log('driveFolderId:', driveFolderId);
        console.log('step4Complete:', step4Complete);
        
        if (selectedFields.size === 0) {
            addLog(LogStatus.ERROR, '최소 1개 이상의 기본 데이터 필드를 선택해야 합니다.');
            return;
        }

        if (!youtubeApiKey) {
            addLog(LogStatus.ERROR, 'YouTube API 키가 필요합니다.');
            return;
        }

        // Google Drive는 선택사항 (로컬 JSON 다운로드도 가능)
        if (!driveFolderId) {
            addLog(LogStatus.WARNING, 'Google Drive 폴더 ID가 없습니다. 로컬 JSON 다운로드로 진행합니다.');
        }

        try {
            setStep4Complete(true);
            setIsProcessingStarted(true);
            addLog(LogStatus.SUCCESS, `4단계 완료: 필드 선택이 확정되었으며, 5단계 데이터 처리를 시작합니다.`);

            // 1단계: 채널 ID 준비 (활성화된 방법에 따라 처리)
            let processTargetChannelIds: string[] = [];
            
            if (updateMode === 'existing') {
                // 기존 채널 업데이트 모드
                addLog(LogStatus.PENDING, `기존 채널 데이터 업데이트 중... (${existingChannelsCount}개)`);
                processTargetChannelIds = await getExistingChannelIds(driveFolderId);
                
                if (processTargetChannelIds.length === 0) {
                    addLog(LogStatus.WARNING, '기존 채널이 없습니다. 신규 데이터 수집 모드로 전환해주세요.');
                    return;
                }
            } else if (updateMode === 'danbi_batch') {
                // Danbi CSV 배치 처리 모드
                if (danbiCsvData.length === 0) {
                    addLog(LogStatus.ERROR, 'Danbi CSV 파일을 먼저 업로드해주세요.');
                    return;
                }
                
                // targetChannelIds에 이미 설정된 채널들 사용 (단비 CSV 채널 ID 확인 버튼에서 설정됨)
                if (targetChannelIds.length === 0) {
                    addLog(LogStatus.WARNING, '처리할 채널이 없습니다. "단비 CSV 채널 ID 확인" 버튼을 먼저 클릭해주세요.');
                    return;
                }
                
                processTargetChannelIds = [...targetChannelIds]; // targetChannelIds 사용
                addLog(LogStatus.SUCCESS, `📂 Danbi CSV에서 ${processTargetChannelIds.length}개 채널을 처리합니다.`);
            } else {
                // 활성화된 채널 수집 방법에 따라 분기
                if (activeChannelMethod === 'search') {
                    // 자동 채널 탐색 모드
                    const categoryLabel = youtubeCategories.find(cat => cat.value === selectedCategory)?.label || '전체 카테고리';
                    
                    // 1단계: 기존 채널 목록 먼저 가져오기
                    addLog(LogStatus.PENDING, '기존 채널 목록 확인 중...');
                    const existingIds = await getExistingChannelIds(driveFolderId);
                    
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

                    processTargetChannelIds = foundChannelIds;
                    addLog(LogStatus.SUCCESS, `✨ ${processTargetChannelIds.length}개의 새로운 채널을 발견했습니다!`);
                    
                } else if (activeChannelMethod === 'manual') {
                    // 직접 채널 입력 모드 - 현재 상태의 targetChannelIds 사용
                    if (targetChannelIds.length === 0) {
                        addLog(LogStatus.WARNING, '처리할 채널이 없습니다. 직접 채널 입력 블럭에서 채널을 추가해주세요.');
                        return;
                    }
                    
                    processTargetChannelIds = [...targetChannelIds]; // 상태 복사
                    addLog(LogStatus.SUCCESS, `📝 직접 입력된 ${processTargetChannelIds.length}개 채널을 처리합니다.`);
                }
            }

            addLog(LogStatus.SUCCESS, `처리할 채널: ${processTargetChannelIds.length}개`);

            // 진행상황 초기화 (processTargetChannelIds 확정 후)
            setProcessingProgress({
                currentIndex: 0,
                totalCount: processTargetChannelIds.length,
                currentChannelName: '',
                currentStep: '채널 데이터 추출 준비 중...',
                isActive: true
            });

            // 2단계: 선택된 필드로 데이터 추출 (스트리밍 방식)
            addLog(LogStatus.PENDING, '채널 데이터 추출 및 즉시 저장 중...');
            let processedCount = 0;

            for (let i = 0; i < processTargetChannelIds.length; i++) {
                const channelId = processTargetChannelIds[i];
                
                // 진행상황 업데이트
                setProcessingProgress(prev => ({
                    ...prev,
                    currentIndex: i + 1,
                    currentChannelName: channelId,
                    currentStep: '기본 데이터 수집 중...'
                }));
                
                addLog(LogStatus.PENDING, `채널 데이터 추출 중... (${i + 1}/${processTargetChannelIds.length}) - ${channelId}`);

                try {
                    // 모든 필드 (기본 + 응용) 포함
                    const allFields = new Set([...selectedFields, ...appliedFields]);
                    
                    // 의존성 필드 추가 (응용데이터 계산을 위해 필요한 필드들)
                    if (appliedFields.has('longformCount')) {
                        allFields.add('videoCount');
                    }
                    if (allFields.has('shortsCount') || allFields.has('longformCount') || allFields.has('totalShortsDuration') || allFields.has('estimatedShortsViews') || allFields.has('estimatedLongformViews')) {
                        allFields.add('uploadsPlaylistId');
                    }
                    if (Array.from(appliedFields).some((f: string) => f.includes('Gained') || f.includes('uploadsPer') || f.includes('Age'))) {
                        allFields.add('publishedAt');
                    }
                    
                    console.log(`[DEBUG] 처리 시작 - 채널 ${channelId}:`, {
                        selectedFields: Array.from(selectedFields),
                        appliedFields: Array.from(appliedFields),
                        allFields: Array.from(allFields)
                    });

                    const { staticData, snapshotData } = await fetchSelectedChannelData(
                        channelId,
                        youtubeApiKey,
                        allFields
                    );
                    
                    // 채널명 업데이트
                    setProcessingProgress(prev => ({
                        ...prev,
                        currentChannelName: staticData.title || channelId,
                        currentStep: '기본 데이터 수집 완료'
                    }));

                    // 2. Fetch shorts count if needed (일괄처리에서도 동일하게 적용)
                    let shortsCountData: { shortsCount: number; totalShortsViews: number } | undefined;
                    const uploadsPlaylistId = staticData.uploadsPlaylistId;
                    const needsShortsCount = allFields.has('shortsCount') || allFields.has('longformCount') || allFields.has('totalShortsDuration') || allFields.has('estimatedShortsViews') || allFields.has('estimatedLongformViews') || allFields.has('shortsViewsPercentage') || allFields.has('longformViewsPercentage');

                    if (needsShortsCount && uploadsPlaylistId) {
                        setProcessingProgress(prev => ({
                            ...prev,
                            currentStep: '콘텐츠 분석 중 (숏폼 집계)...'
                        }));
                        addLog(LogStatus.PENDING, `콘텐츠 분석 중 - ${staticData.title || channelId} (숏폼 갯수 집계)... 채널의 영상 수에 따라 시간이 소요될 수 있습니다.`);
                        try {
                            shortsCountData = await fetchShortsCount(uploadsPlaylistId, youtubeApiKey);
                            addLog(LogStatus.SUCCESS, `콘텐츠 분석 완료 - ${staticData.title || channelId}: 숏폼 ${shortsCountData.shortsCount}개 발견.`);
                            setProcessingProgress(prev => ({
                                ...prev,
                                currentStep: '콘텐츠 분석 완료'
                            }));
                        } catch (e: any) {
                            addLog(LogStatus.ERROR, `숏폼 갯수 집계 실패 - ${staticData.title || channelId}: ${e.message}`);
                            setProcessingProgress(prev => ({
                                ...prev,
                                currentStep: '콘텐츠 분석 실패 (계속 진행)'
                            }));
                        }
                    }

                    // 3. 응용데이터 계산 (shortsCountData 포함)
                    let finalSnapshotData = snapshotData;
                    if (appliedFields.size > 0) {
                        setProcessingProgress(prev => ({
                            ...prev,
                            currentStep: '응용데이터 계산 중...'
                        }));
                        console.log(`[DEBUG] 응용데이터 계산 시작 - 채널 ${channelId}:`, {
                            originalSnapshot: snapshotData,
                            publishedAt: staticData.publishedAt,
                            shortsCountData: shortsCountData
                        });
                        
                        finalSnapshotData = calculateAndAddAppliedData(snapshotData, staticData.publishedAt, shortsCountData);
                        
                        console.log(`[DEBUG] 응용데이터 계산 완료 - 채널 ${channelId}:`, {
                            finalSnapshot: finalSnapshotData
                        });
                        setProcessingProgress(prev => ({
                            ...prev,
                            currentStep: '응용데이터 계산 완료'
                        }));
                    }

                    // 17개 축약 지표 검증 (gsvr 제거)
                    const requiredFields = ['gavg', 'gsub', 'gvps', 'gage', 'gupw', 'gspd', 'gvpd', 'gspm', 'gspy', 'gvir', 'csct', 'clct', 'csdr', 'vesv', 'vsvp', 'velv', 'vlvp'];
                    const missingFields = requiredFields.filter(field => finalSnapshotData[field as keyof typeof finalSnapshotData] === undefined);
                    
                    console.log(`// 17개 매칭 -> ${missingFields.length === 0 ? '성공' : '실패'} -> ${missingFields.length === 0 ? '저장합니다' : '종료합니다'}`);
                    
                    if (missingFields.length > 0) {
                        console.log(`// 누락된 필드들: ${missingFields.join(', ')}`);
                        addLog(LogStatus.ERROR, `❌ 17개 지표 검증 실패 - 누락된 필드: ${missingFields.join(', ')}`);
                        addLog(LogStatus.WARNING, `⚠️ 필수 지표 누락으로 인해 저장을 중단합니다.`);
                        break;
                    }
                    
                    console.log('// 17개 매칭 -> 성공 -> 저장합니다 -> 다음으로');
                    addLog(LogStatus.SUCCESS, `✓ 17개 지표 검증 완료 - ${staticData?.title || channelId}`);

                    // 데이터 일관성 보정 로직 (ε = 1%)
                    const ε = 1; // 최소 비중 1%
                    const totalViews = parseInt(finalSnapshotData.viewCount);
                    let correctionApplied = false;

                    // [케이스 A] 롱폼 영상이 1개 이상인데, 롱폼 비중이 0%로 잡힌 경우
                    if (finalSnapshotData.clct >= 1 && finalSnapshotData.vlvp === 0) {
                        finalSnapshotData.vlvp = ε;                              // 롱폼에 최소 비중 1% 부여
                        finalSnapshotData.vsvp = 100 - ε;                        // 숏폼 비중을 99%로 재조정
                        finalSnapshotData.vesv = Math.round(totalViews * finalSnapshotData.vsvp / 100); // 숏폼 조회수 재계산
                        finalSnapshotData.velv = totalViews - finalSnapshotData.vesv;              // 롱폼 조회수 잔여분
                        correctionApplied = true;
                        console.log('// 데이터 보정: 롱폼 존재하는데 비중 0% → 1% 부여');
                    }

                    // [케이스 B] 숏폼 영상이 1개 이상인데, 숏폼 비중이 0%로 잡힌 경우
                    if (finalSnapshotData.csct >= 1 && finalSnapshotData.vsvp === 0) {
                        finalSnapshotData.vsvp = ε;                              // 숏폼에 최소 비중 1% 부여
                        finalSnapshotData.vlvp = 100 - ε;                        // 롱폼 비중을 99%로 재조정
                        finalSnapshotData.velv = Math.round(totalViews * finalSnapshotData.vlvp / 100); // 롱폼 조회수 재계산
                        finalSnapshotData.vesv = totalViews - finalSnapshotData.velv;              // 숏폼 조회수 잔여분
                        correctionApplied = true;
                        console.log('// 데이터 보정: 숏폼 존재하는데 비중 0% → 1% 부여');
                    }

                    if (correctionApplied) {
                        addLog(LogStatus.INFO, `🔧 데이터 일관성 보정 적용 - ${staticData?.title || channelId}`);
                    }

                    // 즉시 Drive에 저장 (메모리 절약)
                    const channelData = {
                        channelId,
                        staticData,
                        snapshot: finalSnapshotData
                    };
                    
                    if (driveFolderId) {
                        // Google Drive 저장
                        setProcessingProgress(prev => ({
                            ...prev,
                            currentStep: 'Google Drive에 저장 중...'
                        }));
                        
                        addLog(LogStatus.PENDING, `채널 파일 저장 중... (${i + 1}/${processTargetChannelIds.length}): ${staticData?.title || channelId}`);
                        
                        try {
                            await updateOrCreateChannelFile(channelData, driveFolderId);
                            processedCount++;
                            addLog(LogStatus.SUCCESS, `✓ ${staticData?.title || channelId} Google Drive 저장 완료`);
                        } catch (driveError: any) {
                            addLog(LogStatus.ERROR, `❌ Drive 저장 실패: ${driveError.message}`);
                            addLog(LogStatus.WARNING, `⚠️ 첫 번째 채널 저장 실패로 인해 처리를 중단합니다. 유튜브 할당량 절약을 위함입니다.`);
                            // 저장 실패시 즉시 루프 중단
                            break;
                        }
                    } else {
                        // 로컬 JSON 다운로드
                        setProcessingProgress(prev => ({
                            ...prev,
                            currentStep: '로컬 JSON 파일 생성 중...'
                        }));
                        
                        const fileName = `${channelId}.json`;
                        const jsonContent = JSON.stringify(channelData, null, 2);
                        const blob = new Blob([jsonContent], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        
                        processedCount++;
                        addLog(LogStatus.SUCCESS, `✓ ${staticData?.title || channelId} 로컬 JSON 다운로드 완료`);
                    }
                    
                    // Danbi 모드인 경우 진행상황 업데이트
                    if (updateMode === 'danbi_batch' && isDanbiMode) {
                        const currentChannelNumber = danbiStartIndex + i + 1;
                        const updatedProgress = {
                            complete: currentChannelNumber,
                            total: danbiCsvData.length,
                            lastUpdated: new Date().toISOString(),
                            comments: `${currentChannelNumber}까지 완료되었음. ${currentChannelNumber + 1}부터 시작`
                        };
                        setDanbiProgress(updatedProgress);
                        addLog(LogStatus.INFO, `📊 Danbi 진행상황 업데이트: ${currentChannelNumber}/${danbiCsvData.length} 완료`);
                    }
                    
                    setProcessingProgress(prev => ({
                        ...prev,
                        currentStep: `저장 완료 (${i + 1}/${processTargetChannelIds.length})`
                    }));
                    addLog(LogStatus.SUCCESS, `채널 ${staticData.title || channelId} 데이터 추출 완료`);
                } catch (error) {
                    setProcessingProgress(prev => ({
                        ...prev,
                        currentStep: `데이터 추출 실패: ${error}`
                    }));
                    addLog(LogStatus.WARNING, `채널 ${channelId} 데이터 추출 실패: ${error}`);
                }
            }

            // 스트리밍 방식으로 이미 모든 저장 완료됨

            // collections 폴더 찾기 (생성하지 않음)
            let collectionsFolder = await findFileByName('collections', driveFolderId);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const metadataFileName = `${timestamp}.json`;
            const metadataContent = {
                timestamp: new Date().toISOString(),
                totalChannels: processedCount,
                updateMode: updateMode,
                processedChannels: processTargetChannelIds.slice(0, processedCount)
            };

            if (collectionsFolder) {
                await createJsonFile(metadataFileName, collectionsFolder.id, metadataContent);
                addLog(LogStatus.SUCCESS, `📋 수집 기록 파일 생성: collections/${metadataFileName}`);
            } else {
                addLog(LogStatus.INFO, '📋 collections 폴더가 없어서 수집 기록을 건너뜁니다.');
            }
            addLog(LogStatus.SUCCESS, `🎉 처리 완료: 총 ${processedCount}개 채널을 ${updateMode === 'existing' ? '업데이트' : '신규 수집'}했습니다.`);
            
            // 진행상황 완료 처리
            setProcessingProgress(prev => ({
                ...prev,
                currentStep: `✅ 모든 처리 완료! (${processedCount}개 채널)`,
                isActive: false
            }));

        } catch (error: any) {
            console.error('데이터 처리 오류:', error);
            
            // 할당량 오류 감지 시 자동 다운로드
            const isQuotaError = error.message && (
                error.message.toLowerCase().includes('quota') ||
                error.message.toLowerCase().includes('exceed') ||
                error.message.toLowerCase().includes('limit')
            );
            
            if (isQuotaError && updatedCompleteJson && updateMode === 'danbi_batch') {
                const currentComplete = danbiProgress?.complete || 0;
                addLog(LogStatus.WARNING, `🔥 할당량 한계 도달 - ${currentComplete}개 채널까지 처리됨`);
                addLog(LogStatus.INFO, '📥 진행상황 자동 다운로드 중...');
                try {
                    downloadCompleteJson();
                    addLog(LogStatus.SUCCESS, '✅ danbi_complete.json 자동 다운로드 완료!');
                } catch (downloadError) {
                    addLog(LogStatus.ERROR, `다운로드 실패: ${downloadError}`);
                }
            } else {
                addLog(LogStatus.ERROR, `데이터 처리 실패: ${error.message}`);
            }
            
            setStep4Complete(false);
            setIsProcessingStarted(false);
            
            // 진행상황 오류 처리
            setProcessingProgress(prev => ({
                ...prev,
                currentStep: isQuotaError ? 
                    `⚡ 할당량 한계 도달 (${danbiProgress?.complete || 0}개 완료)` : 
                    `❌ 처리 실패: ${error.message}`,
                isActive: false
            }));
        }
    };

    const handleShowExample = () => {
        // 실제 동작과 유사한 예시 데이터 생성 (새로운 JSON 구조 적용)
        const sampleSnapshot: any = {};
        const sampleStaticData: any = {};
        const allFields = [...selectedFields, ...appliedFields];

        // 기본 통계 데이터 (계산 기반이 될 값들)
        const mockStats = {
            subscriberCount: '288000000',
            viewCount: '53123456789', 
            videoCount: '799',
            publishedAt: '2012-02-20T13:42:00Z'
        };

        // 새로운 구조: 정적 데이터는 publishedAt만
        sampleStaticData.publishedAt = mockStats.publishedAt;

        // 선택된 필드들의 실제 계산 결과 생성
        allFields.forEach(fieldId => {
            const allDataFields = [...apiDataFields.flatMap(g => g.fields), ...appliedDataFields.flatMap(g => g.fields)];
            const field = allDataFields.find(f => f.id === fieldId);
            if (field) {
                // 새로운 구조: subscriberCount 제외하고 모든 데이터를 스냅샷에
                if (field.id === 'subscriberCount') {
                    // subscriberCount는 별도 히스토리로 관리되므로 스냅샷에서 제외
                    return;
                } else if (field.id === 'publishedAt') {
                    // publishedAt은 정적 데이터에만 저장 (이미 위에서 처리됨)
                    return;
                } else if (['title', 'customUrl', 'thumbnailUrl', 'thumbnailDefault', 'thumbnailMedium', 'thumbnailHigh'].includes(field.id)) {
                    // 채널 정보는 스냅샷에 (변경 가능하므로)
                    sampleSnapshot[field.id] = field.example;
                } else if (['viewCount', 'videoCount', 'hiddenSubscriberCount'].includes(field.id)) {
                    // 기본 통계는 문자열로 
                    sampleSnapshot[field.id] = (mockStats as any)[field.id] || field.example;
                } else {
                    // 응용 데이터는 실제 계산된 숫자 값으로
                    const shortKey = getShortKey(field.id);
                    const calculatedValue = calculateMockAppliedData(field.id, mockStats);
                    sampleSnapshot[shortKey] = calculatedValue;
                }
            }
        });

        // fieldMapping 생성 (응용 데이터가 있을 때만)
        const fieldMapping: { [key: string]: string } = {};
        appliedFields.forEach(fieldId => {
            const shortKey = getShortKey(fieldId);
            const appliedField = appliedDataFields.flatMap(g => g.fields).find(f => f.id === fieldId);
            if (appliedField) {
                fieldMapping[shortKey] = `${fieldId} (${appliedField.label})`;
            }
        });

        // 구독자 히스토리 생성 (월별 5개 예시)
        const subscriberHistory = [
            { month: "2024-09", count: mockStats.subscriberCount },
            { month: "2024-08", count: "285000000" },
            { month: "2024-07", count: "280000000" },
            { month: "2024-06", count: "275000000" },
            { month: "2024-05", count: "270000000" }
        ];

        // 새로운 채널 파일 구조 적용
        const sampleChannelFile = {
            channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA",
            // 1. 정적 데이터 (채널 생성날짜만)
            staticData: sampleStaticData,
            // 2. 스냅샷 (최신 1개만, subscriberCount 제외)
            snapshots: [
                {
                    ts: new Date().toISOString(),
                    ...sampleSnapshot,
                    // 기존 collectionInfo는 제거 (용량 최적화)
                }
            ],
            // 3. 구독자 히스토리 (월별 5개)
            subscriberHistory: subscriberHistory,
            // 4. 메타데이터
            metadata: {
                firstCollected: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                totalCollections: 1
            },
            // fieldMapping (응용 데이터 설명용)
            ...(Object.keys(fieldMapping).length > 0 && { fieldMapping })
        };

        setExampleJson(JSON.stringify(sampleChannelFile, null, 2));
        setShowExampleModal(true);
    };

    
    /**
     * 응용데이터 계산 함수 - UI appliedDataFields 순서를 엄격히 준수
     * 15년차 시니어 개발자 스타일: 의존성과 순서를 보장하는 안정적인 계산
     */
    const calculateAndAddAppliedData = (snapshot: Snapshot, publishedAt?: string, shortsCountData?: { shortsCount: number; totalShortsViews: number }): Snapshot => {
        console.log('🔍 [시니어 로직] 응용데이터 계산 시작 - UI 순서 엄격 준수');
        console.log('📊 선택된 필드:', Array.from(appliedFields));
        console.log('📈 총 필드 수:', appliedFields.size);
        console.log('📋 입력 데이터:', { snapshot, publishedAt, shortsCountData });
        
        const newSnapshot: Snapshot = { ...snapshot };
        
        // 기본 데이터 파싱 및 검증
        const subscriberCount = snapshot.subscriberCount ? parseInt(snapshot.subscriberCount, 10) : undefined;
        const viewCount = snapshot.viewCount ? parseInt(snapshot.viewCount, 10) : undefined;
        const videoCount = snapshot.videoCount ? parseInt(snapshot.videoCount, 10) : undefined;
        
        console.log('📈 파싱된 기본 데이터:', { subscriberCount, viewCount, videoCount });
        
        // 의존성 변수들 (순서대로 계산됨)
        let channelAgeDays: number | undefined;
        let subsGainedPerDay: number | undefined;
        let estimatedShortsViews: number | undefined;
        
        try {
            // ====== 성장 지표 (추정) - 정확한 UI 순서 ======
            
            // 1. averageViewsPerVideo (gavg)
            if (appliedFields.has('averageViewsPerVideo') && viewCount && videoCount && videoCount > 0) {
                const averageViews = Math.round(viewCount / videoCount);
                newSnapshot.gavg = averageViews;
                console.log(`✅ [1] averageViewsPerVideo: ${averageViews} (${viewCount} ÷ ${videoCount})`);
            }
            
            // 2. subscribersPerVideo (gsub) - 구독 전환율
            if (appliedFields.has('subscribersPerVideo') && subscriberCount && viewCount && viewCount > 0) {
                newSnapshot.gsub = parseFloat(((subscriberCount / viewCount) * 100).toFixed(4));
                console.log(`✅ [2] subscribersPerVideo: ${newSnapshot.gsub}%`);
            }
            
            // 3. viewsPerSubscriber (gvps)
            if (appliedFields.has('viewsPerSubscriber') && viewCount && subscriberCount && subscriberCount > 0) {
                newSnapshot.gvps = parseFloat(((viewCount / subscriberCount) * 100).toFixed(2));
                console.log(`✅ [3] viewsPerSubscriber: ${newSnapshot.gvps}%`);
            }
            
            // 4. channelAgeInDays (gage) - 다른 계산들의 기반이 됨
            if (appliedFields.has('channelAgeInDays') && publishedAt) {
                const publishedDate = new Date(publishedAt);
                const now = new Date();
                channelAgeDays = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
                newSnapshot.gage = channelAgeDays;
                console.log(`✅ [4] channelAgeInDays: ${channelAgeDays}일`);
            }
            
            // 5. uploadsPerWeek (gupw) - channelAgeDays 의존
            if (appliedFields.has('uploadsPerWeek') && videoCount && channelAgeDays && channelAgeDays > 0) {
                newSnapshot.gupw = parseFloat((videoCount / (channelAgeDays / 7)).toFixed(2));
                console.log(`✅ [5] uploadsPerWeek: ${newSnapshot.gupw}개/주`);
            }
            
            // 6. subsGainedPerDay (gspd) - 8,9번의 기반이 됨
            if (appliedFields.has('subsGainedPerDay') && subscriberCount && channelAgeDays && channelAgeDays > 0) {
                subsGainedPerDay = subscriberCount / channelAgeDays;
                newSnapshot.gspd = Math.round(subsGainedPerDay);
                console.log(`✅ [6] subsGainedPerDay: ${newSnapshot.gspd}명/일`);
            }
            
            // 7. viewsGainedPerDay (gvpd)
            if (appliedFields.has('viewsGainedPerDay') && viewCount && channelAgeDays && channelAgeDays > 0) {
                newSnapshot.gvpd = Math.round(viewCount / channelAgeDays);
                console.log(`✅ [7] viewsGainedPerDay: ${newSnapshot.gvpd}회/일`);
            }
            
            // 8. subsGainedPerMonth (gspm) - subsGainedPerDay 의존
            if (appliedFields.has('subsGainedPerMonth') && subsGainedPerDay) {
                newSnapshot.gspm = Math.round(subsGainedPerDay * 30.44);
                console.log(`✅ [8] subsGainedPerMonth: ${newSnapshot.gspm}명/월`);
            }
            
            // 9. subsGainedPerYear (gspy) - subsGainedPerDay 의존
            if (appliedFields.has('subsGainedPerYear') && subsGainedPerDay) {
                newSnapshot.gspy = Math.round(subsGainedPerDay * 365.25);
                console.log(`✅ [9] subsGainedPerYear: ${newSnapshot.gspy}명/년`);
            }
            
            // gsvr (subscriberToViewRatioPercent) 제거됨 - gsub와 중복이므로 삭제
            
            // 11. viralIndex (gvir) - 복합 계산
            if (appliedFields.has('viralIndex') && subscriberCount && viewCount && videoCount && videoCount > 0) {
                const conversionRatePercent = (subscriberCount / viewCount) * 100; // gsub와 동일
                const avgViewsPerVideo = viewCount / videoCount;
                newSnapshot.gvir = Math.round((conversionRatePercent * 100) + (avgViewsPerVideo / 1000000));
                console.log(`✅ [11] viralIndex: ${newSnapshot.gvir}`);
            }
            
            // ====== 콘텐츠 분석 ======
            
            // 12. shortsCount (csct) - shortsCountData 필요
            if (appliedFields.has('shortsCount') && shortsCountData) {
                newSnapshot.csct = shortsCountData.shortsCount;
                console.log(`✅ [11] shortsCount: ${newSnapshot.csct}개`);
            }
            
            // 12. longformCount (clct) - shortsCount 의존
            if (appliedFields.has('longformCount') && videoCount && shortsCountData) {
                const analyzedVideoCount = Math.min(videoCount, 1000);
                newSnapshot.clct = analyzedVideoCount - shortsCountData.shortsCount;
                console.log(`✅ [12] longformCount: ${newSnapshot.clct}개`);
            }
            
            // 13. totalShortsDuration (csdr) - shortsCount 의존
            if (appliedFields.has('totalShortsDuration') && shortsCountData) {
                newSnapshot.csdr = shortsCountData.shortsCount * 60;
                console.log(`✅ [13] totalShortsDuration: ${newSnapshot.csdr}초`);
            }
            
            // ====== 조회수 분석 (추정) ======
            
            // 14. estimatedShortsViews (vesv) - 15,16,17번의 기반이 됨
            if (appliedFields.has('estimatedShortsViews') && shortsCountData) {
                estimatedShortsViews = shortsCountData.totalShortsViews;
                newSnapshot.vesv = estimatedShortsViews;
                console.log(`✅ [14] estimatedShortsViews: ${estimatedShortsViews}회`);
            }
            
            // 15. shortsViewsPercentage (vsvp) - estimatedShortsViews 의존
            if (appliedFields.has('shortsViewsPercentage') && viewCount && estimatedShortsViews !== undefined) {
                newSnapshot.vsvp = parseFloat(((estimatedShortsViews / viewCount) * 100).toFixed(2));
                console.log(`✅ [15] shortsViewsPercentage: ${newSnapshot.vsvp}%`);
            }
            
            // 16. estimatedLongformViews (velv) - estimatedShortsViews 의존
            if (appliedFields.has('estimatedLongformViews') && viewCount && estimatedShortsViews !== undefined) {
                newSnapshot.velv = Math.max(0, viewCount - estimatedShortsViews);
                console.log(`✅ [16] estimatedLongformViews: ${newSnapshot.velv}회`);
            }
            
            // 17. longformViewsPercentage (vlvp) - estimatedLongformViews 의존
            if (appliedFields.has('longformViewsPercentage') && viewCount && newSnapshot.velv !== undefined) {
                newSnapshot.vlvp = parseFloat(((newSnapshot.velv / viewCount) * 100).toFixed(2));
                console.log(`✅ [17] longformViewsPercentage: ${newSnapshot.vlvp}%`);
            }
            
        } catch (error) {
            console.error('❌ 응용데이터 계산 중 오류:', error);
        }
        
        console.log('🎉 [시니어 로직] 응용데이터 계산 완료 - 17개 순서 보장됨');
        console.log('📊 최종 결과:', newSnapshot);
        return newSnapshot;
    };

    // Danbi CSV 배치 처리 함수 - 단순하게 하나씩 순차적으로
    const handleDanbiBatchProcess = useCallback(async () => {
        if (isDanbiBatchRunning || danbiCsvData.length === 0) return;
        
        setIsDanbiBatchRunning(true);
        addLog(LogStatus.INFO, `=== Danbi 배치 처리 시작 === (총 ${danbiProgress.total}개, ${danbiProgress.complete}번부터 시작)`);
        
        // danbiProgress.complete + 1번부터 시작
        const startIndex = danbiProgress.complete;
        
        for (let i = startIndex; i < danbiCsvData.length; i++) {
            if (!isDanbiBatchRunning) break; // 중단된 경우
            
            const currentChannel = danbiCsvData[i];
            const channelNumber = i + 1; // 1부터 시작
            
            try {
                addLog(LogStatus.INFO, `[${channelNumber}/${danbiCsvData.length}] 처리 중: ${currentChannel.channel_name}`);
                
                // 채널 URL에서 채널 ID 추출
                const urlParts = currentChannel.profile_url.split('/');
                const channelId = urlParts[urlParts.length - 1];
                
                // 기존 채널 데이터 수집 로직 사용
                const channelData = await fetchSelectedChannelData(channelId, youtubeApiKey, selectedFields);
                
                if (channelData) {
                    // Google Drive에 저장
                    await updateOrCreateChannelFile(channelData, selectedFolder?.id || 'root');
                    addLog(LogStatus.SUCCESS, `✅ [${channelNumber}] ${currentChannel.channel_name} 완료`);
                } else {
                    addLog(LogStatus.WARNING, `⚠️ [${channelNumber}] ${currentChannel.channel_name} 데이터 없음`);
                }
                
            } catch (error: any) {
                addLog(LogStatus.ERROR, `❌ [${channelNumber}] ${currentChannel.channel_name} 실패: ${error.message}`);
            }
            
            // 진행상황 업데이트 (하나 완료될 때마다 즉시 저장)
            const updatedProgress = {
                complete: channelNumber,
                total: danbiCsvData.length,
                lastUpdated: new Date().toISOString(),
                comments: `${channelNumber}도중 중단 혹은 ${channelNumber}까지 완료되었음. ${channelNumber + 1}부터 시작`
            };
            
            setDanbiProgress(updatedProgress);
            
            // danbi_complete.json 파일 업데이트 (실제 파일 시스템에는 저장되지 않음 - 브라우저 제한)
            console.log('진행상황 업데이트:', updatedProgress);
            
            // 1초 대기 (API 호출 간격 조절)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        setIsDanbiBatchRunning(false);
        addLog(LogStatus.SUCCESS, `🎉 Danbi 배치 처리 완료! (${danbiProgress.complete}/${danbiProgress.total})`);
    }, [isDanbiBatchRunning, danbiCsvData, danbiProgress, youtubeApiKey, selectedFields, appliedFields, selectedFolder, addLog]);

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
                if (Array.from(appliedFields).some((f: string) => f.includes('Gained') || f.includes('uploadsPer') || f.includes('Age'))) {
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

                // 3.5. 17개 축약 지표 검증 (gsvr 제거)
                const requiredFields = ['gavg', 'gsub', 'gvps', 'gage', 'gupw', 'gspd', 'gvpd', 'gspm', 'gspy', 'gvir', 'csct', 'clct', 'csdr', 'vesv', 'vsvp', 'velv', 'vlvp'];
                const missingFields = requiredFields.filter(field => newSnapshotWithAppliedData[field as keyof typeof newSnapshotWithAppliedData] === undefined);
                
                console.log(`// 17개 매칭 -> ${missingFields.length === 0 ? '성공' : '실패'} -> ${missingFields.length === 0 ? '저장합니다' : '종료합니다'}`);
                
                if (missingFields.length > 0) {
                    console.log(`// 누락된 필드들: ${missingFields.join(', ')}`);
                    addLog(LogStatus.ERROR, `❌ 17개 지표 검증 실패 - 누락된 필드: ${missingFields.join(', ')}`);
                    addLog(LogStatus.WARNING, `⚠️ 필수 지표 누락으로 인해 저장을 중단합니다.`);
                    return;
                }
                
                console.log('// 17개 매칭 -> 성공 -> 저장합니다 -> 다음으로');
                addLog(LogStatus.SUCCESS, `✓ 17개 지표 검증 완료 - ${staticData.title || channelId}`);

                // 3.6. 데이터 일관성 보정 로직 (ε = 1%)
                const ε = 1; // 최소 비중 1%
                const totalViews = parseInt(newSnapshotWithAppliedData.viewCount);
                let correctionApplied = false;

                // [케이스 A] 롱폼 영상이 1개 이상인데, 롱폼 비중이 0%로 잡힌 경우
                if (newSnapshotWithAppliedData.clct >= 1 && newSnapshotWithAppliedData.vlvp === 0) {
                    newSnapshotWithAppliedData.vlvp = ε;                              // 롱폼에 최소 비중 1% 부여
                    newSnapshotWithAppliedData.vsvp = 100 - ε;                        // 숏폼 비중을 99%로 재조정
                    newSnapshotWithAppliedData.vesv = Math.round(totalViews * newSnapshotWithAppliedData.vsvp / 100); // 숏폼 조회수 재계산
                    newSnapshotWithAppliedData.velv = totalViews - newSnapshotWithAppliedData.vesv;              // 롱폼 조회수 잔여분
                    correctionApplied = true;
                    console.log('// 데이터 보정: 롱폼 존재하는데 비중 0% → 1% 부여');
                }

                // [케이스 B] 숏폼 영상이 1개 이상인데, 숏폼 비중이 0%로 잡힌 경우
                if (newSnapshotWithAppliedData.csct >= 1 && newSnapshotWithAppliedData.vsvp === 0) {
                    newSnapshotWithAppliedData.vsvp = ε;                              // 숏폼에 최소 비중 1% 부여
                    newSnapshotWithAppliedData.vlvp = 100 - ε;                        // 롱폼 비중을 99%로 재조정
                    newSnapshotWithAppliedData.velv = Math.round(totalViews * newSnapshotWithAppliedData.vlvp / 100); // 롱폼 조회수 재계산
                    newSnapshotWithAppliedData.vesv = totalViews - newSnapshotWithAppliedData.velv;              // 숏폼 조회수 잔여분
                    correctionApplied = true;
                    console.log('// 데이터 보정: 숏폼 존재하는데 비중 0% → 1% 부여');
                }

                if (correctionApplied) {
                    addLog(LogStatus.INFO, `🔧 데이터 일관성 보정 적용 - ${staticData.title || channelId}`);
                }

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
                const now = new Date().toISOString();
                
                if (existingFile) {
                    addLog(LogStatus.INFO, `기존 파일 '${fileName}' 발견. 데이터를 업데이트합니다.`);
                    const content = await getFileContent(existingFile.id);
                    channelData = JSON.parse(content);
                    
                    // Add new snapshot
                    channelData.snapshots.push(newSnapshotWithAppliedData);
                    // Update static data
                    Object.assign(channelData, staticData);
                    
                    // Update metadata (간소화된 3개 필드)
                    channelData.metadata = {
                        firstCollected: channelData.metadata?.firstCollected || now,
                        lastUpdated: now,
                        totalCollections: channelData.snapshots.length
                    };
                    
                    // 파일 저장은 updateOrCreateChannelFile에서 처리
                } else {
                    addLog(LogStatus.INFO, `새 파일 '${fileName}'을(를) 생성합니다.`);
                    channelData = {
                        channelId,
                        ...staticData,
                        snapshots: [newSnapshotWithAppliedData],
                        metadata: {
                            firstCollected: now,
                            lastUpdated: now,
                            totalCollections: 1
                        }
                    };
                    // 파일 저장은 updateOrCreateChannelFile에서 처리
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
        
        // Start immediately (one-time execution)
        run();

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

    const allStepsComplete = step2Complete && step3Complete && step4Complete;
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
                                        value={driveFolderId}
                                        onChange={(e) => {
                                            setDriveFolderId(e.target.value);
                                            localStorage.setItem('DRIVE_FOLDER_ID', e.target.value);
                                        }}
                                        placeholder="Google Drive 폴더 ID (예: 1MsoASuSXq1HkW-tbdh0PjqmeaSxE8DL5)"
                                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base h-12"
                                    />
                                    {driveFolderId && (
                                        <div className="text-center mt-2">
                                            <span className="text-green-400 font-medium">✅ 폴더 ID 입력 완료!</span>
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
                {/* Channel Method Toggle */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">2. 채널 선택 방법</h2>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <button
                            onClick={() => setActiveChannelMethod('search')}
                            className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                                activeChannelMethod === 'search' 
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-400' 
                                    : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500'
                            }`}
                        >
                            <div className="text-left">
                                <div className="font-semibold mb-1">🔍 자동 채널 탐색</div>
                                <div className="text-sm opacity-80">조건을 설정하여 YouTube에서 채널을 자동으로 찾습니다</div>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveChannelMethod('manual')}
                            className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                                activeChannelMethod === 'manual' 
                                    ? 'border-green-500 bg-green-500/20 text-green-400' 
                                    : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500'
                            }`}
                        >
                            <div className="text-left">
                                <div className="font-semibold mb-1">✏️ 직접 채널 입력</div>
                                <div className="text-sm opacity-80">@핸들명을 직접 입력하여 원하는 채널을 추가합니다</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Steps 2 & 3: Two column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Step 2: Find Channels */}
                    <div className={`transition-all duration-300 ${activeChannelMethod !== 'search' ? 'opacity-40 pointer-events-none' : ''}`}>
                        <Step
                        stepNumber={2}
                        title="분석 대상 채널 탐색"
                        description="특정 기준(구독자 수, 정렬 순서)에 맞는 채널을 자동으로 탐색하거나, 채널 ID를 수동으로 추가합니다."
                        isComplete={step2Complete && activeChannelMethod === 'search'}
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
                    </div>
                </Step>
                    </div>
                
                {/* Step 3: Confirm Target Channels */}
                <div className={`transition-all duration-300 ${activeChannelMethod !== 'manual' ? 'opacity-40 pointer-events-none' : ''}`}>
                    <Step
                        stepNumber={3}
                        title="직접 채널 입력"
                        description="탐색된 채널 목록을 확인하고, 원하는 채널의 @핸들을 직접 입력하여 추가하거나 제거할 수 있습니다."
                        isComplete={step3Complete && activeChannelMethod === 'manual'}
                    >
                    <div className="space-y-4">
                        {/* @핸들 직접 입력 */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-300">@핸들 직접 입력</label>
                            <input
                                type="text"
                                value={manualChannelHandle}
                                onChange={(e) => setManualChannelHandle(e.target.value)}
                                placeholder="채널 @핸들 입력 (예: @MrBeast, @Cocomelon, @T-Series) - 콤마로 구분하여 여러 개 가능"
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

                        {/* 구분선 */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-slate-600"></div>
                            <span className="text-slate-400 text-sm">또는</span>
                            <div className="flex-1 h-px bg-slate-600"></div>
                        </div>

                        {/* CSV 파일 업로드 (단비 배치) */}
                        <div className="flex flex-col gap-3">
                            <label className="text-sm font-medium text-slate-300">📂 단비 배치 처리</label>
                            
                            {/* CSV 파일 업로드 */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">1. danbi_channels.csv 파일</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleCsvUpload}
                                    className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 bg-slate-700 border border-slate-600 rounded-lg"
                                />
                                {csvFile && (
                                    <div className="text-xs text-green-400 mt-1">
                                        ✅ {csvFile.name} - {danbiCsvData.length}개 채널
                                    </div>
                                )}
                            </div>

                            {/* 마지막 채널 ID 입력 */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">2. 마지막 크롤링한 채널 ID</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={lastChannelId}
                                        onChange={(e) => setLastChannelId(e.target.value)}
                                        placeholder="예: UCxxxxxxxxxxxxxxxxxxxxxx"
                                        className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                    <button
                                        onClick={handleFindChannelPosition}
                                        disabled={isProcessingCsv || !lastChannelId.trim() || danbiCsvData.length === 0}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-md transition-colors text-sm"
                                    >
                                        확인
                                    </button>
                                </div>
                                {danbiProgress.complete > 0 && (
                                    <div className="text-xs text-green-400 mt-1">
                                        ✅ {danbiProgress.complete}번째까지 완료 - {danbiProgress.complete + 1}번째부터 시작
                                        <div className="text-xs text-slate-400">{danbiProgress.comments}</div>
                                    </div>
                                )}
                            </div>

                            {/* 배치 처리 시작 버튼 */}
                            <button
                                onClick={handleDanbiCsvCheck}
                                disabled={!csvFile || danbiProgress.complete === 0 || isDanbiAnalyzing}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 rounded-lg transition-colors text-lg h-[50px] flex items-center justify-center disabled:bg-slate-500 disabled:cursor-not-allowed"
                            >
                                {isDanbiAnalyzing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                        분석 중...
                                    </>
                                ) : (
                                    <>🔍 단비 CSV 채널 ID 확인</>
                                )}
                            </button>

                            {/* 진행률 표시 */}
                            {isDanbiBatchRunning && (
                                <div className="text-sm text-blue-400 bg-blue-900/20 p-2 rounded">
                                    📊 진행률: {Math.round((danbiProgress.complete / danbiProgress.total) * 100)}% 
                                    ({danbiProgress.complete}/{danbiProgress.total})
                                </div>
                            )}

                            {/* 다운로드 버튼 */}
                            {updatedCompleteJson && (
                                <button
                                    onClick={downloadCompleteJson}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 rounded-lg transition-colors text-sm h-[40px] flex items-center justify-center"
                                >
                                    📥 업데이트된 danbi_complete.json 다운로드
                                </button>
                            )}
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded-md border border-slate-700">
                            {isDanbiAnalyzing ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mr-3"></div>
                                    <span className="text-slate-400">채널 목록 분석 중...</span>
                                </div>
                            ) : targetChannelIds.length > 0 ? (
                                <>
                                    {targetChannelIds.slice(0, 50).map(id => (
                                        <div key={id} className="flex items-center justify-between p-2 hover:bg-slate-700/50 rounded">
                                            <span className="font-mono text-base text-slate-300">{id}</span>
                                            <button onClick={() => handleRemoveChannel(id)} className="text-red-400 hover:text-red-300 text-base font-bold h-[50px] flex items-center justify-center">제거</button>
                                        </div>
                                    ))}
                                    {targetChannelIds.length > 50 && (
                                        <div className="p-2 text-center text-slate-400 border-t border-slate-600 mt-2 pt-2">
                                            ... 그 외 {targetChannelIds.length - 50}개 채널 (상위 50개만 표시)
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-slate-500 text-center text-base py-4">처리할 채널이 없습니다.</p>
                            )}
                        </div>
                        <p className="text-base text-slate-400">총 {targetChannelIds.length}개 채널 선택됨 {step3Complete && <span className="text-green-400">✓ 자동 확정됨</span>}</p>
                    </div>
                </Step>
                </div>
                </div>


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
                                                'title', 'publishedAt', 'country', 'customUrl', 'channelUrl', 'thumbnailDefault',
                                                'subscriberCount', 'videoCount', 'viewCount', 'topicCategories', 'uploadsPlaylistId'
                                            ]);
                                            setSelectedFields(preset1Fields);
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors font-medium"
                                    >
                                        옵션값 1 (11개 필드)
                                    </button>
                                    <button
                                        onClick={() => setSelectedFields(new Set())}
                                        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-md transition-colors"
                                    >
                                        전체 해제
                                    </button>
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                    옵션값 1: 채널제목, 개설일, 국가, 지정URL, 채널URL, 프로필아이콘88×88, 구독자수, 총영상수, 총조회수, 토픽카테고리, 업로드플레이리스트ID
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
                            <div className="flex items-center justify-between mb-3 border-b border-slate-600 pb-2">
                                <h3 className="text-xl font-semibold text-slate-100">
                                    응용 데이터 (가공) <span className="text-base font-normal text-slate-400 ml-2">({appliedFields.size} / {totalAppliedFields})</span>
                                </h3>
                                <InfoButton onClick={() => setShowFieldMappingModal(true)} />
                            </div>
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
                                                        <div className="mt-2 pt-2 border-t border-slate-600">
                                                            <p className="text-2xl font-bold text-yellow-400 text-center">
                                                                {getShortKey(field.id)}
                                                            </p>
                                                        </div>
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
                            처리 시작
                            </button>
                            
                            {/* 진행상황 표시 */}
                            {processingProgress.isActive && (
                                <div className="mt-4 p-4 bg-slate-700 rounded-lg border border-slate-600">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-white font-medium">처리 진행상황</span>
                                        <span className="text-blue-400 font-bold">
                                            {processingProgress.currentIndex}/{processingProgress.totalCount}
                                        </span>
                                    </div>
                                    
                                    {/* 프로그레스 바 */}
                                    <div className="w-full bg-slate-600 rounded-full h-2 mb-3">
                                        <div 
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                                            style={{ 
                                                width: `${processingProgress.totalCount > 0 ? (processingProgress.currentIndex / processingProgress.totalCount) * 100 : 0}%` 
                                            }}
                                        ></div>
                                    </div>
                                    
                                    {/* 현재 상태 */}
                                    <div className="text-sm text-gray-300">
                                        <div className="mb-1">
                                            <span className="text-blue-400">현재 채널:</span> {processingProgress.currentChannelName || 'N/A'}
                                        </div>
                                        <div>
                                            <span className="text-green-400">상태:</span> {processingProgress.currentStep}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Step>
                
                {/* Step 5: Process and Log */}
                 {(isProcessingStarted || allStepsComplete) && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-white mb-4">실행 및 로그</h3>
                        {/* 처리 중일 때만 일시정지/재개/중지 버튼 표시 */}
                        {isProcessing && (
                            <div className="flex gap-4 mb-4">
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
                            </div>
                        )}
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

            {/* Field Mapping Modal */}
            {showFieldMappingModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowFieldMappingModal(false)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">📋 응용 데이터 필드 매핑표</h3>
                            <button onClick={() => setShowFieldMappingModal(false)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-white mb-2">🎯 용량 최적화 목적</h4>
                                <p className="text-slate-200 mb-3">
                                    시계열 데이터의 특성상 매일 스냅샷이 누적됩니다. 긴 변수명을 4글자로 축약하여 
                                    <span className="text-green-400 font-semibold"> 연간 수십GB 용량을 절약</span>할 수 있습니다.
                                </p>
                                <div className="bg-slate-700 rounded p-3 text-sm">
                                    <p className="text-yellow-300">예시: estimatedShortsViews (18자) → vesv (4자) = 78% 절약</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Growth Metrics */}
                                <div className="bg-slate-700/30 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-green-400 mb-3">📈 성장 지표 (g로 시작)</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gavg</span>
                                            <span className="text-slate-400">averageViewsPerVideo</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gsub</span>
                                            <span className="text-slate-400">subscribersPerVideo</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gvps</span>
                                            <span className="text-slate-400">viewsPerSubscriber</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gage</span>
                                            <span className="text-slate-400">channelAgeInDays</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gupw</span>
                                            <span className="text-slate-400">uploadsPerWeek</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gspd</span>
                                            <span className="text-slate-400">subsGainedPerDay</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gvpd</span>
                                            <span className="text-slate-400">viewsGainedPerDay</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gspm</span>
                                            <span className="text-slate-400">subsGainedPerMonth</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gspy</span>
                                            <span className="text-slate-400">subsGainedPerYear</span>
                                        </div>
                                        {/* gsvr 제거됨 - gsub와 중복 */}
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">gvir</span>
                                            <span className="text-slate-400">viralIndex</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Analysis */}
                                <div className="bg-slate-700/30 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-orange-400 mb-3">📹 콘텐츠 분석 (c로 시작)</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">csct</span>
                                            <span className="text-slate-400">shortsCount</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">clct</span>
                                            <span className="text-slate-400">longformCount</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">csdr</span>
                                            <span className="text-slate-400">totalShortsDuration</span>
                                        </div>
                                    </div>
                                </div>

                                {/* View Analysis */}
                                <div className="bg-slate-700/30 rounded-lg p-4">
                                    <h4 className="text-lg font-semibold text-purple-400 mb-3">👁️ 조회수 분석 (v로 시작)</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">vesv</span>
                                            <span className="text-slate-400">estimatedShortsViews</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">vsvp</span>
                                            <span className="text-slate-400">shortsViewsPercentage</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">velv</span>
                                            <span className="text-slate-400">estimatedLongformViews</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-300">vlvp</span>
                                            <span className="text-slate-400">longformViewsPercentage</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-white mb-2">📊 JSON 저장 구조</h4>
                                <div className="bg-slate-800 rounded p-3 text-sm font-mono">
                                    <pre className="text-green-400">{`{
  "fieldMapping": {
    "gavg": "averageViewsPerVideo (영상당 평균 조회수)",
    "gsub": "subscribersPerVideo (구독 전환율 %)",
    "gvps": "viewsPerSubscriber (구독자당 조회수)"
  },
  "snapshots": [
    {
      "ts": "2025-09-04T10:24:35.483Z",
      "gavg": 104876115,
      "gsub": 0.457,
      "gvps": 21879
    }
  ]
}`}</pre>
                                </div>
                            </div>

                            <div className="bg-yellow-600/20 rounded-lg p-4">
                                <h4 className="text-lg font-semibold text-yellow-400 mb-2">💡 축약 규칙</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="font-semibold text-green-400">Growth (g):</span>
                                        <p className="text-slate-300">성장 지표 관련</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-orange-400">Content (c):</span>
                                        <p className="text-slate-300">콘텐츠 분석 관련</p>
                                    </div>
                                    <div>
                                        <span className="font-semibold text-purple-400">View (v):</span>
                                        <p className="text-slate-300">조회수 분석 관련</p>
                                    </div>
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
