// YouTube 채널 데이터 고급 파싱 예제
// 작성자: 20년차 시니어 개발자 👨‍💻

// =======================================
// 📚 1. 기본 파싱 함수들
// =======================================

/**
 * 안전한 JSON 파싱 (에러 처리 포함)
 */
function safeParseJSON(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('❌ JSON 파싱 실패:', error.message);
        return null;
    }
}

/**
 * 채널 기본 정보 추출
 */
function extractBasicInfo(channelData) {
    if (!channelData || !channelData.staticData) {
        console.warn('⚠️ 채널 데이터가 없습니다');
        return null;
    }

    return {
        channelId: channelData.channelId,
        title: channelData.staticData.title,
        customUrl: channelData.staticData.customUrl,
        country: channelData.staticData.country,
        publishedAt: channelData.staticData.publishedAt,
        thumbnailUrl: channelData.staticData.thumbnailDefault
    };
}

/**
 * 최신 스냅샷 데이터 추출
 */
function getLatestSnapshot(channelData) {
    if (!channelData || !channelData.snapshots || channelData.snapshots.length === 0) {
        console.warn('⚠️ 스냅샷 데이터가 없습니다');
        return null;
    }
    
    return channelData.snapshots[0]; // 최신 스냅샷 (첫 번째)
}

// =======================================
// 📊 2. 분석 함수들
// =======================================

/**
 * 채널 성과 분석
 */
function analyzeChannelPerformance(snapshot) {
    if (!snapshot) return null;

    const subscribers = parseInt(snapshot.subscriberCount || '0');
    const views = parseInt(snapshot.viewCount || '0');
    const videos = parseInt(snapshot.videoCount || '0');

    return {
        // 기본 지표
        subscribers,
        views,
        videos,
        // 계산된 지표
        avgViewsPerVideo: snapshot.gavg || (views / videos),
        conversionRate: snapshot.gsub || ((subscribers / views) * 100),
        viewsPerSubscriber: snapshot.gvps || (views / subscribers),
        // 성장 지표
        dailySubGrowth: snapshot.gspd || 0,
        viralIndex: snapshot.gvir || 0,
        // 콘텐츠 분석
        shortsCount: snapshot.csct || 0,
        longformCount: snapshot.clct || 0,
        shortsViewsPercentage: snapshot.vsvp || 0
    };
}

/**
 * 채널 등급 매기기
 */
function rateChannel(performance) {
    if (!performance) return 'Unknown';

    const { subscribers, avgViewsPerVideo, viralIndex, conversionRate } = performance;

    // 구독자 기준 등급
    let sizeGrade = 'Micro';
    if (subscribers >= 100000000) sizeGrade = 'Mega';
    else if (subscribers >= 10000000) sizeGrade = 'Large';
    else if (subscribers >= 1000000) sizeGrade = 'Medium';
    else if (subscribers >= 100000) sizeGrade = 'Small';

    // 성과 기준 등급
    let performanceGrade = 'C';
    if (viralIndex > 100 && avgViewsPerVideo > 1000000) performanceGrade = 'S';
    else if (viralIndex > 50 && avgViewsPerVideo > 100000) performanceGrade = 'A';
    else if (avgViewsPerVideo > 10000) performanceGrade = 'B';

    return {
        size: sizeGrade,
        performance: performanceGrade,
        overall: `${sizeGrade} (${performanceGrade})`
    };
}

/**
 * 콘텐츠 전략 분석
 */
function analyzeContentStrategy(snapshot) {
    if (!snapshot) return null;

    const shortsCount = snapshot.csct || 0;
    const longformCount = snapshot.clct || 0;
    const totalVideos = shortsCount + longformCount;

    const shortsPercentage = totalVideos > 0 ? (shortsCount / totalVideos) * 100 : 0;
    const shortsViewsPercentage = snapshot.vsvp || 0;

    let strategy = 'Mixed';
    if (shortsPercentage > 70) strategy = 'Shorts-Focused';
    else if (shortsPercentage < 30) strategy = 'Long-form Focused';

    let efficiency = 'Average';
    if (shortsViewsPercentage > shortsPercentage + 20) efficiency = 'Shorts Efficient';
    else if (shortsViewsPercentage < shortsPercentage - 20) efficiency = 'Long-form Efficient';

    return {
        strategy,
        efficiency,
        shortsPercentage: shortsPercentage.toFixed(1),
        shortsViewsPercentage: shortsViewsPercentage.toFixed(1),
        totalVideos,
        shortsCount,
        longformCount
    };
}

// =======================================
// 🎯 3. 실용적인 사용 예제들
// =======================================

/**
 * 채널 완전 분석 (올인원)
 */
