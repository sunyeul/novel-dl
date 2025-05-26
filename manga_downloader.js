(async () => {
	// --- 설정 ---
	// 디폴트의 이미지 선택자 (대상 사이트에 맞추어 변경이 필요)
	const DEFAULT_IMAGE_SELECTOR = ".view-padding img"; // 예: .viewer-container img 등, 사이트에 맞추어 조정
	const DEFAULT_DELAY_MS = 5000; // 이미지 가져오기 사이의 디폴트 지연 (밀리초)

	// --- 라이브러리 로드 ---
	async function loadScript(url) {
		return new Promise((resolve, reject) => {
			// JSZip는@require로 로드되므로, 여기서는 필요하지 않지만,
			// 다른 라이브러리가 필요한 경우를 대비하여 남겨둠
			if (typeof JSZip !== "undefined") {
				console.log("JSZip already loaded.");
				resolve();
				return;
			}
			// @require 가 기능하지 않는 환경을 위한 폴백 (북마크릿 등)
			console.log(`Loading script: ${url}`);
			const script = document.createElement("script");
			script.src = url;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function getFileExtension(url) {
		try {
			const pathname = new URL(url).pathname;
			const lastDot = pathname.lastIndexOf(".");
			if (lastDot === -1) return "jpg"; // 확장자가 없는 경우는 jpg를 가정
			return pathname.substring(lastDot + 1).toLowerCase() || "jpg";
		} catch (e) {
			// URL 분석에 실패한 경우는 jpg를 가정
			return "jpg";
		}
	}

	// --- 코어 기능 ---
	function extractImageUrls(imageSelector) {
		const images = document.querySelectorAll(imageSelector);
		if (!images || images.length === 0) {
			console.warn("No images found with selector:", imageSelector);
			return [];
		}
		const urls = Array.from(images)
			.map((img) => img.src || img.dataset.src) // src 또는 지연 로드를 위한 data-src를 고려
			.filter(
				(url) => url && (url.startsWith("http:") || url.startsWith("https:")),
			); // 유효한 URL만 추출
		console.log(`Found ${urls.length} image URLs.`);
		return urls;
	}

	async function fetchImageData(url) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				console.error(
					`Failed to fetch image: ${url}. Status: ${response.status}`,
				);
				return null;
			}
			const blob = await response.blob();
			// CORS 오류를 방지하기 위해 response.blob()를 사용
			// 직접 ArrayBuffer 등으로 변환하려고 하면 CORS 오류가 발생할 수 있음
			return blob;
		} catch (error) {
			console.error(`Error fetching image ${url}: ${error.message}`);
			// CORS 오류의 경우, 콘솔에 세부 사항이 표시될 것으로 가정
			if (error.name === "TypeError" && error.message.includes("fetch")) {
				console.error(
					"This might be a CORS issue. Check the browser console for details.",
				);
			}
			return null;
		}
	}

	async function createMangaZip(title, imageUrls, delayMs, progressCallback) {
		if (typeof JSZip === "undefined") {
			alert(
				"JSZip library is not loaded. Cannot create ZIP file. Make sure you are using Tampermonkey or Violentmonkey with @require, or check internet connection.",
			);
			throw new Error("JSZip not loaded");
		}
		const zip = new JSZip();
		let completedCount = 0;
		let failedCount = 0;
		const totalImages = imageUrls.length;
		const padLength = String(totalImages).length; // 파일 이름의 영 채우기 자릿수

		for (let i = 0; i < totalImages; i++) {
			const url = imageUrls[i];
			const currentImageNum = i + 1;

			progressCallback({
				statusText: `Fetching image ${currentImageNum}/${totalImages}...`,
				completed: completedCount,
				failed: failedCount,
				total: totalImages,
			});

			const imageData = await fetchImageData(url);

			if (imageData && imageData.size > 0) {
				const extension = getFileExtension(url);
				const filename = `${String(currentImageNum).padStart(padLength, "0")}.${extension}`;
				zip.file(filename, imageData, { binary: true });
				completedCount++;
			} else {
				failedCount++;
				console.warn(`Skipping failed image: ${url}`);
			}

			progressCallback({
				statusText: `Processing ${currentImageNum}/${totalImages}...`,
				completed: completedCount,
				failed: failedCount,
				total: totalImages,
			});

			// 다음 이미지 가져오기까지의 지연
			if (i < totalImages - 1) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		progressCallback({
			statusText: "Generating ZIP file...",
			completed: completedCount,
			failed: failedCount,
			total: totalImages,
			isGenerating: true,
		});

		// ZIP 파일 생성 (비동기)
		const zipBlob = await zip.generateAsync({
			type: "blob",
			compression: "DEFLATE",
			compressionOptions: {
				level: 6, // 압축 레벨 (1-9)
			},
		});

		return { zipBlob, completedCount, failedCount };
	}

	// --- UI 관련 (novel-dl 스크립트에서 흐름 사용·변경) ---
	function createModal(title) {
		// 스타일이 존재하지 않는 경우에 추가
		if (!document.getElementById("manga-dl-styles")) {
			const style = document.createElement("style");
			style.id = "manga-dl-styles";
			style.textContent = `
                @keyframes manga-dl-fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes manga-dl-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .manga-dl-modal {
                    position: fixed; z-index: 99999; left: 0; top: 0; width: 100%; height: 100%;
                    background-color: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    animation: manga-dl-fadeIn 0.3s;
                }
                .manga-dl-modal-content {
                    background-color: #fff; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                    width: 400px; max-width: 90%; overflow: hidden;
                }
                .manga-dl-header {
                    background-color: #f7f7f7; border-bottom: 1px solid #e5e5e5; padding: 15px 20px;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .manga-dl-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #333; }
                .manga-dl-close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #888; padding: 0 5px; line-height: 1; }
                .manga-dl-body { padding: 20px; }
                .manga-dl-status { margin-bottom: 15px; font-size: 14px; color: #555; text-align: center; }
                .manga-dl-progress-info { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #666; }
                .manga-dl-progress-bar-container { width: 100%; height: 10px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; }
                .manga-dl-progress-bar { width: 0%; height: 100%; background-color: #007bff; transition: width 0.2s ease; border-radius: 10px; }
                .manga-dl-details { margin-top: 15px; font-size: 12px; color: #777; text-align: center; }
								.manga-dl-spinner { width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: manga-dl-spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-left: 10px; }
            `;
			document.head.appendChild(style);
		}

		const modal = document.createElement("div");
		modal.id = "mangaDownloadProgressModal";
		modal.className = "manga-dl-modal";

		const modalContent = document.createElement("div");
		modalContent.className = "manga-dl-modal-content";

		const header = document.createElement("div");
		header.className = "manga-dl-header";
		const headerTitle = document.createElement("h3");
		headerTitle.textContent = title;
		const closeButton = document.createElement("button");
		closeButton.className = "manga-dl-close-btn";
		closeButton.innerHTML = "&times;";
		closeButton.onclick = () => {
			// 여기서는 단순히 닫기만 합니다 (취소 처리는 복잡하므로 생략)
			if (
				confirm(
					"Are you sure you want to close the progress window? Download might continue in background.",
				)
			) {
				modal.style.display = "none"; // 완전 삭제가 아닌 숨김 처리
			}
		};
		header.appendChild(headerTitle);
		header.appendChild(closeButton);

		const body = document.createElement("div");
		body.className = "manga-dl-body";

		const statusElement = document.createElement("div");
		statusElement.className = "manga-dl-status";
		statusElement.textContent = "Initializing...";

		const progressInfo = document.createElement("div");
		progressInfo.className = "manga-dl-progress-info";
		const progressText = document.createElement("span");
		progressText.textContent = "0%";
		const progressCounts = document.createElement("span");
		progressCounts.textContent = "0/0";
		progressInfo.appendChild(progressText);
		progressInfo.appendChild(progressCounts);

		const progressBarContainer = document.createElement("div");
		progressBarContainer.className = "manga-dl-progress-bar-container";
		const progressBar = document.createElement("div");
		progressBar.className = "manga-dl-progress-bar";
		progressBarContainer.appendChild(progressBar);

		const detailedProgress = document.createElement("div");
		detailedProgress.className = "manga-dl-details";
		detailedProgress.innerHTML = "Completed: 0 | Failed: 0";

		body.appendChild(statusElement);
		body.appendChild(progressInfo);
		body.appendChild(progressBarContainer);
		body.appendChild(detailedProgress);
		modalContent.appendChild(header);
		modalContent.appendChild(body);
		modal.appendChild(modalContent);

		// Spinner element for generating state
		const spinner = document.createElement("div");
		spinner.className = "manga-dl-spinner";
		spinner.style.display = "none"; // Initially hidden
		statusElement.appendChild(spinner);

		function updateProgress(progressData) {
			const {
				statusText,
				completed,
				failed,
				total,
				isGenerating = false, // ZIP 생성 중 플래그
			} = progressData;
			const percent = total > 0 ? ((completed + failed) / total) * 100 : 0;

			statusElement.firstChild.textContent = statusText; // Update text node only
			spinner.style.display = isGenerating ? "inline-block" : "none"; // Show/hide spinner

			progressBar.style.width = `${percent.toFixed(1)}%`;
			progressText.textContent = `${percent.toFixed(1)}%`;
			progressCounts.textContent = `${completed + failed}/${total}`;
			detailedProgress.innerHTML = `Completed: ${completed} | Failed: ${failed}`;
		}

		return {
			modal,
			updateProgress,
			closeModal: () => document.body.removeChild(modal),
		};
	}

	// --- 대화상자 생성 함수 ---
	function createInputDialog(
		initialTitle,
		initialSelector,
		initialDelay,
		callback,
	) {
		const dialog = document.createElement("div");
		Object.assign(dialog.style, {
			position: "fixed",
			zIndex: "99999",
			left: "0",
			top: "0",
			width: "100%",
			height: "100%",
			backgroundColor: "rgba(0,0,0,0.6)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			fontFamily:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
			animation: "manga-dl-fadeIn 0.3s",
		});

		const content = document.createElement("div");
		Object.assign(content.style, {
			backgroundColor: "#fff",
			borderRadius: "8px",
			padding: "25px",
			width: "450px",
			maxWidth: "90%",
			boxShadow: "0 5px 15px rgba(0,0,0,0.2)",
		});

		const titleH3 = document.createElement("h3");
		titleH3.textContent = "Manga Downloader Settings";
		Object.assign(titleH3.style, {
			margin: "0 0 20px 0",
			fontSize: "18px",
			fontWeight: "600",
			color: "#333",
			textAlign: "center",
		});
		content.appendChild(titleH3);

		function createInputGroup(
			labelText,
			inputId,
			inputType,
			defaultValue,
			placeholder,
			description,
		) {
			const group = document.createElement("div");
			group.style.marginBottom = "15px";

			const label = document.createElement("label");
			label.htmlFor = inputId;
			label.textContent = labelText;
			Object.assign(label.style, {
				display: "block",
				marginBottom: "5px",
				fontSize: "14px",
				fontWeight: "500",
				color: "#444",
			});
			group.appendChild(label);

			if (description) {
				const desc = document.createElement("p");
				desc.textContent = description;
				Object.assign(desc.style, {
					fontSize: "11px",
					color: "#777",
					margin: "0 0 5px 0",
					fontStyle: "italic",
				});
				group.appendChild(desc);
			}

			const input = document.createElement("input");
			input.id = inputId;
			input.type = inputType;
			input.value = defaultValue;
			input.placeholder = placeholder || "";
			Object.assign(input.style, {
				width: "100%",
				padding: "10px",
				border: "1px solid #ccc",
				borderRadius: "4px",
				fontSize: "14px",
				boxSizing: "border-box",
			});
			if (inputType === "number") input.min = 0;
			group.appendChild(input);
			return { group, input };
		}

		const titleGroup = createInputGroup(
			"Title (for ZIP file)",
			"mangaTitle",
			"text",
			initialTitle,
			"Enter manga title",
		);
		const selectorGroup = createInputGroup(
			"Image Selector (CSS)",
			"imageSelector",
			"text",
			initialSelector,
			".manga-viewer img",
			"Crucial! Find the correct selector for manga images.",
		);
		const delayGroup = createInputGroup(
			"Delay (ms)",
			"delayMs",
			"number",
			initialDelay,
			"e.g., 1000",
			"Delay between image fetches (>= 500ms recommended).",
		);
		delayGroup.input.min = 0; // 0도 허용

		content.appendChild(titleGroup.group);
		content.appendChild(selectorGroup.group);
		content.appendChild(delayGroup.group);

		const buttonContainer = document.createElement("div");
		Object.assign(buttonContainer.style, {
			display: "flex",
			justifyContent: "flex-end",
			marginTop: "25px",
			gap: "10px",
		});

		const cancelButton = document.createElement("button");
		cancelButton.textContent = "Cancel";
		Object.assign(cancelButton.style, {
			padding: "10px 15px",
			border: "1px solid #ccc",
			borderRadius: "4px",
			backgroundColor: "#f0f0f0",
			cursor: "pointer",
			fontSize: "14px",
		});
		cancelButton.onclick = () => document.body.removeChild(dialog);

		const startButton = document.createElement("button");
		startButton.textContent = "Start Download";
		Object.assign(startButton.style, {
			padding: "10px 20px",
			border: "none",
			borderRadius: "4px",
			backgroundColor: "#007bff",
			color: "white",
			cursor: "pointer",
			fontSize: "14px",
			fontWeight: "500",
		});
		startButton.onclick = () => {
			const title = titleGroup.input.value.trim();
			const selector = selectorGroup.input.value.trim();
			const delay = Number.parseInt(delayGroup.input.value, 10);

			if (!title) {
				alert("Please enter a title.");
				return;
			}
			if (!selector) {
				alert("Please enter an image selector.");
				return;
			}
			if (Number.isNaN(delay) || delay < 0) {
				alert("Please enter a valid non-negative delay.");
				return;
			}

			document.body.removeChild(dialog);
			callback(title, selector, delay);
		};

		buttonContainer.appendChild(cancelButton);
		buttonContainer.appendChild(startButton);
		content.appendChild(buttonContainer);

		dialog.appendChild(content);
		document.body.appendChild(dialog);
	}

	// --- 메인 실행 함수 ---
	async function runMangaDownloader() {
		console.log("Manga Downloader script started.");

		// JSZip의 로드를 시도하는 것 (Tampermonkey/@require가 없는 환경을 위함)
		try {
			await loadScript(
				"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
			);
		} catch (error) {
			alert("Failed to load JSZip library. Cannot proceed.");
			console.error("JSZip loading error:", error);
			return;
		}

		// 페이지 제목에서 기본 제목을 가져옴
		let initialTitle = "manga";
		// .toon-title 요소에서 title 속성에서 추출 (예: "이러는 게 좋아 48-5화")
		const toonTitleElement = document.querySelector(".toon-title");
		if (toonTitleElement) {
			// title 속성에서 추출
			const titleAttr = toonTitleElement.getAttribute("title");
			if (titleAttr) {
				// 괄호 및 뒤쪽 회차 정보 등은 제거 (예: "이러는 게 좋아 48-5화 (246/247)" → "이러는 게 좋아 48-5화")
				initialTitle = titleAttr.replace(/\s*\(.*?\)\s*$/, "").trim();
			} else {
				// title 속성이 없으면 텍스트 노드에서 추출 (br 태그 앞까지)
				const text = toonTitleElement.childNodes[0]?.textContent?.trim();
				if (text) {
					initialTitle = text;
				}
			}
		} else {
			// 기존 방식으로 폴백
			const pageTitle = document.title.split("|")[0].split("-")[0].trim();
			if (pageTitle) initialTitle = pageTitle;
		}

		// 설정 대화상자를 표시
		createInputDialog(
			initialTitle,
			DEFAULT_IMAGE_SELECTOR,
			DEFAULT_DELAY_MS,
			async (title, selector, delay) => {
				console.log(
					`Settings: Title="${title}", Selector="${selector}", Delay=${delay}ms`,
				);

				const imageUrls = extractImageUrls(selector);
				if (imageUrls.length === 0) {
					alert(
						`No images found with the selector "${selector}". Please check the selector and try again.`,
					);
					return;
				}

				const { modal, updateProgress, closeModal } = createModal(
					`Downloading "${title}"`,
				);
				document.body.appendChild(modal);

				try {
					const { zipBlob, completedCount, failedCount } = await createMangaZip(
						title,
						imageUrls,
						delay,
						updateProgress,
					);

					// 다운로드 완료 처리
					updateProgress({
						statusText: "Download complete! Generating file...",
						completed: completedCount,
						failed: failedCount,
						total: imageUrls.length,
						isGenerating: true, // 스피너 표시
					});

					if (completedCount === 0) {
						alert(
							"No images could be downloaded. Check console for errors (possible CORS issues).",
						);
						closeModal();
						return;
					}

					// 잠시 기다렸다가 다운로드 링크를 생성
					await new Promise((resolve) => setTimeout(resolve, 500));

					const finalFilename = `${title}.zip`;
					const link = document.createElement("a");
					link.href = URL.createObjectURL(zipBlob);
					link.download = finalFilename;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					URL.revokeObjectURL(link.href); // 메모리 해제

					alert(
						`Download finished for "${title}"!\nCompleted: ${completedCount}\nFailed: ${failedCount}`,
					);
					closeModal();
				} catch (error) {
					console.error("Error during download process:", error);
					alert(
						`An error occurred: ${error.message}. Check the console for details.`,
					);
					closeModal(); // 오류 시에도 모달을 닫음
				}
			},
		);
	}

	// --- 스크립트 실행 ---
	// 유저가 실행을 시작하는 데 사용할 수 있는 버튼 등을 페이지에 추가해도 좋지만,
	// 여기서는 즉시 실행함
	runMangaDownloader();
})();
