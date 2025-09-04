import { DriveFile } from '../types';

const API_BASE_URL = 'https://www.googleapis.com/drive/v3';
const API_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

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
        
        const newSnapshot = {
            timestamp: new Date().toISOString(),
            ...channelData.snapshot
        };

        let totalSnapshots = 1;
        const now = new Date().toISOString();

        if (existingFile) {
            // 기존 파일 업데이트 - 스냅샷 추가 + Static 데이터 덮어쓰기
            const existingContent = await getFileContent(existingFile.id);
            const existingData = JSON.parse(existingContent);
            
            // 🔄 Static 데이터는 항상 최신으로 덮어쓰기 (채널명, 프로필 등이 바뀔 수 있음)
            existingData.staticData = channelData.staticData; // 완전 덮어쓰기
            
            // 📈 스냅샷은 시간별로 누적 (증가 추이 분석용)
            existingData.snapshots = existingData.snapshots || [];
            existingData.snapshots.push(newSnapshot);
            totalSnapshots = existingData.snapshots.length;
            
            // 메타데이터 업데이트 (간소화된 3개 필드만)
            existingData.metadata = {
                firstCollected: existingData.metadata?.firstCollected || newSnapshot.timestamp,
                lastUpdated: newSnapshot.timestamp,
                totalCollections: totalSnapshots
            };

            await updateJsonFile(existingFile.id, existingData);
        } else {
            // 새 파일 생성 (간소화된 메타데이터)
            const newChannelData = {
                channelId: channelData.channelId,
                staticData: channelData.staticData,
                snapshots: [newSnapshot],
                metadata: {
                    firstCollected: newSnapshot.timestamp,
                    lastUpdated: newSnapshot.timestamp,
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
            totalSnapshots
        };

        await updateChannelIndex(folderId, channelInfo);

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
        const existingIndexFile = await findFileByName(indexFileName, folderId);
        
        if (!existingIndexFile) {
            throw new Error('채널 인덱스 파일을 찾을 수 없습니다.');
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