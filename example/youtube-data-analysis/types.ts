// YouTube 채널 데이터 분석용 TypeScript 인터페이스
// 작성자: 20년차 시니어 개발자

export interface Snapshot {
  ts: string; // timestamp -> ts (UTC 기준 시간)
  subscriberCount?: string;    // 구독자 수
  viewCount?: string;          // 총 조회수  
  videoCount?: string;         // 영상 개수
  hiddenSubscriberCount?: boolean; // 구독자 수 숨김 여부
  
  // 📊 Applied Data - Short Keys (응용 데이터 - 축약키)
  // G그룹: 일반 성과 지표 (General Performance)
  gavg?: number; // averageViewsPerVideo - 영상당 평균 조회수
  gsub?: number; // subscriberConversionRate - 구독 전환율 (%)  
  gvps?: number; // viewsPerSubscriber - 구독자 1명당 조회수
  gage?: number; // channelAgeInDays - 채널 나이 (일)
  gupw?: number; // uploadsPerWeek - 주당 업로드 수
  
  // 성장 지표 (Growth Metrics)
  gspd?: number; // subsGainedPerDay - 하루 구독자 증가수
  gvpd?: number; // viewsGainedPerDay - 하루 조회수 증가량
  gspm?: number; // subsGainedPerMonth - 한 달 구독자 증가수
  gspy?: number; // subsGainedPerYear - 1년 구독자 증가수
  gsvr?: number; // subscriberToViewRatioPercent - 구독자/조회수 비율
  gvir?: number; // viralIndex - 바이럴 지수 (화제성 점수)
  
  // 📹 Content Analysis (콘텐츠 분석)
  csct?: number; // shortsCount - 숏폼 영상 개수
  clct?: number; // longformCount - 롱폼 영상 개수  
  csdr?: number; // totalShortsDuration - 숏폼 총 재생시간 (초)
  
  // 👁️ View Analysis (조회수 분석)
  vesv?: number; // estimatedShortsViews - 숏폼 예상 조회수
  vsvp?: number; // shortsViewsPercentage - 숏폼 조회수 비율 (%)
  velv?: number; // estimatedLongformViews - 롱폼 예상 조회수
  vlvp?: number; // longformViewsPercentage - 롱폼 조회수 비율 (%)
}

export interface ChannelData {
  channelId: string;
  
  // 📋 Static Data (정적 데이터 - 채널 기본 정보)
  staticData?: {
    title?: string;              // 채널명
    description?: string;        // 채널 설명
    customUrl?: string;          // 커스텀 URL (@채널명)
    publishedAt?: string;        // 채널 개설일
    thumbnailUrl?: string;       // 썸네일 URL
    thumbnailDefault?: string;   // 기본 썸네일
    thumbnailMedium?: string;    // 중간 썸네일
    thumbnailHigh?: string;      // 고화질 썸네일
    defaultLanguage?: string;    // 기본 언어
    country?: string;            // 국가
    keywords?: string;           // 키워드
    bannerExternalUrl?: string;  // 배너 URL
    unsubscribedTrailer?: string; // 구독 전 예고편
    uploadsPlaylistId?: string;   // 업로드 플레이리스트 ID
    topicIds?: string[];         // 주제 ID 배열
    topicCategories?: string[];  // 주제 카테고리 배열
    privacyStatus?: string;      // 공개 상태
    isLinked?: boolean;          // 연결 여부
    longUploadsStatus?: string;  // 긴 영상 업로드 상태
    madeForKids?: boolean;       // 어린이 대상 여부
    selfDeclaredMadeForKids?: boolean; // 자체 신고 어린이 대상 여부
  };
  
  // 하위 호환성을 위한 레거시 필드들
  title?: string;
  description?: string;
  customUrl?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  thumbnailDefault?: string;
  thumbnailMedium?: string;
  thumbnailHigh?: string;
  defaultLanguage?: string;
  country?: string;
  keywords?: string;
  bannerExternalUrl?: string;
  unsubscribedTrailer?: string;
  uploadsPlaylistId?: string;
  topicIds?: string[];
  topicCategories?: string[];
  privacyStatus?: string;
  isLinked?: boolean;
  longUploadsStatus?: string;
  madeForKids?: boolean;
  selfDeclaredMadeForKids?: boolean;
  
  // 📈 Snapshots (스냅샷 - 시간별 데이터)
  snapshots: Snapshot[];
  
  // 📊 Metadata (메타데이터 - 수집 정보)
  metadata?: {
    firstCollected: string;    // 첫 수집 시간
    lastUpdated: string;      // 마지막 업데이트 시간
    totalCollections: number; // 총 수집 횟수
  };
}

export interface GoogleUser {
  name: string;      // 사용자 이름
  email: string;     // 이메일
  picture: string;   // 프로필 사진 URL
}

export interface DriveFile {
    kind: string;      // 파일 종류
    id: string;        // 파일 ID
    name: string;      // 파일명
    mimeType: string;  // MIME 타입
}

export enum LogStatus {
    INFO = 'INFO',       // 정보
    SUCCESS = 'SUCCESS', // 성공
    ERROR = 'ERROR',     // 에러
    WARNING = 'WARNING', // 경고
    PENDING = 'PENDING', // 진행 중
}

export interface LogEntry {
    id: number;          // 로그 ID
    message: string;     // 로그 메시지
    status: LogStatus;   // 로그 상태
    timestamp: string;   // 타임스탬프
}

// 🎯 후배 개발자를 위한 팁:
// 1. 이 파일을 참고서로 활용하세요
// 2. 축약어가 헷갈리면 여기 주석을 확인하세요  
// 3. IDE에서 자동완성이 작동합니다
// 4. 모든 필드는 optional(?)이므로 null 체크 필요합니다