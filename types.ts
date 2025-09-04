
export interface Snapshot {
  timestamp: string;
  subscriberCount?: string;
  viewCount?: string;
  videoCount?: string;
  hiddenSubscriberCount?: boolean;
  // Applied Data
  averageViewsPerVideo?: number;
  subscribersPerVideo?: number;
  viewsPerSubscriber?: number;
  channelAgeInDays?: number;
  uploadsPerWeek?: number;
  uploadsPerMonth?: number;
  subsGainedPerDay?: number;
  viewsGainedPerDay?: number;
  subscriberToViewRatioPercent?: number;
  viralIndex?: number;
  subsGainedPerMonth?: number;
  subsGainedPerYear?: number;
  // Content Analysis
  shortsCount?: number;
  longformCount?: number;
  totalShortsDuration?: number;
  // View Analysis
  estimatedShortsViews?: number;
  shortsViewsPercentage?: number;
  longformViewsPercentage?: number;
  estimatedLongformViews?: number;
}

export interface ChannelData {
  channelId: string;
  // Snippet
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
  // Branding
  keywords?: string;
  bannerExternalUrl?: string;
  unsubscribedTrailer?: string;
  // Content Details
  uploadsPlaylistId?: string;
  // Topic Details
  topicIds?: string[];
  topicCategories?: string[];
  // Status
  privacyStatus?: string;
  isLinked?: boolean;
  longUploadsStatus?: string;
  madeForKids?: boolean;
  selfDeclaredMadeForKids?: boolean;
  // Snapshots
  snapshots: Snapshot[];
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