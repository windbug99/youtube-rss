// 인증 상태 관리
let currentUser = null;

// DOM 요소
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const channelList = document.getElementById('channelList');

// 인증 상태 변경 감지
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        showUserInfo(user);
        loadUserChannels();
        setupNotifications();
    } else {
        currentUser = null;
        showLoginButton();
        hideUserContent();
    }
});

// 로그인 버튼 클릭 핸들러
loginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithPopup(provider);
    } catch (error) {
        console.error('로그인 오류:', error);
        alert('로그인 중 오류가 발생했습니다.');
    }
});

// 로그아웃 버튼 클릭 핸들러
logoutBtn.addEventListener('click', async () => {
    try {
        await firebase.auth().signOut();
    } catch (error) {
        console.error('로그아웃 오류:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
});

// 사용자 정보 표시
function showUserInfo(user) {
    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    channelList.classList.remove('hidden');
    
    userPhoto.src = user.photoURL;
    userName.textContent = user.displayName;
}

// 로그인 버튼 표시
function showLoginButton() {
    loginBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
}

// 사용자 콘텐츠 숨기기
function hideUserContent() {
    channelList.classList.add('hidden');
    document.getElementById('result').classList.add('hidden');
}

// 사용자의 구독 채널 로드
async function loadUserChannels() {
    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('channels')
            .get();
        
        const channels = snapshot.docs.map(doc => doc.data());
        displaySubscribedChannels(channels);
    } catch (error) {
        console.error('채널 로드 오류:', error);
    }
}

// 구독 중인 채널 표시
function displaySubscribedChannels(channels) {
    const container = document.getElementById('subscribedChannels');
    container.innerHTML = channels.map(channel => `
        <div class="channel-item">
            <img src="${channel.thumbnail}" alt="${channel.title}">
            <div class="channel-info">
                <h3>${channel.title}</h3>
                <button onclick="unsubscribeChannel('${channel.id}')" class="unsubscribe-btn">구독 취소</button>
            </div>
        </div>
    `).join('');
}

// 채널 구독 취소
async function unsubscribeChannel(channelId) {
    try {
        await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('channels')
            .doc(channelId)
            .delete();
        
        await loadUserChannels();
    } catch (error) {
        console.error('구독 취소 오류:', error);
        alert('구독 취소 중 오류가 발생했습니다.');
    }
}

// 알림 설정 (일시적으로 비활성화)
async function setupNotifications() {
    console.log('알림 기능이 일시적으로 비활성화되었습니다.');
    return;
}

// 알림 토큰 저장
async function saveNotificationToken(token) {
    try {
        await firebase.firestore()
            .collection('users')
            .doc(currentUser.uid)
            .set({
                notificationToken: token
            }, { merge: true });
    } catch (error) {
        console.error('토큰 저장 오류:', error);
    }
}
