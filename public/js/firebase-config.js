// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyArgQjPBbzqaOwj7btNbqnvAeK5sX3JHNc",
    authDomain: "rss-6eca8.firebaseapp.com",
    projectId: "rss-6eca8",
    storageBucket: "rss-6eca8.appspot.com",
    messagingSenderId: "126244572466",
    appId: "1:126244572466:web:22c508663f75f81f101b2b"
};

// Firebase 초기화
const app = firebase.initializeApp(firebaseConfig);

// Firebase 서비스 객체
const auth = firebase.auth();
const db = firebase.firestore();

// Google 로그인 공급자 설정
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});

// Firebase Messaging 객체 초기화
let messaging = null;
if (firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
}

// Service Worker 등록
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        throw new Error('이 브라우저는 Service Worker를 지원하지 않습니다.');
    }

    try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
        });
        console.log('Service Worker 등록 성공:', registration);

        // 기존 Service Worker가 있는 경우 갱신
        if (registration.active) {
            await registration.update();
        }

        return registration;
    } catch (error) {
        console.error('Service Worker 등록 오류:', error);
        throw error;
    }
}

