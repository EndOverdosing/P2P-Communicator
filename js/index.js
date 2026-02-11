document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ui = {
        settingsModalContainer: document.getElementById('settings-modal-container'),
        settingsModalPane: document.getElementById('settings-modal'),
        settingsModalHeader: document.getElementById('settings-modal-header'),
        settingsModalBody: document.getElementById('settings-modal-body'),
        appLoader: document.getElementById('app-loader'),
        authContainer: document.getElementById('auth-container'),
        mainApp: document.getElementById('main-app'),
        loginForm: document.getElementById('login-form'),
        signupForm: document.getElementById('signup-form'),
        showSignup: document.getElementById('show-signup'),
        showLogin: document.getElementById('show-login'),
        authStatus: document.getElementById('auth-status'),
        sidebar: document.getElementById('sidebar'),
        usernameDisplay: document.getElementById('username-display'),
        userAvatar: document.getElementById('user-avatar'),
        logoutBtn: document.getElementById('logout-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        addFriendBtn: document.getElementById('add-friend-btn'),
        createGroupBtn: document.getElementById('create-group-btn'),
        friendsList: document.getElementById('friends-list'),
        chatContainer: document.getElementById('chat-container'),
        welcomeScreen: document.getElementById('welcome-screen'),
        chatView: document.getElementById('chat-view'),
        chatHeader: document.getElementById('chat-header'),
        chatAvatar: document.getElementById('chat-avatar'),
        chatFriendName: document.getElementById('chat-friend-name'),
        backToFriendsBtn: document.getElementById('back-to-friends-btn'),
        callBtn: document.getElementById('call-btn'),
        chatOptionsBtn: document.getElementById('chat-options-btn'),
        messagesContainer: document.getElementById('messages-container'),
        messageForm: document.getElementById('message-form'),
        messageInput: document.getElementById('message-input'),
        modalContainer: document.getElementById('modal-container'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        addFriendModal: document.getElementById('add-friend-modal'),
        addFriendForm: document.getElementById('add-friend-form'),
        friendUsernameInput: document.getElementById('friend-username-input'),
        createGroupModal: document.getElementById('create-group-modal'),
        createGroupForm: document.getElementById('create-group-form'),
        groupNameInput: document.getElementById('group-name-input'),
        groupMembersList: document.getElementById('group-members-list'),
        incomingCallModal: document.getElementById('incoming-call-modal'),
        callerAvatar: document.getElementById('caller-avatar'),
        callerName: document.getElementById('caller-name'),
        declineCallBtn: document.getElementById('decline-call-btn'),
        acceptCallBtn: document.getElementById('accept-call-btn'),
        callSection: document.getElementById('call-section'),
        videoGrid: document.getElementById('video-grid'),
        muteBtn: document.getElementById('mute-btn'),
        toggleVideoBtn: document.getElementById('toggle-video-btn'),
        shareScreenBtn: document.getElementById('share-screen-btn'),
        stopCallBtn: document.getElementById('stop-call-btn'),
        confirmationModal: document.getElementById('confirmation-modal'),
        confirmationTitle: document.getElementById('confirmation-title'),
        confirmationMessage: document.getElementById('confirmation-message'),
        confirmBtn: document.getElementById('confirm-btn'),
        cancelBtn: document.getElementById('cancel-btn'),
        chatFriendStatus: document.getElementById('chat-friend-status'),
        infoModal: document.getElementById('info-modal'),
        infoTitle: document.getElementById('info-title'),
        infoMessage: document.getElementById('info-message'),
        infoOkBtn: document.getElementById('info-ok-btn'),
        toggleChatBtn: document.getElementById('toggle-chat-btn'),
        incomingCallAudio: document.getElementById('incoming-call-audio'),
        chatOverlay: document.getElementById('chat-overlay'),
        chatOverlayHeader: document.getElementById('chat-overlay-header'),
        chatOverlayContent: document.getElementById('chat-overlay-content'),
        chatOverlayBackdrop: document.getElementById('chat-overlay-backdrop'),
        typingIndicator: document.getElementById('typing-indicator'),
        settingsModal: document.getElementById('settings-modal'),
        themeToggle: document.getElementById('theme-toggle'),
        fontSizeSelect: document.getElementById('font-size-select'),
        notificationsToggle: document.getElementById('notifications-toggle'),
        messageSoundToggle: document.getElementById('message-sound-toggle'),
        onlineStatusToggle: document.getElementById('online-status-toggle'),
        readReceiptsToggle: document.getElementById('read-receipts-toggle'),
        settingsAvatar: document.getElementById('settings-avatar'),
        settingsUsername: document.getElementById('settings-username'),
        changeAvatarBtn: document.getElementById('change-avatar-btn'),
        changeUsernameBtn: document.getElementById('change-username-btn'),
        avatarUpload: document.getElementById('avatar-upload'),
        chatOptionsModal: document.getElementById('chat-options-modal'),
        viewProfileBtn: document.getElementById('view-profile-btn'),
        muteConversationBtn: document.getElementById('mute-conversation-btn'),
        blockUserBtn: document.getElementById('block-user-btn'),
        unfriendBtn: document.getElementById('unfriend-btn'),
        friendProfileModal: document.getElementById('friend-profile-modal'),
        profileAvatar: document.getElementById('profile-avatar'),
        profileUsername: document.getElementById('profile-username'),
        profileStatusDot: document.getElementById('profile-status-dot'),
        profileStatusText: document.getElementById('profile-status-text'),
        profileUsernameValue: document.getElementById('profile-username-value'),
        profileJoinedDate: document.getElementById('profile-joined-date'),
        messageUserBtn: document.getElementById('message-user-btn'),
        callUserBtn: document.getElementById('call-user-btn'),
        changeUsernameModal: document.getElementById('change-username-modal'),
        changeUsernameForm: document.getElementById('change-username-form'),
        newUsernameInput: document.getElementById('new-username-input'),
        searchFriendsInput: document.getElementById('search-friends-input'),
        replyPreview: document.getElementById('reply-preview'),
        replyPreviewText: document.querySelector('.reply-preview-text'),
        cancelReplyBtn: document.getElementById('cancel-reply-btn'),
        editMessageModal: document.getElementById('edit-message-modal'),
        editMessageForm: document.getElementById('edit-message-form'),
        editMessageInput: document.getElementById('edit-message-input'),
        fileInput: document.getElementById('file-input'),
        filePreviewModal: document.getElementById('file-preview-modal'),
        filePreviewContent: document.getElementById('file-preview-content'),
        fileSendForm: document.getElementById('file-send-form'),
        fileCaptionInput: document.getElementById('file-caption-input'),
        friendRequestsModal: document.getElementById('friend-requests-modal'),
        requestsList: document.getElementById('requests-list'),
    };

    let peer, localStream, dataConnection, mediaConnection, currentUser, currentChatFriend, friends = {}, groups = {}, subscriptions = [];
    let callState = { isMuted: false, isVideoEnabled: true, isScreenSharing: false };
    let incomingCallData = null;
    let onlineUsers = new Set();
    let isInCall = false;
    let typingTimeout = null;
    let keepAliveInterval = null;
    let currentChatType = 'friend';
    let blockedUsers = new Set();
    let friendRequests = [];
    let pendingRequests = [];
    let replyingTo = null;
    let editingMessage = null;
    let pendingFiles = [];
    let selectedGroupMembers = new Set();
    let conversations = [];
    let callHistory = new Map();
    
    let userSettings = {
        theme: 'dark',
        fontSize: 'medium',
        notifications: true,
        messageSound: true,
        onlineStatus: true,
        readReceipts: true
    };

    const showLoader = (show) => ui.appLoader.classList.toggle('hidden', !show);
    const showAuth = (show) => ui.authContainer.classList.toggle('hidden', !show);
    const showApp = (show) => ui.mainApp.classList.toggle('hidden', !show);
    const setAuthStatus = (message, isError = true) => {
        ui.authStatus.textContent = message;
        ui.authStatus.style.color = isError ? 'var(--error)' : 'var(--success)';
    };

    const loadSettings = () => {
        const saved = localStorage.getItem('userSettings');
        if (saved) {
            userSettings = { ...userSettings, ...JSON.parse(saved) };
        }
        applySettings();
    };

    const saveSettings = () => {
        localStorage.setItem('userSettings', JSON.stringify(userSettings));
    };

    const applySettings = () => {
        document.documentElement.setAttribute('data-theme', userSettings.theme);
        document.body.setAttribute('data-font-size', userSettings.fontSize);

        ui.themeToggle.checked = userSettings.theme === 'dark';
        ui.fontSizeSelect.value = userSettings.fontSize;
        ui.notificationsToggle.checked = userSettings.notifications;
        ui.messageSoundToggle.checked = userSettings.messageSound;
        ui.onlineStatusToggle.checked = userSettings.onlineStatus;
        ui.readReceiptsToggle.checked = userSettings.readReceipts;
    };

    const startKeepAlive = () => {
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        keepAliveInterval = setInterval(async () => {
            if (currentUser) {
                await supabase.from('profiles').update({
                    last_seen: new Date().toISOString()
                }).eq('id', currentUser.id);
            }
        }, 30000);
    };

    const initializePeer = async (userId) => {
        if (peer && !peer.destroyed) peer.destroy();
        ui.callBtn.disabled = true;

        peer = new Peer(undefined, {
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', async (id) => {
            await supabase.from('profiles').update({ peer_id: id }).eq('id', userId);
            ui.callBtn.disabled = false;
        });

        peer.on('call', handleIncomingCall);

        peer.on('error', (error) => {
            console.error('Peer error:', error);
            if (error.type === 'network' || error.type === 'server-error') {
                setTimeout(() => initializePeer(userId), 5000);
            }
        });
    };

    const handleAuth = async () => {
        showLoader(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            await loadUserData(session.user.id);
            showLoader(false);
            showApp(true);
        } else {
            showLoader(false);
            showAuth(true);
        }
    };

    const loadUserData = async (userId) => {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!profile) return;

        currentUser = profile;
        ui.usernameDisplay.textContent = profile.username;
        ui.userAvatar.textContent = profile.username[0].toUpperCase();
        ui.settingsUsername.textContent = profile.username;
        ui.settingsAvatar.textContent = profile.username[0].toUpperCase();

        if (profile.avatar_url) {
            ui.userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username}">`;
            ui.settingsAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username}">`;
        }

        await supabase.from('profiles').update({
            is_online: userSettings.onlineStatus,
            last_seen: new Date().toISOString()
        }).eq('id', userId);

        await loadFriends();
        await loadGroups();
        await loadFriendRequests();
        await loadBlockedUsers();
        subscribeToPresence();
        subscribeToMessages();
        subscribeToFriendRequests();
        subscribeToFriendships();
        subscribeToGroups();
        subscribeToGroupMessages();
        initializePeer(userId);
        startKeepAlive();
        loadSettings();
    };

    const loadFriends = async () => {
        const { data: friendships } = await supabase
            .from('friendships')
            .select('*, friend:profiles!friendships_friend_id_fkey(*)')
            .eq('user_id', currentUser.id)
            .eq('status', 'accepted');

        const { data: reverseFriendships } = await supabase
            .from('friendships')
            .select('*, friend:profiles!friendships_user_id_fkey(*)')
            .eq('friend_id', currentUser.id)
            .eq('status', 'accepted');

        friends = {};
        [...(friendships || []), ...(reverseFriendships || [])].forEach(f => {
            const friend = f.friend;
            if (friend && friend.id !== currentUser.id) {
                friends[friend.id] = friend;
            }
        });

        await updateConversationsList();
    };

    const loadGroups = async () => {
        const { data: groupMemberships } = await supabase
            .from('group_members')
            .select('*, group:groups(*)')
            .eq('user_id', currentUser.id);

        groups = {};
        (groupMemberships || []).forEach(gm => {
            if (gm.group) {
                groups[gm.group.id] = gm.group;
            }
        });

        await updateConversationsList();
    };
    
    const addFileButton = () => {
    const fileBtn = document.createElement('button');
    fileBtn.type = 'button';
    fileBtn.className = 'attach-file-btn';
    fileBtn.innerHTML = '<i class="fa-solid fa-paperclip"></i>';
    fileBtn.title = 'Attach File';
    fileBtn.style.cssText = `
        background: none;
        color: var(--secondary-text);
        font-size: 1.2rem;
        width: 40px;
        height: 40px;
        padding: 0;
        margin-right: 0.5rem;
    `;
    fileBtn.onclick = () => ui.fileInput.click();
    
    const messageWrapper = document.querySelector('.message-input-wrapper');
    if (messageWrapper && !messageWrapper.querySelector('.attach-file-btn')) {
        messageWrapper.insertBefore(fileBtn, messageWrapper.firstChild);
    }
};

    const loadFriendRequests = async () => {
        const { data: incoming } = await supabase
            .from('friendships')
            .select('*, requester:profiles!friendships_user_id_fkey(*)')
            .eq('friend_id', currentUser.id)
            .eq('status', 'pending');

        const { data: outgoing } = await supabase
            .from('friendships')
            .select('*, recipient:profiles!friendships_friend_id_fkey(*)')
            .eq('user_id', currentUser.id)
            .eq('status', 'pending');

        friendRequests = incoming || [];
        pendingRequests = outgoing || [];
    };

    const loadBlockedUsers = async () => {
        const { data: blocks } = await supabase
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', currentUser.id);

        blockedUsers = new Set((blocks || []).map(b => b.blocked_user_id));
    };

    const subscribeToPresence = () => {
        const channel = supabase.channel('online-users');

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                onlineUsers.clear();
                Object.values(state).forEach(presences => {
                    presences.forEach(p => onlineUsers.add(p.user_id));
                });
                updateConversationsList();
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                newPresences.forEach(p => onlineUsers.add(p.user_id));
                updateConversationsList();
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                leftPresences.forEach(p => onlineUsers.delete(p.user_id));
                updateConversationsList();
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: currentUser.id });
                }
            });

        subscriptions.push(channel);
    };

    const subscribeToMessages function
