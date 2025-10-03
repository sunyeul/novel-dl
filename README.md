
# novel-dl

Browser-based novel downloader for 📖🐰 (Booktoki)
  
[![Hits](https://hits.sh/github.com/yeorinhieut/novel-dl.svg)](https://hits.sh/github.com/yeorinhieut/novel-dl/)

> **브라우저에서 직접 실행되는 소설 다운로더. 설치 불필요, 개인정보 안전, 완전 무료.**

---

## ✨ Features

### 📥 다운로드 기능

- **📖🐰 북토끼 소설 다운로드**: 회차 목록 페이지에서 원클릭 다운로드
- **범위 지정 다운로드**: 시작/종료 회차를 선택하여 원하는 구간만 다운로드
- **자동 파일 병합**: 여러 회차를 하나의 텍스트 파일 또는 ZIP 아카이브로 자동 병합
- **파일명 자동 정규화**: OS 호환 가능한 파일명으로 자동 변환
- **⏸️ 일시정지/재개**: 다운로드 중단 시 체크포인트 저장 및 이어받기 지원

### 🎯 사용자 경험

- **모던 UI**: 진행률 표시줄, 남은 시간, 처리 속도를 실시간 표시
- **키보드 단축키**: ESC로 다운로드 취소, 접근성 지원
- **데스크톱 알림**: 다운로드 완료 시 브라우저 알림 (선택사항)
- **프로그램 설치 불필요**: 브라우저만 있으면 즉시 사용 가능
- **중단/재개 기능**: 네트워크 불안정 또는 의도적 중단 시 중단 지점부터 재개 가능

### 🛡️ 안전성 & 제한사항

- **CAPTCHA 자동 감지**: 인증 페이지 감지 시 사용자에게 알림 후 재시도 유도
- **레이트 리밋 준수**: 기본 5초 간격, 분당 20회 제한으로 사이트 부하 최소화
- **에러 핸들링**: 네트워크 오류, 파싱 실패 시 자동으로 건너뛰고 계속 진행
- **개인정보 보호**: 모든 처리는 브라우저 내에서만 실행, 외부 서버 전송 없음

---

## 🚀 Usage

### ⭐ 사용 전 상단 Star 부탁드립니다

### 방법 1: 북마클릿 사용 (권장 - 다회성 사용)

1. **북마클릿 코드 복사**  
   아래 스크립트를 복사하세요 ([원본 보기](https://raw.githubusercontent.com/sunyeul/novel-dl/main/bookmark.js))

   ```javascript
   javascript:(function(){fetch('https://raw.githubusercontent.com/yeorinhieut/novel-dl/main/script.js').then(response=>{if(!response.ok){throw new Error(`Failed to fetch script: ${response.statusText}`);}return response.text();}).then(scriptContent=>{const script=document.createElement('script');script.textContent=scriptContent;document.head.appendChild(script);console.log('Script loaded and executed.');}).catch(error=>{console.error(error);});})();
   ```

2. **북마크바 표시**  
   브라우저에서 `Ctrl+Shift+B` (Mac: `Cmd+Shift+B`)를 눌러 북마크바를 표시합니다.

3. **북마크 추가**  
   `Ctrl+D` (Mac: `Cmd+D`)를 눌러 아무 페이지에서 북마크를 추가합니다.

4. **북마크 편집**  
   - 추가한 북마크를 우클릭 → **수정** 선택
   - **이름**: `novel-dl` (원하는 이름으로 변경 가능)
   - **URL**: 1번에서 복사한 스크립트 붙여넣기

5. **다운로드 실행**  
   다운로드할 소설의 **회차 목록 페이지**로 이동 후, 생성한 북마크를 클릭합니다.

---

### 방법 2: 브라우저 콘솔 사용 (비권장 - 일회성 사용)

1. **스크립트 복사**  
   [script.js](https://raw.githubusercontent.com/yeorinhieut/novel-dl/main/script.js) 내용을 전체 복사합니다.

2. **개발자 콘솔 열기**  
   다운로드할 소설의 **회차 목록 페이지**에서:
   - `F12` 또는 `Ctrl+Shift+I` (Mac: `Cmd+Option+I`)
   - 또는 우클릭 → **검사** → **Console** 탭

3. **스크립트 실행**  
   복사한 스크립트를 콘솔에 붙여넣고 `Enter`를 누릅니다.

---

## 📋 Technical Specifications

### 실행 환경

- **권장 브라우저**: Chrome, Edge (최신 버전)
- **비권장 브라우저**: Firefox, Safari (일부 기능 제한 가능)
- **JavaScript 버전**: ES6+ (async/await, Fetch API)

### 의존성

- **JSZip 3.10.1**: ZIP 압축 라이브러리 (CDN 자동 로드)
- **외부 서버 통신 없음**: 모든 처리는 클라이언트 사이드에서만 실행

### 제한사항

- **레이트 리밋**: 기본 5초 간격, 분당 20회 요청 제한
- **파일 크기**: 1000화 이상 다운로드 시 100MB 이상 가능 (저장 공간 확인 필요)
- **동시 실행**: 여러 탭에서 동시 실행 시 차단 위험 (권장하지 않음)

---

## 🔧 Troubleshooting

### CAPTCHA가 표시됩니다

**원인**: 사이트의 자동화 방지 메커니즘  
**해결**:

1. CAPTCHA를 수동으로 해결합니다.
2. 모달 창의 **재시도** 버튼을 클릭합니다.
3. 레이트 리밋 간격을 더 길게 설정합니다 (10초 권장).

### 다운로드가 중간에 멈춥니다

**원인**: 네트워크 오류 또는 일시적 서버 문제  
**해결**:

1. 진행 상황 모달에서 **일시정지** 버튼을 클릭하여 체크포인트를 저장합니다.
2. 다시 다운로드를 시작하면 중단 지점부터 이어받기 여부를 묻는 확인창이 표시됩니다.
3. 실패한 회차는 자동으로 건너뛰므로 계속 진행됩니다.
4. 완료 후 실패한 회차를 다시 다운로드합니다.

### 파일 저장이 안 됩니다

**원인**: 브라우저의 다운로드 설정 또는 저장 공간 부족  
**해결**:

1. 브라우저 설정에서 다운로드 폴더 권한을 확인합니다.
2. 저장 공간이 충분한지 확인합니다 (100MB 이상 권장).
3. 팝업 차단이 활성화된 경우 해당 사이트 예외 처리합니다.

### 회차 목록이 정확하게 표시되지 않습니다

**원인**: 사이트 구조 변경  
**해결**:

1. [Issues](https://github.com/yeorinhieut/novel-dl/issues)에 문제를 보고합니다.
2. 브라우저 콘솔에서 에러 메시지를 확인하여 함께 제보합니다.

---

## ❓ FAQ

### Q: 한 번에 여러 소설을 다운로드할 수 있나요?

**A**: 권장하지 않습니다. 여러 탭에서 동시에 다운로드를 시도하면 사이트의 차단 정책으로 인해 접속이 불가능해질 수 있습니다. (분당 20회 이상 요청 시 차단)

### Q: 다운로드 중간에 멈췄는데 처음부터 다시 해야 하나요?

**A**: 아니요. 일시정지 버튼을 클릭하거나 다운로드가 중단된 경우, 다시 시작하면 이전 중단 지점부터 이어받기가 가능합니다. localStorage에 체크포인트가 저장되며, 다운로드 완료 또는 5화마다 자동으로 저장됩니다.

### Q: 다운로드 속도를 높일 수 있나요?

**A**: 레이트 리밋 간격을 줄이면 속도가 빨라지지만, 사이트 부하를 최소화하고 차단을 방지하기 위해 기본 5초 간격을 준수해 주시기 바랍니다.

### Q: 개인정보가 수집되나요?

**A**: 아니요. 모든 처리는 브라우저 내에서만 실행되며, 외부 서버로 어떠한 데이터도 전송하지 않습니다. 다운로드한 파일은 사용자의 로컬 저장소에만 저장됩니다.

### Q: 모바일에서도 사용할 수 있나요?

**A**: 기술적으로는 가능하지만, 모바일 브라우저의 제한으로 인해 일부 기능이 정상적으로 동작하지 않을 수 있습니다. 데스크톱 브라우저 사용을 권장합니다.

### Q: 오류가 발생했습니다. 어떻게 해야 하나요?

**A**: [Issues](https://github.com/yeorinhieut/novel-dl/issues) 섹션에 다음 정보와 함께 제보해 주세요:

- 발생한 오류 메시지
- 브라우저 버전 및 OS
- 재현 방법

### Q: 기능 개선을 요청하고 싶습니다

**A**: [Issues](https://github.com/yeorinhieut/novel-dl/issues) 섹션에 개선 사항을 제안하거나, Pull Request를 통해 직접 기여해 주세요.

---

## 🤝 Contributing

프로젝트 기여를 환영합니다! 다음 방법으로 참여할 수 있습니다:

1. **버그 리포트**: [Issues](https://github.com/yeorinhieut/novel-dl/issues)에 버그를 보고합니다.
2. **기능 제안**: [Issues](https://github.com/yeorinhieut/novel-dl/issues)에 새로운 기능을 제안합니다.
3. **코드 기여**: Pull Request를 통해 직접 코드를 기여합니다.

### 개발 가이드라인

자세한 개발 규칙과 코딩 컨벤션은 [CLAUDE.md](CLAUDE.md)를 참조하세요.

---

## 📄 License

본 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
