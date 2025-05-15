document.addEventListener('DOMContentLoaded', () => {
    // marked 설정
    marked.setOptions({
        gfm: true,
        breaks: true,
        sanitize: false,
        renderer: new marked.Renderer()
    });

    // 링크가 새 탭에서 열리도록 설정
    const renderer = new marked.Renderer();
    renderer.link = (href, title, text) => {
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    };
    marked.setOptions({ renderer });
    const channelUrlInput = document.getElementById('channelUrl');
    const generateBtn = document.getElementById('generateBtn');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const resultElement = document.getElementById('result');
    const channelInfoElement = document.getElementById('channelInfo');
    const videoListElement = document.getElementById('videoList');

    generateBtn.addEventListener('click', handleGenerateRss);

    async function handleGenerateRss() {
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }
        const channelUrl = channelUrlInput.value.trim();
        if (!channelUrl) {
            showError('채널 URL을 입력해주세요.');
            return;
        }

        // URL 유효성 검사
        if (!isValidYouTubeUrl(channelUrl)) {
            showError('올바른 YouTube 채널 URL을 입력해주세요.');
            return;
        }

        try {
            showLoading();
            const channelId = await getChannelId(channelUrl);
            const channelData = await getChannelData(channelId);
            const videos = await getChannelVideos(channelId);
            
            // 채널 구독 추가
            await subscribeToChannel(channelId, channelData);
            
            // 영상 요약 추가
            const videosWithSummary = await addVideoSummaries(videos);
            
            displayResults(channelData, videosWithSummary);
        } catch (error) {
            showError(error.message);
        } finally {
            hideLoading();
        }
    }

    function isValidYouTubeUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com';
        } catch {
            return false;
        }
    }

    async function getChannelId(url) {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        
        let channelId;
        
        if (path.includes('/channel/')) {
            channelId = path.split('/channel/')[1];
        } else if (path.includes('/@')) {
            const handle = path.split('/@')[1];
            // 채널 핸들로 채널 ID 조회
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=id&type=channel&q=${handle}&key=${config.YOUTUBE_API_KEY}`
            );
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                channelId = data.items[0].id.channelId;
            } else {
                throw new Error('채널을 찾을 수 없습니다.');
            }
        } else {
            throw new Error('지원하지 않는 채널 URL 형식입니다.');
        }
        
        return channelId;
    }

    async function getChannelData(channelId) {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${config.YOUTUBE_API_KEY}`
        );
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            throw new Error('채널 정보를 찾을 수 없습니다.');
        }
        
        const channel = data.items[0].snippet;
        return {
            title: channel.title,
            description: channel.description,
            thumbnail: channel.thumbnails.default.url
        };
    }

    async function getChannelVideos(channelId) {
        // 먼저 최근 영상 ID를 검색
        const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&order=date&type=video&maxResults=3&key=${config.YOUTUBE_API_KEY}`
        );
        const searchData = await searchResponse.json();
        
        if (!searchData.items) {
            throw new Error('영상 목록을 가져올 수 없습니다.');
        }
        
        // 영상 ID들을 추출
        const videoIds = searchData.items.map(item => item.id.videoId);
        
        // 영상 상세 정보 가져오기
        const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${config.YOUTUBE_API_KEY}`
        );
        const videosData = await videosResponse.json();
        
        if (!videosData.items) {
            throw new Error('영상 정보를 가져올 수 없습니다.');
        }
        
        const videos = videosData.items.map(item => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description || '설명이 없습니다.',
            thumbnail: item.snippet.thumbnails.medium?.url || '',
            publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
            url: `https://youtube.com/watch?v=${item.id}`,
            duration: item.contentDetails.duration
        }));

        // Firestore에서 기존 요약 정보 가져오기
        const summaries = await getStoredSummaries(videos.map(v => v.id));
        return videos.map(video => ({
            ...video,
            summary: summaries[video.id] || null
        }));
    }

    // 채널 구독 추가
    async function subscribeToChannel(channelId, channelData) {
        try {
            await firebase.firestore()
                .collection('users')
                .doc(currentUser.uid)
                .collection('channels')
                .doc(channelId)
                .set({
                    id: channelId,
                    title: channelData.title,
                    description: channelData.description,
                    thumbnail: channelData.thumbnail,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            console.error('채널 구독 오류:', error);
            throw new Error('채널 구독 중 오류가 발생했습니다.');
        }
    }

    // 영상 요약 추가
    async function addVideoSummaries(videos) {
        const summaries = {};
        
        for (const video of videos) {
            try {
                if (!video.title || !video.description) {
                    console.warn('Video missing title or description:', video.id);
                    continue;
                }

                // 비디오 제목과 설명이 유효한지 확인
                const title = video.title?.trim();
                const description = video.description?.trim();
                
                if (!title || !description) {
                    console.warn('유효하지 않은 비디오 데이터:', { id: video.id, title, description });
                    continue;
                }

                const response = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        videoTitle: title,
                        videoDescription: description
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.summary) {
                    summaries[video.id] = data.summary;
                    // 요약 정보 저장
                    await saveVideoSummary(video.id, data.summary);
                }
            } catch (error) {
                console.error('영상 요약 오류:', error);
            }
        }
        
        return videos.map(video => ({
            ...video,
            summary: summaries[video.id] || null
        }));
    }

    // 영상 요약 정보 저장
    async function saveVideoSummary(videoId, summary) {
        try {
            await firebase.firestore()
                .collection('videoSummaries')
                .doc(videoId)
                .set({
                    summary,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            console.error('요약 저장 오류:', error);
        }
    }

    // 저장된 요약 정보 가져오기
    async function getStoredSummaries(videoIds) {
        try {
            const summaries = {};
            const snapshot = await firebase.firestore()
                .collection('videoSummaries')
                .where(firebase.firestore.FieldPath.documentId(), 'in', videoIds)
                .get();
            
            snapshot.forEach(doc => {
                summaries[doc.id] = doc.data().summary;
            });
            
            return summaries;
        } catch (error) {
            console.error('저장된 요약 정보 조회 오류:', error);
            return {};
        }
    }

    function displayResults(channelData, videos) {
        // 채널 정보 표시
        channelInfoElement.innerHTML = `
            <img src="${channelData.thumbnail}" alt="채널 썸네일" width="88" height="88" style="border-radius: 50%">
            <div>
                <h3>${channelData.title}</h3>
                <p>${channelData.description}</p>
            </div>
        `;

        // 영상 목록 표시
        videoListElement.innerHTML = videos.map(video => `
            <div class="video-item">
                <a href="${video.url}" target="_blank">
                    <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
                </a>
                <div class="video-info">
                    <h3><a href="${video.url}" target="_blank">${video.title}</a></h3>
                    <p class="video-description">${video.description}</p>
                    <p class="video-date">게시일: ${video.publishedAt}</p>
                    ${video.summary ? `<div class="video-summary">${
                        marked.parse(
                            addTimestampLinks(video.summary, video.url),
                            { sanitize: false }
                        )
                    }</div>` : ''}
                </div>
            </div>
        `).join('');

        resultElement.classList.remove('hidden');
    }

    function showError(message) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        resultElement.classList.add('hidden');
    }

    function showLoading() {
        loadingElement.classList.remove('hidden');
        errorElement.classList.add('hidden');
        resultElement.classList.add('hidden');
    }

    function hideLoading() {
        loadingElement.classList.add('hidden');
    }

    // 타임스탬프를 초 단위로 변환하는 함수
    function timestampToSeconds(timestamp) {
        const parts = timestamp.match(/^\[?(\d{1,2}):(\d{2})\]?$/);
        if (!parts) return null;
        return parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }

    // 타임스탬프를 링크로 변환하는 함수
    function addTimestampLinks(summary, videoUrl) {
        return summary.replace(/\[(\d{1,2}:\d{2})\]/g, (match, timestamp) => {
            const seconds = timestampToSeconds(timestamp);
            if (seconds === null) return match;
            return `[${timestamp}](${videoUrl}&t=${seconds}s)`;
        });
    }
});
