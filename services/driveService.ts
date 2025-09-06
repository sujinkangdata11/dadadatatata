import { DriveFile } from '../types';

const API_BASE_URL = 'https://www.googleapis.com/drive/v3';
const API_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

// 구독자 히스토리 관리 함수 (월별 최대 5개 유지)
const updateSubscriberHistory = (existingHistory: any[] = [], newSubscriberCount: string): any[] => {
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-09" 형태
    
    // 기존 히스토리에서 현재 월 데이터가 있는지 확인
    const existingIndex = existingHistory.findIndex(item => item.month === currentMonth);
    
    if (existingIndex >= 0) {
        // 같은 달이면 덮어쓰기
        existingHistory[existingIndex].count = newSubscriberCount;
        return existingHistory;
    } else {
        // 새로운 달이면 맨 앞에 추가
        const newHistory = [
            { month: currentMonth, count: newSubscriberCount },
            ...existingHistory
        ];
        
        // 최대 5개까지만 유지 (오래된 것 삭제)
        return newHistory.slice(0, 5);
    }
};

// FIX: Removed 'declare global' block for 'gapi' which was causing a "Cannot redeclare block-scoped variable" error.
// The type is now defined globally in `types.ts`.
const getAuthToken = (): string => {
    const token = gapi.client.getToken();
    return token?.access_token || '';
}

export const findFileByName = async (fileName: string, folderId: string): Promise<DriveFile | null> => {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, kind, mimeType)',
            spaces: 'drive',
        });
        const files = response.result.files;
        return files.length > 0 ? files[0] : null;
    } catch (error: any) {
        console.error('Error finding file:', error);
        throw new Error(`Failed to search for file in Drive: ${error.result?.error?.message || error.message}`);
    }
}

export const getFileContent = async (fileId: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}?alt=media`, {
        method: 'GET',
        headers: new Headers({ 'Authorization': `Bearer ${getAuthToken()}` })
    });
    if (!response.ok) {
        throw new Error(`Failed to get file content: ${response.statusText}`);
    }
    return response.text();
}

export const createJsonFile = async (fileName: string, folderId: string, content: object): Promise<DriveFile> => {
    const fileMetadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(content, null, 2) +
      close_delim;

    const response = await fetch(`${API_UPLOAD_URL}/files?uploadType=multipart`, {
        method: 'POST',
        headers: new Headers({ 
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        }),
        body: multipartRequestBody
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create file: ${errorData.error.message || response.statusText}`);
    }

    return response.json();
}

export const updateJsonFile = async (fileId: string, content: object): Promise<DriveFile> => {
     const response = await fetch(`${API_UPLOAD_URL}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: new Headers({ 
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify(content, null, 2),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update file: ${errorData.error.message || response.statusText}`);
    }
    return response.json();
}

export const createFolder = async (folderName: string, parentId: string): Promise<DriveFile> => {
    try {
        const response = await gapi.client.drive.files.create({
            resource: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId]
            },
            fields: 'id, name, mimeType'
        });
        return response.result;
    } catch (error: any) {
        console.error('폴더 생성 오류:', error);
        throw new Error(`Failed to create folder: ${error.result?.error?.message || error.message}`);
    }
};

export const updateOrCreateChannelFile = async (
    channelData: any, 
    folderId: string
): Promise<void> => {
    try {
        const fileName = `${channelData.channelId}.json`;
        
        // channels 폴더가 있는지 확인, 없으면 생성
        let channelsFolder = await findFileByName('channels', folderId);
        if (!channelsFolder) {
            channelsFolder = await createFolder('channels', folderId);
        }

        // 기존 채널 파일이 있는지 확인
        const existingFile = await findFileByName(fileName, channelsFolder.id);
        
        const now = new Date().toISOString();

        // 새로운 스냅샷 생성 (staticData + snapshotData 합침, subscriberCount 제외)
        const { subscriberCount, ...snapshotWithoutSubscriber } = channelData.snapshot;
        const { publishedAt, ...staticDataForSnapshot } = channelData.staticData || {};
        
        const newSnapshot = {
            ts: now,
            // staticData의 필드들 (채널 정보, 이미지 등)
            ...staticDataForSnapshot,
            // snapshotData의 필드들 (수치 데이터, 응용데이터 등)
            ...snapshotWithoutSubscriber
        };

        if (existingFile) {
            // 기존 파일 업데이트
            const existingContent = await getFileContent(existingFile.id);
            const existingData = JSON.parse(existingContent);
            
            // 1. 정적 데이터 (채널 생성날짜만 유지)
            const updatedStaticData = {
                publishedAt: channelData.staticData?.publishedAt || existingData.staticData?.publishedAt
            };
            
            // 2. 스냅샷 데이터 (최신 1개로 덮어쓰기)
            const updatedSnapshots = [newSnapshot];
            
            // 3. 구독자 히스토리 (월별 5개 관리)
            const updatedSubscriberHistory = updateSubscriberHistory(
                existingData.subscriberHistory || [], 
                subscriberCount
            );
            
            // 4. 메타데이터 업데이트
            const updatedMetadata = {
                firstCollected: existingData.metadata?.firstCollected || now,
                lastUpdated: now,
                totalCollections: (existingData.metadata?.totalCollections || 0) + 1
            };

            const updatedChannelData = {
                channelId: channelData.channelId,
                staticData: updatedStaticData,
                snapshots: updatedSnapshots,
                subscriberHistory: updatedSubscriberHistory,
                metadata: updatedMetadata
            };

            await updateJsonFile(existingFile.id, updatedChannelData);
        } else {
            // 새 파일 생성
            const newChannelData = {
                channelId: channelData.channelId,
                staticData: {
                    publishedAt: channelData.staticData?.publishedAt
                },
                snapshots: [newSnapshot],
                subscriberHistory: updateSubscriberHistory([], subscriberCount),
                metadata: {
                    firstCollected: now,
                    lastUpdated: now,
                    totalCollections: 1
                }
            };
            
            await createJsonFile(fileName, channelsFolder.id, newChannelData);
        }

        // 채널 인덱스 업데이트
        const channelInfo = {
            channelId: channelData.channelId,
            title: channelData.staticData?.title || 'Unknown',
            firstCollected: existingFile ? undefined : now, // 새 채널일때만 설정
            lastUpdated: now,
            totalSnapshots: existingFile ? 
                (JSON.parse(await getFileContent(existingFile.id)).metadata?.totalCollections || 1) : 1
        };

        try {
            // IMPORTANT: 채널 인덱스는 항상 루트('root')에 저장
            // 개별 채널 파일은 사용자 선택 폴더에, 인덱스는 루트에 분리 저장
            // 문제 발생시 이 부분을 'root' 대신 folderId로 변경 가능
            await updateChannelIndex('root', channelInfo);
        } catch (indexError) {
            console.warn(`채널 인덱스 업데이트 실패 (채널 저장은 성공): ${indexError}`);
            // 인덱스 업데이트 실패해도 채널 저장은 성공한 것으로 처리
        }

    } catch (error: any) {
        console.error(`채널 ${channelData.channelId} 파일 처리 오류:`, error);
        throw error;
    }
};

