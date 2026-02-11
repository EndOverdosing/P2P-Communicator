const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
    user: null,
    profile: null,
    friends: {},
    groups: {},
    requests: [],
    blocked: new Set(),
    activeChat: null, 
    activeChatType: null, 
    onlineUsers: new Set(),
    peer: null,
    call: null,
    localStream: null,
    replyTo: null,
    isTyping: false,
    theme: localStorage.getItem('theme') || 'dark'
};

const ui = {
    loader: document.getElementById('app-loader'),
    auth: document.getElementById('auth-container'),
    app: document.getElementById('main-app'),
    loginForm: document.getElementById('login-form'),
    signupForm: document.getElementById('signup-form'),
    authStatus: document.getElementById('auth-status'),
    friendsList: document.getElementById('friends-list'),
    chatView: document.getElementById('chat-view'),
    welcome: document.getElementById('welcome-screen'),
    msgs: document.getElementById('messages-container'),
    msgForm: document.getElementById('message-form'),
    msgInput: document.getElementById('message-input'),
    modal: document.getElementById('modal-container'),
    modalBody: document.getElementById('modal-body'),
    fileInput: document.getElementById('file-input'),
    sidebar: document.getElementById('sidebar'),
    chatContainer: document.getElementById('chat-container'),
    replyBar: document.getElementById('replying-to-bar'),
    contextMenu: document.getElementById('context-menu')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setTheme(state.theme);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await loadUser(session.user.id);
    } else {
        showAuth();
    }

    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('show-signup').onclick = () => toggleAuthMode(true);
    document.getElementById('show-login').onclick = () => toggleAuthMode(false);
    ui.loginForm.onsubmit = handleLogin;
    ui.signupForm.onsubmit = handleSignup;
    document.getElementById('logout-btn').onclick = handleLogout;
    document.getElementById('settings-btn').onclick = showSettings;
    document.getElementById('add-friend-btn').onclick = showAddFriend;
    document.getElementById('create-group-btn').onclick = showCreateGroup;
    document.getElementById('tab-chats').onclick = () => switchTab('chats');
    document.getElementById('tab-requests').onclick = () => switchTab('requests');
    document.getElementById('back-btn').onclick = closeChat;
    document.getElementById('file-btn').onclick = () => ui.fileInput.click();
    ui.fileInput.onchange = handleFileUpload;
    ui.msgInput.onkeydown = handleTyping;
    ui.msgForm.onsubmit = sendMessage;
    document.getElementById('cancel-reply').onclick = cancelReply;
    document.getElementById('close-modal').onclick = closeModal;
    document.getElementById('modal-container').onclick = (e) => { if(e.target === ui.modal) closeModal(); };
    document.getElementById('chat-info-btn').onclick = showChatInfo;
    document.getElementById('voice-call-btn').onclick = () => startCall(false);
    document.getElementById('video-call-btn').onclick = () => startCall(true);
    document.getElementById('call-end').onclick = endCall;
    document.getElementById('call-mute').onclick = toggleMute;
    document.getElementById('call-video').onclick = toggleVideo;

    window.onclick = (e) => {
        if (!e.target.closest('.context-menu')) ui.contextMenu.classList.add('hidden');
    };
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('theme', theme);
}

function toggleAuthMode(isSignup) {
    ui.loginForm.classList.toggle('hidden', isSignup);
    ui.signupForm.classList.toggle('hidden', !isSignup);
    ui.authStatus.textContent = '';
}

function showAuth() {
    ui.loader.classList.add('hidden');
    ui.app.classList.add('hidden');
    ui.auth.classList.remove('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-username').value + '@p2p.local';
    const password = document.getElementById('login-password').value;
    ui.authStatus.textContent = 'Logging in...';
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) ui.authStatus.textContent = 'Login failed.';
    else loadUser(data.user.id);
}