const subscribeToMessages = () => {
    const channel = supabase
        .channel('messages-changes')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${currentUser.id}`
        }, async (payload) => {
            await handleNewMessage(payload.new);
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages'
        }, (payload) => {
            updateMessageInUI(payload.new);
        })
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'messages'
        }, (payload) => {
            removeMessageFromUI(payload.old.id);
        })
        .subscribe();

    subscriptions.push(channel);
};

    const subscribeToFriendRequests = () => {
        const channel = supabase
            .channel('friend-requests-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships'
            }, async (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    if (payload.new.friend_id === currentUser.id && payload.new.status === 'pending') {
                        await loadFriendRequests();
                        showNotification('New friend request received!');
                    } else if (payload.new.status === 'accepted') {
                        await loadFriends();
                        await updateConversationsList();
                    }
                } else if (payload.eventType === 'DELETE') {
                    await loadFriends();
                    await loadFriendRequests();
                    await updateConversationsList();
                }
            })
            .subscribe();

        subscriptions.push(channel);
    };

    const subscribeToFriendships = () => {
        const channel = supabase
            .channel('friendships-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships'
            }, async () => {
                await loadFriends();
                await updateConversationsList();
            })
            .subscribe();

        subscriptions.push(channel);
    };

    const subscribeToGroups = () => {
        const channel = supabase
            .channel('groups-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'groups'
            }, async (payload) => {
                if (payload.eventType === 'UPDATE' && groups[payload.new.id]) {
                    groups[payload.new.id] = payload.new;
                    await updateConversationsList();
                    if (currentChatType === 'group' && currentChatFriend?.id === payload.new.id) {
                        ui.chatFriendName.textContent = payload.new.name;
                    }
                }
            })
            .subscribe();

        const memberChannel = supabase
            .channel('group-members-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_members',
                filter: `user_id=eq.${currentUser.id}`
            }, async () => {
                await loadGroups();
                await updateConversationsList();
            })
            .subscribe();

        subscriptions.push(channel, memberChannel);
    };

    const subscribeToGroupMessages = () => {
        const channel = supabase
            .channel('group-messages-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_messages'
            }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    const { data: group } = await supabase
                        .from('group_members')
                        .select('group_id')
                        .eq('group_id', payload.new.group_id)
                        .eq('user_id', currentUser.id)
                        .single();

                    if (group) {
                        await handleNewGroupMessage(payload.new);
                    }
                } else if (payload.eventType === 'UPDATE') {
                    updateGroupMessageInUI(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    removeMessageFromUI(payload.old.id);
                }
            })
            .subscribe();

        subscriptions.push(channel);
    };

const handleNewMessage = async (message) => {
    if (blockedUsers.has(message.sender_id)) return;
    
    if (document.querySelector(`[data-message-id="${message.id}"]`)) return;

    const { data: sender } = await supabase.from('profiles').select('*').eq('id', message.sender_id).single();
    if (!sender) return;

    await updateConversationsList();

    if (currentChatType === 'friend' && currentChatFriend?.id === message.sender_id) {
        displayMessage(message, sender);
        if (userSettings.readReceipts) {
            await supabase.from('messages').update({ read: true }).eq('id', message.id);
        }
        scrollToBottom();
    } else {
        if (userSettings.notifications) {
            showNotification(`New message from ${sender.username}`);
        }
        if (userSettings.messageSound) {
            playMessageSound();
        }
    }
};

    const handleNewGroupMessage = async (message) => {
        const { data: sender } = await supabase.from('profiles').select('*').eq('id', message.sender_id).single();
        if (!sender) return;

        await updateConversationsList();

        if (currentChatType === 'group' && currentChatFriend?.id === message.group_id) {
            displayGroupMessage(message, sender);
        } else {
            const group = groups[message.group_id];
            if (group && userSettings.notifications) {
                showNotification(`New message in ${group.name}`);
            }
            if (userSettings.messageSound) {
                playMessageSound();
            }
        }
    };

    const updateMessageInUI = (message) => {
        const msgElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (msgElement) {
            const contentElement = msgElement.querySelector('.message-content');
            if (contentElement) {
                contentElement.textContent = message.content;
                const editedBadge = msgElement.querySelector('.message-edited') || document.createElement('span');
                editedBadge.className = 'message-edited';
                editedBadge.textContent = '(edited)';
                if (!msgElement.querySelector('.message-edited')) {
                    contentElement.appendChild(editedBadge);
                }
            }
        }
    };

    const updateGroupMessageInUI = updateMessageInUI;

    const removeMessageFromUI = (messageId) => {
        const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (msgElement) {
            msgElement.remove();
        }
    };

    const updateConversationsList = async () => {
        conversations = [];

        for (const friendId in friends) {
            const friend = friends[friendId];
            const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: false })
                .limit(1);

            const lastMessage = messages?.[0];
            conversations.push({
                type: 'friend',
                id: friendId,
                data: friend,
                lastMessage: lastMessage,
                timestamp: lastMessage?.created_at || friend.created_at
            });
        }

        for (const groupId in groups) {
            const group = groups[groupId];
            const { data: messages } = await supabase
                .from('group_messages')
                .select('*')
                .eq('group_id', groupId)
                .order('created_at', { ascending: false })
                .limit(1);

            const lastMessage = messages?.[0];
            conversations.push({
                type: 'group',
                id: groupId,
                data: group,
                lastMessage: lastMessage,
                timestamp: lastMessage?.created_at || group.created_at
            });
        }

        conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        renderConversationsList();
    };

    const renderConversationsList = () => {
        let html = '';
        
        if (friendRequests.length > 0) {
            html += `<div class="list-header">Friend Requests (${friendRequests.length})</div>`;
            html += `<div class="friend-item" onclick="window.showFriendRequestsModal()">
                <div class="avatar"><i class="fa-solid fa-user-plus"></i></div>
                <div class="friend-info">
                    <div class="friend-name">Pending Requests</div>
                    <div class="friend-status">${friendRequests.length} request${friendRequests.length !== 1 ? 's' : ''}</div>
                </div>
            </div>`;
        }

        if (conversations.length > 0) {
            html += '<div class="list-header">Messages</div>';
            conversations.forEach(conv => {
                if (conv.type === 'friend') {
                    const friend = conv.data;
                    const isOnline = onlineUsers.has(friend.id);
                    const isBlocked = blockedUsers.has(friend.id);
                    if (!isBlocked) {
                        html += `
                            <div class="friend-item" data-friend-id="${friend.id}" onclick="window.openChat('${friend.id}', 'friend')">
                                <div class="avatar-wrapper">
                                    <div class="avatar">${friend.avatar_url ? `<img src="${friend.avatar_url}" alt="${friend.username}">` : friend.username[0].toUpperCase()}</div>
                                    <div class="status-indicator ${isOnline ? 'online' : ''}"></div>
                                </div>
                                <div class="friend-info">
                                    <div class="friend-name">${friend.username}</div>
                                    <div class="friend-status">${conv.lastMessage ? (conv.lastMessage.sender_id === currentUser.id ? 'You: ' : '') + (conv.lastMessage.content?.substring(0, 30) || 'Sent a file') : 'No messages yet'}</div>
                                </div>
                            </div>
                        `;
                    }
                } else if (conv.type === 'group') {
                    const group = conv.data;
                    html += `
                        <div class="group-item" data-group-id="${group.id}" onclick="window.openChat('${group.id}', 'group')">
                            <div class="avatar">${group.avatar_url ? `<img src="${group.avatar_url}" alt="${group.name}">` : group.name[0].toUpperCase()}</div>
                            <div class="friend-info">
                                <div class="friend-name">${group.name}</div>
                                <div class="friend-status">${conv.lastMessage ? (conv.lastMessage.content?.substring(0, 30) || 'Sent a file') : 'No messages yet'}</div>
                            </div>
                        </div>
                    `;
                }
            });
        } else {
            html += '<div class="list-header">No conversations yet</div>';
        }

        ui.friendsList.innerHTML = html;
    };

    window.showFriendRequestsModal = () => {
        showModal(ui.friendRequestsModal);
        renderFriendRequests();
    };

    const renderFriendRequests = () => {
        if (friendRequests.length === 0) {
            ui.requestsList.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 2rem;">No pending requests</p>';
            return;
        }

        let html = '';
        friendRequests.forEach(request => {
            const requester = request.requester;
            html += `
                <div class="request-item" data-request-id="${request.id}">
                    <div class="avatar">${requester.avatar_url ? `<img src="${requester.avatar_url}" alt="${requester.username}">` : requester.username[0].toUpperCase()}</div>
                    <div class="request-info">
                        <div class="request-username">${requester.username}</div>
                        <div class="request-time">${formatTimeAgo(request.created_at)}</div>
                    </div>
                    <div class="request-actions">
                        <button onclick="window.acceptFriendRequest('${request.id}')" style="background-color: var(--success);" title="Accept"><i class="fa-solid fa-check"></i></button>
                        <button onclick="window.declineFriendRequest('${request.id}')" style="background-color: var(--error);" title="Decline"><i class="fa-solid fa-times"></i></button>
                    </div>
                </div>
            `;
        });

        ui.requestsList.innerHTML = html;
    };

    window.acceptFriendRequest = async (requestId) => {
        await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId);
        await loadFriends();
        await loadFriendRequests();
        renderFriendRequests();
        await updateConversationsList();
    };

    window.declineFriendRequest = async (requestId) => {
        await supabase.from('friendships').delete().eq('id', requestId);
        await loadFriendRequests();
        renderFriendRequests();
    };

    window.openChat = async (id, type) => {
        currentChatType = type;

        if (type === 'friend') {
            currentChatFriend = friends[id];
            if (!currentChatFriend) return;

            ui.chatFriendName.textContent = currentChatFriend.username;
            ui.chatAvatar.textContent = currentChatFriend.username[0].toUpperCase();
            
            if (currentChatFriend.avatar_url) {
                ui.chatAvatar.innerHTML = `<img src="${currentChatFriend.avatar_url}" alt="${currentChatFriend.username}">`;
            }

            ui.chatFriendStatus.classList.toggle('online', onlineUsers.has(currentChatFriend.id));

            await loadMessages(currentChatFriend.id);
        } else if (type === 'group') {
            currentChatFriend = groups[id];
            if (!currentChatFriend) return;

            ui.chatFriendName.textContent = currentChatFriend.name;
            ui.chatAvatar.textContent = currentChatFriend.name[0].toUpperCase();
            
            if (currentChatFriend.avatar_url) {
                ui.chatAvatar.innerHTML = `<img src="${currentChatFriend.avatar_url}" alt="${currentChatFriend.name}">`;
            }

            ui.chatFriendStatus.style.display = 'none';

            await loadGroupMessages(currentChatFriend.id);
        }

        ui.welcomeScreen.classList.add('hidden');
        ui.chatView.classList.remove('hidden');

        if (window.innerWidth <= 768) {
            ui.sidebar.classList.add('hidden');
            ui.chatContainer.classList.add('active');
        }

        document.querySelectorAll('.friend-item, .group-item').forEach(item => item.classList.remove('active'));
        const activeItem = type === 'friend' 
            ? document.querySelector(`[data-friend-id="${id}"]`)
            : document.querySelector(`[data-group-id="${id}"]`);
        if (activeItem) activeItem.classList.add('active');
    };

    const loadMessages = async (friendId) => {
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        ui.messagesContainer.innerHTML = '';
        for (const message of messages || []) {
            const sender = message.sender_id === currentUser.id ? currentUser : currentChatFriend;
            displayMessage(message, sender);
        }

        if (userSettings.readReceipts) {
            await supabase.from('messages')
                .update({ read: true })
                .eq('receiver_id', currentUser.id)
                .eq('sender_id', friendId);
        }

        scrollToBottom();
    };

    const loadGroupMessages = async (groupId) => {
        const { data: messages } = await supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

        ui.messagesContainer.innerHTML = '';
        for (const message of messages || []) {
            const { data: sender } = await supabase.from('profiles').select('*').eq('id', message.sender_id).single();
            displayGroupMessage(message, sender);
        }

        scrollToBottom();
    };

const displayMessage = (message, sender) => {
    if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender_id === currentUser.id ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;

    const isMobile = window.innerWidth <= 768;
    const isSent = message.sender_id === currentUser.id;

    let content = '';

    if (message.reply_to_id) {
        const replyText = message.reply_to_content || 'Original message';
        content += `<div class="message-reply-context" style="background: rgba(88, 101, 242, 0.1); padding: 0.5rem; border-left: 3px solid var(--primary-accent); margin-bottom: 0.5rem; border-radius: 4px; font-size: 0.85rem;"><i class="fa-solid fa-reply"></i> ${escapeHtml(replyText.substring(0, 50))}${replyText.length > 50 ? '...' : ''}</div>`;
    }

    if (message.file_url) {
        const fileType = message.file_type || 'file';
        if (fileType.startsWith('image/')) {
            content += `<img src="${message.file_url}" alt="Image" class="message-image" onclick="window.open('${message.file_url}', '_blank')" style="max-width: 300px; border-radius: var(--button-border-radius); cursor: pointer; display: block;">`;
        } else if (fileType.startsWith('audio/')) {
            content += `<audio controls src="${message.file_url}" class="message-audio" style="max-width: 100%;"></audio>`;
        } else {
            content += `<a href="${message.file_url}" target="_blank" class="message-file" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--tertiary-bg); border-radius: var(--button-border-radius); text-decoration: none; color: var(--primary-text);"><i class="fa-solid fa-file"></i> ${message.file_name || 'File'}</a>`;
        }
    }

    if (message.content) {
        content += `<div class="message-content">${escapeHtml(message.content)}${message.edited ? '<span class="message-edited" style="font-size: 0.75rem; color: var(--secondary-text); margin-left: 0.5rem;">(edited)</span>' : ''}</div>`;
    }

    if (message.call_duration !== null && message.call_duration !== undefined) {
        const caller = message.sender_id === currentUser.id ? 'You' : sender.username;
        const duration = formatCallDuration(message.call_duration);
        content = `<div class="message-call-info" style="display: flex; align-items: center; gap: 0.5rem;"><i class="fa-solid fa-phone"></i> ${caller} called â¢ ${duration}</div>`;
    }

    content += `<div class="message-reactions" data-message-id="${message.id}" style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.25rem;"></div>`;

    const timestamp = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isMobile) {
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp-reveal';
        timestampDiv.textContent = timestamp;
        timestampDiv.style.cssText = `
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.75rem;
            color: var(--secondary-text);
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            ${isSent ? 'right: 100%; padding-right: 0.5rem;' : 'left: 100%; padding-left: 0.5rem;'}
        `;
        
        const contentWrapper = document.createElement('div');
        contentWrapper.innerHTML = content;
        contentWrapper.style.cssText = 'position: relative;';
        
        messageDiv.appendChild(timestampDiv);
        messageDiv.appendChild(contentWrapper);
        
        setupMessageSwipe(contentWrapper, isSent);
    } else {
        const contentWrapper = document.createElement('div');
        contentWrapper.innerHTML = content;
        messageDiv.appendChild(contentWrapper);
        
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp';
        timestampDiv.textContent = timestamp;
        timestampDiv.style.cssText = `
            font-size: 0.7rem;
            color: var(--secondary-text);
            margin-top: 0.25rem;
            text-align: ${isSent ? 'right' : 'left'};
        `;
        messageDiv.appendChild(timestampDiv);
    }

    if (message.sender_id === currentUser.id) {
        messageDiv.addEventListener('contextmenu', (e) => showMessageContextMenu(e, message));
        messageDiv.addEventListener('click', (e) => {
            if (e.target.closest('.message-content') && !e.target.closest('.message-reaction')) {
                showMessageContextMenu(e, message);
            }
        });
    }

    messageDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('message-reaction')) {
            toggleReaction(message.id, e.target.dataset.emoji);
        }
    });

    ui.messagesContainer.appendChild(messageDiv);

    if (message.reactions) {
        renderReactions(message.id, message.reactions);
    }
};

    const displayGroupMessage = (message, sender) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender_id === currentUser.id ? 'sent' : 'received'}`;
        messageDiv.dataset.messageId = message.id;

        const isMobile = window.innerWidth <= 768;
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'message-swipe-container';

        let content = '';

        if (message.sender_id !== currentUser.id) {
            const senderAvatar = document.createElement('div');
            senderAvatar.className = 'message-sender-avatar avatar';
            senderAvatar.textContent = sender.username[0].toUpperCase();
            if (sender.avatar_url) {
                senderAvatar.innerHTML = `<img src="${sender.avatar_url}" alt="${sender.username}">`;
            }
            messageDiv.insertBefore(senderAvatar, messageDiv.firstChild);
            
            content += `<div class="message-sender-name">${sender.username}</div>`;
        }

        if (message.reply_to_id) {
            const replyText = message.reply_to_content || 'Original message';
            content += `<div class="message-reply-context"><i class="fa-solid fa-reply"></i> ${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}</div>`;
        }

        if (message.file_url) {
            const fileType = message.file_type || 'file';
            if (fileType.startsWith('image/')) {
                content += `<img src="${message.file_url}" alt="Image" class="message-image" onclick="window.open('${message.file_url}', '_blank')">`;
            } else if (fileType.startsWith('audio/')) {
                content += `<audio controls src="${message.file_url}" class="message-audio"></audio>`;
            } else {
                content += `<a href="${message.file_url}" target="_blank" class="message-file"><i class="fa-solid fa-file"></i> ${message.file_name || 'File'}</a>`;
            }
        }

        if (message.content) {
            content += `<div class="message-content">${escapeHtml(message.content)}${message.edited ? '<span class="message-edited">(edited)</span>' : ''}</div>`;
        }

        if (message.call_duration !== null && message.call_duration !== undefined) {
            const caller = message.sender_id === currentUser.id ? 'You' : sender.username;
            const duration = formatCallDuration(message.call_duration);
            content = `<div class="message-call-info"><i class="fa-solid fa-phone"></i> ${caller} called • ${duration}</div>`;
        }

        content += `<div class="message-reactions" data-message-id="${message.id}"></div>`;

        const timestamp = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (isMobile) {
            swipeContainer.innerHTML = `
                <div class="message-timestamp-reveal">${timestamp}</div>
                ${content}
            `;
            messageDiv.appendChild(swipeContainer);
        } else {
            swipeContainer.innerHTML = content;
            messageDiv.appendChild(swipeContainer);
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'message-timestamp';
            timestampDiv.textContent = timestamp;
            messageDiv.appendChild(timestampDiv);
        }

        if (message.sender_id === currentUser.id) {
            messageDiv.addEventListener('contextmenu', (e) => showGroupMessageContextMenu(e, message));
        }

        messageDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('message-reaction')) {
                toggleGroupReaction(message.id, e.target.dataset.emoji);
            }
        });

        if (isMobile) {
            setupMessageSwipe(swipeContainer, message.sender_id === currentUser.id);
        }

        ui.messagesContainer.appendChild(messageDiv);

        if (message.reactions) {
            renderReactions(message.id, message.reactions);
        }
    };

const setupMessageSwipe = (element, isSent) => {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    element.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });

    element.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        
        const maxSwipe = 80;

        const swipeAmount = isSent ? Math.min(Math.max(diff, -maxSwipe), 0) : Math.max(Math.min(diff, maxSwipe), 0);
        
        element.style.transform = `translateX(${swipeAmount}px)`;
        
        const timestamp = element.parentElement.querySelector('.message-timestamp-reveal');
        if (timestamp) {
            timestamp.style.opacity = Math.abs(swipeAmount) / maxSwipe;
        }
    });

    element.addEventListener('touchend', () => {
        isDragging = false;
        element.style.transform = 'translateX(0)';
        
        const timestamp = element.parentElement.querySelector('.message-timestamp-reveal');
        if (timestamp) {
            timestamp.style.opacity = 0;
        }
    });
};

const showMessageContextMenu = (e, message) => {
    e.preventDefault();
    e.stopPropagation();
    
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        background: var(--secondary-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--card-border-radius);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        min-width: 150px;
        padding: 0.5rem 0;
    `;
    
    const items = [
        { icon: 'fa-reply', text: 'Reply', action: () => window.replyToMessage(message.id, message.content || 'File') },
        { icon: 'fa-face-smile', text: 'React', action: () => window.addReaction(message.id) }
    ];
    
    if (message.content && message.sender_id === currentUser.id) {
        items.push({ icon: 'fa-edit', text: 'Edit', action: () => window.editMessage(message.id, message.content) });
    }
    
    if (message.sender_id === currentUser.id) {
        items.push({ icon: 'fa-trash', text: 'Delete', action: () => window.deleteMessage(message.id), danger: true });
    }
    
    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        menuItem.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.text}`;
        menuItem.style.cssText = `
            padding: 0.75rem 1rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            transition: var(--transition-fast);
            ${item.danger ? 'color: var(--error);' : ''}
        `;
        menuItem.onmouseover = () => menuItem.style.background = 'var(--tertiary-bg)';
        menuItem.onmouseout = () => menuItem.style.background = 'transparent';
        menuItem.onclick = () => {
            item.action();
            menu.remove();
        };
        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
};

if (ui.fileInput) {
    ui.fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        pendingFiles = files;
        
        ui.filePreviewContent.innerHTML = '';
        files.forEach(file => {
            const filePreview = document.createElement('div');
            filePreview.style.cssText = 'margin-bottom: 1rem;';
            
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: var(--button-border-radius);';
                filePreview.appendChild(img);
            } else {
                filePreview.innerHTML = `<div style="padding: 1rem; background: var(--tertiary-bg); border-radius: var(--button-border-radius); display: flex; align-items: center; gap: 0.5rem;"><i class="fa-solid fa-file"></i> ${file.name}</div>`;
            }
            
            ui.filePreviewContent.appendChild(filePreview);
        });

        showModal(ui.filePreviewModal);
        e.target.value = '';
    });
}

    const showGroupMessageContextMenu = (e, message) => {
        e.preventDefault();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.innerHTML = `
            <div class="context-menu-item" onclick="window.replyToGroupMessage('${message.id}', '${escapeHtml(message.content || 'File')}')"><i class="fa-solid fa-reply"></i> Reply</div>
            <div class="context-menu-item" onclick="window.editGroupMessage('${message.id}', '${escapeHtml(message.content)}')"><i class="fa-solid fa-edit"></i> Edit</div>
            <div class="context-menu-item" onclick="window.addGroupReaction('${message.id}')"><i class="fa-solid fa-face-smile"></i> React</div>
            <div class="context-menu-item" onclick="window.deleteGroupMessage('${message.id}')"><i class="fa-solid fa-trash"></i> Delete</div>
        `;

        document.body.appendChild(menu);

        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    };

    window.replyToMessage = (messageId, content) => {
        replyingTo = { id: messageId, content };
        ui.replyPreviewText.textContent = content.substring(0, 100);
        ui.replyPreview.classList.remove('hidden');
        ui.messageInput.focus();
    };

    window.replyToGroupMessage = (messageId, content) => {
        replyingTo = { id: messageId, content };
        ui.replyPreviewText.textContent = content.substring(0, 100);
        ui.replyPreview.classList.remove('hidden');
        ui.messageInput.focus();
    };

    ui.cancelReplyBtn.onclick = () => {
        replyingTo = null;
        ui.replyPreview.classList.add('hidden');
    };

    window.editMessage = (messageId, content) => {
        editingMessage = { id: messageId, type: 'message' };
        ui.editMessageInput.value = content;
        showModal(ui.editMessageModal);
    };

    window.editGroupMessage = (messageId, content) => {
        editingMessage = { id: messageId, type: 'group_message' };
        ui.editMessageInput.value = content;
        showModal(ui.editMessageModal);
    };

    ui.editMessageForm.onsubmit = async (e) => {
        e.preventDefault();
        const newContent = ui.editMessageInput.value.trim();
        if (!newContent || !editingMessage) return;

        const table = editingMessage.type === 'message' ? 'messages' : 'group_messages';
        await supabase.from(table).update({
            content: newContent,
            edited: true
        }).eq('id', editingMessage.id);

        editingMessage = null;
        hideModal();
    };

    window.deleteMessage = async (messageId) => {
        if (confirm('Delete this message?')) {
            await supabase.from('messages').delete().eq('id', messageId);
        }
    };

    window.deleteGroupMessage = async (messageId) => {
        if (confirm('Delete this message?')) {
            await supabase.from('group_messages').delete().eq('id', messageId);
        }
    };

window.addReaction = async (messageId) => {
    const emojis = ['ð', 'â¤ï¸', 'ð', 'ð®', 'ð¢', 'ð', 'ð', 'ð¥'];
    
    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--secondary-bg);
        padding: 1rem;
        border-radius: var(--card-border-radius);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.5rem;
    `;
    
    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.style.cssText = `
            font-size: 2rem;
            padding: 0.5rem;
            background: none;
            border: none;
            cursor: pointer;
            border-radius: var(--button-border-radius);
            transition: var(--transition-fast);
        `;
        btn.onmouseover = () => btn.style.background = 'var(--tertiary-bg)';
        btn.onmouseout = () => btn.style.background = 'none';
        btn.onclick = async () => {
            await toggleReaction(messageId, emoji);
            document.body.removeChild(backdrop);
        };
        picker.appendChild(btn);
    });
    
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    backdrop.onclick = (e) => {
        if (e.target === backdrop) {
            document.body.removeChild(backdrop);
        }
    };
    
    backdrop.appendChild(picker);
    document.body.appendChild(backdrop);
};

    window.addGroupReaction
