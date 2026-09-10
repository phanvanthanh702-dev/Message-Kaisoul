lucide.createIcons();

const socket = io();
let peer = new Peer();
let currentUser = null;
let currentMode = 'login';
let localStream;

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const appContainer = document.getElementById('app-container');
const authForm = document.getElementById('auth-form');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authSubmitBtn = document.getElementById('auth-submit-btn');

const displayUserName = document.getElementById('display-user-name');
const btnLogout = document.getElementById('btn-logout');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const messagesContainer = document.getElementById('messages');
const myPeerIdEl = document.getElementById('my-peer-id');

const callModal = document.getElementById('call-modal');
const btnVideoCall = document.getElementById('btn-video-call');
const btnEndCall = document.getElementById('btn-end-call');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

// Chuyển Tab Đăng nhập / Đăng ký
function switchTab(mode) {
  currentMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  authSubmitBtn.innerText = mode === 'login' ? 'Đăng nhập' : 'Đăng ký';
  authError.innerText = '';
}

// Xử lý gửi Form Đăng Nhập / Đăng Ký
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = authUsername.value.trim();
  const password = authPassword.value.trim();
  const endpoint = currentMode === 'login' ? '/api/login' : '/api/register';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    if (currentMode === 'login') {
      localStorage.setItem('kaisoul_token', data.token);
      localStorage.setItem('kaisoul_user', data.username);
      initApp(data.username);
    } else {
      alert('Đăng ký thành công! Hãy đăng nhập.');
      switchTab('login');
    }
  } catch (err) {
    authError.innerText = err.message;
  }
});

// Khởi chạy App sau khi đăng nhập thành công
function initApp(username) {
  currentUser = username;
  displayUserName.innerText = username;
  authOverlay.classList.add('hidden');
  appContainer.classList.remove('hidden');

  loadMessageHistory();
}

// Tải lịch sử tin nhắn từ database
async function loadMessageHistory() {
  const res = await fetch('/api/messages');
  const messages = await res.json();
  messagesContainer.innerHTML = '<div class="system-message">Chào mừng bạn trở lại với Kaisoul!</div>';
  messages.forEach(renderMessage);
}

// Xử lý Đăng xuất
btnLogout.addEventListener('click', () => {
  localStorage.removeItem('kaisoul_token');
  localStorage.removeItem('kaisoul_user');
  location.reload();
});

// Tự động Đăng nhập nếu có Token lưu sẵn
window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('kaisoul_user');
  const savedToken = localStorage.getItem('kaisoul_token');
  if (savedUser && savedToken) {
    initApp(savedUser);
  }
});

// --- LẮNG NGHE SOCKET CHAT ---
peer.on('open', (id) => { myPeerIdEl.innerText = id; });

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = msgInput.value.trim();
  if (message && currentUser) {
    socket.emit('send_message', { sender: currentUser, message });
    msgInput.value = '';
  }
});

socket.on('receive_message', (data) => { renderMessage(data); });

function renderMessage(data) {
  const isMe = data.sender === currentUser;
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message-item');
  if (isMe) msgDiv.classList.add('me');

  msgDiv.innerHTML = `
    <div class="meta">${data.sender} • ${data.time || ''}</div>
    <div class="content">${escapeHtml(data.message)}</div>
  `;
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- VIDEO CALL WEBRTC ---
btnVideoCall.addEventListener('click', async () => {
  const remotePeerId = prompt("Nhập ID thoại của người bạn muốn gọi:");
  if (!remotePeerId) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    callModal.classList.add('active');

    const call = peer.call(remotePeerId, localStream);
    call.on('stream', (remoteStream) => { remoteVideo.srcObject = remoteStream; });
  } catch (err) {
    alert("Không thể mở Cam/Mic: " + err.message);
  }
});

peer.on('call', async (call) => {
  if (confirm("Có cuộc gọi tới! Nhấn OK để nghe.")) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    callModal.classList.add('active');

    call.answer(localStream);
    call.on('stream', (remoteStream) => { remoteVideo.srcObject = remoteStream; });
  }
});

btnEndCall.addEventListener('click', () => {
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  callModal.classList.remove('active');
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