export const getOrCreateChannelIndex = async (folderId: string): Promise<any> => {
    try {
        const indexFileName = '_channel_index.json';
        const existingIndex = await findFileByName(indexFileName, folderId);
        
        if (existingIndex) {
            // 기존 인덱스 파일 로드
            const content = await getFileContent(existingIndex.id);
            return JSON.parse(content);
        } else {
            // 새로운 인덱스 파일 생성
            const newIndex = {
                lastUpdated: new Date().toISOString(),
                totalChannels: 0,
                channels: []
            };
            await createJsonFile(indexFileName, folderId, newIndex);
            return newIndex;
        }
    } catch (error) {
        console.error('채널 인덱스 처리 오류:', error);
        throw error;
    }
};

export const updateChannelIndex = async (folderId: string, channelInfo: any): Promise<void> => {
    try {
        const indexFileName = '_channel_index.json';
        let existingIndexFile = await findFileByName(indexFileName, folderId);
        
        if (!existingIndexFile) {
            // 인덱스 파일이 없으면 자동 생성
            console.log(`인덱스 파일이 없어서 새로 생성합니다: ${folderId}/${indexFileName}`);
            await getOrCreateChannelIndex(folderId);
            // 생성 후 다시 찾기
            existingIndexFile = await findFileByName(indexFileName, folderId);
            if (!existingIndexFile) {
                throw new Error('인덱스 파일 생성 후에도 찾을 수 없습니다.');
            }
        }
        
        const currentIndex = JSON.parse(await getFileContent(existingIndexFile.id));
        
        // 기존 채널 찾기
        const existingChannelIndex = currentIndex.channels.findIndex((ch: any) => ch.channelId === channelInfo.channelId);
        
        if (existingChannelIndex >= 0) {
            // 기존 채널 업데이트
            currentIndex.channels[existingChannelIndex] = {
                ...currentIndex.channels[existingChannelIndex],
                lastUpdated: channelInfo.lastUpdated,
                totalSnapshots: channelInfo.totalSnapshots
            };
        } else {
            // 새 채널 추가
            currentIndex.channels.push(channelInfo);
            currentIndex.totalChannels = currentIndex.channels.length;
        }
        
        currentIndex.lastUpdated = new Date().toISOString();
        
        await updateJsonFile(existingIndexFile.id, currentIndex);
    } catch (error) {
        console.error('채널 인덱스 업데이트 오류:', error);
        throw error;
    }
};

export const getExistingChannelIds = async (folderId: string): Promise<string[]> => {
    try {
        const channelIndex = await getOrCreateChannelIndex(folderId);
        return channelIndex.channels.map((ch: any) => ch.channelId);
    } catch (error) {
        console.error('기존 채널 ID 조회 오류:', error);
        return [];
    }
};

export const listFolders = async (): Promise<DriveFile[]> => {
    try {
        console.log('Drive API 호출 시작...');
        console.log('gapi:', typeof gapi);
        console.log('gapi.client:', typeof gapi.client);
        console.log('gapi.client.drive:', typeof gapi.client.drive);
        
        // 토큰 확인
        const token = gapi.client.getToken();
        console.log('현재 토큰:', token);
        
        // gapi 클라이언트가 준비되었는지 확인
        if (!gapi.client.drive) {
            throw new Error('Drive API 클라이언트가 초기화되지 않았습니다');
        }
        
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name, parents)',
            orderBy: 'name',
            pageSize: 100,
        });
        
        console.log('Drive API 응답:', response);
        console.log('폴더 개수:', response.result.files?.length || 0);
        
        return response.result.files || [];
    } catch (error: any) {
        console.error('폴더 목록 오류 상세:', error);
        console.error('오류 타입:', typeof error);
        console.error('오류 결과:', error.result);
        throw new Error(`Failed to list folders: ${error.result?.error?.message || error.message}`);
    }
}