function fullChannelAnalysis(jsonString) {
    console.log('🔍 채널 분석을 시작합니다...\n');

    // 1. 데이터 파싱
    const channelData = safeParseJSON(jsonString);
    if (!channelData) return;

    // 2. 기본 정보 추출
    const basicInfo = extractBasicInfo(channelData);
    const snapshot = getLatestSnapshot(channelData);

    if (!basicInfo || !snapshot) {
        console.error('❌ 필수 데이터가 부족합니다');
        return;
    }

    // 3. 성과 분석
    const performance = analyzeChannelPerformance(snapshot);
    const rating = rateChannel(performance);
    const contentStrategy = analyzeContentStrategy(snapshot);

    // 4. 결과 출력
    console.log('📺 채널 정보:');
    console.log(`  • 이름: ${basicInfo.title}`);
    console.log(`  • URL: ${basicInfo.customUrl}`);
    console.log(`  • 국가: ${basicInfo.country || 'Unknown'}`);
    console.log('');

    console.log('📊 성과 지표:');
    console.log(`  • 구독자: ${performance.subscribers.toLocaleString()}명`);
    console.log(`  • 총 조회수: ${performance.views.toLocaleString()}회`);
    console.log(`  • 영상 개수: ${performance.videos.toLocaleString()}개`);
    console.log(`  • 영상당 평균 조회수: ${Math.round(performance.avgViewsPerVideo).toLocaleString()}회`);
    console.log(`  • 구독 전환율: ${performance.conversionRate.toFixed(3)}%`);
    console.log(`  • 바이럴 지수: ${performance.viralIndex}`);
    console.log('');

    console.log('🏆 채널 등급:');
    console.log(`  • 규모: ${rating.size}`);
    console.log(`  • 성과: ${rating.performance}`);
    console.log(`  • 종합: ${rating.overall}`);
    console.log('');

    console.log('🎬 콘텐츠 전략:');
    console.log(`  • 전략: ${contentStrategy.strategy}`);
    console.log(`  • 효율성: ${contentStrategy.efficiency}`);
    console.log(`  • 숏폼 비율: ${contentStrategy.shortsPercentage}% (${contentStrategy.shortsCount}개)`);
    console.log(`  • 롱폼 비율: ${(100 - parseFloat(contentStrategy.shortsPercentage)).toFixed(1)}% (${contentStrategy.longformCount}개)`);
    console.log(`  • 숏폼 조회수 기여도: ${contentStrategy.shortsViewsPercentage}%`);
    console.log('');

    return {
        basicInfo,
        performance,
        rating,
        contentStrategy,
        rawData: channelData
    };
}

/**
 * 채널 비교 분석
 */
function compareChannels(jsonString1, jsonString2, name1 = 'Channel A', name2 = 'Channel B') {
    console.log(`🆚 ${name1} vs ${name2} 비교 분석\n`);

    const analysis1 = fullChannelAnalysis(jsonString1);
    const analysis2 = fullChannelAnalysis(jsonString2);

    if (!analysis1 || !analysis2) {
        console.error('❌ 비교할 채널 데이터가 부족합니다');
        return;
    }

    console.log('📊 주요 지표 비교:');
    console.log(`구독자 수: ${analysis1.performance.subscribers.toLocaleString()} vs ${analysis2.performance.subscribers.toLocaleString()}`);
    console.log(`평균 조회수: ${Math.round(analysis1.performance.avgViewsPerVideo).toLocaleString()} vs ${Math.round(analysis2.performance.avgViewsPerVideo).toLocaleString()}`);
    console.log(`바이럴 지수: ${analysis1.performance.viralIndex} vs ${analysis2.performance.viralIndex}`);
    console.log(`콘텐츠 전략: ${analysis1.contentStrategy.strategy} vs ${analysis2.contentStrategy.strategy}`);
    console.log('');

    // 승부 판정
    let winner = null;
    const score1 = analysis1.performance.viralIndex + (analysis1.performance.avgViewsPerVideo / 1000000);
    const score2 = analysis2.performance.viralIndex + (analysis2.performance.avgViewsPerVideo / 1000000);

    if (score1 > score2) winner = name1;
    else if (score2 > score1) winner = name2;
    else winner = '무승부';

    console.log(`🏆 종합 우승: ${winner}`);
    
    return { analysis1, analysis2, winner };
}

// =======================================
// 🚀 4. 사용법 예제
// =======================================

// 예제 JSON 데이터 (실제 사용시에는 파일에서 읽거나 API에서 받아오세요)
const exampleMrBeastJSON = `{
  "channelId": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "staticData": {
    "title": "MrBeast",
    "customUrl": "@MrBeast",
    "country": "US"
  },
  "snapshots": [{
    "subscriberCount": "431000000",
    "viewCount": "94111043985", 
    "videoCount": "897",
    "gavg": 104917552,
    "gsub": 0.458,
    "gvir": 151,
    "csct": 141,
    "clct": 756,
    "vsvp": 49.12
  }]
}`;

// 💡 사용법:
console.log('='.repeat(50));
console.log('🎉 YouTube 데이터 분석 예제 실행');
console.log('='.repeat(50));

// 단일 채널 분석
const result = fullChannelAnalysis(exampleMrBeastJSON);

console.log('='.repeat(50));
console.log('✨ 분석 완료! 위의 결과를 참고하세요.');
console.log('📚 더 많은 예제는 getting_started.html을 확인하세요.');
console.log('='.repeat(50));

// =======================================
// 🎯 5. 후배 개발자를 위한 팁
// =======================================

/*
🎓 후배 개발자에게 전하는 말:

1. 항상 에러 처리를 하세요 (safeParseJSON 참고)
2. 데이터 구조를 먼저 파악하세요 (types.ts 활용)
3. 작은 함수부터 만들어가세요 (extractBasicInfo → analyzeChannelPerformance → fullChannelAnalysis)
4. console.log()를 적극 활용하세요
5. 실제 데이터로 테스트해보세요

🚀 다음 단계:
- Chart.js로 그래프 그리기
- 여러 채널 동시 분석
- 시간대별 변화 추이 분석
- 웹 애플리케이션으로 발전시키기

화이팅! 💪
*/