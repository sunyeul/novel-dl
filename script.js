// 디버그 로그 설정
const DEBUG = false; // 개발 시에만 true로 설정
function debugLog(...args) {
	if (DEBUG) console.log(...args);
}

// localStorage 체크포인트 관리 함수
function saveCheckpoint(novelTitle, startEpisode, endEpisode, completedEpisodes, failedEpisodes, captchaCount, downloadedIndexes) {
	const checkpoint = {
		novelTitle,
		startEpisode,
		endEpisode,
		completedEpisodes,
		failedEpisodes,
		captchaCount,
		downloadedIndexes,
		timestamp: Date.now(),
	};
	const key = `novel-dl-checkpoint-${sanitizeFilename(novelTitle)}`;
	try {
		localStorage.setItem(key, JSON.stringify(checkpoint));
		debugLog("[saveCheckpoint] 체크포인트 저장 성공", key, checkpoint);
		return true;
	} catch (error) {
		console.error("[saveCheckpoint] 저장 실패", error);
		return false;
	}
}

function loadCheckpoint(novelTitle) {
	const key = `novel-dl-checkpoint-${sanitizeFilename(novelTitle)}`;
	try {
		const data = localStorage.getItem(key);
		if (!data) {
			debugLog("[loadCheckpoint] 체크포인트 없음", key);
			return null;
		}
		const checkpoint = JSON.parse(data);
		debugLog("[loadCheckpoint] 체크포인트 로드 성공", checkpoint);
		return checkpoint;
	} catch (error) {
		console.error("[loadCheckpoint] 로드 실패", error);
		return null;
	}
}

function clearCheckpoint(novelTitle) {
	const key = `novel-dl-checkpoint-${sanitizeFilename(novelTitle)}`;
	try {
		localStorage.removeItem(key);
		debugLog("[clearCheckpoint] 체크포인트 삭제 성공", key);
		return true;
	} catch (error) {
		console.error("[clearCheckpoint] 삭제 실패", error);
		return false;
	}
}

async function fetchNovelContent(url) {
	debugLog("[fetchNovelContent] 시작", url);
	try {
		const response = await fetch(url);

		if (!response.ok) {
			console.error(
				`서버 오류: ${url}에서 콘텐츠를 가져오는 데 실패했습니다. 상태: ${response.status}`,
			);
			return null;
		}

		const html = await response.text();
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");

		// 여러 선택자를 시도합니다
		const titleSelectors = [
			".toon-title",
			".view-title",
			"h1.title",
			".post-title",
			".entry-title",
		];

		let titleElement = null;
		for (const selector of titleSelectors) {
			titleElement = doc.querySelector(selector);
			if (titleElement) {
				debugLog(`[fetchNovelContent] 제목 선택자 발견: ${selector}`);
				break;
			}
		}

		let episodeTitle = "제목 없는 에피소드";
		if (titleElement) {
			episodeTitle =
				titleElement.getAttribute("title") ||
				titleElement.textContent.split("<br>")[0].trim() ||
				"제목 없는 에피소드";
			debugLog("[fetchNovelContent] 추출된 제목:", episodeTitle);
		}

		// 여러 콘텐츠 선택자를 시도합니다
		const contentSelectors = [
			"#novel_content",
			".novel-content",
			".view-content",
			".entry-content",
			".post-content",
		];

		let content = null;
		for (const selector of contentSelectors) {
			content = doc.querySelector(selector);
			if (content) {
				debugLog(`[fetchNovelContent] 콘텐츠 선택자 발견: ${selector}`);
				break;
			}
		}

		if (!content) {
			console.error(`콘텐츠를 찾을 수 없습니다: ${url}`);
			return null;
		}

		let cleanedContent = cleanText(content.innerHTML);
		if (cleanedContent.startsWith(episodeTitle)) {
			cleanedContent = cleanedContent.slice(episodeTitle.length).trim();
		}

		debugLog(
			"[fetchNovelContent] 정제된 콘텐츠(100자):",
			cleanedContent.slice(0, 100),
		);

		debugLog("[fetchNovelContent] 종료", { episodeTitle });
		return {
			episodeTitle: episodeTitle,
			content: cleanedContent,
		};
	} catch (error) {
		console.error(`fetchNovelContent 오류: ${error.message}`);
		return null;
	}
}

function unescapeHTML(text) {
	const entities = {
		"&lt;": "<",
		"&gt;": ">",
		"&amp;": "&",
		"&quot;": '"',
		"&apos;": "'",
		"&nbsp;": " ",
		"&ndash;": "-",
		"&mdash;": "--",
		"&lsquo;": "'",
		"&rsquo;": "'",
		"&ldquo;": '"',
		"&rdquo;": '"',
	};

	let result = text;
	for (const [entity, replacement] of Object.entries(entities)) {
		const regex = new RegExp(entity, "g");
		result = result.replace(regex, replacement);
	}

	return result;
}

function cleanText(text) {
	let cleaned = text;
	cleaned = cleaned.replace(/<div>/g, "");
	cleaned = cleaned.replace(/<\/div>/g, "");
	cleaned = cleaned.replace(/<p>/g, "\n");
	cleaned = cleaned.replace(/<\/p>/g, "\n");
	cleaned = cleaned.replace(/<br\s*[/]?>/g, "\n");
	cleaned = cleaned.replace(/<img[^>]*>/gi, "[이미지 건너뜀]");
	cleaned = cleaned.replace(/<[^>]*>/g, "");
	cleaned = cleaned.replace(/ {2,}/g, " ");
	cleaned = unescapeHTML(cleaned);

	cleaned = cleaned
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join("\n\n")
		.replace(/\n{3,}/g, "\n\n");

	return cleaned;
}