async function handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = username + '@p2p.local';
    const password = document.getElementById('signup-password').value;
    
    if (username.length < 3) return ui.authStatus.textContent = 'Username too short.';
    
    const { data: exists } = await supabase.from('profiles').select('id').eq('username', username).single();
    if (exists) return ui.authStatus.textContent = 'Username taken.';

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return ui.authStatus.textContent = error.message;

    await supabase.from('profiles').insert({ id: data.user.id, username });
    loadUser(data.user.id);
}

async function loadUser(uid) {
    ui.auth.classList.add('hidden');
    ui.loader.classList.remove('hidden');

    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    state.user = data;
    state.profile = data;

    document.getElementById('user-avatar').innerHTML = getAvatar(data);
    document.getElementById('username-display').textContent = data.username;

    await Promise.all([loadFriends(), loadGroups(), loadRequests(), loadBlocked()]);
    
    initPeer();
    setupRealtime();
    
    ui.loader.classList.add('hidden');
    ui.app.classList.remove('hidden');
    renderSidebar();
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload();
}

function initPeer() {
    state.peer = new Peer(undefined, {
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });
    
    state.peer.on('open', id => {
        supabase.from('profiles').update({ peer_id: id, is_online: true }).eq('id', state.user.id);
    });

    state.peer.on('call', incomingCall => {
        if (state.call) return incomingCall.close();
        
        const callerId = Object.values(state.friends).find(f => f.peer_id === incomingCall.peer)?.id;
        const callerName = state.friends[callerId]?.username || 'Unknown';
        
        if (confirm(`Incoming call from ${callerName}. Accept?`)) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                state.localStream = stream;
                incomingCall.answer(stream);
                handleCallStream(incomingCall);
            });
        } else {
            incomingCall.close();
        }
    });
}

function handleCallStream(call) {
    state.call = call;
    document.getElementById('call-overlay').classList.remove('hidden');
    
    addVideoTile('local', state.localStream, true);

    call.on('stream', remoteStream => {
        addVideoTile('remote', remoteStream);
    });

    call.on('close', () => {
        endCallUI();
    });
}

function addVideoTile(id, stream, muted = false) {
    const div = document.createElement('div');
    div.className = 'video-tile';
    div.id = `video-${id}`;
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = muted;
    video.playsInline = true;
    div.appendChild(video);
    document.getElementById('video-grid').appendChild(div);
}

async function startCall(video) {
    if (!state.activeChat || state.activeChatType !== 'friend') return;
    const friend = state.friends[state.activeChat];
    if (!friend.peer_id) return alert('User is offline');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        state.localStream = stream;
        const call = state.peer.call(friend.peer_id, stream);
        handleCallStream(call);
        
        insertSystemMessage(state.activeChat, 'call', `Started a ${video ? 'video' : 'voice'} call`);
    } catch (e) {
        alert('Could not access media devices');
    }
}

function endCall() {
    if (state.call) state.call.close();
    if (state.localStream) state.localStream.getTracks().forEach(t => t.stop());
    endCallUI();
}

function endCallUI() {
    state.call = null;
    state.localStream = null;
    document.getElementById('call-overlay').classList.add('hidden');
    document.getElementById('video-grid').innerHTML = '';
}

function toggleMute() {
    const track = state.localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    document.getElementById('call-mute').classList.toggle('danger', !track.enabled);
}

function toggleVideo() {
    const track = state.localStream.getVideoTracks()[0];
    track.enabled = !track.enabled;
    document.getElementById('call-video').classList.toggle('danger', !track.enabled);
}

function setupRealtime() {
    supabase.channel('public')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handleMessageUpdate)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, handleFriendUpdate)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileUpdate)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, loadGroups)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, loadGroups)
    .subscribe();

    setInterval(async () => {
        await supabase.from('profiles').update({ last_seen: new Date() }).eq('id', state.user.id);
    }, 30000);
}

