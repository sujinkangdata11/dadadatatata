
export interface Snapshot {
  ts: string; // timestamp -> ts
  // 기본 채널 정보 (변경 가능)
  title?: string;
  customUrl?: string;
  thumbnailUrl?: string;
  thumbnailDefault?: string;
  thumbnailMedium?: string;
  thumbnailHigh?: string;
  // 수치 데이터 (계산용으로는 포함, 저장할 때만 제외)
  subscriberCount?: string; // 계산에는 필요하지만 저장 시 subscriberHistory로 이동
  viewCount?: string;
  videoCount?: string;
  hiddenSubscriberCount?: boolean;
  // Applied Data - Short Keys
  gavg?: number; // averageViewsPerVideo
  gsub?: number; // subscribersPerVideo  
  gvps?: number; // viewsPerSubscriber
  gage?: number; // channelAgeInDays
  gupw?: number; // uploadsPerWeek
  gspd?: number; // subsGainedPerDay
  gvpd?: number; // viewsGainedPerDay
  gspm?: number; // subsGainedPerMonth
  gspy?: number; // subsGainedPerYear
  // gsvr?: number; // subscriberToViewRatioPercent - 제거됨 (gsub와 중복)
  gvir?: number; // viralIndex
  // Content Analysis
  csct?: number; // shortsCount
  clct?: number; // longformCount
  csdr?: number; // totalShortsDuration
  // View Analysis  
  vesv?: number; // estimatedShortsViews
  vsvp?: number; // shortsViewsPercentage
  velv?: number; // estimatedLongformViews
  vlvp?: number; // longformViewsPercentage
}

export interface SubscriberHistoryEntry {
  month: string; // "2024-09" 형태
  count: string; // 구독자 수
}

export interface ChannelData {
  channelId: string;
  // Static Data (절대 안바뀌는 것만)
  staticData?: {
    publishedAt?: string; // 채널 생성날짜만
  };
  // Snapshots (최신 1개만, subscriberCount 제외)
  snapshots: Snapshot[];
  // Subscriber History (월별 5개 유지)
  subscriberHistory?: SubscriberHistoryEntry[];
  // Metadata (간소화된 구조)
  metadata?: {
    firstCollected: string;
    lastUpdated: string;
    totalCollections: number;
  };
  // Legacy fields for backwards compatibility (deprecated)
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
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

export interface DriveFile {
    kind: string;
    id: string;
    name: string;
    mimeType: string;
}

export enum LogStatus {
    INFO = 'INFO',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    PENDING = 'PENDING',
}

export interface LogEntry {
    id: number;
    message: string;
    status: LogStatus;
    timestamp: string;
}

// FIX: Added type declarations for import.meta.env to resolve "Property 'env' does not exist on type 'ImportMeta'" error in App.tsx.
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_DRIVE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// FIX: Added global declarations for 'gapi' and 'google' to a central file to avoid "Cannot redeclare block-scoped variable" errors.
declare global {
  // eslint-disable-next-line no-unused-vars
  const gapi: any;
  // eslint-disable-next-line no-unused-vars
  const google: any;
}