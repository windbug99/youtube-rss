// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase 초기화
firebase.initializeApp({
    apiKey: "AIzaSyArgQjPBbzqaOwj7btNbqnvAeK5sX3JHNc",
    authDomain: "rss-6eca8.firebaseapp.com",
    projectId: "rss-6eca8",
    storageBucket: "rss-6eca8.appspot.com",
    messagingSenderId: "126244572466",
    appId: "1:126244572466:web:22c508663f75f81f101b2b"
});

// 메시징 객체 가져오기
const messaging = firebase.messaging();

// 백그라운드 메시지 수신
messaging.onBackgroundMessage(function(payload) {
    console.log('백그라운드에서 메시지 수신:', payload);

    const notificationTitle = payload.notification.title || '새 알림';
    const notificationOptions = {
        body: payload.notification.body || '',
        icon: '/icon.png',
        badge: '/badge.png',
        tag: 'notification-' + Date.now(),
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', function(event) {
    console.log('알림 클릭:', event);
    event.notification.close();

    // 알림 클릭 시 웹 앱 열기
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                if (clientList.length > 0) {
                    return clientList[0].focus();
                }
                return clients.openWindow('/');
            })
    );
});

self.addEventListener('install', function(event) {
    console.log('Service Worker 설치됨');
});

self.addEventListener('activate', function(event) {
    console.log('Service Worker 활성화됨');
});

