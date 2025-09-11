import { DriveFile } from '../types';

// 브라우저 환경에서 로컬 저장을 위한 유틸리티
const downloadJsonFile = (fileName: string, content: object): void => {
    const jsonContent = JSON.stringify(content, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// 메모리에 저장된 파일들 (세션 동안만 유지)
const localFileStorage: Map<string, object> = new Map();

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

// 브라우저 환경에서는 폴더 생성 불필요

export const findFileByName = async (fileName: string, folderId: string): Promise<DriveFile | null> => {
    try {
        if (localFileStorage.has(fileName)) {
            return {
                id: fileName,
                name: fileName,
                kind: 'drive#file',
                mimeType: 'application/json'
            };
        }
        
        return null;
    } catch (error: any) {
        console.error('Error finding file:', error);
        throw new Error(`Failed to search for file: ${error.message}`);
    }
}

export const getFileContent = async (fileId: string): Promise<string> => {
    try {
        const content = localFileStorage.get(fileId);
        if (content) {
            return JSON.stringify(content, null, 2);
        }
        throw new Error(`File not found: ${fileId}`);
    } catch (error: any) {
        throw new Error(`Failed to get file content: ${error.message}`);
    }
}

export const createJsonFile = async (fileName: string, folderId: string, content: object): Promise<DriveFile> => {
    console.log(`🚀 [createJsonFile] 시작: ${fileName} (브라우저 다운로드)`);
    
    try {
        // 메모리에 저장
        localFileStorage.set(fileName, content);
        
        // 채널 인덱스 파일은 다운로드하지 않음
        if (!fileName.includes('_channel_index.json')) {
            // 브라우저에서 자동 다운로드 (채널 데이터만)
            downloadJsonFile(fileName, content);
            console.log(`✅ [createJsonFile] 성공: ${fileName} (다운로드됨)`);
        } else {
            console.log(`✅ [createJsonFile] 성공: ${fileName} (인덱스 파일이므로 메모리에만 저장)`);
        }
        
        return {
            id: fileName,
            name: fileName,
            kind: 'drive#file',
            mimeType: 'application/json'
        };
    } catch (error: any) {
        console.error(`❌ [createJsonFile] 처리 실패: ${fileName}`, error);
        throw new Error(`Failed to process file: ${error.message}`);
    }
}

export const updateJsonFile = async (fileId: string, content: object): Promise<DriveFile> => {
    try {
        // 메모리에 업데이트
        localFileStorage.set(fileId, content);
        
        // 채널 인덱스 파일은 다운로드하지 않음
        if (!fileId.includes('_channel_index.json')) {
            // 브라우저에서 자동 다운로드 (채널 데이터만)
            downloadJsonFile(fileId, content);
        }
        
        return {
            id: fileId,
            name: fileId,
            kind: 'drive#file',
            mimeType: 'application/json'
        };
    } catch (error: any) {
        throw new Error(`Failed to update and download file: ${error.message}`);
    }
}

// createFolder 함수 제거됨 - 로컬 저장으로 변경됨

export const updateOrCreateChannelFile = async (
    channelData: any, 
    folderId: string
): Promise<void> => {
    try {
        const fileName = `${channelData.channelId}.json`;
        
        // 기존 채널 파일이 있는지 확인 (folderId가 이미 channels 폴더임)
        console.log(`🔍 [DEBUG] 파일 검색 중: ${fileName} in ${folderId}`);
        const existingFile = await findFileByName(fileName, folderId);
        console.log(`📁 [DEBUG] 기존 파일 검색 결과:`, existingFile ? '있음' : '없음');
        
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
            console.log(`✅ 기존 파일 업데이트 완료: ${fileName}`);
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
            
            console.log(`🆕 새 파일 생성 시도: ${fileName}`);
            await createJsonFile(fileName, folderId, newChannelData);
            console.log(`✅ 새 파일 생성 완료: ${fileName}`);
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
            // 채널 인덱스를 로컬 json 폴더에 저장
            await updateChannelIndex('local', channelInfo);
        } catch (indexError) {
            console.warn(`채널 인덱스 업데이트 실패 (채널 저장은 성공): ${indexError}`);
            // 인덱스 업데이트 실패해도 채널 저장은 성공한 것으로 처리
        }

    } catch (error: any) {
        console.error(`채널 ${channelData.channelId} 파일 처리 오류:`, error);
        console.error('오류 상세:', error.message);
        console.error('오류 스택:', error.stack);
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
    // 로컬 저장으로 변경되어 폴더 목록이 필요없음
    // 기본 로컬 폴더 반환
    return [{
        id: 'local',
        name: 'Local JSON Storage',
        kind: 'drive#file',
        mimeType: 'application/vnd.google-apps.folder'
    }];
}