window.addGroupReaction = async (messageId) => {
    const emojis = ['ð', 'â¤ï¸', 'ð', 'ð®', 'ð¢', 'ð', 'ð', 'ð¥'];
    
    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--secondary-bg);
        padding: 1rem;
        border-radius: var(--card-border-radius);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.5rem;
    `;
    
    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.style.cssText = `
            font-size: 2rem;
            padding: 0.5rem;
            background: none;
            border: none;
            cursor: pointer;
            border-radius: var(--button-border-radius);
            transition: var(--transition-fast);
        `;
        btn.onmouseover = () => btn.style.background = 'var(--tertiary-bg)';
        btn.onmouseout = () => btn.style.background = 'none';
        btn.onclick = async () => {
            await toggleGroupReaction(messageId, emoji);
            document.body.removeChild(backdrop);
        };
        picker.appendChild(btn);
    });
    
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    backdrop.onclick = (e) => {
        if (e.target === backdrop) {
            document.body.removeChild(backdrop);
        }
    };
    
    backdrop.appendChild(picker);
    document.body.appendChild(backdrop);
};


    const toggleReaction = async (messageId, emoji) => {
        const { data: message } = await supabase.from('messages').select('reactions').eq('id', messageId).single();
        let reactions = message?.reactions || {};

        if (!reactions[emoji]) {
            reactions[emoji] = [];
        }

        const userIndex = reactions[emoji].indexOf(currentUser.id);
        if (userIndex > -1) {
            reactions[emoji].splice(userIndex, 1);
            if (reactions[emoji].length === 0) {
                delete reactions[emoji];
            }
        } else {
            reactions[emoji].push(currentUser.id);
        }

        await supabase.from('messages').update({ reactions }).eq('id', messageId);
        renderReactions(messageId, reactions);
    };

    const toggleGroupReaction = async (messageId, emoji) => {
        const { data: message } = await supabase.from('group_messages').select('reactions').eq('id', messageId).single();
        let reactions = message?.reactions || {};

        if (!reactions[emoji]) {
            reactions[emoji] = [];
        }

        const userIndex = reactions[emoji].indexOf(currentUser.id);
        if (userIndex > -1) {
            reactions[emoji].splice(userIndex, 1);
            if (reactions[emoji].length === 0) {
                delete reactions[emoji];
            }
        } else {
            reactions[emoji].push(currentUser.id);
        }

        await supabase.from('group_messages').update({ reactions }).eq('id', messageId);
        renderReactions(messageId, reactions);
    };

    const renderReactions = (messageId, reactions) => {
        const container = document.querySelector(`[data-message-id="${messageId}"] .message-reactions`);
        if (!container) return;

        let html = '';
        for (const [emoji, users] of Object.entries(reactions)) {
            if (users.length > 0) {
                const hasReacted = users.includes(currentUser.id);
                html += `<span class="message-reaction ${hasReacted ? 'reacted' : ''}" data-emoji="${emoji}">${emoji} ${users.length}</span>`;
            }
        }
        container.innerHTML = html;
    };

    const scrollToBottom = () => {
        ui.messagesContainer.scrollTop = ui.messagesContainer.scrollHeight;
    };

    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = now - then;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const formatCallDuration = (seconds) => {
        if (seconds === 0) return 'Missed';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const showNotification = (message) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Peer 2 Peer', { body: message });
        }
    };

    const playMessageSound = () => {
        const audio = new Audio('/audios/message.mp3');
        audio.play().catch(() => {});
    };

    ui.messageForm.onsubmit = async (e) => {
        e.preventDefault();
        const content = ui.messageInput.value.trim();
        if (!content && pendingFiles.length === 0) return;

        const messageData = {
            content,
            sender_id: currentUser.id,
            created_at: new Date().toISOString()
        };

        if (replyingTo) {
            messageData.reply_to_id = replyingTo.id;
            messageData.reply_to_content = replyingTo.content;
        }

        if (pendingFiles.length > 0) {
            const file = pendingFiles[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${currentUser.id}/${fileName}`;

            const { data: uploadData } = await supabase.storage
                .from('files')
                .upload(filePath, file);

            if (uploadData) {
                const { data: { publicUrl } } = supabase.storage
                    .from('files')
                    .getPublicUrl(filePath);

                messageData.file_url = publicUrl;
                messageData.file_type = file.type;
                messageData.file_name = file.name;
            }
            
            pendingFiles = [];
        }

        if (currentChatType === 'friend') {
            messageData.receiver_id = currentChatFriend.id;
            await supabase.from('messages').insert([messageData]);
        } else if (currentChatType === 'group') {
            messageData.group_id = currentChatFriend.id;
            await supabase.from('group_messages').insert([messageData]);
        }

        ui.messageInput.value = '';
        ui.messageInput.style.height = 'auto';
        replyingTo = null;
        ui.replyPreview.classList.add('hidden');
        await updateConversationsList();
    };

    ui.messageInput.addEventListener('input', () => {
        adjustTextareaHeight();
        
        if (typingTimeout) clearTimeout(typingTimeout);
        
        typingTimeout = setTimeout(() => {
        }, 1000);
    });

    ui.fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        pendingFiles = files;
        
        ui.filePreviewContent.innerHTML = '';
        files.forEach(file => {
            const filePreview = document.createElement('div');
            filePreview.className = 'file-preview-item';
            
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.style.maxWidth = '100%';
                img.style.maxHeight = '300px';
                filePreview.appendChild(img);
            } else {
                filePreview.innerHTML = `<i class="fa-solid fa-file"></i> ${file.name}`;
            }
            
            ui.filePreviewContent.appendChild(filePreview);
        });

        showModal(ui.filePreviewModal);
    });

    ui.fileSendForm.onsubmit = async (e) => {
        e.preventDefault();
        const caption = ui.fileCaptionInput.value.trim();
        
        ui.messageInput.value = caption;
        hideModal();
        ui.fileCaptionInput.value = '';
        
        ui.messageForm.dispatchEvent(new Event('submit'));
    };

    ui.addFriendForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = ui.friendUsernameInput.value.trim();
        if (!username) return;

        const { data: targetUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single();

        if (!targetUser) {
            alert('User not found');
            return;
        }

        if (targetUser.id === currentUser.id) {
            alert('You cannot add yourself as a friend');
            return;
        }

        const { data: existing } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${currentUser.id})`)
            .single();

        if (existing) {
            alert('Friend request already exists or you are already friends');
            return;
        }

        await supabase.from('friendships').insert([{
            user_id: currentUser.id,
            friend_id: targetUser.id,
            status: 'pending'
        }]);

        ui.friendUsernameInput.value = '';
        hideModal();
        alert('Friend request sent!');
    };

    ui.createGroupForm.onsubmit = async (e) => {
        e.preventDefault();
        const groupName = ui.groupNameInput.value.trim();
        if (!groupName || selectedGroupMembers.size === 0) {
            alert('Please enter a group name and select at least one member');
            return;
        }

        const { data: group } = await supabase.from('groups').insert([{
            name: groupName,
            owner_id: currentUser.id,
            created_by: currentUser.id
        }]).select().single();

        if (!group) return;

        const members = [
            { group_id: group.id, user_id: currentUser.id, role: 'owner' },
            ...Array.from(selectedGroupMembers).map(memberId => ({
                group_id: group.id,
                user_id: memberId,
                role: 'member'
            }))
        ];

        await supabase.from('group_members').insert(members);

        ui.groupNameInput.value = '';
        selectedGroupMembers.clear();
        hideModal();
        await loadGroups();
        await updateConversationsList();
    };

    const renderGroupMemberSelection = () => {
    let html = '<div class="list-header" style="margin-bottom: 1rem;">Select Members</div>';
    for (const friendId in friends) {
        const friend = friends[friendId];
        const isSelected = selectedGroupMembers.has(friendId);
        html += `
            <div class="group-member-item ${isSelected ? 'selected' : ''}" onclick="window.toggleGroupMember('${friendId}')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: var(--button-border-radius); cursor: pointer; margin-bottom: 0.5rem; background: var(--tertiary-bg);">
                <div class="group-member-checkbox" style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0; ${isSelected ? 'background-color: var(--primary-accent); border-color: var(--primary-accent);' : ''}">
                    <i class="fa-solid fa-check" style="color: white; font-size: 0.7rem; ${isSelected ? 'opacity: 1;' : 'opacity: 0;'}"></i>
                </div>
                <div class="avatar" style="width: 36px; height: 36px; flex-shrink: 0;">${friend.avatar_url ? `<img src="${friend.avatar_url}" alt="${friend.username}">` : friend.username[0].toUpperCase()}</div>
                <div class="group-member-name" style="flex: 1; font-weight: 500;">${friend.username}</div>
            </div>
        `;
    }
    ui.groupMembersList.innerHTML = html;
};

    window.toggleGroupMember = (friendId) => {
        if (selectedGroupMembers.has(friendId)) {
            selectedGroupMembers.delete(friendId);
        } else {
            selectedGroupMembers.add(friendId);
        }
        renderGroupMemberSelection();
    };

    const showModal = (modal) => {
        ui.modalContainer.classList.remove('hidden');
        document.querySelectorAll('#modal-content > div').forEach(m => m.classList.add('hidden'));
        modal.classList.remove('hidden');
    };

    const hideModal = () => {
        ui.modalContainer.classList.add('hidden');
    };

    ui.closeModalBtn.onclick = hideModal;
    ui.modalContainer.onclick = (e) => {
        if (e.target === ui.modalContainer) hideModal();
    };

    ui.addFriendBtn.onclick = () => {
        showModal(ui.addFriendModal);
    };

    ui.createGroupBtn.onclick = () => {
        selectedGroupMembers.clear();
        renderGroupMemberSelection();
        showModal(ui.createGroupModal);
    };

    ui.backToFriendsBtn.onclick = () => {
        ui.sidebar.classList.remove('hidden');
        ui.chatContainer.classList.remove('active');
    };

    ui.chatOptionsBtn.onclick = () => {
        showModal(ui.chatOptionsModal);
    };

    ui.viewProfileBtn.onclick = async () => {
        if (currentChatType === 'friend') {
            ui.profileUsername.textContent = currentChatFriend.username;
            ui.profileUsernameValue.textContent = currentChatFriend.username;
            ui.profileAvatar.textContent = currentChatFriend.username[0].toUpperCase();
            
            if (currentChatFriend.avatar_url) {
                ui.profileAvatar.innerHTML = `<img src="${currentChatFriend.avatar_url}" alt="${currentChatFriend.username}">`;
            }

            const isOnline = onlineUsers.has(currentChatFriend.id);
            ui.profileStatusDot.classList.toggle('online', isOnline);
            ui.profileStatusText.textContent = isOnline ? 'Online' : 'Offline';

            const joinedDate = new Date(currentChatFriend.created_at).toLocaleDateString();
            ui.profileJoinedDate.textContent = joinedDate;

            hideModal();
            showModal(ui.friendProfileModal);
        }
    };

    ui.blockUserBtn.onclick = async () => {
        if (currentChatType === 'friend') {
            if (confirm(`Block ${currentChatFriend.username}?`)) {
                await supabase.from('blocked_users').insert([{
                    user_id: currentUser.id,
                    blocked_user_id: currentChatFriend.id
                }]);
                
                await loadBlockedUsers();
                hideModal();
                ui.chatView.classList.add('hidden');
                ui.welcomeScreen.classList.remove('hidden');
                await updateConversationsList();
            }
        }
    };

    ui.unfriendBtn.onclick = async () => {
        if (currentChatType === 'friend') {
            if (confirm(`Remove ${currentChatFriend.username} from friends?`)) {
                await supabase.from('friendships').delete()
                    .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${currentChatFriend.id}),and(user_id.eq.${currentChatFriend.id},friend_id.eq.${currentUser.id})`);
                
                await loadFriends();
                hideModal();
                ui.chatView.classList.add('hidden');
                ui.welcomeScreen.classList.remove('hidden');
                await updateConversationsList();
            }
        }
    };

    ui.settingsBtn.onclick = () => {
        showSettingsModal();
    };

    ui.logoutBtn.onclick = async () => {
        if (confirm('Are you sure you want to logout?')) {
            await supabase.auth.signOut();
            location.reload();
        }
    };

    ui.loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', username)
            .single();

        if (!profile) {
            setAuthStatus('Username not found');
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password: password
        });

        if (error) {
            setAuthStatus(error.message);
        } else {
            location.reload();
        }
    };

    ui.signupForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;

        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (existing) {
            setAuthStatus('Username already taken');
            return;
        }

        const email = `${username}@p2p.local`;

        const { data: authData, error } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            setAuthStatus(error.message);
            return;
        }

        if (authData.user) {
            await supabase.from('profiles').insert([{
                id: authData.user.id,
                username: username,
                email: email
            }]);

            location.reload();
        }
    };

    ui.showSignup.onclick = (e) => {
        e.preventDefault();
        ui.loginForm.classList.add('hidden');
        ui.signupForm.classList.remove('hidden');
        ui.authStatus.textContent = '';
    };

    ui.showLogin.onclick = (e) => {
        e.preventDefault();
        ui.signupForm.classList.add('hidden');
        ui.loginForm.classList.remove('hidden');
        ui.authStatus.textContent = '';
    };

    ui.themeToggle.onchange = () => {
        userSettings.theme = ui.themeToggle.checked ? 'dark' : 'light';
        saveSettings();
        applySettings();
    };

    ui.fontSizeSelect.onchange = () => {
        userSettings.fontSize = ui.fontSizeSelect.value;
        saveSettings();
        applySettings();
    };

    ui.notificationsToggle.onchange = () => {
        userSettings.notifications = ui.notificationsToggle.checked;
        saveSettings();
        if (userSettings.notifications && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    ui.messageSoundToggle.onchange = () => {
        userSettings.messageSound = ui.messageSoundToggle.checked;
        saveSettings();
    };

    ui.onlineStatusToggle.onchange = async () => {
        userSettings.onlineStatus = ui.onlineStatusToggle.checked;
        saveSettings();
        await supabase.from('profiles').update({
            is_online: userSettings.onlineStatus
        }).eq('id', currentUser.id);
    };

    ui.readReceiptsToggle.onchange = () => {
        userSettings.readReceipts = ui.readReceiptsToggle.checked;
        saveSettings();
    };

    ui.changeAvatarBtn.onclick = () => {
        ui.avatarUpload.click();
    };

    ui.avatarUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-avatar.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { data: uploadData } = await supabase.storage
            .from('files')
            .upload(filePath, file, { upsert: true });

        if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
                .from('files')
                .getPublicUrl(filePath);

            await supabase.from('profiles').update({
                avatar_url: publicUrl
            }).eq('id', currentUser.id);

            currentUser.avatar_url = publicUrl;
            ui.userAvatar.innerHTML = `<img src="${publicUrl}" alt="${currentUser.username}">`;
            ui.settingsAvatar.innerHTML = `<img src="${publicUrl}" alt="${currentUser.username}">`;
        }
    };

    ui.changeUsernameBtn.onclick = () => {
        hideSettingsModal();
        showModal(ui.changeUsernameModal);
    };

    ui.changeUsernameForm.onsubmit = async (e) => {
        e.preventDefault();
        const newUsername = ui.newUsernameInput.value.trim();
        if (!newUsername) return;

        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', newUsername)
            .single();

        if (existing) {
            alert('Username already taken');
            return;
        }

        await supabase.from('profiles').update({
            username: newUsername
        }).eq('id', currentUser.id);

        currentUser.username = newUsername;
        ui.usernameDisplay.textContent = newUsername;
        ui.settingsUsername.textContent = newUsername;
        ui.userAvatar.textContent = newUsername[0].toUpperCase();
        ui.settingsAvatar.textContent = newUsername[0].toUpperCase();

        if (currentUser.avatar_url) {
            ui.userAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="${newUsername}">`;
            ui.settingsAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="${newUsername}">`;
        }

        ui.newUsernameInput.value = '';
        hideModal();
    };

    ui.searchFriendsInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.friend-item, .group-item').forEach(item => {
            const name = item.querySelector('.friend-name')?.textContent.toLowerCase();
            if (name?.includes(query) || !query) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });

    const handleIncomingCall = (call) => {
        mediaConnection = call;
        incomingCallData = call.metadata;

        const callerId = incomingCallData.from;
        const caller = friends[callerId];

        if (!caller) {
            call.close();
            return;
        }

        ui.callerName.textContent = caller.username;
        ui.callerAvatar.textContent = caller.username[0].toUpperCase();
        if (caller.avatar_url) {
            ui.callerAvatar.innerHTML = `<img src="${caller.avatar_url}" alt="${caller.username}">`;
        }

        showModal(ui.incomingCallModal);
        ui.incomingCallAudio.play();
    };

    ui.acceptCallBtn.onclick = async () => {
        ui.incomingCallAudio.pause();
        ui.incomingCallAudio.currentTime = 0;
        hideModal();

        const startTime = Date.now();

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            mediaConnection.answer(localStream);

            mediaConnection.on('stream', (remoteStream) => {
                showCallUI();
                addVideoStream('local', localStream, currentUser);
                addVideoStream('remote', remoteStream, friends[incomingCallData.from]);
            });

            mediaConnection.on('close', async () => {
                const duration = Math.floor((Date.now() - startTime) / 1000);
                await saveCallRecord(incomingCallData.from, duration);
                endCall();
            });

        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Could not access camera/microphone');
        }
    };

    ui.declineCallBtn.onclick = () => {
        ui.incomingCallAudio.pause();
        ui.incomingCallAudio.currentTime = 0;
        hideModal();
        if (mediaConnection) {
            mediaConnection.close();
            mediaConnection = null;
        }
    };

    ui.callBtn.onclick = async () => {
        if (!currentChatFriend || currentChatType !== 'friend') return;

        const { data: friendProfile } = await supabase
            .from('profiles')
            .select('peer_id')
            .eq('id', currentChatFriend.id)
            .single();

        if (!friendProfile?.peer_id) {
            alert('Friend is not available for calls');
            return;
        }

        const startTime = Date.now();

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            const call = peer.call(friendProfile.peer_id, localStream, {
                metadata: { from: currentUser.id }
            });

            mediaConnection = call;

            call.on('stream', (remoteStream) => {
                showCallUI();
                addVideoStream('local', localStream, currentUser);
                addVideoStream('remote', remoteStream, currentChatFriend);
            });

            call.on('close', async () => {
                const duration = Math.floor((Date.now() - startTime) / 1000);
                await saveCallRecord(currentChatFriend.id, duration);
                endCall();
            });

        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Could not access camera/microphone');
        }
    };

    const saveCallRecord = async (otherUserId, duration) => {
        if (currentChatType === 'friend') {
            await supabase.from('messages').insert([{
                sender_id: currentUser.id,
                receiver_id: otherUserId,
                call_duration: duration,
                created_at: new Date().toISOString()
            }]);
        }
        await updateConversationsList();
    };

    const showCallUI = () => {
        ui.callSection.classList.remove('hidden');
        isInCall = true;
    };

    const addVideoStream = (id, stream, user) => {
        const existingTile = document.getElementById(`video-${id}`);
        if (existingTile) existingTile.remove();

        const tile = document.createElement('div');
        tile.className = 'participant-tile';
        tile.id = `video-${id}`;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        if (id === 'local') video.muted = true;

        const placeholder = document.createElement('div');
        placeholder.className = 'video-off-placeholder';
        placeholder.innerHTML = `
            <div class="avatar">${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}">` : user.username[0].toUpperCase()}</div>
            <span>${user.username}</span>
        `;

        tile.appendChild(video);
        tile.appendChild(placeholder);
        ui.videoGrid.appendChild(tile);
    };

    const updateVideoState = (id, enabled) => {
        const tile = document.getElementById(`video-${id}`);
        if (tile) {
            tile.classList.toggle('video-off', !enabled);
        }
    };

    const endCall = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        if (mediaConnection) {
            mediaConnection.close();
            mediaConnection = null;
        }
        ui.videoGrid.innerHTML = '';
        ui.callSection.classList.add('hidden');
        isInCall = false;
        callState = { isMuted: false, isVideoEnabled: true, isScreenSharing: false };
    };

    ui.stopCallBtn.onclick = endCall;

    ui.muteBtn.onclick = () => {
        callState.isMuted = !callState.isMuted;
        if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = !callState.isMuted);
        ui.muteBtn.classList.toggle('danger', callState.isMuted);
        ui.muteBtn.innerHTML = callState.isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
    };

    ui.toggleVideoBtn.onclick = async () => {
        callState.isVideoEnabled = !callState.isVideoEnabled;
        if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = callState.isVideoEnabled);
        updateVideoState('local', callState.isVideoEnabled);
        ui.toggleVideoBtn.classList.toggle('active', callState.isVideoEnabled);
        ui.toggleVideoBtn.innerHTML = callState.isVideoEnabled ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>';
    };

    ui.toggleChatBtn.onclick = () => {
        const isVisible = ui.chatOverlay.classList.contains('visible');
        ui.chatOverlayBackdrop.classList.toggle('visible', !isVisible);
        ui.chatOverlay.classList.toggle('visible', !isVisible);

        if (!isVisible) {
            ui.chatOverlayContent.innerHTML = '';
            const chatClone = ui.chatView.cloneNode(true);
            chatClone.classList.remove('hidden');
            ui.chatOverlayContent.appendChild(chatClone);
        }
    };

    ui.chatOverlayBackdrop.onclick = () => {
        ui.chatOverlayBackdrop.classList.remove('visible');
        ui.chatOverlay.classList.remove('visible');
    };

    const setupDrag = () => {
        let isDragging = false;
        let startY, startHeight;

        const dragStart = (e) => {
            isDragging = true;
            startY = e.pageY || e.touches[0].pageY;
            startHeight = ui.chatOverlay.offsetHeight;
            ui.chatOverlay.style.transition = 'none';
            document.body.style.userSelect = 'none';
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const currentY = e.pageY || e.touches[0].pageY;
            const diffY = currentY - startY;
            let newHeight = startHeight - diffY;

            const minHeight = 200;
            const maxHeight = window.innerHeight * 0.9;
            if (newHeight < minHeight) newHeight = minHeight;
            if (newHeight > maxHeight) newHeight = maxHeight;

            ui.chatOverlay.style.height = `${newHeight}px`;
        };

        const dragEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            ui.chatOverlay.style.transition = 'transform 0.3s ease-out, height 0.3s ease-out';
            document.body.style.userSelect = '';

            const currentHeight = ui.chatOverlay.offsetHeight;
            if (currentHeight < startHeight * 0.7 && currentHeight < 300) {
                ui.chatOverlayBackdrop.classList.remove('visible');
                ui.chatOverlay.classList.remove('visible');
                ui.chatOverlay.style.height = '';
            }
        };

        ui.chatOverlayHeader.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);

        ui.chatOverlayHeader.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('touchend', dragEnd);
    };

    const setupSettingsDrag = () => {
        if (window.innerWidth > 768) {
            return;
        }

        let isDragging = false;
        let startY, startTranslate;

        const dragStart = (e) => {
            if (window.innerWidth > 768) return;
            isDragging = true;
            startY = e.pageY || e.touches[0].pageY;
            startTranslate = 0;
            ui.settingsModalPane.style.transition = 'none';
        };

        const dragMove = (e) => {
            if (!isDragging || window.innerWidth > 768) return;
            const currentY = e.pageY || e.touches[0].pageY;
            const diffY = currentY - startY;

            if (diffY > 0) {
                ui.settingsModalPane.style.transform = `translateY(${diffY}px)`;
            }
        };

        const dragEnd = (e) => {
            if (!isDragging || window.innerWidth > 768) return;
            isDragging = false;
            ui.settingsModalPane.style.transition = 'transform 0.3s ease-out';

            const currentY = e.pageY || e.changedTouches[0].pageY;
            const diffY = currentY - startY;

            if (diffY > 100) {
                ui.settingsModalPane.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    hideSettingsModal();
                    ui.settingsModalPane.style.transform = '';
                }, 300);
            } else {
                ui.settingsModalPane.style.transform = 'translateY(0)';
            }
        };

        ui.settingsModalHeader.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);

        ui.settingsModalHeader.addEventListener('touchstart', dragStart, { passive: true });
        document.addEventListener('touchmove', dragMove, { passive: true });
        document.addEventListener('touchend', dragEnd, { passive: true });

        ui.settingsModalContainer.addEventListener('click', (e) => {
            if (e.target === ui.settingsModalContainer) {
                hideSettingsModal();
            }
        });
    };

    setupDrag();
    setupSettingsDrag();

    const showSettingsModal = () => {
        ui.settingsModalContainer.classList.add('visible');
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                ui.settingsModalPane.classList.add('visible');
            }, 10);
        }
    };

    const hideSettingsModal = () => {
        ui.settingsModalPane.classList.remove('visible');
        setTimeout(() => {
            ui.settingsModalContainer.classList.remove('visible');
        }, 300);
    };

    const adjustTextareaHeight = () => {
        ui.messageInput.style.height = 'auto';
        const scrollHeight = ui.messageInput.scrollHeight;
        ui.messageInput.style.height = `${Math.min(scrollHeight, 120)}px`;
    };

    window.addEventListener('beforeunload', async () => {
        if (currentUser && userSettings.onlineStatus) {
            await supabase.from('profiles').update({
                is_online: false
            }).eq('id', currentUser.id);
        }
    });

    handleAuth();
setTimeout(addFileButton, 500);
});