function createModal(title, isBusyRef) {
	// 애니메이션 스타일이 아직 추가되지 않은 경우 문서에 추가합니다
	if (!document.getElementById("novel-dl-styles")) {
		const style = document.createElement("style");
		style.id = "novel-dl-styles";
		style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulse {
                0% { opacity: 0.7; }
                50% { opacity: 1; }
                100% { opacity: 0.7; }
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
		document.head.appendChild(style);
	}

	// 모달 컨테이너 생성
	const modal = document.createElement("div");
	modal.id = "downloadProgressModal";
	Object.assign(modal.style, {
		display: "flex",
		position: "fixed",
		zIndex: "9999",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		backgroundColor: "rgba(0,0,0,0.5)",
		alignItems: "center",
		justifyContent: "center",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	});

	// 모달 콘텐츠 생성
	const modalContent = document.createElement("div");
	Object.assign(modalContent.style, {
		backgroundColor: "#fff",
		borderRadius: "12px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
		width: "450px",
		maxWidth: "90%",
		padding: "0",
		overflow: "hidden",
		animation: "fadeIn 0.3s",
	});

	// 헤더 생성
	const header = document.createElement("div");
	Object.assign(header.style, {
		backgroundColor: "#f9f9fb",
		borderBottom: "1px solid #eaecef",
		padding: "16px 20px",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
	});

	// 헤더에 제목 추가
	const headerTitle = document.createElement("h3");
	headerTitle.textContent = title;
	Object.assign(headerTitle.style, {
		margin: "0",
		color: "#172238",
		fontSize: "16px",
		fontWeight: "600",
	});
	header.appendChild(headerTitle);

	// 닫기 버튼 추가
	const closeButton = document.createElement("button");
	closeButton.innerHTML = "&times;";
	Object.assign(closeButton.style, {
		background: "none",
		border: "none",
		fontSize: "22px",
		cursor: "pointer",
		color: "#666",
		padding: "0 4px",
		lineHeight: "1",
	});
	closeButton.onclick = () => {
		if (isBusyRef?.value) {
			if (confirm("다운로드를 취소하시겠습니까?")) {
				document.body.removeChild(modal);
			}
		} else {
			document.body.removeChild(modal);
		}
	};
	header.appendChild(closeButton);

	modalContent.appendChild(header);

	// 본문 생성
	const body = document.createElement("div");
	Object.assign(body.style, {
		padding: "20px",
	});
	modalContent.appendChild(body);

	// 상태 요소 생성
	const statusElement = document.createElement("div");
	Object.assign(statusElement.style, {
		marginBottom: "16px",
		fontSize: "14px",
		color: "#444",
		fontWeight: "500",
	});
	body.appendChild(statusElement);

	// 진행 정보 요소 생성
	const progressInfo = document.createElement("div");
	Object.assign(progressInfo.style, {
		display: "flex",
		justifyContent: "space-between",
		marginBottom: "10px",
		fontSize: "14px",
		color: "#555",
	});

	const progressText = document.createElement("div");
	progressText.textContent = "0%";
	Object.assign(progressText.style, {
		fontWeight: "600",
	});
	progressInfo.appendChild(progressText);

	const timeRemaining = document.createElement("div");
	progressInfo.appendChild(timeRemaining);

	body.appendChild(progressInfo);

	// 진행률 표시줄 컨테이너 생성
	const progressBarContainer = document.createElement("div");
	Object.assign(progressBarContainer.style, {
		width: "100%",
		height: "8px",
		backgroundColor: "#eaecef",
		borderRadius: "8px",
		overflow: "hidden",
	});

	// 진행률 표시줄 생성
	const progressBar = document.createElement("div");
	Object.assign(progressBar.style, {
		width: "0%",
		height: "100%",
		background: "linear-gradient(90deg, #3a7bd5, #6fa1ff)",
		borderRadius: "8px",
		transition: "width 0.3s ease",
	});

	progressBarContainer.appendChild(progressBar);
	body.appendChild(progressBarContainer);

	// 상세 진행률 요소 생성
	const detailedProgress = document.createElement("div");
	Object.assign(detailedProgress.style, {
		marginTop: "16px",
		fontSize: "13px",
		color: "#666",
		textAlign: "center",
	});
	body.appendChild(detailedProgress);

	// 일시정지/재개 버튼 컨테이너 생성
	const controlButtonsContainer = document.createElement("div");
	Object.assign(controlButtonsContainer.style, {
		marginTop: "20px",
		display: "flex",
		gap: "8px",
		justifyContent: "center",
	});

	// 일시정지/재개 버튼 생성
	const pauseResumeButton = document.createElement("button");
	pauseResumeButton.textContent = "일시정지";
	pauseResumeButton.dataset.isPaused = "false";
	Object.assign(pauseResumeButton.style, {
		backgroundColor: "#ff9800",
		color: "white",
		border: "none",
		padding: "10px 20px",
		borderRadius: "8px",
		fontSize: "14px",
		fontWeight: "500",
		cursor: "pointer",
		transition: "background-color 0.2s",
	});
	pauseResumeButton.onmouseover = () => {
		pauseResumeButton.style.backgroundColor = pauseResumeButton.dataset.isPaused === "true" ? "#388e3c" : "#f57c00";
	};
	pauseResumeButton.onmouseout = () => {
		pauseResumeButton.style.backgroundColor = pauseResumeButton.dataset.isPaused === "true" ? "#4CAF50" : "#ff9800";
	};
	controlButtonsContainer.appendChild(pauseResumeButton);

	body.appendChild(controlButtonsContainer);

	modal.appendChild(modalContent);

	return {
		modal,
		statusElement,
		progressText,
		timeRemaining,
		progressBar,
		detailedProgress,
		closeButton,
		pauseResumeButton,
	};
}

// 이동 평균을 사용한 개선된 시간 추정 함수
function createProgressTracker(totalItems) {
	const startTime = Date.now();
	const processingTimes = [];
	const MAX_SAMPLES = 5; // 이동 평균에 마지막 5개 샘플 사용

	return {
		update: (completedItems) => {
			const progress = (completedItems / totalItems) * 100;

			const elapsed = Date.now() - startTime;

			// 항목당 시간 계산 및 이동 평균을 위해 저장
			if (completedItems > 0) {
				const currentTimePerItem = elapsed / completedItems;
				processingTimes.push(currentTimePerItem);

				// 가장 최근 샘플만 유지
				if (processingTimes.length > MAX_SAMPLES) {
					processingTimes.shift();
				}
			}

			// 처리 시간의 이동 평균 계산
			const avgTimePerItem =
				processingTimes.length > 0
					? processingTimes.reduce((sum, time) => sum + time, 0) /
						processingTimes.length
					: 0;

			// 이동 평균을 기반으로 남은 시간 계산
			const remainingItems = totalItems - completedItems;
			const estimatedRemainingTime = avgTimePerItem * remainingItems;

			return {
				progress: progress.toFixed(1),
				remaining: formatTime(estimatedRemainingTime),
				elapsed: formatTime(elapsed),
				speed: avgTimePerItem > 0 ? (1000 / avgTimePerItem).toFixed(2) : "0.00", // 초당 항목 수
			};
		},
	};
}

function formatTime(ms) {
	if (ms < 60000) {
		return `${Math.ceil(ms / 1000)}초`;
	}
	if (ms < 3600000) {
		const mins = Math.floor(ms / 60000);
		const secs = Math.floor((ms % 60000) / 1000);
		return `${mins}분 ${secs}초`;
	}
	const hours = Math.floor(ms / 3600000);
	const mins = Math.floor((ms % 3600000) / 60000);
	return `${hours}시간 ${mins}분`;
}

async function loadScript(url) {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = url;
		script.onload = resolve;
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

function sanitizeFilename(name) {
	return name.replace(/[/\\?%*:|"<>]/g, "_");
}

function showSaveOptionsDialog(onSaveOptionSelected) {
	debugLog("[showSaveOptionsDialog] 대화 상자 표시");
	const dialog = document.createElement("div");
	Object.assign(dialog.style, {
		position: "fixed",
		zIndex: "9999",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		backgroundColor: "rgba(0,0,0,0.5)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	});

	const dialogContent = document.createElement("div");
	Object.assign(dialogContent.style, {
		backgroundColor: "#fff",
		borderRadius: "12px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
		width: "350px",
		maxWidth: "90%",
		padding: "24px",
		animation: "fadeIn 0.3s",
	});

	const dialogTitle = document.createElement("h3");
	dialogTitle.textContent = "저장 방식 선택";
	Object.assign(dialogTitle.style, {
		margin: "0 0 20px 0",
		color: "#172238",
		fontSize: "18px",
		fontWeight: "600",
	});
	dialogContent.appendChild(dialogTitle);

	const optionsContainer = document.createElement("div");
	Object.assign(optionsContainer.style, {
		display: "flex",
		flexDirection: "column",
		gap: "12px",
		marginBottom: "24px",
	});

	const createOption = (value, text, description) => {
		const option = document.createElement("div");
		Object.assign(option.style, {
			padding: "14px",
			border: "1px solid #e4e9f0",
			borderRadius: "8px",
			cursor: "pointer",
			backgroundColor: "#f9f9fb",
			transition: "all 0.2s ease",
		});

		option.innerHTML = `
            <div style="font-weight: 600; color: #172238; margin-bottom: 4px;">${text}</div>
            <div style="font-size: 13px; color: #666;">${description}</div>
        `;

		option.onclick = () => {
			document.body.removeChild(dialog);
			onSaveOptionSelected(value !== "1");
		};

		option.onmouseover = () => {
			option.style.backgroundColor = "#f0f2f8";
			option.style.borderColor = "#3a7bd5";
		};

		option.onmouseout = () => {
			option.style.backgroundColor = "#f9f9fb";
			option.style.borderColor = "#e4e9f0";
		};

		return option;
	};

	optionsContainer.appendChild(
		createOption(
			"1",
			"한 파일로 병합",
			"모든 회차가 하나의 파일로 저장됩니다.",
		),
	);
	optionsContainer.appendChild(
		createOption(
			"2",
			"각 회차별 저장 (ZIP)",
			"각 회차를 개별 파일로 ZIP 압축합니다.",
		),
	);

	dialogContent.appendChild(optionsContainer);

	const cancelButton = document.createElement("button");
	cancelButton.textContent = "취소";
	Object.assign(cancelButton.style, {
		width: "100%",
		padding: "10px",
		border: "1px solid #e4e9f0",
		borderRadius: "8px",
		backgroundColor: "#f9f9fb",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: "500",
		transition: "all 0.2s ease",
	});

	cancelButton.onmouseover = () => {
		cancelButton.style.backgroundColor = "#f0f2f8";
	};

	cancelButton.onmouseout = () => {
		cancelButton.style.backgroundColor = "#f9f9fb";
	};

	cancelButton.onclick = () => {
		document.body.removeChild(dialog);
	};

	dialogContent.appendChild(cancelButton);

	dialog.appendChild(dialogContent);
	document.body.appendChild(dialog);
}

async function processDownloadLoop(
	title,
	episodeLinks,
	startEpisode,
	endEpisode,
	delayMs,
	saveAsZip,
	zip,
	checkpoint = null,
) {
	debugLog("[processDownloadLoop] 다운로드 루프 시작");
	const startingIndex = episodeLinks.length - startEpisode;
	const endingIndex = episodeLinks.length - endEpisode;
	const totalEpisodes = startingIndex - endingIndex + 1;

	const {
		modal,
		statusElement,
		progressText,
		timeRemaining,
		progressBar,
		detailedProgress,
		pauseResumeButton,
	} = createModal(`"${title}" 다운로드 중`, { value: true });

	document.body.appendChild(modal);

	const progressTracker = createProgressTracker(totalEpisodes);
	let novelText = `${title}\n\nnovel-dl로 다운로드됨,\nhttps://github.com/yeorinhieut/novel-dl\n\n`;
	let completedEpisodes = checkpoint ? checkpoint.completedEpisodes : 0;
	let failedEpisodes = checkpoint ? checkpoint.failedEpisodes : 0;
	let captchaCount = checkpoint ? checkpoint.captchaCount : 0;
	const downloadedIndexes = checkpoint ? new Set(checkpoint.downloadedIndexes) : new Set();
	
	// 일시정지 플래그
	let isPaused = false;
	let pausePromiseResolve = null;

	// 일시정지/재개 버튼 이벤트 핸들러
	pauseResumeButton.onclick = () => {
		if (!isPaused) {
			// 일시정지
			isPaused = true;
			pauseResumeButton.textContent = "재개";
			pauseResumeButton.dataset.isPaused = "true";
			pauseResumeButton.style.backgroundColor = "#4CAF50";
			statusElement.textContent = "⏸️ 일시정지됨 - 재개 버튼을 눌러주세요";
			
			// 체크포인트 저장
			saveCheckpoint(
				title,
				startEpisode,
				endEpisode,
				completedEpisodes,
				failedEpisodes,
				captchaCount,
				Array.from(downloadedIndexes),
			);
			debugLog("[processDownloadLoop] 일시정지 및 체크포인트 저장");
		} else {
			// 재개
			isPaused = false;
			pauseResumeButton.textContent = "일시정지";
			pauseResumeButton.dataset.isPaused = "false";
			pauseResumeButton.style.backgroundColor = "#ff9800";
			statusElement.textContent = "다운로드 재개 중...";
			
			if (pausePromiseResolve) {
				pausePromiseResolve();
				pausePromiseResolve = null;
			}
			debugLog("[processDownloadLoop] 다운로드 재개");
		}
	};

	statusElement.textContent = checkpoint ? "체크포인트에서 다운로드 재개 중..." : "다운로드를 준비하는 중...";

	for (let i = startingIndex; i >= endingIndex; i--) {
		// 일시정지 체크
		if (isPaused) {
			debugLog("[processDownloadLoop] 일시정지 상태, 대기 중...");
			await new Promise((resolve) => {
				pausePromiseResolve = resolve;
			});
		}

		const episodeUrl = episodeLinks[i];
		debugLog(`[processDownloadLoop] ${i}번째 에피소드 URL:`, episodeUrl);
		
		// 이미 다운로드된 에피소드 스킵
		if (downloadedIndexes.has(i)) {
			debugLog(`[processDownloadLoop] 이미 다운로드됨, 건너뜀: ${i}번째 에피소드`);
			continue;
		}
		
		if (!episodeUrl.startsWith("https://booktoki")) {
			failedEpisodes++;
			debugLog(`[processDownloadLoop] booktoki URL 아님, 건너뜀: ${episodeUrl}`);
			continue;
		}

		const currentEpisode = startingIndex - i + 1;
		const episodeNumber = episodeLinks.length - i;
		statusElement.textContent = `${episodeNumber}화 다운로드 중... (${currentEpisode}/${totalEpisodes})`;

		let result = await fetchNovelContent(episodeUrl);
		if (!result) {
			captchaCount++;
			statusElement.textContent = `⚠️ CAPTCHA 감지됨! ${episodeNumber}화를 처리할 수 없습니다.`;
			debugLog(
				`[processDownloadLoop] CAPTCHA 감지, 사용자 확인 대기: ${episodeUrl}`,
			);

			const userConfirmed = confirm(
				`CAPTCHA가 발견되었습니다!\n${episodeUrl}\n\n캡챠를 해결한 후 확인을 눌러주세요.`,
			);
			if (!userConfirmed) {
				failedEpisodes++;
				debugLog(
					`[processDownloadLoop] 사용자 캡챠 미해결, 건너뜀: ${episodeUrl}`,
				);
				continue;
			}

			statusElement.textContent = `${episodeNumber}화 다시 시도 중...`;
			result = await fetchNovelContent(episodeUrl);
			if (!result) {
				statusElement.textContent = `❌ ${episodeNumber}화 다운로드 실패`;
				failedEpisodes++;
				debugLog(`[processDownloadLoop] 재시도 실패: ${episodeUrl}`);
				continue;
			}
		}

		const { episodeTitle, content } = result;
		debugLog(`[processDownloadLoop] 에피소드 다운로드 성공: ${episodeTitle}`);

		if (saveAsZip) {
			zip.file(`${sanitizeFilename(episodeTitle)}.txt`, content);
		} else {
			novelText += `${episodeTitle}\n\n${content}\n\n`;
		}

		// 다운로드 완료한 인덱스 기록
		downloadedIndexes.add(i);
		completedEpisodes++;
		const stats = progressTracker.update(completedEpisodes);
		
		// 주기적으로 체크포인트 저장 (5화마다)
		if (completedEpisodes % 5 === 0) {
			saveCheckpoint(
				title,
				startEpisode,
				endEpisode,
				completedEpisodes,
				failedEpisodes,
				captchaCount,
				Array.from(downloadedIndexes),
			);
			debugLog(`[processDownloadLoop] 체크포인트 자동 저장 (${completedEpisodes}화 완료)`);
		}

		progressBar.style.width = `${stats.progress}%`;
		progressText.textContent = `${stats.progress}%`;
		timeRemaining.textContent = `남은 시간: ${stats.remaining}`;

		detailedProgress.innerHTML = `
                <div style="margin-bottom: 4px; display: flex; justify-content: center; gap: 12px;">
                    <span>✅ 완료: ${completedEpisodes}화</span>
                    <span>❌ 실패: ${failedEpisodes}화</span>
                    <span>⚠️ 캡챠: ${captchaCount}회</span>
                </div>
                <div>소요 시간: ${stats.elapsed} | 처리 속도: ${stats.speed}화/초</div>
            `;

		await new Promise((r) => setTimeout(r, delayMs));
	}

	debugLog("[processDownloadLoop] 다운로드 루프 종료", {
		completedEpisodes,
		failedEpisodes,
		captchaCount,
	});
	statusElement.textContent = "✅ 다운로드 완료, 파일 생성 중...";
	progressBar.style.width = "100%";
	progressText.textContent = "100%";
	
	// 다운로드 완료 시 체크포인트 삭제
	clearCheckpoint(title);
	debugLog("[processDownloadLoop] 체크포인트 삭제 완료");

	return { modal, completedEpisodes, novelText };
}

function showCompletionDialog(
	title,
	completedEpisodes,
	startEpisode,
	endEpisode,
	saveAsZip,
	zip,
	novelText,
) {
	debugLog("[showCompletionDialog] 완료 대화 상자 표시");
	const completionDialog = document.createElement("div");
	Object.assign(completionDialog.style, {
		position: "fixed",
		zIndex: "9999",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		backgroundColor: "rgba(0,0,0,0.5)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	});

	const completionContent = document.createElement("div");
	Object.assign(completionContent.style, {
		backgroundColor: "#fff",
		borderRadius: "12px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
		width: "400px",
		maxWidth: "90%",
		padding: "24px",
		animation: "fadeIn 0.3s",
		textAlign: "center",
	});

	const successIcon = document.createElement("div");
	successIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
	Object.assign(successIcon.style, {
		display: "flex",
		justifyContent: "center",
		marginBottom: "16px",
	});
	completionContent.appendChild(successIcon);

	const completionTitle = document.createElement("h3");
	completionTitle.textContent = "다운로드가 완료되었어요!";
	Object.assign(completionTitle.style, {
		color: "#172238",
		fontSize: "18px",
		margin: "0 0 8px 0",
	});
	completionContent.appendChild(completionTitle);

	const completionMessage = document.createElement("p");
	completionMessage.textContent = `${completedEpisodes}화의 다운로드가 준비되었습니다.`;
	Object.assign(completionMessage.style, {
		color: "#666",
		margin: "0 0 24px 0",
		fontSize: "14px",
	});
	completionContent.appendChild(completionMessage);

	const downloadBtn = document.createElement("button");
	downloadBtn.textContent = "다운로드";
	Object.assign(downloadBtn.style, {
		backgroundColor: "#4CAF50",
		color: "white",
		border: "none",
		padding: "12px 24px",
		borderRadius: "8px",
		fontSize: "14px",
		fontWeight: "500",
		cursor: "pointer",
		marginBottom: "24px",
		width: "100%",
		transition: "background-color 0.2s",
	});

	downloadBtn.onmouseover = () => {
		downloadBtn.style.backgroundColor = "#388E3C";
	};

	downloadBtn.onmouseout = () => {
		downloadBtn.style.backgroundColor = "#4CAF50";
	};

	downloadBtn.onclick = () => {
		if (saveAsZip) {
			zip.generateAsync({ type: "blob" }).then((blob) => {
				const a = document.createElement("a");
				a.href = URL.createObjectURL(blob);
				a.download = `${sanitizeFilename(title)}.zip`;
				a.click();

			showNotification(
				`"${title}" 다운로드 시작`,
				`${completedEpisodes}화가 ZIP 파일로 저장됩니다.`,
			);
				document.body.removeChild(completionDialog);
			});
		} else {
			const blob = new Blob([novelText], { type: "text/plain" });
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `${sanitizeFilename(title)}(${startEpisode}~${endEpisode}).txt`;
			a.click();

			showNotification(
				`"${title}" 다운로드 시작`,
				`${completedEpisodes}화가 텍스트 파일로 저장됩니다.`,
			);
			document.body.removeChild(completionDialog);
		}
	};

	completionContent.appendChild(downloadBtn);

	completionDialog.appendChild(completionContent);
	document.body.appendChild(completionDialog);
}

async function downloadNovel(
	title,
	episodeLinks,
	startEpisode,
	endEpisode,
	delayMs = 5000,
) {
	debugLog("[downloadNovel] 시작", {
		title,
		startEpisode,
		endEpisode,
		delayMs,
	});

	// 기존 체크포인트 확인
	const existingCheckpoint = loadCheckpoint(title);
	let checkpoint = null;
	
	if (existingCheckpoint) {
		const resumeConfirmed = confirm(
			`이전에 중단된 다운로드를 발견했습니다!\n\n` +
			`소설: ${existingCheckpoint.novelTitle}\n` +
			`진행률: ${existingCheckpoint.completedEpisodes}화 완료\n` +
			`범위: ${existingCheckpoint.startEpisode}화 ~ ${existingCheckpoint.endEpisode}화\n` +
			`실패: ${existingCheckpoint.failedEpisodes}화\n\n` +
			`이어서 다운로드하시겠습니까?\n` +
			`(취소 시 새로 시작합니다)`
		);
		
		if (resumeConfirmed) {
			checkpoint = existingCheckpoint;
			startEpisode = existingCheckpoint.startEpisode;
			endEpisode = existingCheckpoint.endEpisode;
			debugLog("[downloadNovel] 체크포인트에서 재개", checkpoint);
		} else {
			clearCheckpoint(title);
			debugLog("[downloadNovel] 체크포인트 무시, 새로 시작");
		}
	}

	showSaveOptionsDialog(async (saveAsZip) => {
		debugLog("[downloadNovel] 저장 방식:", saveAsZip ? "ZIP" : "단일 파일");
		let zip;

		if (saveAsZip) {
			try {
				await loadScript(
					"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
				);
				zip = new JSZip();
				debugLog("[downloadNovel] JSZip 로드 성공");
			} catch (e) {
				console.error("[downloadNovel] JSZip 로드 실패", e);
				alert("ZIP 라이브러리 로드 실패!");
				return;
			}
		}

		const { modal, completedEpisodes, novelText } = await processDownloadLoop(
			title,
			episodeLinks,
			startEpisode,
			endEpisode,
			delayMs,
			saveAsZip,
			zip,
			checkpoint,
		);

		setTimeout(() => {
			debugLog("[downloadNovel] 파일 생성 및 다운로드 버튼 표시");
			document.body.removeChild(modal);

			showCompletionDialog(
				title,
				completedEpisodes,
				startEpisode,
				endEpisode,
				saveAsZip,
				zip,
				novelText,
			);
		}, 500);
	});
}

function showNotification(title, message) {
	const notification = document.createElement("div");
	Object.assign(notification.style, {
		position: "fixed",
		bottom: "20px",
		right: "20px",
		backgroundColor: "#fff",
		borderLeft: "4px solid #4CAF50",
		borderRadius: "4px",
		boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
		padding: "16px",
		zIndex: "9999",
		maxWidth: "320px",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
		animation: "fadeIn 0.3s",
	});

	notification.innerHTML = `
        <div style="font-weight: 600; color: #172238; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 13px; color: #666;">${message}</div>
    `;

	document.body.appendChild(notification);

	// 5초 후 자동 제거
	setTimeout(() => {
		notification.style.opacity = "0";
		notification.style.transition = "opacity 0.3s";
		setTimeout(() => document.body.removeChild(notification), 300);
	}, 5000);
}

function extractTitle() {
	const titleElement = document.evaluate(
		'//*[@id="content_wrapper"]/div[1]/span',
		document,
		null,
		XPathResult.FIRST_ORDERED_NODE_TYPE,
		null,
	).singleNodeValue;
	return titleElement ? titleElement.textContent.trim() : null;
}

async function fetchPage(url) {
	const response = await fetch(url);
	if (!response.ok) {
		console.error(`Failed to fetch page: ${url}. Status: ${response.status}`);
		return null;
	}
	const html = await response.text();
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	return doc;
}

function createInputGroup(
	labelText,
	inputType,
	defaultValue,
	placeholder,
	description,
	validator,
) {
	const group = document.createElement("div");
	Object.assign(group.style, {
		marginBottom: "20px",
	});

	const label = document.createElement("label");
	label.textContent = labelText;
	Object.assign(label.style, {
		display: "block",
		marginBottom: "8px",
		fontSize: "14px",
		color: "#444",
		fontWeight: "500",
	});
	group.appendChild(label);

	if (description) {
		const desc = document.createElement("div");
		desc.textContent = description;
		Object.assign(desc.style, {
			fontSize: "13px",
			color: "#666",
			marginBottom: "8px",
		});
		group.appendChild(desc);
	}

	const input = document.createElement("input");
	input.type = inputType;
	input.value = defaultValue;
	input.placeholder = placeholder || "";
	Object.assign(input.style, {
		width: "100%",
		padding: "10px",
		border: "1px solid #e4e9f0",
		borderRadius: "8px",
		fontSize: "14px",
		boxSizing: "border-box",
	});
	group.appendChild(input);

	const errorDiv = document.createElement("div");
	errorDiv.className = "error-message";
	Object.assign(errorDiv.style, {
		color: "#e74c3c",
		fontSize: "12px",
		height: "16px",
		marginTop: "4px",
		display: "block",
	});
	group.appendChild(errorDiv);

	if (validator) {
		input.addEventListener("input", () => {
			const msg = validator(input.value);
			errorDiv.textContent = msg || "";
			if (msg) {
				input.style.borderColor = "#e74c3c";
			} else {
				input.style.borderColor = "#e4e9f0";
			}
		});
	}

	return { group, input, errorDiv };
}

function showPageInputDialog(title, onPagesConfirmed) {
	debugLog("[showPageInputDialog] 대화 상자 표시");
	const dialog = document.createElement("div");
	Object.assign(dialog.style, {
		position: "fixed",
		zIndex: "9999",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		backgroundColor: "rgba(0,0,0,0.5)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	});

	const dialogContent = document.createElement("div");
	Object.assign(dialogContent.style, {
		backgroundColor: "#fff",
		borderRadius: "12px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
		width: "400px",
		maxWidth: "90%",
		padding: "24px",
		animation: "fadeIn 0.3s",
	});

	const dialogTitle = document.createElement("h3");
	dialogTitle.textContent = `"${title}" 다운로드 설정`;
	Object.assign(dialogTitle.style, {
		margin: "0 0 20px 0",
		color: "#172238",
		fontSize: "18px",
		fontWeight: "600",
	});
	dialogContent.appendChild(dialogTitle);

	const pagesInput = createInputGroup(
		"소설 목록의 페이지 수",
		"number",
		"1",
		"페이지 수 입력",
		"1000화가 넘지 않는 경우 1, 1000화 이상부터 2~ 입력",
		(value) => {
			if (Number.isNaN(Number(value)) || Number(value) < 1) {
				return "유효한 페이지 수를 입력해주세요.";
			}
			return null;
		},
	);
	dialogContent.appendChild(pagesInput.group);
	pagesInput.input.min = 1;

	const buttonsContainer = document.createElement("div");
	Object.assign(buttonsContainer.style, {
		display: "flex",
		justifyContent: "space-between",
		marginTop: "16px",
		gap: "12px",
	});

	const cancelButton = document.createElement("button");
	cancelButton.textContent = "취소";
	Object.assign(cancelButton.style, {
		flex: "1",
		padding: "10px",
		border: "1px solid #e4e9f0",
		borderRadius: "8px",
		backgroundColor: "#f9f9fb",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: "500",
		transition: "all 0.2s ease",
	});

	cancelButton.onmouseover = () => {
		cancelButton.style.backgroundColor = "#f0f2f8";
	};

	cancelButton.onmouseout = () => {
		cancelButton.style.backgroundColor = "#f9f9fb";
	};

	cancelButton.onclick = () => document.body.removeChild(dialog);
	buttonsContainer.appendChild(cancelButton);

	const continueButton = document.createElement("button");
	continueButton.textContent = "계속";
	Object.assign(continueButton.style, {
		flex: "1",
		padding: "10px",
		border: "none",
		borderRadius: "8px",
		backgroundColor: "#3a7bd5",
		color: "white",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: "500",
		transition: "all 0.2s ease",
	});

	continueButton.onmouseover = () => {
		continueButton.style.backgroundColor = "#2d62aa";
	};

	continueButton.onmouseout = () => {
		continueButton.style.backgroundColor = "#3a7bd5";
	};

	continueButton.onclick = () => {
		const totalPages = Number.parseInt(pagesInput.input.value, 10);
		debugLog("[showPageInputDialog] 사용자 입력 페이지 수:", totalPages);

		if (Number.isNaN(totalPages) || totalPages < 1) {
			alert("유효한 페이지 수를 입력해주세요.");
			debugLog("[showPageInputDialog] 잘못된 페이지 수 입력");
			return;
		}

		document.body.removeChild(dialog);
		onPagesConfirmed(totalPages);
	};

	buttonsContainer.appendChild(continueButton);

	dialogContent.appendChild(buttonsContainer);
	dialog.appendChild(dialogContent);
	document.body.appendChild(dialog);
}

async function fetchAllEpisodeLinks(currentUrl, totalPages) {
	debugLog("[fetchAllEpisodeLinks] 시작", { currentUrl, totalPages });
	const loadingDialog = document.createElement("div");
	Object.assign(loadingDialog.style, {
		position: "fixed",
		zIndex: "9999",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		backgroundColor: "rgba(0,0,0,0.5)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	});

	const loadingContent = document.createElement("div");
	Object.assign(loadingContent.style, {
		backgroundColor: "#fff",
		borderRadius: "12px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
		width: "300px",
		maxWidth: "90%",
		padding: "24px",
		textAlign: "center",
	});

	const loadingTitle = document.createElement("h3");
	loadingTitle.textContent = "에피소드 목록 불러오는 중";
	Object.assign(loadingTitle.style, {
		margin: "0 0 16px 0",
		color: "#172238",
		fontSize: "16px",
		fontWeight: "600",
	});
	loadingContent.appendChild(loadingTitle);

	const loadingText = document.createElement("p");
	loadingText.textContent = "잠시만 기다려주세요...";
	Object.assign(loadingText.style, {
		margin: "0 0 20px 0",
		fontSize: "14px",
		color: "#555",
	});
	loadingContent.appendChild(loadingText);

	if (!document.getElementById("custom-spinner-style")) {
		const style = document.createElement("style");
		style.id = "custom-spinner-style";
		style.textContent = `
			@keyframes custom-spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
			.custom-spinner {
				width: 32px;
				height: 32px;
				border: 3px solid #f3f3f3;
				border-top: 3px solid #3a7bd5;
				border-radius: 50%;
				animation: custom-spin 1s linear infinite;
			}
		`;
		document.head.appendChild(style);
	}

	const spinnerContainer = document.createElement("div");
	Object.assign(spinnerContainer.style, {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: "16px",
	});

	const spinner = document.createElement("div");
	spinner.className = "custom-spinner";

	spinnerContainer.appendChild(spinner);
	loadingContent.appendChild(spinnerContainer);

	loadingDialog.appendChild(loadingContent);
	document.body.appendChild(loadingDialog);

	const allEpisodeLinks = [];
	for (let page = 1; page <= totalPages; page++) {
		loadingText.textContent = `페이지 ${page}/${totalPages} 불러오는 중...`;
		const nextPageUrl = `${currentUrl}?spage=${page}`;
		debugLog(`[fetchAllEpisodeLinks] 페이지 ${page} URL:`, nextPageUrl);
		const nextPageDoc = await fetchPage(nextPageUrl);
		if (nextPageDoc) {
			const nextPageLinks = Array.from(
				nextPageDoc.querySelectorAll(".item-subject"),
			).map((link) => link.getAttribute("href"));
			debugLog(
				`[fetchAllEpisodeLinks] 페이지 ${page} 에피소드 링크 수:`,
				nextPageLinks.length,
			);
			allEpisodeLinks.push(...nextPageLinks);
			loadingText.textContent = `${allEpisodeLinks.length}개 에피소드 발견됨`;
		} else {
			debugLog(`[fetchAllEpisodeLinks] 페이지 ${page} 로드 실패`);
		}
		await new Promise((r) => setTimeout(r, 500));
	}

	debugLog("[fetchAllEpisodeLinks] 전체 에피소드 링크 수:", allEpisodeLinks.length);

	document.body.removeChild(loadingDialog);

	return allEpisodeLinks;
}

function validateDownloadRange(startEpisode, endEpisode, totalEpisodes) {
	if (
		Number.isNaN(startEpisode) ||
		Number.isNaN(endEpisode) ||
		startEpisode < 1 ||
		endEpisode < startEpisode ||
		endEpisode > totalEpisodes
	) {
		return false;
	}
	return true;
}

function showRangeInputDialog(
	allEpisodeLinks,
	onDownloadConfirmed,
) {
	debugLog("[showRangeInputDialog] 대화 상자 표시");
	const rangeDialog = document.createElement("div");
	Object.assign(rangeDialog.style, {
		position: "fixed",
		zIndex: "9999",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		backgroundColor: "rgba(0,0,0,0.5)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	});

	const rangeContent = document.createElement("div");
	Object.assign(rangeContent.style, {
		backgroundColor: "#fff",
		borderRadius: "12px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
		width: "400px",
		maxWidth: "90%",
		padding: "24px",
		animation: "fadeIn 0.3s",
	});

	const rangeTitle = document.createElement("h3");
	rangeTitle.textContent = "다운로드 범위 설정";
	Object.assign(rangeTitle.style, {
		margin: "0 0 16px 0",
		color: "#172238",
		fontSize: "18px",
		fontWeight: "600",
	});
	rangeContent.appendChild(rangeTitle);

	const episodeCount = document.createElement("div");
	episodeCount.innerHTML = `<span style="display: inline-block; background-color: #ebf5ff; color: #3a7bd5; padding: 4px 8px; border-radius: 4px; font-weight: 500;">전체 ${allEpisodeLinks.length}화가 발견되었습니다.</span>`;
	Object.assign(episodeCount.style, {
		margin: "0 0 20px 0",
		fontSize: "14px",
	});
	rangeContent.appendChild(episodeCount);

	const startInput = createInputGroup(
		"시작 회차",
		"number",
		"1",
		"시작 회차 번호",
		"1부터 시작",
		(value) => {
			if (Number.isNaN(Number(value)) || Number(value) < 1) {
				return "유효한 회차를 입력해주세요.";
			}
			return null;
		},
	);
	rangeContent.appendChild(startInput.group);
	startInput.input.min = 1;
	startInput.input.max = allEpisodeLinks.length;

	const endInput = createInputGroup(
		"종료 회차",
		"number",
		allEpisodeLinks.length.toString(),
		"종료 회차 번호",
		"마지막 회차 입력",
		(value) => {
			if (
				Number.isNaN(Number(value)) ||
				Number(value) < 1 ||
				Number(value) > allEpisodeLinks.length
			) {
				return "유효한 회차를 입력해주세요.";
			}
			return null;
		},
	);
	rangeContent.appendChild(endInput.group);
	endInput.input.min = 1;
	endInput.input.max = allEpisodeLinks.length;

	const delayInput = createInputGroup(
		"딜레이 설정 (밀리초)",
		"number",
		"5000",
		"딜레이 입력",
		"⚠️ 권장: 기본값(5000ms=5초)을 유지하세요. 변경 시 차단 위험이 있습니다.",
		(value) => {
			if (Number.isNaN(Number(value)) || Number(value) < 1000) {
				return "유효한 딜레이 값을 입력해주세요. (최소 1000ms)";
			}
			return null;
		},
	);
	rangeContent.appendChild(delayInput.group);
	delayInput.input.min = 1000;
	delayInput.input.style.border = "1px solid #ffcc00";
	delayInput.input.style.backgroundColor = "#fffbf0";

	const rangeButtons = document.createElement("div");
	Object.assign(rangeButtons.style, {
		display: "flex",
		justifyContent: "space-between",
		marginTop: "20px",
		gap: "12px",
	});

	const rangeCancelButton = document.createElement("button");
	rangeCancelButton.textContent = "취소";
	Object.assign(rangeCancelButton.style, {
		flex: "1",
		padding: "10px",
		border: "1px solid #e4e9f0",
		borderRadius: "8px",
		backgroundColor: "#f9f9fb",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: "500",
		transition: "all 0.2s ease",
	});

	rangeCancelButton.onmouseover = () => {
		rangeCancelButton.style.backgroundColor = "#f0f2f8";
	};

	rangeCancelButton.onmouseout = () => {
		rangeCancelButton.style.backgroundColor = "#f9f9fb";
	};

	rangeCancelButton.onclick = () => document.body.removeChild(rangeDialog);
	rangeButtons.appendChild(rangeCancelButton);

	const downloadButton = document.createElement("button");
	downloadButton.textContent = "다운로드";
	Object.assign(downloadButton.style, {
		flex: "1",
		padding: "10px",
		border: "none",
		borderRadius: "8px",
		backgroundColor: "#3a7bd5",
		color: "white",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: "500",
		transition: "all 0.2s ease",
	});

	downloadButton.onmouseover = () => {
		downloadButton.style.backgroundColor = "#2d62aa";
	};

	downloadButton.onmouseout = () => {
		downloadButton.style.backgroundColor = "#3a7bd5";
	};

	downloadButton.onclick = () => {
		const startEpisode = Number.parseInt(startInput.input.value, 10);
		const endEpisode = Number.parseInt(endInput.input.value, 10);
		const delay = Number.parseInt(delayInput.input.value, 10);
		debugLog("[showRangeInputDialog] 다운로드 범위 입력:", {
			startEpisode,
			endEpisode,
			delay,
		});

		if (!validateDownloadRange(startEpisode, endEpisode, allEpisodeLinks.length)) {
			alert("유효한 회차 범위를 입력해주세요.");
			debugLog("[showRangeInputDialog] 잘못된 회차 범위 입력");
			return;
		}

		if (Number.isNaN(delay) || delay < 1000) {
			alert("유효한 딜레이 값을 입력해주세요. (최소 1000ms)");
			debugLog("[showRangeInputDialog] 잘못된 딜레이 입력");
			return;
		}

		document.body.removeChild(rangeDialog);
		onDownloadConfirmed(startEpisode, endEpisode, delay);
	};

	rangeButtons.appendChild(downloadButton);

	rangeContent.appendChild(rangeButtons);

	rangeDialog.appendChild(rangeContent);
	document.body.appendChild(rangeDialog);

	setModalAccessibility(
		rangeDialog,
		startInput.input,
		() => document.body.removeChild(rangeDialog),
		downloadButton,
	);
}

async function runCrawler() {
	debugLog("[runCrawler] 시작");
	const novelPageRule = "https://booktoki";
	let currentUrl = window.location.href;

	const urlParts = currentUrl.split("?")[0];
	currentUrl = urlParts;

	debugLog("[runCrawler] 현재 URL:", currentUrl);

	if (!currentUrl.startsWith(novelPageRule)) {
		alert("이 스크립트는 북토기 소설 목록 페이지에서 실행해야 합니다.");
		debugLog("[runCrawler] 북토기 페이지 아님, 종료");
		return;
	}

	const title = extractTitle();
	debugLog("[runCrawler] 추출된 제목:", title);

	if (!title) {
		alert("소설 제목을 추출하지 못했습니다.");
		debugLog("[runCrawler] 제목 추출 실패, 종료");
		return;
	}

	showPageInputDialog(title, async (totalPages) => {
		const allEpisodeLinks = await fetchAllEpisodeLinks(currentUrl, totalPages);

		if (allEpisodeLinks.length === 0) {
			alert("에피소드 목록을 가져오지 못했습니다.");
			debugLog("[runCrawler] 에피소드 링크 없음, 종료");
			return;
		}

		showRangeInputDialog(allEpisodeLinks, (startEpisode, endEpisode, delay) => {
			debugLog(
				`작업 추가됨: ${title} 다운로드 준비 중 (${startEpisode}화부터 ${endEpisode}화까지)`,
			);
			downloadNovel(title, allEpisodeLinks, startEpisode, endEpisode, delay);
		});
	});
}

function setModalAccessibility(
	modal,
	firstInput,
	closeCallback,
	defaultButton,
) {
	if (firstInput) firstInput.focus();
	modal.tabIndex = -1;
	modal.focus();
	modal.addEventListener("keydown", (e) => {
		const focusable = modal.querySelectorAll(
			'input, button, [tabindex]:not([tabindex="-1"])',
		);
		const focusArr = Array.from(focusable);
		const idx = focusArr.indexOf(document.activeElement);
		if (e.key === "Tab") {
			if (e.shiftKey) {
				if (idx === 0) {
					focusArr[focusArr.length - 1].focus();
					e.preventDefault();
				}
			} else {
				if (idx === focusArr.length - 1) {
					focusArr[0].focus();
					e.preventDefault();
				}
			}
		}
		if (e.key === "Escape") {
			closeCallback();
		}
		if (e.key === "Enter" && defaultButton) {
			if (
				document.activeElement.tagName === "INPUT" ||
				document.activeElement === defaultButton
			) {
				defaultButton.click();
			}
		}
	});
}

runCrawler();
