
import { ChannelData, Snapshot } from '../types';

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const fetchSelectedChannelData = async (
  channelId: string,
  apiKey: string,
  fields: Set<string>
): Promise<{ staticData: Partial<ChannelData>, snapshotData: Snapshot }> => {
  
  const partMapping: { [key: string]: string } = {
    // snippet
    title: 'snippet',
    description: 'snippet',
    customUrl: 'snippet',
    publishedAt: 'snippet',
    thumbnailUrl: 'snippet',
    defaultLanguage: 'snippet',
    country: 'snippet',
    // statistics
    subscriberCount: 'statistics',
    viewCount: 'statistics',
    videoCount: 'statistics',
    hiddenSubscriberCount: 'statistics',
    // brandingSettings
    keywords: 'brandingSettings',
    bannerExternalUrl: 'brandingSettings',
    unsubscribedTrailer: 'brandingSettings',
    // contentDetails
    uploadsPlaylistId: 'contentDetails',
    // topicDetails
    topicIds: 'topicDetails',
    topicCategories: 'topicDetails',
    // status
    privacyStatus: 'status',
    isLinked: 'status',
    longUploadsStatus: 'status',
    madeForKids: 'status',
    selfDeclaredMadeForKids: 'status',
  };

  const parts = new Set<string>();
  fields.forEach(field => {
    if (partMapping[field]) {
      parts.add(partMapping[field]);
    }
  });

  if (parts.size === 0) {
    return { staticData: {}, snapshotData: { ts: new Date().toISOString() } };
  }

  const url = `${API_BASE_URL}/channels?part=${Array.from(parts).join(',')}&id=${channelId}&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`YouTube API error: ${errorData.error.message || response.statusText}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel with ID ${channelId} not found.`);
  }

  const item = data.items[0];
  const staticData: Partial<ChannelData> = {};
  const snapshotData: Snapshot = { ts: new Date().toISOString() };

  // Map snippet data
  if (parts.has('snippet') && item.snippet) {
    if (fields.has('title')) staticData.title = item.snippet.title;
    if (fields.has('description')) staticData.description = item.snippet.description;
    if (fields.has('customUrl')) staticData.customUrl = item.snippet.customUrl;
    if (fields.has('publishedAt')) staticData.publishedAt = item.snippet.publishedAt;
    if (fields.has('defaultLanguage')) staticData.defaultLanguage = item.snippet.defaultLanguage;
    if (fields.has('country')) staticData.country = item.snippet.country;
    
    // Map thumbnail/profile icon data
    if (item.snippet.thumbnails) {
      if (fields.has('thumbnailUrl')) {
        staticData.thumbnailUrl = item.snippet.thumbnails.high?.url || 
                                 item.snippet.thumbnails.medium?.url || 
                                 item.snippet.thumbnails.default?.url;
      }
      if (fields.has('thumbnailDefault') && item.snippet.thumbnails.default) {
        staticData.thumbnailDefault = item.snippet.thumbnails.default.url;
      }
      if (fields.has('thumbnailMedium') && item.snippet.thumbnails.medium) {
        staticData.thumbnailMedium = item.snippet.thumbnails.medium.url;
      }
      if (fields.has('thumbnailHigh') && item.snippet.thumbnails.high) {
        staticData.thumbnailHigh = item.snippet.thumbnails.high.url;
      }
    }
  }

  // Map statistics data
  if (parts.has('statistics') && item.statistics) {
    if (fields.has('subscriberCount')) snapshotData.subscriberCount = item.statistics.subscriberCount || '0';
    if (fields.has('viewCount')) snapshotData.viewCount = item.statistics.viewCount || '0';
    if (fields.has('videoCount')) snapshotData.videoCount = item.statistics.videoCount || '0';
    if (fields.has('hiddenSubscriberCount')) snapshotData.hiddenSubscriberCount = item.statistics.hiddenSubscriberCount;
  }

  // Map brandingSettings data
  if (parts.has('brandingSettings') && item.brandingSettings) {
    if (fields.has('keywords') && item.brandingSettings.channel) staticData.keywords = item.brandingSettings.channel.keywords;
    if (fields.has('unsubscribedTrailer') && item.brandingSettings.channel) staticData.unsubscribedTrailer = item.brandingSettings.channel.unsubscribedTrailer;
    if (fields.has('bannerExternalUrl') && item.brandingSettings.image) {
      staticData.bannerExternalUrl = item.brandingSettings.image.bannerExternalUrl;
    }
  }

  // Map contentDetails data
  if (parts.has('contentDetails') && item.contentDetails && item.contentDetails.relatedPlaylists) {
      if (fields.has('uploadsPlaylistId')) staticData.uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;
  }

  // Map topicDetails data
  if (parts.has('topicDetails') && item.topicDetails) {
      if (fields.has('topicIds')) staticData.topicIds = item.topicDetails.topicIds;
      if (fields.has('topicCategories')) staticData.topicCategories = item.topicDetails.topicCategories;
  }
  
  // Map status data
  if (parts.has('status') && item.status) {
      if (fields.has('privacyStatus')) staticData.privacyStatus = item.status.privacyStatus;
      if (fields.has('isLinked')) staticData.isLinked = item.status.isLinked;
      if (fields.has('longUploadsStatus')) staticData.longUploadsStatus = item.status.longUploadsStatus;
      if (fields.has('madeForKids')) staticData.madeForKids = item.status.madeForKids;
      if (fields.has('selfDeclaredMadeForKids')) staticData.selfDeclaredMadeForKids = item.status.selfDeclaredMadeForKids;
  }

  return { staticData, snapshotData };
};


/**
 * Finds popular YouTube channels based on subscriber count and a specified sort order.
 * It searches for a broad set of popular channels, fetches their detailed statistics,
 * filters them by subscriber count, and then sorts them.
 * @param apiKey - The YouTube Data API v3 key.
 * @param minSubscribers - The minimum number of subscribers required.
 * @param sortOrder - The criteria to sort by: 'viewCount' (desc) or 'videoCount_asc' (asc).
 * @param maxResults - The maximum number of channel IDs to return.
 * @returns A promise that resolves to an array of channel IDs.
 */
export const findChannelsImproved = async (
  apiKey: string,
  minSubscribers: number,
  sortOrder: 'viewCount' | 'videoCount_asc',
  maxResults: number = 25,
  categoryId?: string,
  excludeChannelIds: string[] = [],
  searchKeyword: string = 'popular'
): Promise<string[]> => {
  const allFoundChannels: string[] = [];
  
  // Step 1: Get channels using user-provided search keyword
  // YouTube Search API requires a query parameter, empty queries return 0 results
  let searchUrl = `${API_BASE_URL}/search?part=snippet&type=channel&q=${searchKeyword}&order=viewCount&maxResults=50&key=${apiKey}`;
  
  // Add category filter if specified  
  if (categoryId && categoryId !== '') {
    searchUrl += `&videoCategoryId=${categoryId}`;
  }
  
  try {
    console.log('🔍 Searching with URL:', searchUrl);
    const searchResponse = await fetch(searchUrl);
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('📊 Search API Response:', searchData);
      console.log('📈 Items found:', searchData.items?.length || 0);
      if (searchData.items) {
        // Extract channel IDs and filter out existing ones immediately
        const newChannelIds = searchData.items
          .map((item: any) => item.snippet.channelId)
          .filter((id: string) => id && !excludeChannelIds.includes(id));
        
        console.log('🎯 Channel IDs found:', newChannelIds);
        allFoundChannels.push(...newChannelIds);
      }
    } else {
      console.error('❌ Search API Error:', searchResponse.status, searchResponse.statusText);
      const errorData = await searchResponse.json();
      console.error('Error details:', errorData);
    }
  } catch (error) {
    console.warn(`Channel search failed for "${searchKeyword}":`, error);
  }

  if (allFoundChannels.length === 0) {
    console.log('❌ No channels found in search step');
    return [];
  }
  
  console.log(`✅ Total channels found: ${allFoundChannels.length}`);

  // Step 2: Batch fetch statistics for all found channels
  const batchSize = 50;
  const allChannelsWithStats = [];
  
  for (let i = 0; i < allFoundChannels.length; i += batchSize) {
    const batch = allFoundChannels.slice(i, i + batchSize);
    const statsUrl = `${API_BASE_URL}/channels?part=statistics&id=${batch.join(',')}&key=${apiKey}`;
    
    try {
      const statsResponse = await fetch(statsUrl);
      if (!statsResponse.ok) continue;
      
      const statsData = await statsResponse.json();
      if (statsData.items) {
        allChannelsWithStats.push(...statsData.items);
      }
    } catch (error) {
      console.warn(`Statistics batch failed:`, error);
      continue;
    }
  }

  // Step 3: Filter by subscriber count first
  console.log(`📊 Channels with stats: ${allChannelsWithStats.length}`);
  console.log(`🎯 Max subscribers filter: ${minSubscribers}`);
  
  allChannelsWithStats.forEach((item: any, index) => {
    if (item.statistics) {
      const subCount = parseInt(item.statistics.subscriberCount, 10);
      const viewCount = parseInt(item.statistics.viewCount, 10);
      console.log(`Channel ${index + 1}: ${subCount} subs, ${viewCount} views - ${subCount <= minSubscribers ? '✅ Pass' : '❌ Filtered'}`);
    }
  });
  
  const subscriberFilteredChannels = allChannelsWithStats.filter((item: any) => 
    item.statistics && 
    parseInt(item.statistics.subscriberCount, 10) <= minSubscribers
  );
  
  console.log(`🔽 After subscriber filter: ${subscriberFilteredChannels.length} channels`);
  
  // Step 4: Sort by the requested criteria  
  if (sortOrder === 'viewCount') {
    // 총조회수 높은 순으로 정렬 (미스터비스트 등이 상위에)
    subscriberFilteredChannels.sort((a: any, b: any) => parseInt(b.statistics.viewCount, 10) - parseInt(a.statistics.viewCount, 10));
  } else if (sortOrder === 'videoCount_asc') {
    // 영상 개수 적은 순으로 정렬 
    subscriberFilteredChannels.sort((a: any, b: any) => parseInt(a.statistics.videoCount, 10) - parseInt(b.statistics.videoCount, 10));
  }
  
  const filteredChannels = subscriberFilteredChannels;

  return filteredChannels.slice(0, maxResults).map((item: any) => item.id);
};

// Legacy function for backward compatibility
export const findChannels = async (
  apiKey: string,
  minSubscribers: number,
  sortOrder: 'viewCount' | 'videoCount_asc',
  maxResults: number = 25,
  categoryId?: string
): Promise<string[]> => {
  return await findChannelsImproved(apiKey, minSubscribers, sortOrder, maxResults, categoryId, []);
};

const parseISO8601Duration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    match.shift(); // remove full match
    
    const [hours, minutes, seconds] = match.map(val => parseInt(val || '0', 10));
    
    return (hours * 3600) + (minutes * 60) + seconds;
};

export const fetchShortsCount = async (
  uploadsPlaylistId: string,
  apiKey: string
): Promise<{ shortsCount: number; totalShortsViews: number }> => {
  let videoIds: string[] = [];
  let nextPageToken: string | undefined = undefined;
  const MAX_VIDEOS = 1000; // 최신 1000개 영상만 분석

  // 1. Paginate through playlist items to gather video IDs (최신 1000개 제한)
  do {
    const playlistUrl = `${API_BASE_URL}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${nextPageToken || ''}&key=${apiKey}`;
    const playlistResponse = await fetch(playlistUrl);
    if (!playlistResponse.ok) {
        const errorData = await playlistResponse.json();
        throw new Error(`YouTube PlaylistItems API error: ${errorData.error.message || playlistResponse.statusText}`);
    }
    const playlistData = await playlistResponse.json();

    const ids = playlistData.items.map((item: any) => item.contentDetails.videoId).filter(Boolean);
    videoIds = videoIds.concat(ids);
    nextPageToken = playlistData.nextPageToken;
    
    // 1000개 제한 적용
    if (videoIds.length >= MAX_VIDEOS) {
      videoIds = videoIds.slice(0, MAX_VIDEOS);
      break;
    }
  } while (nextPageToken);

  let shortsCount = 0;
  let totalShortsViews = 0;

  // 2. Fetch video details in batches of 50 (content + statistics)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const videosUrl = `${API_BASE_URL}/videos?part=contentDetails,statistics&id=${batch.join(',')}&key=${apiKey}`;
    const videosResponse = await fetch(videosUrl);
     if (!videosResponse.ok) {
        const errorData = await videosResponse.json();
        console.warn(`Could not fetch details for batch, skipping. Error: ${errorData.error.message}`);
        continue; // Skip this batch on error
    }
    const videosData = await videosResponse.json();

    // 3. Parse duration, count Shorts, and sum their views
    for (const video of videosData.items) {
      if (video.contentDetails && video.contentDetails.duration) {
          const durationInSeconds = parseISO8601Duration(video.contentDetails.duration);
          if (durationInSeconds > 0 && durationInSeconds <= 60) {
              shortsCount++;
              // Add this short's view count to total
              const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
              totalShortsViews += viewCount;
          }
      }
    }
  }

  return { shortsCount, totalShortsViews };
};

export const fetchChannelIdByHandle = async (handle: string, apiKey:string): Promise<string> => {
    const handleName = handle.startsWith('@') ? handle.substring(1) : handle;
    const searchUrl = `${API_BASE_URL}/search?part=snippet&q=${handleName}&type=channel&maxResults=1&key=${apiKey}`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        throw new Error(`YouTube Search API error for handle: ${errorData.error.message || searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0 || !searchData.items[0].snippet.channelId) {
        throw new Error(`Channel with handle '${handle}' not found.`);
    }
    
    const channelId = searchData.items[0].snippet.channelId;
    return channelId;
};
