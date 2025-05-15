require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');
const path = require('path');

const app = express();
const port = process.env.PORT || 5003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Gemini API 키 확인
if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
}

console.log('Using Gemini API key:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');

// 콘텐츠 생성 함수
async function generateContent(prompt) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gemma-3-4b-it',
                contents: {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Error response:', error);
            throw new Error(error.error?.message || 'API request failed');
        }

        const responseText = await response.text();
        console.log('Raw API response:', responseText);

        try {
            const data = JSON.parse(responseText);
            console.log('Parsed API response:', data);

            const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!summary?.trim()) {
                throw new Error('Generated summary is empty');
            }

            console.log('Extracted summary:', summary);
            return summary;
        } catch (error) {
            console.error('Error parsing API response:', error);
            throw error;
        }
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
}

// 사용 가능한 모델 목록 확인
async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log('Available models:', data);
        return data;
    } catch (error) {
        console.error('Error listing models:', error);
        throw error;
    }
}

// 모델 테스트
async function testModel() {
    try {
        await listModels();
        const result = await generateContent('Say hello if you can read this message.');
        console.log('Test successful! Response:', result);
    } catch (error) {
        console.error('Gemini AI test failed:', error);
    }
}

// 초기화 테스트 실행
testModel().catch(error => {
    console.error('Gemini AI initialization test failed:', error);
    // 테스트 실패해도 서버는 계속 실행
});

// API 라우트
app.post('/api/summarize', async (req, res) => {
    console.log('Received summarize request:', req.body);
    const { videoTitle, videoDescription } = req.body;

    if (!videoTitle?.trim() || !videoDescription?.trim()) {
        console.log('Missing or empty required fields');
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 영상 제목과 설명의 길이 제한
        const truncatedTitle = videoTitle.trim().slice(0, 500);
        const truncatedDescription = videoDescription.trim().slice(0, 1000);

        const prompt = `영상에서 핵심주제를 3~5개 도출하고 개조식으로 요약하고 한글로 출력해주세요. 핵심내용에는 타임스탬프를 찍어주세요. 마크다운 형식으로 출력해주세요.

다음과 같은 형식으로 출력해주세요:

# 영상 요약
## 핵심 내용
- [00:00] 주제1 요약
- [00:00] 주제2 요약

제목: ${truncatedTitle}

설명: ${truncatedDescription}`;
        console.log('Generating summary with prompt:', prompt);
        
        const summary = await generateContent(prompt);
        console.log('Generated summary:', summary);

        if (!summary?.trim()) {
            throw new Error('Generated summary is empty');
        }

        res.json({ summary });
    } catch (error) {
        console.error('Error generating summary:', error);
        if (error.response) {
            console.error('Error response:', await error.response.text());
        }
        res.status(500).json({ 
            error: 'Failed to generate summary',
            details: error.message
        });
    }
});

// 새 영상 확인 및 알림 전송 (매 시간 실행)
cron.schedule('0 * * * *', async () => {
    try {
        // TODO: 구독 중인 채널의 새 영상 확인
        // TODO: 새 영상이 있다면 Firebase Cloud Messaging으로 알림 전송
    } catch (error) {
        console.error('Error checking new videos:', error);
    }
});

// SPA를 위한 라우트
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