async function loadFriends() {
    const { data } = await supabase.from('friends')
        .select(`*, p1:profiles!user_id_1(username, avatar_url, is_online, peer_id, last_seen), p2:profiles!user_id_2(username, avatar_url, is_online, peer_id, last_seen)`)
        .or(`user_id_1.eq.${state.user.id},user_id_2.eq.${state.user.id}`)
        .eq('status', 'accepted');
    
    state.friends = {};
    data.forEach(f => {
        const isP1 = f.user_id_1 === state.user.id;
        const profile = isP1 ? f.p2 : f.p1;
        const fid = isP1 ? f.user_id_2 : f.user_id_1;
        state.friends[fid] = { id: fid, ...profile };
        if (profile.is_online) state.onlineUsers.add(fid);
    });
    renderSidebar();
}

async function loadRequests() {
    const { data } = await supabase.from('friends')
        .select(`*, profile:profiles!action_user_id(username, avatar_url)`)
        .eq('user_id_2', state.user.id)
        .eq('status', 'pending');
    state.requests = data;
    renderSidebar();
}

async function loadGroups() {
    const { data } = await supabase.from('group_members')
        .select(`group_id, groups:groups(*)`)
        .eq('user_id', state.user.id);
    
    state.groups = {};
    data.forEach(g => {
        state.groups[g.group_id] = g.groups;
    });
    renderSidebar();
}

async function loadBlocked() {
    const { data } = await supabase.from('blocked_users').select('blocked_user_id').eq('user_id', state.user.id);
    state.blocked = new Set(data.map(b => b.blocked_user_id));
}

