# YouTube 채널 데이터 분석 가이드 📊

> **후배 개발자를 위한 완벽한 시작 가이드**  
> 작성자: 20년차 시니어 개발자 👨‍💻

---

## 🎯 이 가이드가 필요한 이유

YouTube 채널을 분석할 때 **"이 채널이 성공한 채널인가?"**를 판단하려면:
- 구독자 대비 조회수는 어때? 🔢
- 영상당 평균 조회수는? 📹  
- 성장 속도는 빠른가? 📈
- 숏폼 vs 롱폼 중 뭐가 인기? ⚡

이런 질문들에 답하기 위해 **17개 핵심 지표**를 만들었습니다.

---

## 📋 17개 지표 완전 정리표

### 📊 **G그룹 - 일반 성과 지표** (General Performance)
*"채널의 전반적인 실력을 보여주는 지표들"*

| 축약코드 | 실제 이름 | 한글 설명 | 실제 예시 | 해석법 |
|---------|----------|----------|-----------|--------|
| `gavg` | averageViewsPerVideo | 영상당 평균 조회수 | 1,000,000 | 영상 하나당 100만 조회수 받음 |
| `gsub` | subscriberConversionRate | 구독 전환율 (%) | 0.458 | 조회자 1000명 중 4.58명이 구독 |
| `gvps` | viewsPerSubscriber | 구독자 1명당 조회수 | 21835.51 | 구독자가 충성도 높음 (높을수록 좋음) |
| `gage` | channelAgeInDays | 채널 나이 (일) | 4946 | 개설한 지 4946일 (약 13.5년) |
| `gupw` | uploadsPerWeek | 주당 업로드 수 | 1.27 | 일주일에 1.27개 영상 업로드 |

### 📈 **성장 속도 지표**
*"얼마나 빨리 성장하고 있는가"*

| 축약코드 | 실제 이름 | 한글 설명 | 실제 예시 | 해석법 |
|---------|----------|----------|-----------|--------|
| `gspd` | subsGainedPerDay | 하루 구독자 증가수 | 87,141 | 하루에 8만 7천명 구독자 증가 |
| `gvpd` | viewsGainedPerDay | 하루 조회수 증가량 | 19,027,708 | 하루에 1900만 조회수 증가 |
| `gspm` | subsGainedPerMonth | 한 달 구독자 증가수 | 2,652,576 | 한 달에 265만명 구독자 증가 |
| `gspy` | subsGainedPerYear | 1년 구독자 증가수 | 31,828,296 | 1년에 3182만명 구독자 증가 |
| `gsvr` | subscriberToViewRatio | 구독자/조회수 비율 | - | 구독자 대비 조회수 비율 |
| `gvir` | viralIndex | 바이럴 지수 | 151 | 얼마나 화제성 있는지 (높을수록 바이럴) |

### 📹 **C그룹 - 콘텐츠 분석** (Content Analysis)
*"어떤 종류의 영상을 주로 만드는가"*

| 축약코드 | 실제 이름 | 한글 설명 | 실제 예시 | 해석법 |
|---------|----------|----------|-----------|--------|
| `csct` | shortsCount | 숏폼 영상 개수 | 141 | 총 141개의 숏폼 영상 |
| `clct` | longformCount | 롱폼 영상 개수 | 756 | 총 756개의 롱폼 영상 |
| `csdr` | totalShortsDuration | 숏폼 총 재생시간(초) | 8460 | 숏폼 전체 재생시간 8460초 |

### 👁️ **V그룹 - 조회수 분석** (Views Analysis)
*"어떤 콘텐츠가 더 인기있는가"*

| 축약코드 | 실제 이름 | 한글 설명 | 실제 예시 | 해석법 |
|---------|----------|----------|-----------|--------|
| `vesv` | estimatedShortsViews | 숏폼 예상 조회수 | 46,231,285,654 | 숏폼으로 462억 조회수 |
| `vsvp` | shortsViewsPercentage | 숏폼 조회수 비율(%) | 49.12 | 전체 조회수의 49.12%가 숏폼 |
| `velv` | estimatedLongformViews | 롱폼 예상 조회수 | 47,879,758,331 | 롱폼으로 478억 조회수 |
| `vlvp` | longformViewsPercentage | 롱폼 조회수 비율(%) | 50.88 | 전체 조회수의 50.88%가 롱폼 |

---

## 🚀 실습하기 - 3단계 로드맵

### **1단계: 데이터 구조 파악하기**
```javascript
// sample_mrbeast.json 파일을 열어보세요
const data = JSON.parse(jsonString);
console.log(data.staticData.title); // "MrBeast" 출력
console.log(data.snapshots.length); // 스냅샷 개수 확인
```

### **2단계: 하나씩 출력해보기**
```javascript
const latest = data.snapshots[0]; // 최신 스냅샷
console.log(`구독자: ${latest.subscriberCount?.toLocaleString()}명`);
console.log(`평균 조회수: ${latest.gavg?.toLocaleString()}회`);
```

### **3단계: 브라우저에 표시하기**
`getting_started.html` 파일을 브라우저에서 열어보세요!

---

## 📁 파일 구조

```
📁 youtube-data-analysis/
├── 📄 README.md          (이 파일 - 완전한 가이드)
├── 📄 types.ts           (TypeScript 인터페이스 정의)
├── 📄 sample_mrbeast.json      (MrBeast 실제 데이터)
├── 📄 sample_small_channel.json (작은 채널 데이터)
├── 📄 getting_started.html     (바로 실행 가능한 예제)
└── 📄 parsing_examples.js      (고급 파싱 예제들)
```

---

## 🎯 시니어의 조언

### ✅ **DO (이렇게 하세요)**
- 콘솔에 먼저 출력해서 데이터 확인하기
- 하나씩 단계별로 진행하기  
- types.ts 파일을 참고서로 활용하기
- 에러 메시지 꼼꼼히 읽기

### ❌ **DON'T (이렇게 하지 마세요)**
- 처음부터 복잡한 차트 만들려고 하기
- 모든 데이터를 한번에 처리하려고 하기
- 축약어 외우려고 하기 (패턴으로 이해하세요!)

---

## 💪 격려의 한마디

**"이미 완벽한 JSON 구조가 있으니까, 절반은 끝났다고 보면 돼!"**

YouTube API에서 복잡한 데이터를 이미 깔끔하게 정리해뒀습니다.  
당신은 그냥 이 데이터를 예쁘게 보여주기만 하면 됩니다! 🎨

---

## 🆘 막혔을 때는?

1. **types.ts 파일 확인** - 모든 필드 설명이 있어요
2. **console.log()로 디버깅** - 데이터가 어떻게 생겼는지 확인
3. **작은 단위부터** - 채널명부터 시작해서 점진적으로 확장
4. **시니어에게 질문** - 모르는 건 바로 물어보세요!

**화이팅! 🚀**