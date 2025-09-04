
export interface Snapshot {
  ts: string; // timestamp -> ts
  subscriberCount?: string;
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
  gsvr?: number; // subscriberToViewRatioPercent
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

export interface ChannelData {
  channelId: string;
  // Static Data
  staticData?: {
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
  };
  // Legacy fields for backwards compatibility
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
  // Snapshots
  snapshots: Snapshot[];
  // Metadata (간소화된 구조)
  metadata?: {
    firstCollected: string;
    lastUpdated: string;
    totalCollections: number;
  };
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