function renderSidebar() {
    const list = ui.friendsList;
    list.innerHTML = '';
    
    const activeTab = document.querySelector('.sidebar-tabs button.active').id;
    
    if (activeTab === 'tab-requests') {
        document.getElementById('requests-badge').textContent = state.requests.length;
        document.getElementById('requests-badge').classList.toggle('hidden', state.requests.length === 0);
        
        state.requests.forEach(req => {
            const el = document.createElement('div');
            el.className = 'request-item';
            el.innerHTML = `
                <div class="avatar">${getAvatar(req.profile)}</div>
                <div class="friend-info-col">
                    <span class="friend-name">${req.profile.username}</span>
                    <span class="friend-last-msg">Friend Request</span>
                </div>
                <div class="request-actions">
                    <button onclick="respondRequest('${req.id}', true)" style="background:var(--success);"><i class="fa-solid fa-check"></i></button>
                    <button onclick="respondRequest('${req.id}', false)" style="background:var(--error);"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
            list.appendChild(el);
        });
        return;
    }

    const items = [
        ...Object.values(state.friends).map(f => ({ ...f, type: 'friend', name: f.username })),
        ...Object.values(state.groups).map(g => ({ ...g, type: 'group', name: g.name }))
    ];

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = `friend-item ${state.activeChat === item.id ? 'active' : ''}`;
        const isOnline = item.type === 'friend' && state.onlineUsers.has(item.id);
        
        el.innerHTML = `
            <div class="avatar-wrapper">
                <div class="avatar">${getAvatar(item)}</div>
                ${item.type === 'friend' ? `<div class="status-indicator ${isOnline ? 'online' : ''}"></div>` : ''}
            </div>
            <div class="friend-info-col">
                <span class="friend-name">${item.name}</span>
            </div>
        `;
        el.onclick = () => openChat(item.id, item.type);
        list.appendChild(el);
    });
}

function switchTab(tab) {
    document.querySelectorAll('.sidebar-tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    renderSidebar();
}

async function respondRequest(id, accept) {
    if (accept) {
        await supabase.from('friends').update({ status: 'accepted' }).eq('id', id);
        loadFriends();
    } else {
        await supabase.from('friends').delete().eq('id', id);
    }
    loadRequests();
}

function getAvatar(profile) {
    if (profile.avatar_url) return `<img src="${profile.avatar_url}">`;
    return profile.username ? profile.username[0].toUpperCase() : 'G';
}

async function openChat(id, type) {
    state.activeChat = id;
    state.activeChatType = type;
    
    const target = type === 'friend' ? state.friends[id] : state.groups[id];
    if (!target) return;

    ui.chatContainer.classList.add('active');
    ui.sidebar.classList.add('hidden');
    ui.welcome.classList.add('hidden');
    ui.chatView.classList.remove('hidden');
    
    document.getElementById('chat-title').textContent = type === 'friend' ? target.username : target.name;
    document.getElementById('chat-header-avatar').innerHTML = getAvatar(target);
    document.getElementById('chat-status').textContent = type === 'friend' ? (state.onlineUsers.has(id) ? 'Online' : 'Offline') : `${Object.keys(state.groups[id] || {}).length} members`;
    
    renderSidebar();
    loadMessages();
}

function closeChat() {
    state.activeChat = null;
    ui.chatContainer.classList.remove('active');
    ui.sidebar.classList.remove('hidden');
    ui.chatView.classList.add('hidden');
    ui.welcome.classList.remove('hidden');
    renderSidebar();
}

async function loadMessages() {
    ui.msgs.innerHTML = '';
    const query = supabase.from('messages').select('*, profiles(username, avatar_url)').order('created_at', { ascending: true });
    
    if (state.activeChatType === 'friend') {
        query.or(`and(sender_id.eq.${state.user.id},receiver_id.eq.${state.activeChat}),and(sender_id.eq.${state.activeChat},receiver_id.eq.${state.user.id})`);
    } else {
        query.eq('group_id', state.activeChat);
    }
    
    const { data } = await query;
    let lastDate = null;
    
    data.forEach(msg => {
        const date = new Date(msg.created_at).toLocaleDateString();
        if (date !== lastDate) {
            const div = document.createElement('div');
            div.className = 'date-separator';
            div.textContent = date;
            ui.msgs.appendChild(div);
            lastDate = date;
        }
        renderMessage(msg);
    });
    scrollToBottom();
}

function renderMessage(msg) {
    if (msg.type === 'call') {
        const div = document.createElement('div');
        div.className = 'call-log-message';
        div.innerHTML = `<i class="fa-solid fa-phone"></i> ${msg.content}`;
        ui.msgs.appendChild(div);
        return;
    }

    const isMe = msg.sender_id === state.user.id;
    const div = document.createElement('div');
    div.className = `message-row ${isMe ? 'sent' : ''}`;
    div.id = `msg-${msg.id}`;
    
    let contentHtml = `<div class="message-bubble">`;
    if (msg.reply_to_id) {
        contentHtml += `<div class="reply-preview" onclick="scrollToMessage('${msg.reply_to_id}')">Replying to message...</div>`;
    }
    
    if (msg.type === 'image') {
        contentHtml += `<img src="${msg.file_url}" class="message-image" onclick="window.open(this.src)">`;
    } else if (msg.type === 'file') {
        contentHtml += `<a href="${msg.file_url}" target="_blank" class="message-file"><i class="fa-solid fa-file"></i> ${msg.content}</a>`;
    } else {
        contentHtml += msg.content;
    }
    
    if (msg.is_edited) contentHtml += `<span class="edited-tag">(edited)</span>`;
    
    contentHtml += `</div>
        <div class="message-timestamp">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        <div class="reactions-container" id="reactions-${msg.id}"></div>
    `;

    div.innerHTML = `
        <div class="message-avatar avatar small-avatar">${getAvatar(msg.profiles)}</div>
        <div class="message-content-wrapper">
            ${contentHtml}
        </div>
        <div class="message-actions">
            <button class="action-btn" onclick="triggerReply('${msg.id}', '${msg.profiles.username}')"><i class="fa-solid fa-reply"></i></button>
            <button class="action-btn" onclick="triggerReaction('${msg.id}')"><i class="fa-regular fa-face-smile"></i></button>
            ${isMe && msg.type === 'text' ? `<button class="action-btn" onclick="triggerEdit('${msg.id}', '${msg.content}')"><i class="fa-solid fa-pen"></i></button>` : ''}
            ${isMe ? `<button class="action-btn" onclick="deleteMessage('${msg.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
        <div class="swipe-timestamp left">${new Date(msg.created_at).toLocaleTimeString()}</div>
        <div class="swipe-timestamp right">${new Date(msg.created_at).toLocaleTimeString()}</div>
    `;

    setupSwipe(div);
    div.oncontextmenu = (e) => showContextMenu(e, msg);
    ui.msgs.appendChild(div);
    renderReactions(msg.id, msg.reactions);
}

function setupSwipe(el) {
    let startX = 0;
    el.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    el.addEventListener('touchmove', e => {
        const delta = e.touches[0].clientX - startX;
        if (Math.abs(delta) < 80) el.style.transform = `translateX(${delta}px)`;
        if (delta > 0) el.classList.add('swiped-right');
        else el.classList.add('swiped-left');
    });
    el.addEventListener('touchend', () => {
        el.style.transform = 'translateX(0)';
        el.classList.remove('swiped-right', 'swiped-left');
    });
}

async function sendMessage(e) {
    e.preventDefault();
    const text = ui.msgInput.value.trim();
    if (!text && !state.fileToUpload) return;

    let type = 'text';
    let fileUrl = null;
    let content = text;

    if (state.fileToUpload) {
        const file = state.fileToUpload;
        const ext = file.name.split('.').pop();
        const path = `${state.user.id}/${Date.now()}.${ext}`;
        await supabase.storage.from('chat-files').upload(path, file);
        const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
        fileUrl = data.publicUrl;
        type = file.type.startsWith('image/') ? 'image' : 'file';
        content = file.name;
        state.fileToUpload = null;
    }

    const msg = {
        sender_id: state.user.id,
        receiver_id: state.activeChatType === 'friend' ? state.activeChat : null,
        group_id: state.activeChatType === 'group' ? state.activeChat : null,
        content,
        type,
        file_url: fileUrl,
        reply_to_id: state.replyTo
    };

    await supabase.from('messages').insert(msg);
    ui.msgInput.value = '';
    cancelReply();
    scrollToBottom();
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        state.fileToUpload = file;
        ui.msgInput.value = `[File: ${file.name}]`;
    }
}

function triggerReply(id, name) {
    state.replyTo = id;
    ui.replyBar.classList.remove('hidden');
    document.getElementById('reply-to-name').textContent = name;
    ui.msgInput.focus();
}

function cancelReply() {
    state.replyTo = null;
    ui.replyBar.classList.add('hidden');
    state.fileToUpload = null;
    ui.msgInput.value = '';
}

async function triggerReaction(msgId) {
    const emoji = prompt('Enter emoji:');
    if (!emoji) return;
    
    const { data } = await supabase.from('messages').select('reactions').eq('id', msgId).single();
    let reactions = data.reactions || {};
    if (!reactions[emoji]) reactions[emoji] = [];
    
    if (reactions[emoji].includes(state.user.id)) {
        reactions[emoji] = reactions[emoji].filter(id => id !== state.user.id);
        if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
        reactions[emoji].push(state.user.id);
    }
    
    await supabase.from('messages').update({ reactions }).eq('id', msgId);
}

function renderReactions(msgId, reactions) {
    const container = document.getElementById(`reactions-${msgId}`);
    if (!container || !reactions) return;
    container.innerHTML = '';
    
    Object.entries(reactions).forEach(([emoji, users]) => {
        const span = document.createElement('span');
        span.className = `reaction-pill ${users.includes(state.user.id) ? 'active' : ''}`;
        span.textContent = `${emoji} ${users.length}`;
        span.onclick = () => triggerReaction(msgId); // Toggle logic
        container.appendChild(span);
    });
}

function scrollToBottom() {
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
}

function showContextMenu(e, msg) {
    e.preventDefault();
    const menu = ui.contextMenu;
    menu.innerHTML = `
        <button onclick="triggerReply('${msg.id}', '${msg.profiles.username}')">Reply</button>
        <button onclick="navigator.clipboard.writeText('${msg.content}')">Copy</button>
        ${msg.sender_id === state.user.id ? `<button class="danger" onclick="deleteMessage('${msg.id}')">Delete</button>` : ''}
    `;
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    menu.classList.remove('hidden');
}

async function deleteMessage(id) {
    if(confirm('Delete message?')) await supabase.from('messages').delete().eq('id', id);
}

async function triggerEdit(id, oldContent) {
    const newContent = prompt('Edit message:', oldContent);
    if (newContent && newContent !== oldContent) {
        await supabase.from('messages').update({ content: newContent, is_edited: true }).eq('id', id);
    }
}

function handleMessageUpdate(payload) {
    if (payload.eventType === 'INSERT') {
        if ((payload.new.sender_id === state.activeChat || payload.new.receiver_id === state.activeChat || payload.new.group_id === state.activeChat)) {
            renderMessage({ ...payload.new, profiles: state.friends[payload.new.sender_id] || state.user });
            scrollToBottom();
            document.getElementById('msg-sound').play();
        }
    } else if (payload.eventType === 'UPDATE') {
        const el = document.getElementById(`msg-${payload.new.id}`);
        if (el) {
            el.querySelector('.message-bubble').innerHTML = payload.new.content + (payload.new.is_edited ? ' <span class="edited-tag">(edited)</span>' : '');
            renderReactions(payload.new.id, payload.new.reactions);
        }
    } else if (payload.eventType === 'DELETE') {
        document.getElementById(`msg-${payload.old.id}`)?.remove();
    }
}

function handleFriendUpdate() { loadFriends(); loadRequests(); }
function handleProfileUpdate(payload) {
    if (state.friends[payload.new.id]) {
        state.friends[payload.new.id] = { ...state.friends[payload.new.id], ...payload.new };
        if (payload.new.is_online) state.onlineUsers.add(payload.new.id);
        else state.onlineUsers.delete(payload.new.id);
        renderSidebar();
        if (state.activeChat === payload.new.id) {
            document.getElementById('chat-status').textContent = payload.new.is_online ? 'Online' : 'Offline';
        }
    }
}

function showAddFriend() {
    ui.modalBody.innerHTML = `
        <h2>Add Friend</h2>
        <input type="text" id="friend-username" placeholder="Username" style="width:100%; padding:0.8rem; margin:1rem 0; border-radius:8px; border:1px solid #333; background:#222; color:white;">
        <button onclick="sendFriendRequest()">Send Request</button>
    `;
    ui.modal.classList.add('visible');
}

async function sendFriendRequest() {
    const username = document.getElementById('friend-username').value;
    const { data: user } = await supabase.from('profiles').select('id').eq('username', username).single();
    if (!user) return alert('User not found');
    if (user.id === state.user.id) return alert('Cannot add yourself');
    
    await supabase.from('friends').insert({
        user_id_1: state.user.id,
        user_id_2: user.id,
        status: 'pending',
        action_user_id: state.user.id
    });
    closeModal();
    alert('Request sent');
}

function showCreateGroup() {
    const friends = Object.values(state.friends).filter(f => f.type !== 'group');
    ui.modalBody.innerHTML = `
        <h2>Create Group</h2>
        <input type="text" id="group-name" placeholder="Group Name" style="width:100%; padding:0.8rem; border-radius:8px; margin-bottom:1rem; background:#222; color:white; border:1px solid #333;">
        <div class="user-select-list">
            ${friends.map(f => `
                <div class="select-user-item" onclick="toggleSelection(this, '${f.id}')">
                    <div class="selection-dot"></div>
                    <div class="avatar">${getAvatar(f)}</div>
                    <span>${f.username}</span>
                </div>
            `).join('')}
        </div>
        <button onclick="createGroup()" style="margin-top:1rem;">Create</button>
    `;
    ui.modal.classList.add('visible');
}

window.toggleSelection = (el, id) => {
    el.classList.toggle('selected');
    el.dataset.selected = el.classList.contains('selected');
};

async function createGroup() {
    const name = document.getElementById('group-name').value;
    const selected = Array.from(document.querySelectorAll('.select-user-item[data-selected="true"]')).map(el => el.onclick.toString().match(/'([^']+)'/)[1]);
    
    if (!name || selected.length === 0) return alert('Name and members required');

    const { data: group } = await supabase.from('groups').insert({ name, owner_id: state.user.id }).select().single();
    
    const members = [...selected, state.user.id].map(uid => ({ group_id: group.id, user_id: uid }));
    await supabase.from('group_members').insert(members);
    
    closeModal();
    loadGroups();
}

function showChatInfo() {
    const target = state.activeChatType === 'friend' ? state.friends[state.activeChat] : state.groups[state.activeChat];
    const isGroup = state.activeChatType === 'group';
    
    ui.modalBody.innerHTML = `
        <div style="text-align:center;">
            <div class="avatar large-avatar" style="margin:0 auto 1rem;">${getAvatar(target)}</div>
            <h2>${isGroup ? target.name : target.username}</h2>
            ${isGroup ? `
                <input type="text" value="${target.name}" id="edit-group-name" style="margin:1rem 0; padding:0.5rem;">
                <button onclick="updateGroup('${target.id}')">Update Name</button>
                <button class="danger" onclick="leaveGroup('${target.id}')" style="margin-top:1rem;">Leave Group</button>
            ` : `
                <button class="danger" onclick="blockUser('${target.id}')" style="margin-top:1rem;">Block User</button>
            `}
        </div>
    `;
    ui.modal.classList.add('visible');
}

async function updateGroup(gid) {
    const name = document.getElementById('edit-group-name').value;
    await supabase.from('groups').update({ name }).eq('id', gid);
    closeModal();
}

async function leaveGroup(gid) {
    if(confirm('Leave group?')) {
        await supabase.from('group_members').delete().eq('group_id', gid).eq('user_id', state.user.id);
        closeChat();
        closeModal();
    }
}

async function blockUser(uid) {
    if(confirm('Block user?')) {
        await supabase.from('blocked_users').insert({ user_id: state.user.id, blocked_user_id: uid });
        closeChat();
        closeModal();
        loadBlocked();
    }
}

function showSettings() {
    ui.modalBody.innerHTML = `
        <h2>Settings</h2>
        <div class="input-group">
            <label>Theme</label>
            <select onchange="setTheme(this.value)" style="width:100%; padding:0.5rem;">
                <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Dark</option>
                <option value="light" ${state.theme === 'light' ? 'selected' : ''}>Light</option>
            </select>
        </div>
        <div class="input-group" style="margin-top:1rem;">
            <label>Profile Picture</label>
            <input type="file" onchange="uploadAvatar(this)">
        </div>
    `;
    ui.modal.classList.add('visible');
}

async function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    const path = `avatars/${state.user.id}/${Date.now()}`;
    await supabase.storage.from('avatars').upload(path, file);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', state.user.id);
    state.user.avatar_url = data.publicUrl;
    alert('Avatar updated');
    loadUser(state.user.id);
}

function insertSystemMessage(chatId, type, content) {
    supabase.from('messages').insert({
        sender_id: state.user.id,
        receiver_id: state.activeChatType === 'friend' ? chatId : null,
        group_id: state.activeChatType === 'group' ? chatId : null,
        type: 'call',
        content
    });
}

function handleTyping() {
    
}

function scrollToMessage(id) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth' });
}

function closeModal() {
    ui.modal.classList.remove('visible');
}
