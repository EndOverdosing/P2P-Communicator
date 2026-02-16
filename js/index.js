document.addEventListener('DOMContentLoaded', () => {
    const securityConfig = {
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
        rateLimits: {
            messages: { limit: 100, window: 60000 },
            friendRequests: { limit: 10, window: 300000 },
            apiCalls: { limit: 200, window: 60000 }
        }
    };

    const botDetection = {
        minFormTime: 3000,
        maxFormTime: 300000,
        mouseMovements: 0,
        keystrokes: 0,

        initFormTracking(formId) {
            const form = document.getElementById(formId);
            if (!form) return;

            const timestamp = document.getElementById('signup-timestamp');
            if (timestamp) timestamp.value = Date.now();

            this.mouseMovements = 0;
            this.keystrokes = 0;

            const trackMouse = () => this.mouseMovements++;
            const trackKeys = () => this.keystrokes++;

            form.addEventListener('mousemove', trackMouse);
            form.addEventListener('keydown', trackKeys);

            form._cleanup = () => {
                form.removeEventListener('mousemove', trackMouse);
                form.removeEventListener('keydown', trackKeys);
            };
        },

        validateFormSubmission(formId) {
            const form = document.getElementById(formId);
            if (!form) return false;

            const honeypotWebsite = form.querySelector('[name="website"]');
            const honeypotEmail = form.querySelector('[name="email_confirm"]');

            if (honeypotWebsite?.value || honeypotEmail?.value) {
                return false;
            }

            const timestamp = document.getElementById('signup-timestamp');
            if (timestamp?.value) {
                const timeSpent = Date.now() - parseInt(timestamp.value);
                if (timeSpent < this.minFormTime || timeSpent > this.maxFormTime) {
                    return false;
                }
            }

            if (this.mouseMovements < 3 && this.keystrokes < 10) {
                return false;
            }

            return true;
        },

        cleanup(formId) {
            const form = document.getElementById(formId);
            if (form?._cleanup) {
                form._cleanup();
                delete form._cleanup;
            }
        }
    };

    function generateFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('fingerprint', 2, 2);
        const canvasData = canvas.toDataURL();

        const fingerprint = {
            canvas: canvasData.slice(-50),
            screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            platform: navigator.platform,
            vendor: navigator.vendor,
            plugins: Array.from(navigator.plugins || []).map(p => p.name).slice(0, 3).join(','),
            touch: 'ontouchstart' in window,
            cores: navigator.hardwareConcurrency || 0
        };

        const str = JSON.stringify(fingerprint);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    const sessionFingerprint = generateFingerprint();
    const suspiciousActions = new Map();

    function trackSuspiciousActivity(userId, action) {
        const key = `${userId}_${action}`;
        const now = Date.now();
        const activities = suspiciousActions.get(key) || [];

        activities.push(now);

        const recentActivities = activities.filter(time => now - time < 60000);
        suspiciousActions.set(key, recentActivities);

        if (recentActivities.length > 20) {
            return false;
        }

        return true;
    }

    const rateLimiters = new Map();
    const loginAttempts = new Map();

    function checkRateLimit(key, type) {
        const config = securityConfig.rateLimits[type];
        if (!config) return true;

        const now = Date.now();
        const limiter = rateLimiters.get(key) || { count: 0, resetTime: now + config.window };

        if (now > limiter.resetTime) {
            limiter.count = 0;
            limiter.resetTime = now + config.window;
        }

        if (limiter.count >= config.limit) {
            const waitTime = Math.ceil((limiter.resetTime - now) / 1000);
            showInfo('Rate Limited', `Please wait ${waitTime} seconds before trying again.`);
            return false;
        }

        limiter.count++;
        rateLimiters.set(key, limiter);
        return true;
    }

    function sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML.replace(/[<>\"']/g, char => {
            const entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return entities[char];
        });
    }

    function validateUsername(username) {
        const regex = /^[a-zA-Z0-9_-]{3,20}$/;
        return regex.test(username);
    }

    function validatePassword(password) {
        return password.length >= 8 &&
            /[A-Z]/.test(password) &&
            /[a-z]/.test(password) &&
            /[0-9]/.test(password);
    }

    async function verifyHCaptcha(token) {
        try {
            const response = await fetch('/api/verify-captcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            return data.success;
        } catch {
            return false;
        }
    }

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    });

    window.supabase = supabaseClient;

    const ui = {
        settingsModalContainer: document.getElementById('settings-modal-container'),
        settingsModalPane: document.getElementById('settings-modal'),
        settingsModalHeader: document.getElementById('settings-modal-header'),
        settingsModalBody: document.getElementById('settings-modal-body'),
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
        notificationsBtn: document.getElementById('notifications-btn'),
        notificationsBadge: document.getElementById('notifications-badge'),
        chatContainer: document.getElementById('chat-container'),
        welcomeScreen: document.getElementById('welcome-screen'),
        chatView: document.getElementById('chat-view'),
        chatHeader: document.getElementById('chat-header'),
        chatAvatar: document.getElementById('chat-avatar'),
        chatFriendName: document.getElementById('chat-friend-name'),
        chatStatusText: document.getElementById('chat-status-text'),
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
        replyPreview: document.getElementById('reply-preview'),
        replyPreviewText: document.querySelector('.reply-preview-text'),
        cancelReplyBtn: document.getElementById('cancel-reply-btn'),
        editMessageForm: document.getElementById('edit-message-form'),
        editMessageInput: document.getElementById('edit-message-input'),
        fileInput: document.getElementById('file-input'),
        friendRequestsModal: document.getElementById('friend-requests-modal'),
        requestsList: document.getElementById('requests-list'),
        closeChatPaneBtn: document.getElementById('close-chat-pane-btn'),
        createServerBtn: document.getElementById('create-server-btn'),
        createServerModal: document.getElementById('create-server-modal'),
        createServerForm: document.getElementById('create-server-form'),
        serverNameInput: document.getElementById('server-name-input'),
        serverPrivateToggle: document.getElementById('server-private-toggle'),
        serverPasswordInput: document.getElementById('server-password-input'),
        serverPasswordGroup: document.getElementById('server-password-group'),
        joinServerModal: document.getElementById('join-server-modal'),
        joinServerForm: document.getElementById('join-server-form'),
        serverPasswordJoin: document.getElementById('server-password-join'),
        serverInfoModal: document.getElementById('server-info-modal'),
        serverInfoName: document.getElementById('server-info-name'),
        serverOwnerName: document.getElementById('server-owner-name'),
        serverType: document.getElementById('server-type'),
        serverMembersList: document.getElementById('server-members-list'),
        serverOwnerActions: document.getElementById('server-owner-actions'),
        deleteServerBtn: document.getElementById('delete-server-btn'),
        serverInfoBtn: document.getElementById('server-info-btn'),
        contentList: document.getElementById('content-list'),
        searchInput: document.getElementById('search-input'),
        navbarInSidebar: document.getElementById('navbar-in-sidebar'),
        notificationsModal: document.getElementById('notifications-modal'),
        viewBlockedUsersBtn: document.getElementById('view-blocked-users-btn'),
        blockedUsersModal: document.getElementById('blocked-users-modal'),
        blockedUsersList: document.getElementById('blocked-users-list'),
    };

    let peer, localStream, mediaConnection, currentUser, currentChatFriend, friends = {}, subscriptions = [];
    let callState = { isMuted: false, isVideoEnabled: true, isScreenSharing: false };
    let incomingCallData = null;
    let onlineUsers = new Set();
    let incomingCallTimeout = null;
    let isInCall = false;

    let currentTab = 'personal';
    let servers = [];
    let currentServer = null;
    let selectedServerForJoin = null;

    let keepAliveInterval = null;
    let currentChatType = 'friend';
    let blockedUsers = new Set();
    let friendRequests = [];
    let replyingTo = null;
    let pendingFiles = [];
    let conversations = [];

    let userSettings = {
        theme: 'dark',
        fontSize: 'medium',
        notifications: true,
        messageSound: true,
        onlineStatus: true,
        readReceipts: true
    };

    let notifications = [];
    let unreadNotificationsCount = 0;

    const URL_REGEX = /(https?:\/\/[^\s]+)/g;

    ui.notificationsBtn?.addEventListener('click', async () => {
        await loadNotifications();
        renderNotifications();
        showModal(ui.notificationsModal);
    });

    async function loadNotifications() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                *,
                from_user:profiles!notifications_from_user_id_fkey(id, username, avatar_url)
            `)
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            notifications = data || [];
            unreadNotificationsCount = notifications.filter(n => !n.read).length;
            updateNotificationsBadge();
        } catch (error) {
        }
    }

    function updateNotificationsBadge() {
        const badge = ui.notificationsBadge || document.getElementById('notifications-badge');
        if (badge) {
            if (unreadNotificationsCount > 0) {
                badge.textContent = unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    function renderNotifications() {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        list.innerHTML = '';

        if (notifications.length === 0) {
            return;
        }

        notifications.forEach(notification => {
            const item = createNotificationElement(notification);
            list.appendChild(item);
        });
    }

    function createNotificationElement(notification) {
        const div = document.createElement('div');
        div.className = `notification-item ${!notification.read ? 'unread' : ''}`;
        div.dataset.notificationId = notification.id;

        const fromUser = notification.from_user;
        if (!fromUser) return div;

        const avatar = document.createElement('div');
        avatar.className = 'notification-avatar';
        if (fromUser.avatar_url) {
            avatar.innerHTML = `<img src="${fromUser.avatar_url}" alt="${fromUser.username}">`;
        } else {
            avatar.textContent = fromUser.username[0].toUpperCase();
        }

        const content = document.createElement('div');
        content.className = 'notification-content';

        const text = document.createElement('div');
        text.className = 'notification-text';

        const time = document.createElement('div');
        time.className = 'notification-time';
        time.textContent = formatTimeAgo(notification.created_at);

        if (notification.type === 'friend_request') {
            text.innerHTML = `<strong>${fromUser.username}</strong> sent you a friend request`;

            content.appendChild(text);
            content.appendChild(time);
        } else if (notification.type === 'message') {
            text.innerHTML = `<strong>${fromUser.username}</strong> sent you a message`;

            if (notification.content) {
                const preview = document.createElement('div');
                preview.style.cssText = 'font-size: 0.85rem; color: var(--secondary-text); margin-top: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                preview.textContent = notification.content;
                content.appendChild(text);
                content.appendChild(preview);
                content.appendChild(time);
            } else {
                content.appendChild(text);
                content.appendChild(time);
            }

            div.onclick = async () => {
                await markNotificationAsRead(notification.id);
                if (friends[fromUser.id]) {
                    closeAllModals();
                    await switchTab('personal');
                    setTimeout(() => {
                        window.openChat(fromUser.id, 'friend');
                    }, 100);
                }
            };
        }

        div.appendChild(avatar);
        div.appendChild(content);

        if (!notification.read) {
            div.onclick = async (e) => {
                if (!e.target.closest('.notification-actions')) {
                    await markNotificationAsRead(notification.id);
                }
            };
        }

        return div;
    }

    async function markNotificationAsRead(notificationId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId);

            if (error) throw error;

            const notification = notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                unreadNotificationsCount = Math.max(0, unreadNotificationsCount - 1);
                updateNotificationsBadge();
                renderNotifications();
            }
        } catch (error) {
        }
    }

    async function acceptFriendRequestFromNotification(friendshipId, notificationId) {
        try {
            const { error } = await supabase
                .from('friendships')
                .update({ status: 'accepted' })
                .eq('id', friendshipId);

            if (error) throw error;

            await markNotificationAsRead(notificationId);
            await loadFriends();
            await updateConversationsList();
            renderNotifications();
        } catch (error) {
            showInfo('Error', 'Failed to accept friend request');
        }
    }

    async function declineFriendRequestFromNotification(friendshipId, notificationId) {
        try {
            const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', friendshipId);

            if (error) throw error;

            await markNotificationAsRead(notificationId);
            renderNotifications();
        } catch (error) {
            showInfo('Error', 'Failed to decline friend request');
        }
    }

    function subscribeToNotifications() {
        if (!currentUser || !currentUser.id) return;
        const channel = supabase
            .channel(`notifications-${currentUser.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUser.id}`
            }, async (payload) => {
                const { data: fromUser } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .eq('id', payload.new.from_user_id)
                    .single();
                const notification = { ...payload.new, from_user: fromUser };
                notifications.unshift(notification);
                unreadNotificationsCount++;
                updateNotificationsBadge();

                if (userSettings.notifications && 'Notification' in window && Notification.permission === 'granted') {
                    let notifTitle = 'New Notification';
                    let notifBody = '';

                    if (notification.type === 'friend_request') {
                        notifTitle = 'New Friend Request';
                        notifBody = `${fromUser.username} sent you a friend request`;
                    } else if (notification.type === 'message') {
                        notifTitle = 'New Message';
                        notifBody = `${fromUser.username}: ${notification.content || 'Sent a file'}`;
                    }
                    new Notification(notifTitle, {
                        body: notifBody,
                        icon: fromUser.avatar_url || '/favicon.ico'
                    });
                }

                if (userSettings.messageSound && notification.type === 'message') {
                    playMessageSound();
                }
            })
            .subscribe((status) => {
            });

        subscriptions.push(channel);
    }

    document.getElementById('notifications-btn')?.addEventListener('click', async () => {
        await loadNotifications();
        renderNotifications();
        showModal(document.getElementById('notifications-modal'));
    });

    document.getElementById('notifications-btn')?.addEventListener('click', async () => {
        await loadNotifications();
        renderNotifications();
        showModal(document.getElementById('notifications-modal'));
    });

    document.getElementById('notifications-btn')?.addEventListener('click', async () => {
        await loadNotifications();
        subscribeToFriendshipChanges();
        subscribeToNotifications();
        renderNotifications();
        showModal(document.getElementById('notifications-modal'));
    });

    function linkifyText(text) {
        if (!text) return '';

        const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return escaped.replace(urlRegex, (url) => {
            let cleanUrl = url;
            if (url.match(/[.,;:!?)]$/)) {
                cleanUrl = url.slice(0, -1);
            }
            return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="message-link" onclick="event.stopPropagation()">${cleanUrl}</a>`;
        });
    }

    async function fetchLinkPreview(url) {
        try {
            const { data: existing, error: selectError } = await supabase
                .from('link_previews')
                .select('*')
                .eq('url', url)
                .maybeSingle();

            if (existing && !selectError) {
                return existing;
            }

            const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (data.status === 'success' && data.data) {
                const preview = {
                    url: url,
                    title: data.data.title || null,
                    description: data.data.description || null,
                    image_url: data.data.image?.url || null,
                    favicon_url: data.data.logo?.url || null,
                    site_name: data.data.publisher || null
                };

                const { error: insertError } = await supabase
                    .from('link_previews')
                    .insert(preview)
                    .select()
                    .single();

                if (!insertError) {
                    return preview;
                }
            }
        } catch (error) {
        }
        return null;
    }

    async function addLinkPreviewsToMessage(messageElement, content) {
        if (!content) return;

        const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
        const urls = content.match(urlRegex);

        if (!urls || urls.length === 0) return;

        const uniqueUrls = [...new Set(urls)];
        const firstUrl = uniqueUrls[0].replace(/[.,;:!?)]$/, '');

        try {
            const preview = await fetchLinkPreview(firstUrl);
            if (!preview) return;

            const previewElement = document.createElement('a');
            previewElement.className = 'link-preview';
            previewElement.href = preview.url;
            previewElement.target = '_blank';
            previewElement.rel = 'noopener noreferrer';
            previewElement.onclick = (e) => e.stopPropagation();

            if (preview.image_url) {
                const img = document.createElement('img');
                img.className = 'link-preview-image';
                img.src = preview.image_url;
                img.alt = preview.title || 'Link preview';
                img.onerror = () => img.style.display = 'none';
                previewElement.appendChild(img);
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'link-preview-content';

            if (preview.title) {
                const title = document.createElement('div');
                title.className = 'link-preview-title';
                title.textContent = preview.title;
                contentDiv.appendChild(title);
            }

            if (preview.description) {
                const desc = document.createElement('div');
                desc.className = 'link-preview-description';
                desc.textContent = preview.description;
                contentDiv.appendChild(desc);
            }

            const urlDiv = document.createElement('div');
            urlDiv.className = 'link-preview-url';
            try {
                const urlObj = new URL(preview.url);
                urlDiv.textContent = urlObj.hostname;
            } catch {
                urlDiv.textContent = preview.url;
            }
            contentDiv.appendChild(urlDiv);

            previewElement.appendChild(contentDiv);
            messageElement.appendChild(previewElement);
        } catch (error) {
        }
    }
    document.addEventListener('click', async (e) => {
        const unfriendBtn = e.target.closest('#unfriend-btn, #unfriend-btn-dynamic');
        if (unfriendBtn) {
            e.preventDefault();
            e.stopPropagation();

            if (currentChatType === 'friend' && currentChatFriend) {
                showConfirmation(
                    'Remove Friend',
                    `Are you sure you want to remove ${currentChatFriend.username} from your friends?`,
                    async () => {
                        const removedFriendId = currentChatFriend.id;
                        try {
                            const { data: friendshipsToDelete, error: fetchError } = await supabase
                                .from('friendships')
                                .select('*')
                                .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${removedFriendId}),and(user_id.eq.${removedFriendId},friend_id.eq.${currentUser.id})`);

                            if (fetchError) {
                                throw fetchError;
                            }
                            if (!friendshipsToDelete || friendshipsToDelete.length === 0) {
                                showInfo('Error', 'No friendship found. You may already not be friends.');
                                return;
                            }
                            const { data: deleteResult, error: deleteError } = await supabase
                                .from('friendships')
                                .delete()
                                .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${removedFriendId}),and(user_id.eq.${removedFriendId},friend_id.eq.${currentUser.id})`)
                                .select();

                            if (deleteError) {
                                throw deleteError;
                            }
                            delete friends[removedFriendId];
                            hideModal();
                            ui.chatView.classList.add('hidden');
                            ui.welcomeScreen.classList.remove('hidden');
                            currentChatFriend = null;
                            await updateConversationsList();
                            const channelName = `unfriend-${currentUser.id}-${removedFriendId}-${Date.now()}`;
                            const unfriendChannel = supabase.channel(channelName);

                            await new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => {
                                    resolve();
                                }, 3000);

                                unfriendChannel.subscribe((status) => {
                                    if (status === 'SUBSCRIBED') {
                                        clearTimeout(timeout);
                                        resolve();
                                    }
                                });
                            });

                            const payload = {
                                removedBy: currentUser.id,
                                removedUser: removedFriendId,
                                timestamp: Date.now()
                            };
                            await unfriendChannel.send({
                                type: 'broadcast',
                                event: 'friendship_removed',
                                payload: payload
                            });
                            setTimeout(() => {
                                supabase.removeChannel(unfriendChannel);
                            }, 1000);
                            showInfo('Success', 'Friend removed successfully');
                        } catch (error) {
                            showInfo('Error', `Failed to remove friend: ${error.message}`);
                        }
                    }
                );
            } else {
            }
        }

        const blockBtn = e.target.closest('#block-user-btn, #block-user-btn-dynamic');
        if (blockBtn) {
            e.preventDefault();
            e.stopPropagation();

            if (currentChatType === 'friend' && currentChatFriend) {
                showConfirmation(
                    `Block ${currentChatFriend.username}?`,
                    'This user will be blocked and you will not receive messages from them.',
                    async () => {
                        const blockedUserId = currentChatFriend.id;
                        try {
                            const { data: existingBlock } = await supabase
                                .from('blocked_users')
                                .select('*')
                                .eq('user_id', currentUser.id)
                                .eq('blocked_user_id', blockedUserId)
                                .maybeSingle();
                            if (existingBlock) {
                                showInfo('Info', 'User is already blocked');
                                return;
                            }
                            const { data: blockData, error: blockError } = await supabase
                                .from('blocked_users')
                                .insert([{
                                    user_id: currentUser.id,
                                    blocked_user_id: blockedUserId,
                                    created_at: new Date().toISOString()
                                }])
                                .select()
                                .single();

                            if (blockError) {
                                throw blockError;
                            }
                            const { data: deleteResult, error: deleteError } = await supabase
                                .from('friendships')
                                .delete()
                                .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${blockedUserId}),and(user_id.eq.${blockedUserId},friend_id.eq.${currentUser.id})`)
                                .select();
                            if (deleteError) {
                            }
                            delete friends[blockedUserId];
                            await loadBlockedUsers();
                            hideModal();
                            ui.chatView.classList.add('hidden');
                            ui.welcomeScreen.classList.remove('hidden');
                            currentChatFriend = null;
                            await updateConversationsList();
                            const channelName = `block-${currentUser.id}-${blockedUserId}-${Date.now()}`;
                            const blockChannel = supabase.channel(channelName);

                            await new Promise((resolve) => {
                                const timeout = setTimeout(() => {
                                    resolve();
                                }, 3000);

                                blockChannel.subscribe((status) => {
                                    if (status === 'SUBSCRIBED') {
                                        clearTimeout(timeout);
                                        resolve();
                                    }
                                });
                            });

                            const payload = {
                                blockedBy: currentUser.id,
                                blockedUser: blockedUserId,
                                timestamp: Date.now()
                            };
                            await blockChannel.send({
                                type: 'broadcast',
                                event: 'user_blocked',
                                payload: payload
                            });
                            setTimeout(() => {
                                supabase.removeChannel(blockChannel);
                            }, 1000);
                            showInfo('Success', 'User blocked successfully');
                        } catch (error) {
                            showInfo('Error', `Failed to block user: ${error.message}`);
                        }
                    }
                );
            } else {
            }
        }
    });

    function subscribeToFriendshipChanges() {
        if (!currentUser || !currentUser.id) {
            return;
        }
        const personalChannel = supabase.channel(`friendship-${currentUser.id}`);

        personalChannel
            .on('broadcast', { event: 'friendship_removed' }, async (payload) => {
                const { removedBy, removedUser } = payload.payload;

                if (removedUser === currentUser.id) {
                    delete friends[removedBy];

                    if (currentChatFriend && currentChatFriend.id === removedBy) {
                        ui.chatView.classList.add('hidden');
                        ui.welcomeScreen.classList.remove('hidden');
                        currentChatFriend = null;
                        showInfo('Friend Removed', 'You have been removed from this friendship');
                    }

                    await updateConversationsList();
                }
            })
            .on('broadcast', { event: 'user_blocked' }, async (payload) => {
                const { blockedBy, blockedUser } = payload.payload;

                if (blockedUser === currentUser.id) {
                    delete friends[blockedBy];

                    if (currentChatFriend && currentChatFriend.id === blockedBy) {
                        ui.chatView.classList.add('hidden');
                        ui.welcomeScreen.classList.remove('hidden');
                        currentChatFriend = null;
                        showInfo('Blocked', 'You have been blocked by this user');
                    }

                    await updateConversationsList();
                }
            })
            .subscribe((status) => {
            });

        subscriptions.push(personalChannel);

        const dbChannel = supabase
            .channel('db-friendship-changes')
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'friendships',
                filter: `user_id=eq.${currentUser.id}`
            }, async (payload) => {
                const friendId = payload.old.friend_id;
                if (friends[friendId]) {
                    delete friends[friendId];
                    if (currentChatFriend?.id === friendId) {
                        ui.chatView.classList.add('hidden');
                        ui.welcomeScreen.classList.remove('hidden');
                        currentChatFriend = null;
                    }
                    await updateConversationsList();
                }
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'friendships',
                filter: `friend_id=eq.${currentUser.id}`
            }, async (payload) => {
                const friendId = payload.old.user_id;
                if (friends[friendId]) {
                    delete friends[friendId];
                    if (currentChatFriend?.id === friendId) {
                        ui.chatView.classList.add('hidden');
                        ui.welcomeScreen.classList.remove('hidden');
                        currentChatFriend = null;
                    }
                    await updateConversationsList();
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'blocked_users',
                filter: `blocked_user_id=eq.${currentUser.id}`
            }, async (payload) => {
                const blockerId = payload.new.user_id;
                if (friends[blockerId]) {
                    delete friends[blockerId];
                    if (currentChatFriend?.id === blockerId) {
                        ui.chatView.classList.add('hidden');
                        ui.welcomeScreen.classList.remove('hidden');
                        currentChatFriend = null;
                    }
                    await updateConversationsList();
                }
            })
            .subscribe((status) => {
            });

        subscriptions.push(dbChannel);
    }
    function closeAllModals() {
        ui.modalContainer.classList.add('hidden');
        ui.addFriendModal?.classList.add('hidden');
        ui.friendRequestsModal?.classList.add('hidden');
        ui.incomingCallModal?.classList.add('hidden');
        ui.confirmationModal?.classList.add('hidden');
        ui.infoModal?.classList.add('hidden');
        ui.chatOptionsModal?.classList.add('hidden');
        ui.friendProfileModal?.classList.add('hidden');
        ui.changeUsernameModal?.classList.add('hidden');
        ui.editMessageModal?.classList.add('hidden');
        ui.createServerModal?.classList.add('hidden');
        ui.joinServerModal?.classList.add('hidden');
        ui.serverInfoModal?.classList.add('hidden');
        ui.blockedUsersModal?.classList.add('hidden');
    }

    function showInfo(title, message) {
        closeAllModals();
        ui.infoTitle.textContent = title;
        ui.infoMessage.textContent = message;
        ui.infoModal.style.zIndex = '10003';
        ui.modalContainer.style.zIndex = '10002';
        ui.infoModal.classList.remove('hidden');
        ui.modalContainer.classList.remove('hidden');
    }

    function showConfirmation(title, message, onConfirm) {
        closeAllModals();
        ui.confirmationTitle.textContent = title;
        ui.confirmationMessage.textContent = message;
        ui.confirmationModal.classList.remove('hidden');
        ui.modalContainer.classList.remove('hidden');

        ui.confirmBtn.onclick = () => {
            onConfirm();
            closeAllModals();
        };
    }

    async function switchTab(tab) {
        currentTab = tab;
        updateURLPath(tab);

        const sidebarTitle = document.getElementById('sidebar-title');
        if (sidebarTitle) {
            sidebarTitle.textContent = tab === 'personal' ? 'Messages' : 'Servers';
        }

        const addFriendBtn = document.getElementById('add-friend-btn');
        if (addFriendBtn) {
            if (tab === 'global') {
                addFriendBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
                addFriendBtn.onclick = () => {
                    closeAllModals();
                    ui.createServerModal.classList.remove('hidden');
                    ui.modalContainer.classList.remove('hidden');
                };
            } else {
                addFriendBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i>';
                addFriendBtn.onclick = () => {
                    showModal(ui.addFriendModal);
                };
            }
        }

        document.querySelectorAll('.navbar-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.querySelectorAll('.personal-only').forEach(el => {
            el.classList.toggle('hidden', tab !== 'personal');
        });

        document.querySelectorAll('.global-only').forEach(el => {
            el.classList.toggle('hidden', tab !== 'global');
        });

        currentChatFriend = null;
        currentServer = null;

        ui.welcomeScreen.classList.remove('hidden');
        ui.chatView.classList.add('hidden');

        unsubscribeFromServerMessages();

        if (tab === 'global') {
            await loadServers();
        } else if (tab === 'personal') {
            renderConversationsList();
        }
    }

    document.querySelectorAll('.navbar-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await switchTab(btn.dataset.tab);
        });
    });

    ui.createServerBtn?.addEventListener('click', () => {
        closeAllModals();
        ui.createServerModal.classList.remove('hidden');
        ui.modalContainer.classList.remove('hidden');
    });

    ui.infoOkBtn?.addEventListener('click', () => {
        closeAllModals();
    });

    ui.serverPrivateToggle?.addEventListener('change', () => {
        ui.serverPasswordGroup.style.display = ui.serverPrivateToggle.checked ? 'block' : 'none';
        if (!ui.serverPrivateToggle.checked) {
            ui.serverPasswordInput.value = '';
        }
    });

    ui.createServerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = ui.serverNameInput.value.trim();
        const isPrivate = ui.serverPrivateToggle.checked;
        const password = isPrivate ? ui.serverPasswordInput.value : null;

        if (!name) return;
        if (isPrivate && !password) {
            showInfo('Error', 'Please enter a password for private server');
            return;
        }

        try {
            const { data, error } = await supabaseClient.from('servers').insert({
                name,
                owner_id: currentUser.id,
                is_private: isPrivate,
                password: password,
                created_at: new Date().toISOString()
            }).select().single();

            if (error) throw error;

            await supabaseClient.from('server_members').insert({
                server_id: data.id,
                user_id: currentUser.id,
                joined_at: new Date().toISOString()
            });

            ui.serverNameInput.value = '';
            ui.serverPrivateToggle.checked = false;
            ui.serverPasswordInput.value = '';
            closeAllModals();
            loadServers();
            showInfo('Success', 'Server created successfully');
        } catch (error) {
            showInfo('Error', error.message);
        }
    });

    async function loadServers() {
        try {
            const { data, error } = await supabaseClient
                .from('servers')
                .select(`
                *,
                server_members(count)
            `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            servers = data || [];
            if (currentTab === 'global') {
                renderConversationsList();
            }
        } catch (error) {
        }
    }

    function renderServers() {
        renderConversationsList();
    }

    window.joinServer = joinServer;

    async function joinServer(server) {
        try {
            const { data: membership } = await supabaseClient
                .from('server_members')
                .select()
                .eq('server_id', server.id)
                .eq('user_id', currentUser.id)
                .single();

            if (membership) {
                openServerChat(server);
            } else {
                if (server.is_private) {
                    selectedServerForJoin = server;
                    closeAllModals();
                    ui.joinServerModal.classList.remove('hidden');
                    ui.modalContainer.classList.remove('hidden');
                } else {
                    await addMemberToServer(server.id);
                    openServerChat(server);
                }
            }
        } catch (error) {
        }
    }

    ui.joinServerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = ui.serverPasswordJoin.value;

        if (!selectedServerForJoin) return;

        if (password === selectedServerForJoin.password) {
            await addMemberToServer(selectedServerForJoin.id);
            openServerChat(selectedServerForJoin);
            ui.serverPasswordJoin.value = '';
            closeAllModals();
        } else {
            showInfo('Error', 'Incorrect password');
        }
    });

    async function addMemberToServer(serverId) {
        await supabaseClient.from('server_members').insert({
            server_id: serverId,
            user_id: currentUser.id,
            joined_at: new Date().toISOString()
        });
        loadServers();
    }

    document.getElementById('open-navbar-btn')?.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            ui.sidebar.classList.add('open');
        }
    });

    async function openServerChat(server) {
        currentServer = server;
        currentChatFriend = null;
        currentChatType = 'server';

        updateURLPath(`server/${server.id}`);
        document.querySelectorAll('.friend-item').forEach(item => item.classList.remove('active'));

        ui.welcomeScreen.classList.add('hidden');
        ui.chatView.classList.remove('hidden');

        if (window.innerWidth <= 768) {
            ui.sidebar.classList.add('hidden');
            ui.chatContainer.classList.add('active');
        }

        setTimeout(() => {
            ui.messagesContainer.scrollTop = ui.messagesContainer.scrollHeight;
        }, 100);

        ui.chatFriendName.textContent = server.name;
        ui.chatStatusText.textContent = '';
        ui.chatFriendStatus.style.display = 'none';

        document.querySelectorAll('.personal-chat-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.server-chat-only').forEach(el => el.classList.remove('hidden'));

        const initials = server.name.substring(0, 2).toUpperCase();
        ui.chatAvatar.textContent = initials;
        ui.chatAvatar.style.background = 'var(--primary-accent)';

        if (window.innerWidth <= 768) {
            ui.sidebar.classList.remove('open');
        }
        await loadServerMessages(server.id);
        subscribeToServerMessages(server.id);
    }

    let serverMessagesSubscription = null;

    function subscribeToServerMessages(serverId) {
        unsubscribeFromServerMessages();

        const channelName = `server_messages_${serverId}`;

        serverMessagesSubscription = supabaseClient
            .channel(channelName, {
                config: {
                    broadcast: { self: true }
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'server_messages',
                filter: `server_id=eq.${serverId}`
            }, async (payload) => {
                const { data: userData } = await supabaseClient
                    .from(currentUser.table_name || 'profiles')
                    .select('username, avatar_url')
                    .eq('id', payload.new.user_id)
                    .single();

                displayServerMessage({ ...payload.new, username: userData?.username, avatar_url: userData?.avatar_url });
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'server_messages',
                filter: `server_id=eq.${serverId}`
            }, (payload) => {
                const msgElement = document.querySelector(`[data-message-id="${payload.new.id}"]`);
                if (msgElement) {
                    const contentElement = msgElement.querySelector('.message-content');
                    if (contentElement) {
                        contentElement.innerHTML = `${escapeHtml(payload.new.content)}<span class="message-edited" style="font-size: 0.75rem; color: var(--secondary-text); margin-left: 0.5rem;">(edited)</span>`;
                    }
                }
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'server_messages',
                filter: `server_id=eq.${serverId}`
            }, (payload) => {
                removeMessageFromUI(payload.old.id);
            })
            .subscribe((status, err) => {
                if (err) {
                }
                if (status === 'SUBSCRIBED') {
                }
            });
    }

    function unsubscribeFromServerMessages() {
        if (serverMessagesSubscription) {
            supabaseClient.removeChannel(serverMessagesSubscription);
            serverMessagesSubscription = null;
        }
    }

    async function loadServerMessages(serverId) {
        showSkeletonMessages();

        try {
            const { data, error } = await supabaseClient
                .from('server_messages')
                .select('*')
                .eq('server_id', serverId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const userIds = [...new Set((data || []).map(msg => msg.user_id))];
            const userPromises = userIds.map(async (userId) => {
                const { data: userData } = await supabaseClient
                    .from(currentUser.table_name || 'profiles')
                    .select('username, avatar_url')
                    .eq('id', userId)
                    .single();
                return { userId, username: userData?.username, avatar_url: userData?.avatar_url };
            });

            const userResults = await Promise.all(userPromises);
            const userMap = userResults.reduce((acc, { userId, username, avatar_url }) => {
                acc[userId] = { username: username || 'Unknown', avatar_url };
                return acc;
            }, {});

            renderAllServerMessages(data || [], userMap);
        } catch (error) {
            ui.messagesContainer.innerHTML = '';
        }
    }

    function displayServerMessage(msg) {
        if (document.querySelector(`[data-message-id="${msg.id}"]`)) {
            return;
        }

        const messageDiv = createServerMessageElement(msg, msg.username || 'Unknown');
        ui.messagesContainer.appendChild(messageDiv);
        ui.messagesContainer.scrollTop = ui.messagesContainer.scrollHeight;
    }

    ui.serverInfoBtn?.addEventListener('click', async () => {
        if (!currentServer) return;

        try {
            const { data: owner } = await supabaseClient
                .from(currentUser.table_name || 'profiles')
                .select('username')
                .eq('id', currentServer.owner_id)
                .single();

            const { data: memberIds, error: membersError } = await supabaseClient
                .from('server_members')
                .select('user_id')
                .eq('server_id', currentServer.id);

            if (membersError) throw membersError;

            const members = [];
            for (const member of memberIds || []) {
                const { data: userData } = await supabaseClient
                    .from(currentUser.table_name || 'profiles')
                    .select('username, avatar_url')
                    .eq('id', member.user_id)
                    .single();

                members.push({
                    user_id: member.user_id,
                    username: userData?.username || 'Unknown',
                    avatar_url: userData?.avatar_url
                });
            }


            closeAllModals();
            ui.serverInfoName.textContent = currentServer.name;
            ui.serverOwnerName.textContent = owner?.username || 'Unknown';
            ui.serverType.textContent = currentServer.is_private ? 'Private' : 'Public';

            ui.serverMembersList.innerHTML = '';
            members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'member-item';

                const username = member.username;
                const isOwner = member.user_id === currentServer.owner_id;
                const initials = username.substring(0, 2).toUpperCase();

                memberDiv.innerHTML = `
                <div class="member-avatar">${member.avatar_url ? `<img src="${member.avatar_url}" alt="${member.username}">` : initials}</div>
                <div class="member-info">
                    <span class="member-name">${username}</span>
                    <span class="member-role">${isOwner ? 'Owner' : 'Member'}</span>
                </div>
                ${currentUser.id === currentServer.owner_id && !isOwner ? `
                    <div class="member-actions">
                        <button onclick="kickMember('${member.user_id}')">Kick</button>
                    </div>
                ` : ''}
            `;

                ui.serverMembersList.appendChild(memberDiv);
            });

            ui.serverOwnerActions.style.display = currentUser.id === currentServer.owner_id ? 'block' : 'none';
            ui.serverInfoModal.classList.remove('hidden');
            ui.modalContainer.classList.remove('hidden');
        } catch (error) {
        }
    });

    window.kickMember = async function (userId) {
        if (!currentServer) return;

        try {
            await supabaseClient
                .from('server_members')
                .delete()
                .eq('server_id', currentServer.id)
                .eq('user_id', userId);

            ui.serverInfoBtn.click();
            showInfo('Success', 'Member kicked');
        } catch (error) {
            showInfo('Error', error.message);
        }
    };

    ui.deleteServerBtn?.addEventListener('click', async () => {
        if (!currentServer) return;

        showConfirmation(
            'Delete Server',
            'Are you sure? This cannot be undone.',
            async () => {
                try {
                    await supabaseClient.from('servers').delete().eq('id', currentServer.id);
                    closeAllModals();
                    switchTab('global');
                    showInfo('Success', 'Server deleted');
                } catch (error) {
                    showInfo('Error', error.message);
                }
            }
        );
    });

    ui.searchInput?.addEventListener('input', () => {
        if (currentTab === 'global') {
            renderServers();
        } else {
            renderConversationsList();
        }
    });

    const HEARTBEAT_INTERVAL = 3000;
    let heartbeatTimer = null;
    let isTabVisible = true;

    let touchStartX = 0;
    let touchStartY = 0;
    let currentSwipeElement = null;

    let activeCallInvite = null;
    let callRetryInterval = null;
    let callInviteTimeout = null;

    function initializeMessageSwipe() {
        const messagesContainer = ui.messagesContainer;
        if (!messagesContainer) {
            return;
        }

        messagesContainer.addEventListener('touchstart', (e) => {
            const messageElement = e.target.closest('.message');
            if (!messageElement) return;

            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            currentSwipeElement = messageElement;
        });

        messagesContainer.addEventListener('touchmove', (e) => {
            if (!currentSwipeElement) return;

            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = touchX - touchStartX;
            const deltaY = touchY - touchStartY;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                e.preventDefault();
            }

            const maxSwipe = 100;
            currentSwipeElement.style.transform = '';

            const timestamp = currentSwipeElement.querySelector('.message-timestamp-reveal');
            if (timestamp) {
                const opacity = Math.min(Math.abs(deltaX) / maxSwipe, 1);
                timestamp.style.opacity = opacity;
            }
        }, { passive: false });

        messagesContainer.addEventListener('touchend', () => {
            if (currentSwipeElement) {
                currentSwipeElement.style.transform = '';
                const timestamp = currentSwipeElement.querySelector('.message-timestamp-reveal');
                if (timestamp) {
                    setTimeout(() => { timestamp.style.opacity = '0'; }, 300);
                }
                currentSwipeElement = null;
            }
        });
    }

    document.addEventListener('visibilitychange', () => {
        isTabVisible = !document.hidden;
        if (isTabVisible) {
            if (currentUser) {
                updateUserPresence();
            }
            if (currentUser) {
                updateUserPresence();
            }
        }
    });

    function startHeartbeat() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(async () => {
            if (currentUser && userSettings.onlineStatus) {
                await supabase.from('profiles').update({
                    last_seen: new Date().toISOString(),
                    is_online: true
                }).eq('id', currentUser.id);
            }
        }, HEARTBEAT_INTERVAL);
    }

    async function updateUserPresence() {
        if (currentUser && userSettings.onlineStatus) {
            await supabase.from('profiles').update({
                last_seen: new Date().toISOString(),
                is_online: true
            }).eq('id', currentUser.id);
        }
    }

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    ui.callBtn.onclick = async () => {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            if (!currentChatFriend) {
                showInfoModal('Error', 'Please select a friend to call.');
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                }
                return;
            }

            ui.callSection.classList.remove('hidden');
            ui.chatView.classList.add('hidden');

            const localVideo = document.createElement('video');
            localVideo.srcObject = localStream;
            localVideo.autoplay = true;
            localVideo.muted = true;
            localVideo.playsInline = true;
            localVideo.id = 'local-video';

            ui.videoGrid.innerHTML = '';
            ui.videoGrid.appendChild(localVideo);

            const callChannel = supabase.channel(`call-invite-${currentChatFriend.id}`);
            callChannel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await callChannel.send({
                        type: 'broadcast',
                        event: 'incoming_call',
                        payload: {
                            callerId: currentUser.id,
                            callerName: currentUser.username,
                            callerAvatar: currentUser.avatar_url,
                            callerPeerId: peer.id
                        }
                    });
                }
            });

            isInCall = true;

        } catch (error) {
            const isHTTP = window.location.protocol === 'http:' && window.location.hostname !== 'localhost';

            if (error.name === 'NotAllowedError') {
                if (isHTTP) {
                    showInfoModal('HTTPS Required', 'Video calling requires HTTPS. Please access this site via HTTPS or use localhost. For development, you can use ngrok or enable chrome://flags/#unsafely-treat-insecure-origin-as-secure');
                } else {
                    showInfoModal('Permission Denied', 'Camera and microphone access was denied. Please allow access in your browser settings and try again.');
                }
            } else if (error.name === 'NotFoundError') {
                showInfoModal('Device Not Found', 'No camera or microphone found. Please connect a device and try again.');
            } else {
                showInfoModal('Error', isHTTP ? 'Cannot access camera/microphone over HTTP. Please use HTTPS or localhost.' : 'Could not access camera/microphone. Please check your permissions and try again.');
            }
        }
    };

    if (ui.chatOptionsBtn) {
        ui.chatOptionsBtn.onclick = () => {
            if (currentChatType === 'friend' && currentChatFriend) {
                const friendOptionsHTML = `
            <h2>Chat Options</h2>
            <div class="friend-options-list">
                <button class="option-btn" id="view-profile-btn-dynamic">
                    <i class="fa-solid fa-user"></i>
                    <span>View Profile</span>
                </button>
                <button class="option-btn" id="mute-conversation-btn-dynamic">
                    <i class="fa-solid fa-bell-slash"></i>
                    <span>Mute Conversation</span>
                </button>
                <button class="option-btn" id="block-user-btn-dynamic">
                    <i class="fa-solid fa-ban"></i>
                    <span>Block User</span>
                </button>
                <button class="option-btn danger" id="unfriend-btn-dynamic">
                    <i class="fa-solid fa-user-minus"></i>
                    <span>Remove Friend</span>
                </button>
            </div>
        `;

                ui.chatOptionsModal.innerHTML = friendOptionsHTML;
                showModal(ui.chatOptionsModal);

                document.getElementById('view-profile-btn-dynamic').onclick = ui.viewProfileBtn.onclick;
                document.getElementById('block-user-btn-dynamic').onclick = ui.blockUserBtn.onclick;

            } else if (currentChatType === 'server' && currentServer) {
                const serverOptionsHTML = `
            <h2>Server Options</h2>
            <div class="friend-options-list">
                <button class="option-btn" id="server-info-btn-dynamic">
                    <i class="fa-solid fa-info-circle"></i>
                    <span>Server Info</span>
                </button>
                <button class="option-btn" id="mute-server-btn-dynamic">
                    <i class="fa-solid fa-bell-slash"></i>
                    <span>Mute Server</span>
                </button>
                <button class="option-btn danger" id="leave-server-btn-dynamic">
                    <i class="fa-solid fa-right-from-bracket"></i>
                    <span>Leave Server</span>
                </button>
            </div>
        `;

                ui.chatOptionsModal.innerHTML = serverOptionsHTML;
                showModal(ui.chatOptionsModal);

                document.getElementById('server-info-btn-dynamic').onclick = () => {
                    hideModal();
                    ui.serverInfoBtn.click();
                };

                document.getElementById('leave-server-btn-dynamic').onclick = async () => {
                    showConfirmation(
                        'Leave Server',
                        `Are you sure you want to leave ${currentServer.name}?`,
                        async () => {
                            try {
                                await supabaseClient
                                    .from('server_members')
                                    .delete()
                                    .eq('server_id', currentServer.id)
                                    .eq('user_id', currentUser.id);

                                hideModal();
                                switchTab('global');
                                showInfo('Success', 'Left server successfully');
                            } catch (error) {
                                showInfo('Error', error.message);
                            }
                        }
                    );
                };
            }
        };
    }

    function showChatOptions() {
        if (currentChatType === 'friend' && currentChatFriend) {
            const friendOptionsHTML = `
            <h2>Chat Options</h2>
            <div class="friend-options-list">
                <button class="option-btn" id="view-profile-btn-dynamic">
                    <i class="fa-solid fa-user"></i>
                    <span>View Profile</span>
                </button>
                <button class="option-btn" id="mute-conversation-btn-dynamic">
                    <i class="fa-solid fa-bell-slash"></i>
                    <span>Mute Conversation</span>
                </button>
                <button class="option-btn" id="block-user-btn-dynamic">
                    <i class="fa-solid fa-ban"></i>
                    <span>Block User</span>
                </button>
                <button class="option-btn danger" id="unfriend-btn-dynamic">
                    <i class="fa-solid fa-user-minus"></i>
                    <span>Remove Friend</span>
                </button>
            </div>
        `;

            ui.chatOptionsModal.innerHTML = friendOptionsHTML;
            showModal(ui.chatOptionsModal);

            document.getElementById('view-profile-btn-dynamic').onclick = ui.viewProfileBtn.onclick;
            document.getElementById('block-user-btn-dynamic').onclick = ui.blockUserBtn.onclick;

        } else if (currentChatType === 'server' && currentServer) {
            ui.serverInfoBtn.click();
        }
    }

    const showAuth = (show) => ui.authContainer.classList.toggle('hidden', !show);
    const showApp = (show) => ui.mainApp.classList.toggle('hidden', !show);

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

        ui.themeToggle.onchange = () => {
            userSettings.theme = ui.themeToggle.checked ? 'dark' : 'light';
            saveSettings();
            applySettings();
        };
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
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun.services.mozilla.com' }
                ],
                iceCandidatePoolSize: 10
            },
            debug: 1
        });

        peer.on('open', async (id) => {
            await supabase.from('profiles').update({ peer_id: id }).eq('id', userId);
            ui.callBtn.disabled = false;
        });

        peer.on('call', (call) => {
            mediaConnection = call;
            handleIncomingCall(call);
        });

        peer.on('disconnected', () => {
            if (!peer.destroyed) {
                setTimeout(() => {
                    if (peer && !peer.destroyed) {
                        peer.reconnect();
                    }
                }, 1000);
            }
        });

        peer.on('error', (error) => {
            if (error.type === 'peer-unavailable') {
                return;
            }

            if (error.type === 'network' || error.type === 'server-error') {
                setTimeout(() => {
                    if (peer && peer.destroyed) {
                        initializePeer(userId);
                    }
                }, 3000);
            }

            if (isInCall) {
                showInfoModal('Connection Error', 'Call connection lost. Please try again.');
                endCall();
            }
        });
    };

    const handleAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            const loaded = await loadUserData(session.user.id);

            if (!loaded) {
                await supabase.auth.signOut();
                showAuth(true);
                showInfoModal('Account Error', 'Your account could not be loaded. Please sign in again.');
                return;
            }

            showApp(true);

            await loadNotifications();
        } else {
            showAuth(true);
        }
    };

    const loadUserData = async (userId) => {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error || !profile) {
                return false;
            }

            if (!profile.avatar_url) {
                const defaultAvatars = [
                    '/images/avatar-image.png',
                    '/images/avatar-image-2.png',
                    '/images/avatar-image-3.png',
                    '/images/avatar-image-4.png',
                    '/images/avatar-image-5.png',
                    '/images/avatar-image-6.png'
                ];
                const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

                await supabase
                    .from('profiles')
                    .update({ avatar_url: randomAvatar })
                    .eq('id', userId);

                profile.avatar_url = randomAvatar;
            }

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
            await loadFriendRequests();
            await loadBlockedUsers();
            await updateConversationsList();
            await checkPendingCallInvites();

            subscribeToPresence();
            subscribeToMessages();
            subscribeToMessageBroadcasts();
            subscribeToProfileUpdates();
            subscribeToCallInvites();
            subscribeToFriendRequests();
            subscribeToFriendships();

            initializePeer(userId);
            startKeepAlive();
            startHeartbeat();
            loadSettings();

            setTimeout(() => {
                handleRouting();
            }, 500);

            return true;
        } catch (error) {
            return false;
        }
    };

    let loadFriendsTimeout = null;
    let isLoadingFriends = false;

    const updateConversationsList = async () => {
        if (isUpdatingConversations) {
            return;
        }

        isUpdatingConversations = true;

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

        conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (currentTab === 'personal') {
            renderConversationsList();
        }

        clearTimeout(updateConversationsTimeout);
        updateConversationsTimeout = setTimeout(() => {
            isUpdatingConversations = false;
        }, 500);
    };

    const loadFriends = async () => {
        if (isLoadingFriends) {
            return;
        }

        isLoadingFriends = true;

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

        friends = Object.create(null);

        const uniqueFriendIds = new Set();

        (friendships || []).forEach(f => {
            const friend = f.friend;
            if (friend && friend.id !== currentUser.id && !uniqueFriendIds.has(friend.id)) {
                friends[friend.id] = friend;
                uniqueFriendIds.add(friend.id);
            }
        });

        (reverseFriendships || []).forEach(f => {
            const friend = f.friend;
            if (friend && friend.id !== currentUser.id && !uniqueFriendIds.has(friend.id)) {
                friends[friend.id] = friend;
                uniqueFriendIds.add(friend.id);
            }
        });

        clearTimeout(loadFriendsTimeout);
        loadFriendsTimeout = setTimeout(() => {
            isLoadingFriends = false;
        }, 500);
    };

    const initializeFileAttachment = () => {
        const attachBtn = document.getElementById('attach-file-btn');
        const fileInput = ui.fileInput;
        if (!attachBtn || !fileInput) {
            return;
        }

        attachBtn.onclick = () => {
            fileInput.click();
        };

        fileInput.onchange = (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            files.forEach(file => {
                if (!pendingFiles.find(f => f.name === file.name && f.size === file.size)) {
                    pendingFiles.push(file);
                } else {
                }
            });
            renderFilePreview();
            e.target.value = '';
        };

    };

    const renderFilePreview = () => {

        const filePreview = document.getElementById('file-attachment-preview');

        if (!filePreview) {
            return;
        }

        if (pendingFiles.length === 0) {
            filePreview.classList.add('hidden');
            return;
        }

        filePreview.classList.remove('hidden');
        filePreview.innerHTML = '';

        pendingFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-attachment-item';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-attachment-remove';
            removeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
            removeBtn.onclick = (e) => {
                e.preventDefault();
                pendingFiles.splice(index, 1);
                renderFilePreview();
            };

            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.alt = file.name;
                fileItem.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.muted = true;
                fileItem.appendChild(video);
            } else if (file.type.startsWith('audio/')) {
                fileItem.classList.add('file-type');
                fileItem.innerHTML = `
                <i class="fa-solid fa-music"></i>
                <span class="file-name">${file.name}</span>
            `;
            } else {
                fileItem.classList.add('file-type');
                const icon = getFileIcon(file.type, file.name);
                fileItem.innerHTML = `
                <i class="fa-solid ${icon}"></i>
                <span class="file-name">${file.name}</span>
            `;
            }

            fileItem.appendChild(removeBtn);
            filePreview.appendChild(fileItem);
        });

    };

    const getFileIcon = (mimeType, fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();

        if (mimeType.includes('pdf') || ext === 'pdf') return 'fa-file-pdf';
        if (mimeType.includes('word') || ['doc', 'docx'].includes(ext)) return 'fa-file-word';
        if (mimeType.includes('excel') || ['xls', 'xlsx'].includes(ext)) return 'fa-file-excel';
        if (mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint';
        if (mimeType.includes('zip') || mimeType.includes('rar') || ['zip', 'rar', '7z'].includes(ext)) return 'fa-file-zipper';
        if (['txt', 'md'].includes(ext)) return 'fa-file-lines';
        if (['json', 'xml', 'html', 'css', 'js'].includes(ext)) return 'fa-file-code';

        return 'fa-file';
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

        if (incoming && incoming.length > 0) {
            const requesterIds = incoming.map(req => req.user_id);

            const { data: blocks } = await supabase
                .from('blocked_users')
                .select('*')
                .or(`and(user_id.eq.${currentUser.id},blocked_user_id.in.(${requesterIds.join(',')})),and(user_id.in.(${requesterIds.join(',')}),blocked_user_id.eq.${currentUser.id})`);

            if (blocks && blocks.length > 0) {
                const blockedUserIds = new Set();
                blocks.forEach(block => {
                    if (block.user_id === currentUser.id) {
                        blockedUserIds.add(block.blocked_user_id);
                    } else {
                        blockedUserIds.add(block.user_id);
                    }
                });

                const invalidRequestIds = incoming
                    .filter(req => blockedUserIds.has(req.user_id))
                    .map(req => req.id);

                if (invalidRequestIds.length > 0) {
                    await supabase
                        .from('friendships')
                        .delete()
                        .in('id', invalidRequestIds);
                }

                friendRequests = incoming.filter(req => !blockedUserIds.has(req.user_id));
            } else {
                friendRequests = incoming || [];
            }
        } else {
            friendRequests = [];
        }
    };

    const loadBlockedUsers = async () => {
        const { data: blocks } = await supabase
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', currentUser.id);

        blockedUsers = new Set((blocks || []).map(b => b.blocked_user_id));
    };

    const subscribeToFriendRequests = () => {
        if (!currentUser || !currentUser.id) return;

        const channel = supabase.channel(`friend-requests-${currentUser.id}`);

        channel
            .on('broadcast', { event: 'friend_request' }, async (payload) => {
                await loadFriendRequests();
                await updateConversationsList();
                showNotification('New friend request received!');
            })
            .on('broadcast', { event: 'friend_accepted' }, async (payload) => {
                await loadFriends();
                await updateConversationsList();
                showNotification('Friend request accepted!');
            })
            .on('broadcast', { event: 'friend_removed' }, async (payload) => {
                await loadFriends();
                await updateConversationsList();
            })
            .on('broadcast', { event: 'request_declined' }, async (payload) => {
                await loadFriendRequests();
                await updateConversationsList();
            })
            .subscribe((status) => {
            });

        subscriptions.push(channel);
    };

    const subscribeToFriendships = () => {
        if (!currentUser || !currentUser.id) return;

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

    const subscribeToCallInvites = () => {
        if (!currentUser || !currentUser.id) return;

        const channel = supabase.channel(`call-invite-${currentUser.id}`);

        channel
            .on('broadcast', { event: 'incoming_call' }, async (payload) => {
                const callerData = payload.payload;

                if (isInCall && incomingCallData?.from === callerData.callerId) {
                    return;
                }

                if (isInCall) {
                    await channel.send({
                        type: 'broadcast',
                        event: 'call_declined',
                        payload: {
                            declinedBy: currentUser.id,
                            callerId: callerData.callerId
                        }
                    });
                    return;
                }
                incomingCallData = {
                    from: callerData.callerId,
                    peerId: callerData.callerPeerId,
                    callerName: callerData.callerName,
                    callerAvatar: callerData.callerAvatar
                };

                ui.callerName.textContent = callerData.callerName;
                ui.callerAvatar.textContent = callerData.callerName[0].toUpperCase();
                if (callerData.callerAvatar) {
                    ui.callerAvatar.innerHTML = `<img src="${callerData.callerAvatar}" alt="${callerData.callerName}">`;
                }

                showModal(ui.incomingCallModal);

                incomingCallTimeout = setTimeout(() => {
                    if (!isInCall && incomingCallData) {
                        hideModal();
                        ui.incomingCallAudio.pause();
                        ui.incomingCallAudio.currentTime = 0;
                        incomingCallData = null;
                    }
                }, 30000);
            })
            .on('broadcast', { event: 'call_cancelled' }, (payload) => {
                if (incomingCallData?.from === payload.payload.callerId) {
                    hideModal();
                    ui.incomingCallAudio.pause();
                    ui.incomingCallAudio.currentTime = 0;
                    incomingCallData = null;
                    if (incomingCallTimeout) {
                        clearTimeout(incomingCallTimeout);
                    }
                }
            })
            .on('broadcast', { event: 'call_accepted' }, async (payload) => {
                if (activeCallInvite && payload.payload.acceptedBy === activeCallInvite.calleeId) {
                    const { acceptedBy, accepterPeerId } = payload.payload;
                    clearCallInvite();
                    hideOutgoingCallUI();
                    await initiateCallConnection(acceptedBy, accepterPeerId);
                }
            })
            .on('broadcast', { event: 'call_declined' }, async (payload) => {
                if (activeCallInvite && payload.payload.declinedBy === activeCallInvite.calleeId) {
                    clearCallInvite();
                    hideOutgoingCallUI();
                    showInfoModal('Call Declined', 'The user declined your call.');
                    if (localStream) {
                        localStream.getTracks().forEach(track => track.stop());
                        localStream = null;
                    }
                    if (mediaConnection) {
                        mediaConnection.close();
                        mediaConnection = null;
                    }
                }
            })
            .subscribe();

        subscriptions.push(channel);
    };

    const subscribeToPresence = () => {
        if (!currentUser || !currentUser.id) return;

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

    const subscribeToMessages = () => {
        if (!currentUser || !currentUser.id) {
            return;
        }

        const channel = supabase
            .channel(`realtime-messages-${currentUser.id}`)
            .on('broadcast', { event: 'new_message' }, async (payload) => {
                const message = payload.payload;

                if (message.receiver_id === currentUser.id || message.sender_id === currentUser.id) {
                    await handleNewMessage(message);
                }
            })
            .on('broadcast', { event: 'message_updated' }, (payload) => {
                const { messageId, content } = payload.payload;
                updateMessageInUI({ id: messageId, content, edited: true });
            })
            .on('broadcast', { event: 'message_deleted' }, (payload) => {
                const messageId = payload.payload.messageId;
                removeMessageFromUI(messageId);
            })
            .on('broadcast', { event: 'reaction_updated' }, async (payload) => {
                const { messageId, reactions } = payload.payload;
                renderReactions(messageId, reactions || {});
            })
            .subscribe();

        subscriptions.push(channel);
    };

    const subscribeToMessageBroadcasts = () => {
        if (!currentUser || !currentUser.id) return;
        const channel = supabase.channel(`messages-${currentUser.id}`)
            .on('broadcast', { event: 'new_message' }, async (payload) => {
                const messageId = payload.payload.messageId;

                const { data: message, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('id', messageId)
                    .single();
                if (message && !error) {
                    const { data: sender } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', message.sender_id)
                        .single();
                    if (sender && currentChatFriend && currentChatFriend.id === message.sender_id) {
                        displayMessage(message, sender);
                        scrollToBottom();
                    } else {
                    }

                    await updateConversationsList();
                }
            })
            .on('broadcast', { event: 'message_deleted' }, (payload) => {
                const messageId = payload.payload.messageId;
                removeMessageFromUI(messageId);
            })
            .on('broadcast', { event: 'message_updated' }, (payload) => {
                const { messageId, content } = payload.payload;
                const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (msgElement) {
                    const contentElement = msgElement.querySelector('.message-content');
                    if (contentElement) {
                        contentElement.textContent = content;
                        const editedBadge = msgElement.querySelector('.message-edited') || document.createElement('span');
                        editedBadge.className = 'message-edited';
                        editedBadge.textContent = '(edited)';
                        editedBadge.style.cssText = 'font-size: 0.75rem; color: var(--secondary-text); margin-left: 0.5rem;';
                        if (!msgElement.querySelector('.message-edited')) {
                            contentElement.appendChild(editedBadge);
                        }
                    }
                }
            })
            .on('broadcast', { event: 'reaction_updated' }, async (payload) => {
                const { messageId, reactions } = payload.payload;

                const { data: message } = await supabase
                    .from('messages')
                    .select('sender_id, receiver_id')
                    .eq('id', messageId)
                    .single();

                if (message) {
                    const isInCurrentChat = currentChatFriend &&
                        (message.sender_id === currentChatFriend.id || message.receiver_id === currentChatFriend.id);

                    if (isInCurrentChat) {
                        renderReactions(messageId, reactions || {});
                    }
                }
            })
            .subscribe((status) => {
            });

        subscriptions.push(channel);
    };

    const subscribeToProfileUpdates = () => {
        if (!currentUser || !currentUser.id) return;

        const channel = supabase.channel(`profile-updates-${currentUser.id}`);

        channel
            .on('broadcast', { event: 'avatar_updated' }, async (payload) => {
                const userId = payload.payload.userId;
                const avatarUrl = payload.payload.avatarUrl;

                if (friends[userId]) {
                    friends[userId].avatar_url = avatarUrl;
                    await updateConversationsList();

                    if (currentChatFriend && currentChatFriend.id === userId) {
                        currentChatFriend.avatar_url = avatarUrl;
                        if (avatarUrl) {
                            ui.chatAvatar.innerHTML = `<img src="${avatarUrl}" alt="${currentChatFriend.username}">`;
                        } else {
                            ui.chatAvatar.textContent = currentChatFriend.username[0].toUpperCase();
                            ui.chatAvatar.innerHTML = '';
                        }
                    }
                }
            })
            .on('broadcast', { event: 'username_updated' }, async (payload) => {
                const userId = payload.payload.userId;
                const newUsername = payload.payload.username;

                if (friends[userId]) {
                    friends[userId].username = newUsername;
                    await updateConversationsList();

                    if (currentChatFriend && currentChatFriend.id === userId) {
                        currentChatFriend.username = newUsername;
                        ui.chatFriendName.textContent = newUsername;
                    }
                }
            })
            .subscribe((status) => {
            });

        subscriptions.push(channel);
    };

    const checkPendingCallInvites = async () => {
        const { data: pendingCalls } = await supabase
            .from('call_invites')
            .select('*, caller:profiles!call_invites_caller_id_fkey(*)')
            .eq('callee_id', currentUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (pendingCalls && pendingCalls.length > 0) {
            const latestCall = pendingCalls[0];
            const caller = latestCall.caller;

            ui.callerName.textContent = caller.username;
            ui.callerAvatar.textContent = caller.username[0].toUpperCase();
            if (caller.avatar_url) {
                ui.callerAvatar.innerHTML = `<img src="${caller.avatar_url}" alt="${caller.username}">`;
            }

            incomingCallData = { from: caller.id, callInviteId: latestCall.id };
            showModal(ui.incomingCallModal);
            ui.incomingCallAudio.play();
        }
    };

    const handleNewMessage = async (message) => {
        if (blockedUsers.has(message.sender_id)) {
            return;
        }

        const existingElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (existingElement) return;

        const { data: sender } = await supabase.from('profiles').select('*').eq('id', message.sender_id).single();
        if (!sender) return;

        await updateConversationsList();

        if (currentChatType === 'friend' && currentChatFriend &&
            (currentChatFriend.id === message.sender_id || currentChatFriend.id === message.receiver_id)) {
            const displayUser = message.sender_id === currentUser.id ? currentUser : sender;
            displayMessage(message, displayUser);

            if (userSettings.readReceipts && message.sender_id !== currentUser.id) {
                await supabase.from('messages').update({ read: true }).eq('id', message.id);
            }
            scrollToBottom();
        }

        const shouldNotify = message.sender_id !== currentUser.id &&
            (!isTabVisible || (currentChatType !== 'friend' || currentChatFriend?.id !== message.sender_id));

        if (shouldNotify) {
            if (userSettings.notifications && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`New message from ${sender.username}`, {
                    body: message.content || 'Sent a file',
                    icon: sender.avatar_url || '/favicon.ico',
                    tag: message.id
                });
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

    const removeMessageFromUI = (messageId) => {
        const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (msgElement) {
            msgElement.remove();
        }
    };

    let updateConversationsTimeout = null;
    let isUpdatingConversations = false;
    let renderConversationsTimeout = null;
    let isRenderingConversations = false;

    let remoteVideoStates = {};

    const renderConversationsList = () => {
        if (isRenderingConversations) {
            return;
        }

        isRenderingConversations = true;

        ui.contentList.innerHTML = '';

        const searchTerm = ui.searchInput?.value?.toLowerCase() || '';

        if (currentTab === 'personal') {
            const hasFriendRequests = friendRequests.length > 0;
            const hasConversations = conversations.length > 0;

            if (hasFriendRequests || hasConversations) {
                if (hasFriendRequests) {
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'list-header';
                    headerDiv.textContent = `Friend Requests (${friendRequests.length})`;
                    ui.contentList.appendChild(headerDiv);

                    const requestDiv = document.createElement('div');
                    requestDiv.className = 'friend-item';
                    requestDiv.innerHTML = `
                    <div class="avatar"><i class="fa-solid fa-user-plus"></i></div>
                    <div class="friend-info">
                        <div class="friend-name">Pending Requests</div>
                        <div class="friend-status">${friendRequests.length} request${friendRequests.length !== 1 ? 's' : ''}</div>
                    </div>
                `;
                    requestDiv.addEventListener('click', () => {
                        window.showFriendRequestsModal();
                    });
                    ui.contentList.appendChild(requestDiv);
                }

                if (hasConversations) {
                    const filteredConversations = conversations.filter(conv => {
                        if (conv.type === 'friend') {
                            const friend = conv.data;
                            return friend.username.toLowerCase().includes(searchTerm);
                        }
                        return false;
                    });

                    filteredConversations.forEach(conv => {
                        if (conv.type === 'friend') {
                            const friend = conv.data;
                            const isOnline = onlineUsers.has(friend.id);
                            const isBlocked = blockedUsers.has(friend.id);
                            if (!isBlocked) {
                                const friendDiv = document.createElement('div');
                                friendDiv.className = 'friend-item';
                                friendDiv.dataset.friendId = friend.id;

                                friendDiv.innerHTML = `
                                <div class="avatar-wrapper">
                                    <div class="avatar">${friend.avatar_url ? `<img src="${friend.avatar_url}" alt="${friend.username}">` : friend.username[0].toUpperCase()}</div>
                                    <div class="status-indicator ${isOnline ? 'online' : ''}"></div>
                                </div>
                                <div class="friend-info">
                                    <div class="friend-name">${friend.username}</div>
                                    <div class="friend-status">${conv.lastMessage ? (conv.lastMessage.call_duration !== null && conv.lastMessage.call_duration !== undefined ? (conv.lastMessage.call_duration === 0 ? 'Missed call' : `Call • ${formatCallDuration(conv.lastMessage.call_duration)}`) : (conv.lastMessage.sender_id === currentUser.id ? 'You: ' : '') + (conv.lastMessage.content?.substring(0, 30) || 'Sent a file')) : 'No messages yet'}</div>
                                </div>
                            `;

                                friendDiv.addEventListener('click', () => {
                                    currentChatType = 'friend';
                                    currentServer = null;
                                    window.openChat(friend.id, 'friend');
                                });

                                ui.contentList.appendChild(friendDiv);
                            }
                        }
                    });
                }
            }

            if (!hasFriendRequests && !hasConversations) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <i class="fa-regular fa-comment-dots"></i>
                    <h3>No conversations yet</h3>
                    <p>Add friends to start chatting</p>
                    <button id="add-friend-empty" class="btn btn-primary">
                        <i class="fa-solid fa-user-plus"></i> Add Friend
                    </button>
                `;
                ui.contentList.appendChild(emptyState);

                document.getElementById('add-friend-empty')?.addEventListener('click', () => {
                    document.getElementById('add-friend-btn')?.click();
                });
            }
        } else if (currentTab === 'global') {
            const filteredServers = servers.filter(server => {
                return server.name.toLowerCase().includes(searchTerm);
            });

            if (filteredServers.length > 0) {
                filteredServers.forEach(server => {
                    const initials = server.name.substring(0, 2).toUpperCase();
                    const memberCount = server.server_members?.[0]?.count || 0;

                    const serverDiv = document.createElement('div');
                    serverDiv.className = 'server-item';
                    serverDiv.dataset.serverId = server.id;

                    serverDiv.innerHTML = `
    <div class="avatar-wrapper">
        <div class="avatar server-avatar" style="background: var(--primary-accent);">${initials}</div>
    </div>
    <div class="friend-info">
        <div class="server-name">
            ${server.name}
            ${server.is_private ? '<i class="fa-solid fa-lock server-lock-icon"></i>' : ''}
        </div>
        <div class="server-meta">
            <span>Members:</span> <span>${memberCount}</span>
        </div>
    </div>
`;

                    serverDiv.addEventListener('click', () => {
                        joinServer(server);
                    });

                    ui.contentList.appendChild(serverDiv);
                });
            } else {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <i class="fa-solid fa-globe"></i>
                    <h3>No servers found</h3>
                    <p>Try a different search term or create a new server</p>
                    <button id="create-server-empty" class="btn btn-primary">
                        <i class="fa-solid fa-plus"></i> Create Server
                    </button>
                `;
                ui.contentList.appendChild(emptyState);

                document.getElementById('create-server-empty')?.addEventListener('click', () => {
                    hideModal();
                    showModal(ui.createServerModal);
                });
            }
        }

        clearTimeout(renderConversationsTimeout);
        renderConversationsTimeout = setTimeout(() => {
            isRenderingConversations = false;
        }, 500);
    };

    window.showFriendRequestsModal = () => {
        updateURLPath('friend-requests');
        showModal(ui.friendRequestsModal);
        renderFriendRequests();
    };

    window.showFriendRequestsModal = () => {
        updateURLPath('friend-requests');
        showModal(ui.friendRequestsModal);
        renderFriendRequests();
    };

    window.joinServer = joinServer;

    const updateURLPath = (path) => {
        if (window.history && window.history.pushState) {
            window.history.pushState({ path }, '', `/${path}`);
        }
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
                        <button onclick="window.acceptFriendRequest('${request.id}')" style="background-color: var(--tertiary-bg);" title="Accept"><i class="fa-solid fa-check"></i></button>
                        <button onclick="window.declineFriendRequest('${request.id}')" style="background-color: var(--error);" title="Decline"><i class="fa-solid fa-times"></i></button>
                    </div>
                </div>
            `;
        });

        ui.requestsList.innerHTML = html;
    };

    window.acceptFriendRequest = async (requestId) => {
        const { data: request } = await supabase
            .from('friendships')
            .select('user_id, friend_id')
            .eq('id', requestId)
            .single();

        if (!request) {
            return;
        }

        const { data: iBlockedThem } = await supabase
            .from('blocked_users')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('blocked_user_id', request.user_id)
            .maybeSingle();

        if (iBlockedThem) {
            await supabase
                .from('friendships')
                .delete()
                .eq('id', requestId);

            await loadFriendRequests();
            renderFriendRequests();
            showInfo('Cannot accept', 'You have blocked this user.');
            return;
        }

        const { data: theyBlockedMe } = await supabase
            .from('blocked_users')
            .select('*')
            .eq('user_id', request.user_id)
            .eq('blocked_user_id', currentUser.id)
            .maybeSingle();

        if (theyBlockedMe) {
            await supabase
                .from('friendships')
                .delete()
                .eq('id', requestId);

            await loadFriendRequests();
            renderFriendRequests();
            showInfo('Cannot accept', 'This request is no longer valid.');
            return;
        }

        const { error } = await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (error) {
            showInfoModal('Error', 'Failed to accept friend request.');
            return;
        }

        await loadFriends();
        await loadFriendRequests();
        renderFriendRequests();
        await updateConversationsList();

        const notifyChannel = supabase.channel(`friend-requests-${request.user_id}`, {
            config: { broadcast: { self: false } }
        });

        await new Promise((resolve) => {
            notifyChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
            });
        });

        await notifyChannel.send({
            type: 'broadcast',
            event: 'friend_accepted',
            payload: { friendId: currentUser.id }
        });

        supabase.removeChannel(notifyChannel);
    };

    window.declineFriendRequest = async (requestId) => {
        const { data: request } = await supabase
            .from('friendships')
            .select('user_id')
            .eq('id', requestId)
            .single();

        if (!request) {
            return;
        }

        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', requestId);

        if (error) {
            return;
        }

        await loadFriendRequests();
        renderFriendRequests();

        const notifyChannel = supabase.channel(`friend-requests-${request.user_id}`, {
            config: { broadcast: { self: false } }
        });

        await new Promise((resolve) => {
            notifyChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
            });
        });

        await notifyChannel.send({
            type: 'broadcast',
            event: 'request_declined',
            payload: { declinedBy: currentUser.id }
        });

        supabase.removeChannel(notifyChannel);
    };

    window.openChat = async (id, type) => {
        if (isCurrentlyTyping && currentTypingChannel) {
            isCurrentlyTyping = false;
            await currentTypingChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: currentUser.id, isTyping: false }
            });
            currentTypingChannel = null;
            currentTypingFriendId = null;
        }

        ui.typingIndicator.classList.add('hidden');

        currentChatType = type;
        currentServer = null;

        if (type === 'friend') {
            currentChatFriend = friends[id];
            if (!currentChatFriend) {
                return;
            }

            updateURLPath(`chat/${id}`);
            ui.chatAvatar.textContent = currentChatFriend.username[0].toUpperCase();

            await loadMessages(currentChatFriend.id);
            subscribeToTypingIndicators(id);

            const isOnline = onlineUsers.has(currentChatFriend.id);
            ui.chatStatusText.textContent = isOnline ? 'Online' : 'Offline';
            ui.chatStatusText.classList.remove('hidden');

            if (currentChatFriend.avatar_url) {
                ui.chatAvatar.innerHTML = `<img src="${currentChatFriend.avatar_url}" alt="${currentChatFriend.username}">`;
            }

            ui.chatFriendStatus.classList.toggle('online', onlineUsers.has(currentChatFriend.id));
            ui.chatFriendName.textContent = currentChatFriend.username;
            document.querySelectorAll('.personal-chat-only').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.server-chat-only').forEach(el => el.classList.add('hidden'));

            await loadMessages(currentChatFriend.id);
            subscribeToTypingIndicators(id);
        }

        ui.welcomeScreen.classList.add('hidden');
        ui.chatView.classList.remove('hidden');

        const friendInfo = document.querySelector('#chat-header .friend-info');
        if (friendInfo) {
            friendInfo.onclick = showChatOptions;
        }

        initializeMessageSwipe();

        if (window.innerWidth <= 768) {
            ui.sidebar.classList.add('hidden');
            ui.chatContainer.classList.add('active');
        }

        setTimeout(() => {
            ui.messagesContainer.scrollTop = ui.messagesContainer.scrollHeight;
        }, 100);

        document.querySelectorAll('.friend-item').forEach(item => item.classList.remove('active'));
        const activeItem = document.querySelector(`[data-friend-id="${id}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    };

    const subscribeToTypingIndicators = (friendId) => {
        const userId1 = currentUser.id;
        const userId2 = friendId;
        const channelName = `typing-${userId1 < userId2 ? userId1 : userId2}-${userId1 < userId2 ? userId2 : userId1}`;
        const existingChannel = subscriptions.find(sub => sub.topic === `realtime:${channelName}`);
        if (existingChannel) {
            return;
        }

        const typingChannel = supabase.channel(channelName, {
            config: {
                broadcast: { ack: false }
            }
        });

        typingChannel
            .on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.payload.userId !== currentUser.id) {
                    if (payload.payload.isTyping) {
                        ui.typingIndicator.classList.remove('hidden');
                    } else {
                        ui.typingIndicator.classList.add('hidden');
                    }
                }
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setTimeout(() => {
                        subscribeToTypingIndicators(friendId);
                    }, 1000);
                }
            });

        subscriptions.push(typingChannel);
    };

    function showSkeletonMessages() {
        ui.messagesContainer.innerHTML = '';

        const skeletonCount = Math.floor(Math.random() * 4) + 5;

        for (let i = 0; i < skeletonCount; i++) {
            const isSent = Math.random() > 0.5;
            const skeletonDiv = document.createElement('div');
            skeletonDiv.className = `message-skeleton ${isSent ? 'sent' : 'received'}`;

            skeletonDiv.innerHTML = `
                <div class="message-skeleton-content"></div>
                <div class="message-skeleton-time"></div>
            `;

            ui.messagesContainer.appendChild(skeletonDiv);
        }
    }

    function renderAllMessages(messages) {
        ui.messagesContainer.innerHTML = '';

        if (messages.length === 0) return;

        const fragment = document.createDocumentFragment();

        messages.forEach(message => {
            const sender = message.sender_id === currentUser.id ? currentUser : currentChatFriend;
            if (!sender) return;
            const messageDiv = createMessageElement(message, sender);
            fragment.appendChild(messageDiv);
        });

        ui.messagesContainer.appendChild(fragment);

        requestAnimationFrame(() => {
            scrollToBottom();
        });
    }

    function renderAllServerMessages(messages, userMap) {
        ui.messagesContainer.innerHTML = '';

        if (messages.length === 0) return;

        const fragment = document.createDocumentFragment();

        messages.forEach(msg => {
            const userInfo = userMap[msg.user_id] || { username: 'Unknown', avatar_url: null };
            const messageDiv = createServerMessageElement({ ...msg, avatar_url: userInfo.avatar_url }, userInfo.username);
            fragment.appendChild(messageDiv);
        });

        ui.messagesContainer.appendChild(fragment);

        requestAnimationFrame(() => {
            scrollToBottom();
        });
    }

    window.openImageFullscreen = (imageUrl) => {
        const overlay = document.createElement('div');
        overlay.className = 'image-fullscreen-overlay';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Fullscreen image';

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        };

        overlay.appendChild(img);
        document.body.appendChild(overlay);

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    };

    const scrollToMessage = (messageId) => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const messageContent = messageElement.querySelector('.message-content');
            if (messageContent) {
                messageContent.classList.add('message-highlight');

                setTimeout(() => {
                    messageContent.classList.remove('message-highlight');
                }, 1000);
            }
        }
    };

    window.scrollToMessage = scrollToMessage;

    const createMessageElement = (message, sender) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender_id === currentUser.id ? 'sent' : 'received'}`;
        messageDiv.dataset.messageId = message.id;

        const isMobile = window.innerWidth <= 768;
        const isSent = message.sender_id === currentUser.id;

        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = isMobile ? 'position: relative;' : '';

        if (message.reply_to_id) {
            const replyDiv = document.createElement('div');
            replyDiv.className = 'message-reply-context';
            replyDiv.onclick = () => scrollToMessage(message.reply_to_id);

            const replyContent = document.createElement('div');
            replyContent.className = 'message-reply-content';

            const replyAuthor = document.createElement('span');
            replyAuthor.className = 'message-reply-author';
            replyAuthor.textContent = message.sender_id === currentUser.id ? 'You' : (currentChatFriend?.username || 'User');

            const replyText = document.createElement('span');
            replyText.className = 'message-reply-text';
            replyText.textContent = message.reply_to_content || 'Original message';

            replyContent.appendChild(replyAuthor);
            replyContent.appendChild(replyText);
            replyDiv.appendChild(replyContent);
            contentWrapper.appendChild(replyDiv);
        }

        if (message.files && Array.isArray(message.files) && message.files.length > 0) {
            message.files.forEach(file => {
                const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i);
                const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i);

                if (isImage) {
                    const img = document.createElement('img');
                    img.src = file.url;
                    img.alt = file.name;
                    img.className = 'message-image';
                    img.onclick = () => window.openImageFullscreen(file.url);
                    contentWrapper.appendChild(img);
                } else if (isVideo) {
                    const video = document.createElement('video');
                    video.controls = true;
                    video.src = file.url;
                    video.style.cssText = 'max-width: 300px; border-radius: var(--button-border-radius); margin: 0.5rem 0;';
                    contentWrapper.appendChild(video);
                } else if (isAudio) {
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = file.url;
                    audio.className = 'message-audio';
                    audio.style.cssText = 'max-width: 100%; margin: 0.5rem 0;';
                    contentWrapper.appendChild(audio);
                } else {
                    const icon = getFileIcon(file.type, file.name);
                    const fileLink = document.createElement('a');
                    fileLink.href = file.url;
                    fileLink.target = '_blank';
                    fileLink.className = 'message-file';
                    fileLink.style.cssText = 'display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--tertiary-bg); border-radius: var(--button-border-radius); text-decoration: none; color: var(--primary-text); margin: 0.5rem 0;';
                    fileLink.innerHTML = `<i class="fa-solid ${icon}"></i> <div><div>${file.name}</div><div style="font-size: 0.85rem; color: var(--secondary-text);">${formatFileSize(file.size)}</div></div>`;
                    contentWrapper.appendChild(fileLink);
                }
            });
        }

        if (message.file_url) {
            const fileType = message.file_type || 'file';
            if (fileType.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = message.file_url;
                img.alt = 'Image';
                img.className = 'message-image';
                img.onclick = () => window.openImageFullscreen(message.file_url);
                img.style.cssText = 'max-width: 300px; border-radius: var(--button-border-radius); cursor: pointer; display: block;';
                contentWrapper.appendChild(img);
            } else if (fileType.startsWith('audio/')) {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = message.file_url;
                audio.className = 'message-audio';
                audio.style.cssText = 'max-width: 100%;';
                contentWrapper.appendChild(audio);
            } else {
                const fileLink = document.createElement('a');
                fileLink.href = message.file_url;
                fileLink.target = '_blank';
                fileLink.className = 'message-file';
                fileLink.style.cssText = 'display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--tertiary-bg); border-radius: var(--button-border-radius); text-decoration: none; color: var(--primary-text);';
                fileLink.innerHTML = `<i class="fa-solid fa-file"></i> ${message.file_name || 'File'}`;
                contentWrapper.appendChild(fileLink);
            }
        }

        if (message.content) {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';

            const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
            const parts = message.content.split(urlRegex);
            parts.forEach((part, index) => {
                if (part.match(urlRegex)) {
                    let cleanUrl = part;
                    if (part.match(/[.,;:!?)]$/)) {
                        const punctuation = part.slice(-1);
                        cleanUrl = part.slice(0, -1);

                        const link = document.createElement('a');
                        link.href = cleanUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'message-link';
                        link.textContent = cleanUrl;
                        link.onclick = (e) => e.stopPropagation();

                        contentDiv.appendChild(link);
                        contentDiv.appendChild(document.createTextNode(punctuation));
                    } else {
                        const link = document.createElement('a');
                        link.href = cleanUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'message-link';
                        link.textContent = cleanUrl;
                        link.onclick = (e) => e.stopPropagation();

                        contentDiv.appendChild(link);
                    }
                } else if (part) {
                    contentDiv.appendChild(document.createTextNode(part));
                }
            });

            if (message.edited) {
                const editedSpan = document.createElement('span');
                editedSpan.className = 'message-edited';
                editedSpan.style.cssText = 'font-size: 0.75rem; color: var(--secondary-text); margin-left: 0.5rem;';
                editedSpan.textContent = '(edited)';
                contentDiv.appendChild(editedSpan);
            }

            contentWrapper.appendChild(contentDiv);
            addLinkPreviewsToMessage(contentWrapper, message.content);
        }

        if (message.call_duration !== null && message.call_duration !== undefined) {
            const duration = formatCallDuration(message.call_duration);
            const callType = message.call_duration === 0 ? 'Missed call' : 'Call';
            const durationText = message.call_duration === 0 ? '' : ` • ${duration}`;

            const callDiv = document.createElement('div');
            callDiv.className = 'message-call-info';
            callDiv.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; color: var(--secondary-text); font-size: 0.9rem;';
            callDiv.innerHTML = `<i class="fa-solid fa-phone"></i> ${callType}${durationText}`;
            contentWrapper.innerHTML = '';
            contentWrapper.appendChild(callDiv);
        }

        const reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'message-reactions';
        reactionsDiv.dataset.messageId = message.id;
        reactionsDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.25rem;';
        contentWrapper.appendChild(reactionsDiv);

        const timestamp = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isMobile) {
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'message-timestamp-reveal';
            timestampDiv.textContent = timestamp;
            timestampDiv.style.cssText = `
            position: absolute;
            bottom: 0.25rem;
            font-size: 0.75rem;
            color: var(--secondary-text);
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            ${isSent ? 'right: 0.5rem;' : 'left: 0.5rem;'}
        `;

            messageDiv.appendChild(contentWrapper);
            messageDiv.appendChild(timestampDiv);

            setupMessageSwipe(contentWrapper, isSent);
        } else {
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

        messageDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMessageContextMenu(e, message);
        });

        let lastTap = 0;
        const DOUBLE_TAP_DELAY = 300;

        messageDiv.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;

            if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
                e.preventDefault();
                const touch = e.changedTouches[0];
                const event = new MouseEvent('contextmenu', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true,
                    cancelable: true
                });
                messageDiv.dispatchEvent(event);
            }
            lastTap = currentTime;
        }, { passive: false });

        messageDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('message-reaction')) {
                toggleReaction(message.id, e.target.dataset.emoji);
            }
        });

        if (message.reactions) {
            renderReactions(message.id, message.reactions);
        }

        return messageDiv;
    };

    window.replyToServerMessage = (messageId, content) => {
        replyingTo = { id: messageId, content, type: 'server' };
        const displayText = content && content.trim() ? content : 'File';
        ui.replyPreviewText.textContent = displayText.substring(0, 100);
        ui.replyPreview.classList.remove('hidden');
        ui.messageInput.focus();
    };

    function createServerMessageElement(msg, username) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.user_id === currentUser.id ? 'sent' : 'received'}`;
        messageDiv.setAttribute('data-message-id', msg.id);

        const isMobile = window.innerWidth <= 768;
        const isSent = msg.user_id === currentUser.id;

        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = isMobile ? 'position: relative;' : '';

        if (msg.reply_to_id) {
            const replyDiv = document.createElement('div');
            replyDiv.className = 'message-reply-context';
            replyDiv.onclick = () => scrollToMessage(msg.reply_to_id);

            const replyContent = document.createElement('div');
            replyContent.className = 'message-reply-content';

            const replyAuthor = document.createElement('span');
            replyAuthor.className = 'message-reply-author';
            replyAuthor.textContent = msg.user_id === currentUser.id ? 'You' : username;

            const replyText = document.createElement('span');
            replyText.className = 'message-reply-text';
            replyText.textContent = msg.reply_to_content || 'Original message';

            replyContent.appendChild(replyAuthor);
            replyContent.appendChild(replyText);
            replyDiv.appendChild(replyContent);
            contentWrapper.appendChild(replyDiv);
        }

        if (msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
            msg.files.forEach(file => {
                const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i);
                const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i);

                if (isImage) {
                    const img = document.createElement('img');
                    img.src = file.url;
                    img.alt = file.name;
                    img.className = 'message-image';
                    img.onclick = () => window.openImageFullscreen(file.url);
                    contentWrapper.appendChild(img);
                } else if (isVideo) {
                    const video = document.createElement('video');
                    video.controls = true;
                    video.src = file.url;
                    video.style.cssText = 'max-width: 300px; border-radius: var(--button-border-radius); margin: 0.5rem 0;';
                    contentWrapper.appendChild(video);
                } else if (isAudio) {
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = file.url;
                    audio.className = 'message-audio';
                    audio.style.cssText = 'max-width: 100%; margin: 0.5rem 0;';
                    contentWrapper.appendChild(audio);
                } else {
                    const icon = getFileIcon(file.type, file.name);
                    const fileLink = document.createElement('a');
                    fileLink.href = file.url;
                    fileLink.target = '_blank';
                    fileLink.className = 'message-file';
                    fileLink.style.cssText = 'display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--tertiary-bg); border-radius: var(--button-border-radius); text-decoration: none; color: var(--primary-text); margin: 0.5rem 0;';
                    fileLink.innerHTML = `<i class="fa-solid ${icon}"></i> <div><div>${file.name}</div><div style="font-size: 0.85rem; color: var(--secondary-text);">${formatFileSize(file.size)}</div></div>`;
                    contentWrapper.appendChild(fileLink);
                }
            });
        }

        if (msg.content) {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';

            const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
            const parts = msg.content.split(urlRegex);
            parts.forEach((part) => {
                if (part.match(urlRegex)) {
                    let cleanUrl = part;
                    if (part.match(/[.,;:!?)]$/)) {
                        const punctuation = part.slice(-1);
                        cleanUrl = part.slice(0, -1);

                        const link = document.createElement('a');
                        link.href = cleanUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'message-link';
                        link.textContent = cleanUrl;
                        link.onclick = (e) => e.stopPropagation();

                        contentDiv.appendChild(link);
                        contentDiv.appendChild(document.createTextNode(punctuation));
                    } else {
                        const link = document.createElement('a');
                        link.href = cleanUrl;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'message-link';
                        link.textContent = cleanUrl;
                        link.onclick = (e) => e.stopPropagation();

                        contentDiv.appendChild(link);
                    }
                } else if (part) {
                    contentDiv.appendChild(document.createTextNode(part));
                }
            });

            if (msg.edited) {
                const editedSpan = document.createElement('span');
                editedSpan.className = 'message-edited';
                editedSpan.style.cssText = 'font-size: 0.75rem; color: var(--secondary-text); margin-left: 0.5rem;';
                editedSpan.textContent = '(edited)';
                contentDiv.appendChild(editedSpan);
            }

            contentWrapper.appendChild(contentDiv);
            addLinkPreviewsToMessage(contentWrapper, msg.content);
        }

        const timestamp = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isMobile) {
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'message-timestamp-reveal';
            timestampDiv.textContent = timestamp;
            timestampDiv.style.cssText = `
            position: absolute;
            bottom: 0.25rem;
            font-size: 0.75rem;
            color: var(--secondary-text);
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            ${isSent ? 'right: 0.5rem;' : 'left: 0.5rem;'}
        `;

            messageDiv.appendChild(contentWrapper);
            messageDiv.appendChild(timestampDiv);

            setupMessageSwipe(contentWrapper, isSent);
        } else {
            messageDiv.appendChild(contentWrapper);

            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'message-timestamp';
            timestampDiv.textContent = timestamp;
            timestampDiv.style.cssText = `font-size: 0.7rem; color: var(--secondary-text); margin-top: 0.25rem; text-align: ${isSent ? 'right' : 'left'};`;
            messageDiv.appendChild(timestampDiv);
        }

        messageDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showMessageContextMenu(e, msg);
        });

        let lastTap = 0;
        const DOUBLE_TAP_DELAY = 300;

        messageDiv.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;

            if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
                e.preventDefault();
                const touch = e.changedTouches[0];
                const event = new MouseEvent('contextmenu', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    bubbles: true,
                    cancelable: true
                });
                messageDiv.dispatchEvent(event);
            }
            lastTap = currentTime;
        }, { passive: false });

        return messageDiv;
    }

    const loadMessages = async (friendId) => {
        showSkeletonMessages();

        try {
            if (!currentChatFriend) {
                currentChatFriend = friends[friendId];
            }

            const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });

            renderAllMessages(messages || []);

            if (userSettings.readReceipts) {
                await supabase.from('messages')
                    .update({ read: true })
                    .eq('receiver_id', currentUser.id)
                    .eq('sender_id', friendId);
            }

            scrollToBottom();
        } catch (error) {
            ui.messagesContainer.innerHTML = '';
        }
    };

    const displayMessage = (message, sender) => {
        if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
        const messageDiv = createMessageElement(message, sender);
        ui.messagesContainer.appendChild(messageDiv);
        if (message.reactions) {
            renderReactions(message.id, message.reactions);
        }
        scrollToBottom();
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
            if (!isDragging) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
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

    window.editServerMessage = (messageId, content) => {
        const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!msgElement) return;

        const contentElement = msgElement.querySelector('.message-content');
        if (!contentElement) return;

        const originalText = content;
        const wasEdited = contentElement.querySelector('.message-edited') !== null;

        const textarea = document.createElement('textarea');
        textarea.className = 'inline-edit-textarea';
        textarea.value = originalText;
        textarea.style.cssText = `
            width: 100%;
            min-height: 60px;
            padding: 0.5rem;
            border: 1px solid var(--primary-accent);
            border-radius: var(--button-border-radius);
            background: var(--tertiary-bg);
            color: var(--primary-text);
            font-family: inherit;
            font-size: inherit;
            resize: vertical;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 0.5rem;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = 'padding: 0.5rem 1rem; background: var(--primary-accent); color: white; border: none; border-radius: var(--button-border-radius); cursor: pointer;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding: 0.5rem 1rem; background: var(--secondary-bg); color: var(--primary-text); border: none; border-radius: var(--button-border-radius); cursor: pointer;';

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);

        const editContainer = document.createElement('div');
        editContainer.appendChild(textarea);
        editContainer.appendChild(buttonContainer);

        contentElement.innerHTML = '';
        contentElement.appendChild(editContainer);

        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        const cancelEdit = () => {
            contentElement.innerHTML = escapeHtml(originalText);
            if (wasEdited) {
                contentElement.insertAdjacentHTML('beforeend', '<span class="message-edited" style="font-size: 0.75rem; color: var(--secondary-text); margin-left: 0.5rem;">(edited)</span>');
            }
        };

        const saveEdit = async () => {
            const newContent = textarea.value.trim();
            if (!newContent || newContent === originalText) {
                cancelEdit();
                return;
            }

            contentElement.innerHTML = `${escapeHtml(newContent)}<span class="message-edited" style="font-size: 0.75rem; color: var(--secondary-text); margin-left: 0.5rem;">(edited)</span>`;

            try {
                const { error } = await window.supabase
                    .from('server_messages')
                    .update({
                        content: newContent,
                        edited: true
                    })
                    .eq('id', messageId)
                    .eq('user_id', currentUser.id);

                if (error) {
                    showInfo('Error', 'Failed to save edit: ' + error.message);
                    cancelEdit();
                }
            } catch (error) {
                cancelEdit();
            }
        };

        saveBtn.onclick = saveEdit;
        cancelBtn.onclick = cancelEdit;

        textarea.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        };
    };

    window.deleteServerMessage = async (messageId) => {
        showConfirmation(
            'Delete Message',
            'Are you sure you want to delete this message? This cannot be undone.',
            async () => {
                try {
                    removeMessageFromUI(messageId);

                    const { data, error } = await window.supabase
                        .from('server_messages')
                        .delete()
                        .eq('id', messageId)
                        .select();

                    if (error) {
                        showInfo('Error', 'Failed to delete message: ' + error.message);
                        if (currentServer) loadServerMessages(currentServer.id);
                        return;
                    }

                    if (data && data.length === 0) {
                        showInfo('Error', 'Could not delete message. You might not have permission.');
                        if (currentServer) loadServerMessages(currentServer.id);
                    }

                } catch (error) {
                    showInfo('Error', 'An error occurred while deleting');
                }
            }
        );
    };

    const showMessageContextMenu = (e, message) => {
        e.preventDefault();
        e.stopPropagation();

        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) existingMenu.remove();
        const existingBackdrop = document.querySelector('.context-menu-backdrop');
        if (existingBackdrop) existingBackdrop.remove();

        const menu = document.createElement('div');
        menu.className = 'context-menu';

        const isMobile = window.innerWidth <= 768;
        const isSentMessage = message.sender_id === currentUser.id || message.user_id === currentUser.id;
        if (isMobile) {
            menu.style.cssText = `
            position: fixed;
            left: 0;
            bottom: 0;
            right: 0;
            background: var(--secondary-bg);
            border-radius: var(--card-border-radius) var(--card-border-radius) 0 0;
            z-index: 10002;
            width: 100%;
            padding: 1rem 0 2rem 0;
            animation: slideUp 0.3s ease-out;
        `;
        } else {
            const menuWidth = 200;
            const menuHeight = 250;

            let clientX = e.clientX;
            let clientY = e.clientY;

            if (e.changedTouches && e.changedTouches.length > 0) {
                clientX = e.changedTouches[0].clientX;
                clientY = e.changedTouches[0].clientY;
            }

            let left = clientX;
            let top = clientY;

            if (left + menuWidth > window.innerWidth) {
                left = window.innerWidth - menuWidth - 10;
            }
            if (left < 10) {
                left = 10;
            }

            if (top + menuHeight > window.innerHeight) {
                top = window.innerHeight - menuHeight - 10;
            }
            if (top < 10) {
                top = 10;
            }

            menu.style.cssText = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            background: var(--secondary-bg);
            border-radius: var(--card-border-radius);
            z-index: 10002;
            min-width: 200px;
            padding: 0.5rem 0;
        `;
        }

        const items = [];

        if (currentChatType === 'friend') {
            items.push(
                { icon: 'fa-reply', text: 'Reply', action: () => window.replyToMessage(message.id, message.content || 'File') },
                { icon: 'fa-face-smile', text: 'React', action: () => window.addReaction(message.id) }
            );

            if (isSentMessage) {
                if (message.content) {
                    items.push({ icon: 'fa-edit', text: 'Edit', action: () => window.editMessage(message.id, message.content) });
                }
                items.push({ icon: 'fa-trash', text: 'Delete', action: () => window.deleteMessage(message.id), danger: true });
            }
        } else if (currentChatType === 'server') {
            items.push({ icon: 'fa-reply', text: 'Reply', action: () => window.replyToServerMessage(message.id, message.content || 'File') });
            items.push({
                icon: 'fa-copy', text: 'Copy Text', action: () => {
                    if (message.content) {
                        navigator.clipboard.writeText(message.content).then(() => {
                            showInfoModal('Copied', 'Message copied to clipboard');
                        }).catch(() => {
                            showInfoModal('Error', 'Failed to copy message');
                        });
                    }
                }
            });

            if (isSentMessage && message.content) {
                items.push({ icon: 'fa-edit', text: 'Edit', action: () => window.editServerMessage(message.id, message.content) });
            }
            if (isSentMessage) {
                items.push({ icon: 'fa-trash', text: 'Delete', action: () => window.deleteServerMessage(message.id), danger: true });
            }
        }
        if (items.length === 0) {
            return;
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
            menuItem.onclick = (ev) => {
                ev.stopPropagation();
                item.action();
                menu.remove();
                const backdrop = document.querySelector('.context-menu-backdrop');
                if (backdrop) backdrop.remove();
            };
            menu.appendChild(menuItem);
        });

        let backdrop = null;
        if (isMobile) {
            backdrop = document.createElement('div');
            backdrop.className = 'context-menu-backdrop';
            backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--primary-bg);
            z-index: 10001;
            animation: fadeIn 0.3s ease-out;
        `;
            backdrop.onclick = () => {
                menu.remove();
                backdrop.remove();
            };
            document.body.appendChild(backdrop);
        }

        document.body.appendChild(menu);
        const closeMenu = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                const backdrop = document.querySelector('.context-menu-backdrop');
                if (backdrop) backdrop.remove();
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('touchstart', closeMenu);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            document.addEventListener('touchstart', closeMenu);
        }, 100);
    };

    if (ui.fileInput) {
        ui.fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            pendingFiles = files;

            if (ui.filePreviewContent) {
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
            }
        });
    }

    window.replyToMessage = (messageId, content) => {
        replyingTo = { id: messageId, content };
        const displayText = content && content.trim() ? content : 'File';
        ui.replyPreviewText.textContent = displayText.substring(0, 100);
        ui.replyPreview.classList.remove('hidden');
        ui.messageInput.focus();
    };

    const style = document.createElement('style');
    style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateY(100%);
        }
        to {
            transform: translateY(0);
        }
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;
    document.head.appendChild(style);

    ui.cancelReplyBtn.onclick = () => {
        ui.messageInput.value = '';
        replyingTo = null;
        ui.replyPreview.classList.add('hidden');
    };

    window.editMessage = (messageId, content) => {
        const msgElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!msgElement) {
            return;
        }

        const contentElement = msgElement.querySelector('.message-content');
        if (!contentElement) {
            return;
        }

        const originalText = content;

        const textarea = document.createElement('textarea');
        textarea.className = 'inline-edit-textarea';
        textarea.value = originalText;
        textarea.style.cssText = `
        width: 100%;
        min-height: 60px;
        padding: 0.5rem;
        border: 1px solid var(--primary-accent);
        border-radius: var(--button-border-radius);
        background: var(--tertiary-bg);
        color: var(--primary-text);
        font-family: inherit;
        font-size: inherit;
        resize: vertical;
    `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
    `;

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
        padding: 0.5rem 1rem;
        background: var(--primary-accent);
        color: white;
        border: none;
        border-radius: var(--button-border-radius);
        cursor: pointer;
    `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
        padding: 0.5rem 1rem;
        background: var(--secondary-bg);
        color: var(--primary-text);
        border: none;
        border-radius: var(--button-border-radius);
        cursor: pointer;
    `;

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);

        const editContainer = document.createElement('div');
        editContainer.appendChild(textarea);
        editContainer.appendChild(buttonContainer);

        contentElement.innerHTML = '';
        contentElement.appendChild(editContainer);

        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        const saveEdit = async () => {
            const newContent = textarea.value.trim();
            if (!newContent) {
                cancelEdit();
                return;
            }

            const { data: message, error: fetchError } = await supabase
                .from('messages')
                .select('sender_id, receiver_id')
                .eq('id', messageId)
                .single();
            const { error } = await supabase.from('messages').update({
                content: newContent,
                edited: true
            }).eq('id', messageId);
            if (error) {
                showInfoModal('Error', 'Failed to edit message.');
                cancelEdit();
                return;
            }
            updateMessageInUI({ id: messageId, content: newContent, edited: true });

            if (message) {
                const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;

                const channel = supabase.channel(`realtime-messages-${otherUserId}`, {
                    config: { broadcast: { self: false } }
                });

                await new Promise((resolve) => {
                    channel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') resolve();
                    });
                });

                await channel.send({
                    type: 'broadcast',
                    event: 'message_updated',
                    payload: {
                        messageId: messageId,
                        content: newContent
                    }
                });

                supabase.removeChannel(channel);
            }
        };

        const cancelEdit = () => {
            contentElement.textContent = originalText;
            const editedBadge = msgElement.querySelector('.message-edited');
            if (editedBadge) {
                contentElement.appendChild(editedBadge);
            }
        };

        saveBtn.onclick = saveEdit;
        cancelBtn.onclick = cancelEdit;

        textarea.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        };
    };

    window.deleteMessage = async (messageId) => {
        showConfirmationModal('Delete this message?', 'This action cannot be undone.', async () => {
            const { data: message, error: fetchError } = await supabase
                .from('messages')
                .select('sender_id, receiver_id')
                .eq('id', messageId)
                .single();
            if (!message) {
                showInfoModal('Error', 'Message not found.');
                return;
            }

            const { error } = await supabase.from('messages').delete().eq('id', messageId);
            if (error) {
                showInfoModal('Error', 'Failed to delete message.');
                return;
            }
            removeMessageFromUI(messageId);

            const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;

            const channel = supabase.channel(`realtime-messages-${otherUserId}`, {
                config: { broadcast: { self: false } }
            });

            await new Promise((resolve) => {
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') resolve();
                });
            });

            await channel.send({
                type: 'broadcast',
                event: 'message_deleted',
                payload: { messageId: messageId }
            });

            supabase.removeChannel(channel);

            await updateConversationsList();
        });
    };

    const showConfirmationModal = (title, message, onConfirm) => {
        ui.confirmationTitle.textContent = title;
        ui.confirmationMessage.textContent = message;
        ui.confirmationModal.style.zIndex = '10003';
        ui.modalContainer.style.zIndex = '10002';
        showModal(ui.confirmationModal);

        ui.confirmBtn.onclick = async () => {
            await onConfirm();
            ui.confirmationModal.style.zIndex = '';
            ui.modalContainer.style.zIndex = '';
            hideModal();
        };

        ui.cancelBtn.onclick = () => {
            ui.confirmationModal.style.zIndex = '';
            ui.modalContainer.style.zIndex = '';
            hideModal();
        };
    };

    const showInfoModal = (title, message) => {
        ui.infoTitle.textContent = title;
        ui.infoMessage.textContent = message;
        ui.infoModal.style.zIndex = '10003';
        ui.modalContainer.style.zIndex = '10002';
        showModal(ui.infoModal);

        ui.infoOkBtn.onclick = () => {
            ui.infoModal.style.zIndex = '';
            ui.modalContainer.style.zIndex = '';
            hideModal();
        };
    };

    window.addReaction = async (messageId) => {
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

        const picker = document.createElement('div');
        picker.className = 'emoji-picker';
        picker.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(var(--secondary-bg-rgb));
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

    const toggleReaction = async (messageId, emoji) => {
        const { data: message } = await supabase.from('messages').select('reactions, sender_id, receiver_id').eq('id', messageId).single();

        if (!message) return;

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

        const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;

        const channel = supabase.channel(`realtime-messages-${otherUserId}`, {
            config: { broadcast: { self: false } }
        });

        await new Promise((resolve) => {
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
            });
        });

        await channel.send({
            type: 'broadcast',
            event: 'reaction_updated',
            payload: {
                messageId,
                reactions: reactions
            }
        });

        supabase.removeChannel(channel);
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
        if (mins === 0) {
            return `${secs}s`;
        }
        return `${mins}m ${secs}s`;
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const showNotification = (message) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Palyra', { body: message });
        }
    };

    const playMessageSound = () => {
        const audio = new Audio('/audios/message.mp3');
        audio.play().catch(() => { });
    };

    ui.messageForm.onsubmit = async (e) => {
        e.preventDefault();

        const messageKey = `msg_${currentUser.id}_${sessionFingerprint}`;
        if (!checkRateLimit(messageKey, 'messages')) return;

        if (!trackSuspiciousActivity(currentUser.id, 'message')) {
            showInfo('Slow Down', 'You are sending messages too quickly.');
            return;
        }

        if (isCurrentlyTyping && currentTypingChannel) {
            isCurrentlyTyping = false;
            await currentTypingChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: currentUser.id, isTyping: false }
            });
        }

        const content = ui.messageInput.value.trim();
        if (!content && pendingFiles.length === 0) {
            return;
        }

        if (currentServer) {
            let messageData = {
                server_id: currentServer.id,
                user_id: currentUser.id,
                content,
                created_at: new Date().toISOString()
            };

            if (replyingTo && replyingTo.type === 'server') {
                messageData.reply_to_id = replyingTo.id;
                messageData.reply_to_content = replyingTo.content;
            }

            if (pendingFiles.length > 0) {
                const filePreview = document.getElementById('file-attachment-preview');
                if (!filePreview) return;

                const uploadedFiles = [];
                const totalFiles = pendingFiles.length;

                for (let i = 0; i < pendingFiles.length; i++) {
                    const file = pendingFiles[i];
                    const fileItem = filePreview.children[totalFiles - 1 - i];

                    if (fileItem) {
                        const overlay = document.createElement('div');
                        overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: var(--button-border-radius);
                z-index: 10;
            `;
                        overlay.innerHTML = `
                <div style="color: white; font-size: 0.75rem; margin-bottom: 0.5rem;">Uploading...</div>
                <div style="width: 80%; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
                    <div class="upload-progress-bar" style="height: 100%; background: var(--primary-accent); width: 0%; transition: width 0.3s ease;"></div>
                </div>
                <div class="upload-status" style="color: white; font-size: 0.65rem; margin-top: 0.25rem;">0%</div>
            `;
                        fileItem.appendChild(overlay);

                        const progressBar = overlay.querySelector('.upload-progress-bar');
                        const statusText = overlay.querySelector('.upload-status');

                        try {
                            let fileToUpload = file;

                            if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) {
                                statusText.textContent = 'Compressing...';
                                await new Promise(resolve => setTimeout(resolve, 200));
                                fileToUpload = await new Promise((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const img = new Image();
                                        img.onload = () => {
                                            const canvas = document.createElement('canvas');
                                            const MAX_WIDTH = 1920;
                                            const MAX_HEIGHT = 1920;
                                            let width = img.width;
                                            let height = img.height;

                                            if (width > height) {
                                                if (width > MAX_WIDTH) {
                                                    height *= MAX_WIDTH / width;
                                                    width = MAX_WIDTH;
                                                }
                                            } else {
                                                if (height > MAX_HEIGHT) {
                                                    width *= MAX_HEIGHT / height;
                                                    height = MAX_HEIGHT;
                                                }
                                            }

                                            canvas.width = width;
                                            canvas.height = height;
                                            const ctx = canvas.getContext('2d');
                                            ctx.drawImage(img, 0, 0, width, height);

                                            canvas.toBlob((blob) => {
                                                if (blob) {
                                                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                                                } else {
                                                    resolve(file);
                                                }
                                            }, 'image/jpeg', 0.8);
                                        };
                                        img.onerror = () => resolve(file);
                                        img.src = event.target.result;
                                    };
                                    reader.onerror = () => resolve(file);
                                    reader.readAsDataURL(file);
                                });
                            }

                            progressBar.style.width = '50%';
                            statusText.textContent = '50%';

                            const fileExt = fileToUpload.name.split('.').pop();
                            const fileName = `${Date.now()}-${currentUser.id}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                            const { data: uploadData, error: uploadError } = await supabase.storage
                                .from('files')
                                .upload(fileName, fileToUpload, {
                                    cacheControl: '3600',
                                    upsert: false
                                });

                            if (uploadError) {
                                statusText.textContent = 'Failed';
                                progressBar.style.background = 'var(--error)';
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                continue;
                            }

                            if (uploadData) {
                                const { data: { publicUrl } } = supabase.storage
                                    .from('files')
                                    .getPublicUrl(fileName);
                                uploadedFiles.push({
                                    url: publicUrl,
                                    name: file.name,
                                    type: file.type,
                                    size: file.size
                                });

                                progressBar.style.width = '100%';
                                statusText.textContent = '100%';
                                await new Promise(resolve => setTimeout(resolve, 300));
                            }
                        } catch (error) {
                            statusText.textContent = 'Error';
                            progressBar.style.background = 'var(--error)';
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }

                if (uploadedFiles.length > 0) {
                    messageData.files = uploadedFiles;
                }

                pendingFiles = [];
                renderFilePreview();
            }

            const { data, error } = await supabaseClient.from('server_messages').insert(messageData).select().single();

            if (error) throw error;

            ui.messageInput.value = '';
            return;
        }

        let messageData = {
            sender_id: currentUser.id,
            receiver_id: currentChatFriend.id,
            created_at: new Date().toISOString()
        };

        if (pendingFiles.length > 0) {
            const filePreview = document.getElementById('file-attachment-preview');
            if (!filePreview) return;

            const uploadedFiles = [];
            const totalFiles = pendingFiles.length;

            for (let i = 0; i < pendingFiles.length; i++) {
                const file = pendingFiles[i];
                const fileItem = filePreview.children[totalFiles - 1 - i];

                if (fileItem) {
                    const overlay = document.createElement('div');
                    overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: var(--button-border-radius);
                z-index: 10;
            `;
                    overlay.innerHTML = `
                <div style="color: white; font-size: 0.75rem; margin-bottom: 0.5rem;">Uploading...</div>
                <div style="width: 80%; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;">
                    <div class="upload-progress-bar" style="height: 100%; background: var(--primary-accent); width: 0%; transition: width 0.3s ease;"></div>
                </div>
                <div class="upload-status" style="color: white; font-size: 0.65rem; margin-top: 0.25rem;">0%</div>
            `;
                    fileItem.appendChild(overlay);

                    const progressBar = overlay.querySelector('.upload-progress-bar');
                    const statusText = overlay.querySelector('.upload-status');

                    try {
                        let fileToUpload = file;

                        if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) {
                            statusText.textContent = 'Compressing...';
                            await new Promise(resolve => setTimeout(resolve, 200));
                            fileToUpload = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const img = new Image();
                                    img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        const MAX_WIDTH = 1920;
                                        const MAX_HEIGHT = 1920;
                                        let width = img.width;
                                        let height = img.height;

                                        if (width > height) {
                                            if (width > MAX_WIDTH) {
                                                height *= MAX_WIDTH / width;
                                                width = MAX_WIDTH;
                                            }
                                        } else {
                                            if (height > MAX_HEIGHT) {
                                                width *= MAX_HEIGHT / height;
                                                height = MAX_HEIGHT;
                                            }
                                        }

                                        canvas.width = width;
                                        canvas.height = height;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, width, height);

                                        canvas.toBlob((blob) => {
                                            if (blob) {
                                                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                                            } else {
                                                resolve(file);
                                            }
                                        }, 'image/jpeg', 0.8);
                                    };
                                    img.onerror = () => resolve(file);
                                    img.src = event.target.result;
                                };
                                reader.onerror = () => resolve(file);
                                reader.readAsDataURL(file);
                            });
                        }

                        progressBar.style.width = '50%';
                        statusText.textContent = '50%';

                        const fileExt = fileToUpload.name.split('.').pop();
                        const fileName = `${Date.now()}-${currentUser.id}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('files')
                            .upload(fileName, fileToUpload, {
                                cacheControl: '3600',
                                upsert: false
                            });

                        if (uploadError) {
                            statusText.textContent = 'Failed';
                            progressBar.style.background = 'var(--error)';
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }

                        if (uploadData) {
                            const { data: { publicUrl } } = supabase.storage
                                .from('files')
                                .getPublicUrl(fileName);
                            uploadedFiles.push({
                                url: publicUrl,
                                name: file.name,
                                type: file.type,
                                size: file.size
                            });

                            progressBar.style.width = '100%';
                            statusText.textContent = '100%';
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    } catch (error) {
                        statusText.textContent = 'Error';
                        progressBar.style.background = 'var(--error)';
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            if (uploadedFiles.length > 0) {
                messageData.files = uploadedFiles;
            } else {
                showInfoModal('Upload Failed', 'Failed to upload files. Please try again.');
                return;
            }

            pendingFiles = [];
            renderFilePreview();
        }

        if (content) {
            messageData.content = content;
        } else if (!messageData.files || messageData.files.length === 0) {
            return;
        }

        if (replyingTo) {
            messageData.reply_to_id = replyingTo.id;
            messageData.reply_to_content = replyingTo.content;
        }

        ui.messageInput.value = '';
        replyingTo = null;
        ui.replyPreview.classList.add('hidden');

        const { data: insertedMessage, error } = await supabase
            .from('messages')
            .insert([messageData])
            .select()
            .single();

        if (error) {
            showInfoModal('Error', 'Failed to send message. Please try again.');
            return;
        }
        displayMessage(insertedMessage, currentUser);
        scrollToBottom();

        await updateConversationsList();
        const recipientChannel = supabase.channel(`messages-${currentChatFriend.id}`);

        await new Promise((resolve) => {
            recipientChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
            });
        });

        await recipientChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: { messageId: insertedMessage.id }
        });
        supabase.removeChannel(recipientChannel);
    };

    ui.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            ui.messageForm.dispatchEvent(new Event('submit'));
        }
    });

    let typingChannels = {};

    let typingTimeoutId = null;
    let isCurrentlyTyping = false;
    let currentTypingChannel = null;
    let currentTypingFriendId = null;

    ui.messageInput.addEventListener('input', async () => {
        adjustTextareaHeight();

        if (currentChatFriend && currentChatType === 'friend') {
            const hasText = ui.messageInput.value.trim().length > 0;

            const userId1 = currentUser.id;
            const userId2 = currentChatFriend.id;
            const channelName = `typing-${userId1 < userId2 ? userId1 : userId2}-${userId1 < userId2 ? userId2 : userId1}`;

            if (!currentTypingChannel || currentTypingFriendId !== currentChatFriend.id) {
                if (currentTypingChannel) {
                    await currentTypingChannel.send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { userId: currentUser.id, isTyping: false }
                    });
                }

                currentTypingFriendId = currentChatFriend.id;
                currentTypingChannel = supabase.channel(channelName, {
                    config: {
                        broadcast: { ack: false }
                    }
                });

                await new Promise((resolve) => {
                    currentTypingChannel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            resolve();
                        }
                    });
                });

                isCurrentlyTyping = false;
            }

            if (hasText && !isCurrentlyTyping) {
                isCurrentlyTyping = true;

                await currentTypingChannel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { userId: currentUser.id, isTyping: true }
                });
            } else if (!hasText && isCurrentlyTyping) {
                isCurrentlyTyping = false;

                await currentTypingChannel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { userId: currentUser.id, isTyping: false }
                });
            }

            clearTimeout(typingTimeoutId);

            if (hasText) {
                typingTimeoutId = setTimeout(async () => {
                    isCurrentlyTyping = false;
                    if (currentTypingChannel) {
                        await currentTypingChannel.send({
                            type: 'broadcast',
                            event: 'typing',
                            payload: { userId: currentUser.id, isTyping: false }
                        });
                    }
                }, 3000);
            }
        }
    });

    const renderBlockedUsers = () => {
        if (!ui.blockedUsersList) return;

        ui.blockedUsersList.innerHTML = '';

        if (blockedUsers.size === 0) {
            ui.blockedUsersList.innerHTML = '<p style="text-align: center; color: var(--secondary-text); padding: 2rem;">No blocked users</p>';
            return;
        }

        blockedUsers.forEach(async (blockedUserId) => {
            const { data: blockedUser } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', blockedUserId)
                .single();

            if (!blockedUser) return;

            const userDiv = document.createElement('div');
            userDiv.className = 'request-item';
            userDiv.style.marginBottom = '0.5rem';

            userDiv.innerHTML = `
            <div class="avatar">${blockedUser.avatar_url ? `<img src="${blockedUser.avatar_url}" alt="${blockedUser.username}">` : blockedUser.username[0].toUpperCase()}</div>
            <div class="request-info" style="flex: 1;">
                <div class="request-username">${blockedUser.username}</div>
            </div>
            <div class="request-actions">
                <button onclick="window.unblockUser('${blockedUser.id}')" style="background-color: var(--primary-accent);" title="Unblock">
                    <i class="fa-solid fa-unlock"></i>
                </button>
            </div>
        `;

            ui.blockedUsersList.appendChild(userDiv);
        });
    };

    window.unblockUser = async (userId) => {
        try {
            const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('blocked_user_id', userId);

            if (error) throw error;

            blockedUsers.delete(userId);
            renderBlockedUsers();
            showInfo('Success', 'User unblocked successfully');
        } catch (error) {
            showInfo('Error', 'Failed to unblock user');
        }
    };

    ui.viewBlockedUsersBtn?.addEventListener('click', () => {
        hideSettingsModal();
        renderBlockedUsers();
        showModal(ui.blockedUsersModal);
    });

    ui.addFriendForm.onsubmit = async (e) => {
        e.preventDefault();

        const friendReqKey = `friend_${currentUser.id}_${sessionFingerprint}`;
        if (!checkRateLimit(friendReqKey, 'friendRequests')) return;

        if (!trackSuspiciousActivity(currentUser.id, 'friendRequest')) {
            showInfo('Slow Down', 'Please wait before sending another friend request.');
            return;
        }

        const username = sanitizeInput(ui.friendUsernameInput.value.trim());
        if (!username) {
            return;
        }
        const { data: targetUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single();
        if (!targetUser) {
            showInfoModal('User not found', 'The username you entered does not exist.');
            return;
        }

        if (targetUser.id === currentUser.id) {
            showInfoModal('Cannot add yourself', 'You cannot add yourself as a friend.');
            return;
        }
        const { data: iBlockedThem } = await supabase
            .from('blocked_users')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('blocked_user_id', targetUser.id)
            .maybeSingle();
        if (iBlockedThem) {
            showInfoModal('User blocked', 'You have blocked this user. Unblock them first to send a friend request.');
            return;
        }
        const { data: canSend, error: rpcError } = await supabase
            .rpc('check_can_send_friend_request', {
                sender_id: currentUser.id,
                receiver_id: targetUser.id
            });
        if (rpcError || !canSend) {
            showInfoModal('User has blocked you', 'This user has blocked you and cannot receive friend requests from you.');
            return;
        }
        const { data: existing } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${currentUser.id})`)
            .maybeSingle();
        if (existing) {
            showInfoModal('Request exists', 'Friend request already exists or you are already friends.');
            return;
        }
        const { data: newRequest, error } = await supabase
            .from('friendships')
            .insert([{
                user_id: currentUser.id,
                friend_id: targetUser.id,
                status: 'pending'
            }])
            .select()
            .single();
        if (error) {
            showInfoModal('Error', 'Failed to send friend request.');
            return;
        }

        ui.friendUsernameInput.value = '';
        hideModal();
        showInfoModal('Request sent', 'Friend request sent successfully!');
        const targetUserId = targetUser.id;
        const notifyChannel = supabase.channel(`friend-requests-${targetUserId}`, {
            config: { broadcast: { self: false } }
        });

        await new Promise((resolve) => {
            notifyChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') resolve();
            });
        });

        await notifyChannel.send({
            type: 'broadcast',
            event: 'friend_request',
            payload: { fromUserId: currentUser.id }
        });
    };

    const showModal = (modal) => {
        ui.modalContainer.classList.remove('hidden');

        const modalContent = document.getElementById('modal-content');
        const allModals = modalContent.querySelectorAll('#modal-content > div:not(.close-btn)');
        allModals.forEach(m => m.classList.add('hidden'));

        if (typeof modal === 'string') {
            const dynamicModals = modalContent.querySelectorAll('.dynamic-modal');
            dynamicModals.forEach(dm => dm.remove());

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modal;
            const newModal = tempDiv.firstElementChild;
            if (newModal) {
                modalContent.appendChild(newModal);
            }
        } else if (modal && modal.classList) {
            modal.classList.remove('hidden');
        }
    };

    const hideModal = () => {
        ui.modalContainer.classList.add('hidden');

        const modalContent = document.getElementById('modal-content');
        const dynamicModals = modalContent.querySelectorAll('.dynamic-modal');
        dynamicModals.forEach(dm => dm.remove());
    };

    ui.closeModalBtn.onclick = hideModal;

    ui.modalContainer.onclick = (e) => {
        if (e.target === ui.modalContainer) {
            hideModal();
        }
    };

    document.addEventListener('click', (e) => {
        if (ui.modalContainer && !ui.modalContainer.classList.contains('hidden')) {
            const modalContent = document.getElementById('modal-content');
            if (modalContent && !modalContent.contains(e.target) && e.target === ui.modalContainer) {
                hideModal();
            }
        }
    });

    ui.addFriendBtn.onclick = () => {
        showModal(ui.addFriendModal);
    };

    ui.backToFriendsBtn.onclick = () => {
        if (isInCall) {
            ui.chatView.classList.add('hidden');
            ui.welcomeScreen.classList.remove('hidden');
            createFloatingCallIndicator();
            return;
        }

        currentServer = null;
        currentChatFriend = null;
        currentChatType = 'friend';
        updateURLPath('messages');

        if (window.innerWidth <= 768) {
            ui.sidebar.classList.remove('hidden');
            ui.chatContainer.classList.remove('active');
            ui.chatView.classList.add('hidden');
        } else {
            ui.sidebar.classList.remove('hidden');
            ui.chatContainer.classList.remove('active');
            ui.welcomeScreen.classList.remove('hidden');
            ui.chatView.classList.add('hidden');
        }
    };

    const createFloatingCallIndicator = () => {
        const existing = document.getElementById('floating-call-indicator');
        if (existing) return;

        const indicator = document.createElement('div');
        indicator.id = 'floating-call-indicator';
        indicator.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: var(--success);
        color: white;
        padding: 1rem;
        border-radius: var(--card-border-radius);
        z-index: 9999;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: pulse 2s infinite;
    `;
        indicator.innerHTML = `
        <i class="fa-solid fa-phone"></i>
        <span>Call in progress - Click to return</span>
    `;
        indicator.onclick = () => {
            ui.callSection.classList.remove('hidden');
            ui.chatView.classList.add('hidden');
            ui.welcomeScreen.classList.add('hidden');
            indicator.remove();
        };
        document.body.appendChild(indicator);
    };

    ui.viewProfileBtn.onclick = async () => {
        if (currentChatType === 'friend' && currentChatFriend) {
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
        } else if (currentChatType === 'server' && currentServer) {
            ui.serverInfoBtn.click();
        }
    };

    ui.blockUserBtn.onclick = async () => {
        if (currentChatType === 'friend' && currentChatFriend) {
            showConfirmation(
                `Block ${currentChatFriend.username}?`,
                'This user will be blocked and you will not receive messages from them.',
                async () => {
                    const blockedUserId = currentChatFriend.id;
                    try {
                        const { data: existingBlock, error: checkError } = await supabase
                            .from('blocked_users')
                            .select('*')
                            .eq('user_id', currentUser.id)
                            .eq('blocked_user_id', blockedUserId)
                            .maybeSingle();
                        if (existingBlock) {
                            showInfo('Info', 'User is already blocked');
                            return;
                        }
                        const { data: blockData, error: blockError } = await supabase
                            .from('blocked_users')
                            .insert([{
                                user_id: currentUser.id,
                                blocked_user_id: blockedUserId,
                                created_at: new Date().toISOString()
                            }])
                            .select()
                            .single();

                        if (blockError) {
                            throw blockError;
                        }
                        const { data: friendshipsToDelete, error: fetchError } = await supabase
                            .from('friendships')
                            .select('*')
                            .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${blockedUserId}),and(user_id.eq.${blockedUserId},friend_id.eq.${currentUser.id})`);
                        const { data: deleteResult, error: deleteError } = await supabase
                            .from('friendships')
                            .delete()
                            .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${blockedUserId}),and(user_id.eq.${blockedUserId},friend_id.eq.${currentUser.id})`)
                            .select();

                        if (deleteError) {
                        } else {
                        }
                        delete friends[blockedUserId];
                        await loadBlockedUsers();
                        hideModal();
                        ui.chatView.classList.add('hidden');
                        ui.welcomeScreen.classList.remove('hidden');
                        currentChatFriend = null;
                        await updateConversationsList();
                        const channelName = `block-broadcast-${currentUser.id}-${blockedUserId}-${Date.now()}`;
                        const blockChannel = supabase.channel(channelName);

                        const subscribePromise = new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error('Channel subscription timeout'));
                            }, 5000);

                            blockChannel.subscribe((status) => {
                                if (status === 'SUBSCRIBED') {
                                    clearTimeout(timeout);
                                    resolve();
                                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                                    clearTimeout(timeout);
                                    reject(new Error(`Channel error: ${status}`));
                                }
                            });
                        });

                        await subscribePromise;
                        const broadcastPayload = {
                            blockedBy: currentUser.id,
                            blockedUser: blockedUserId,
                            timestamp: Date.now()
                        };
                        const sendResult = await blockChannel.send({
                            type: 'broadcast',
                            event: 'user_blocked',
                            payload: broadcastPayload
                        });
                        setTimeout(() => {
                            supabase.removeChannel(blockChannel);
                        }, 2000);
                        showInfo('Success', 'User blocked successfully');
                    } catch (error) {
                        showInfo('Error', `Failed to block user: ${error.message}`);
                    }
                }
            );
        } else {
        }
    };

    ui.settingsBtn.onclick = () => {
        updateURLPath('settings');
        showSettingsModal();
    };

    ui.logoutBtn.onclick = async () => {
        showConfirmationModal('Logout', 'Are you sure you want to logout?', async () => {
            await supabase.auth.signOut();
            location.reload();
        });
    };

    ui.loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = sanitizeInput(document.getElementById('login-username').value.trim());
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            showInfoModal('Invalid credentials', 'Please enter both username and password.');
            return;
        }

        const attemptKey = `login_${username}`;
        const attempts = loginAttempts.get(attemptKey) || { count: 0, lockedUntil: 0 };

        if (Date.now() < attempts.lockedUntil) {
            const waitMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
            showInfoModal('Account Locked', `Too many failed attempts. Try again in ${waitMinutes} minutes.`);
            return;
        }

        if (!checkRateLimit(attemptKey, 'apiCalls')) return;

        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', username)
                .maybeSingle();

            if (profileError && profileError.code !== 'PGRST116') {
                showInfoModal('Error', 'Could not find user. Please try again.');
                return;
            }

            if (!profile) {
                attempts.count++;
                if (attempts.count >= securityConfig.maxLoginAttempts) {
                    attempts.lockedUntil = Date.now() + securityConfig.lockoutDuration;
                }
                loginAttempts.set(attemptKey, attempts);
                showInfoModal('Username not found', 'The username you entered does not exist.');
                return;
            }

            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: profile.email,
                password: password
            });

            if (loginError) {
                attempts.count++;
                if (attempts.count >= securityConfig.maxLoginAttempts) {
                    attempts.lockedUntil = Date.now() + securityConfig.lockoutDuration;
                }
                loginAttempts.set(attemptKey, attempts);
                showInfoModal('Invalid credentials', 'Incorrect username or password.');
                return;
            }

            loginAttempts.delete(attemptKey);
            location.reload();
        } catch (error) {
            showInfoModal('Error', 'An unexpected error occurred. Please try again.');
        }
    };

    ui.signupForm.onsubmit = async (e) => {
        e.preventDefault();

        if (!botDetection.validateFormSubmission('signup-form')) {
            showInfoModal('Validation Failed', 'Please complete the form naturally.');
            botDetection.cleanup('signup-form');
            return;
        }

        const username = sanitizeInput(document.getElementById('signup-username').value.trim());
        const password = document.getElementById('signup-password').value;

        if (!validateUsername(username)) {
            showInfoModal('Invalid username', 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens.');
            return;
        }

        if (!validatePassword(password)) {
            showInfoModal('Weak password', 'Password must be at least 8 characters with uppercase, lowercase, and numbers.');
            return;
        }

        const signupKey = `signup_${sessionFingerprint}`;
        if (!checkRateLimit(signupKey, 'apiCalls')) return;

        if (!trackSuspiciousActivity(sessionFingerprint, 'signup')) {
            showInfoModal('Too Many Attempts', 'Please wait a moment before trying again.');
            return;
        }

        try {
            const { data: existing, error: checkError } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                showInfoModal('Error', 'Could not verify username. Please try again.');
                return;
            }

            if (existing) {
                showInfoModal('Username taken', 'This username is already taken. Please choose another.');
                return;
            }

            const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@p2p.local`;

            const { data: authData, error: signupError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                        fingerprint: sessionFingerprint
                    }
                }
            });

            if (signupError) {
                showInfoModal('Signup failed', signupError.message);
                return;
            }

            if (authData.user) {
                await new Promise(resolve => setTimeout(resolve, 500));

                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ username: username })
                    .eq('id', authData.user.id);

                botDetection.cleanup('signup-form');
                location.reload();
            }
        } catch (error) {
            showInfoModal('Error', 'An unexpected error occurred. Please try again.');
        }
    };

    ui.showSignup.onclick = (e) => {
        e.preventDefault();
        ui.loginForm.classList.add('hidden');
        ui.signupForm.classList.remove('hidden');
        ui.authStatus.textContent = '';
        botDetection.initFormTracking('signup-form');
    };

    ui.showLogin.onclick = (e) => {
        e.preventDefault();
        ui.signupForm.classList.add('hidden');
        ui.loginForm.classList.remove('hidden');
        ui.authStatus.textContent = '';
        botDetection.cleanup('signup-form');
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

    ui.settingsAvatar.onclick = () => {
        ui.avatarUpload.click();
    };

    ui.avatarUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showInfoModal('Invalid file', 'Please upload an image file.');
            e.target.value = '';
            return;
        }

        const maxSize = 25 * 1024 * 1024;
        if (file.size > maxSize) {
            showInfoModal('File too large', 'Please upload an image smaller than 25MB.');
            e.target.value = '';
            return;
        }

        try {
            const compressedFile = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 800;
                        const MAX_HEIGHT = 800;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                            } else {
                                reject(new Error('Image compression failed'));
                            }
                        }, 'image/jpeg', 0.85);
                    };
                    img.onerror = () => reject(new Error('Failed to load image'));
                    img.src = event.target.result;
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });

            const fileExt = 'jpg';
            const fileName = `${currentUser.id}-avatar-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, compressedFile, {
                    upsert: true,
                    contentType: 'image/jpeg'
                });

            if (uploadError) {
                throw new Error(`Upload failed: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', currentUser.id);

            if (updateError) {
                throw new Error(`Profile update failed: ${updateError.message}`);
            }

            currentUser.avatar_url = publicUrl;
            ui.settingsAvatar.innerHTML = `<img src="${publicUrl}" alt="${currentUser.username}">`;
            ui.userAvatar.innerHTML = `<img src="${publicUrl}" alt="${currentUser.username}">`;

            e.target.value = '';

            for (const friendId in friends) {
                const channel = supabase.channel(`profile-updates-${friendId}`, {
                    config: { broadcast: { self: false } }
                });

                await new Promise((resolve) => {
                    channel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') resolve();
                    });
                });

                await channel.send({
                    type: 'broadcast',
                    event: 'avatar_updated',
                    payload: { userId: currentUser.id, avatarUrl: publicUrl }
                });
            }

            showInfoModal('Success', 'Profile picture updated successfully!');

        } catch (error) {
            showInfoModal('Upload failed', error.message || 'Could not upload avatar. Please try again.');
            e.target.value = '';
        }
    };

    ui.changeUsernameBtn.onclick = () => {
        hideSettingsModal();
        showModal(ui.changeUsernameModal);
    };

    ui.callBtn.onclick = () => {
        startCall();
    };

    ui.changeUsernameForm.onsubmit = async (e) => {
        e.preventDefault();
        const newUsername = ui.newUsernameInput.value.trim();

        if (!newUsername || newUsername.length < 3) {
            showInfoModal('Invalid username', 'Username must be at least 3 characters long.');
            return;
        }

        try {
            const { data: existing, error: checkError } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', newUsername)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                showInfoModal('Error', 'Could not verify username. Please try again.');
                return;
            }

            if (existing) {
                showInfoModal('Username taken', 'This username is already taken. Please choose another.');
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
            showInfoModal('Success', 'Username updated successfully!');

            for (const friendId in friends) {
                const channel = supabase.channel(`profile-updates-${friendId}`, {
                    config: { broadcast: { self: false } }
                });

                await new Promise((resolve) => {
                    channel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') resolve();
                    });
                });

                await channel.send({
                    type: 'broadcast',
                    event: 'username_updated',
                    payload: { userId: currentUser.id, username: newUsername }
                });
            }
        } catch (error) {
            showInfoModal('Error', 'Could not update username. Please try again.');
        }
    };

    const handleIncomingCall = (call) => {
        if (isInCall && incomingCallData && call.metadata?.from === incomingCallData.from) {
            mediaConnection = call;

            if (localStream) {
                call.answer(localStream);

                let streamReceived = false;
                call.on('stream', (remoteStream) => {
                    if (streamReceived) {
                        return;
                    }
                    streamReceived = true;
                    const callerId = call.metadata.from;
                    const existingRemote = document.getElementById('remote-video');
                    if (!existingRemote) {
                        addVideoStream('remote', remoteStream, friends[callerId]);
                    }
                });
            }
            return;
        }

        if (isInCall && call.metadata?.from !== incomingCallData?.from) {
            call.close();
            return;
        }
        mediaConnection = call;

        incomingCallData = {
            from: call.metadata.from,
            peerId: call.peer,
            callerName: call.metadata.callerName,
            callerAvatar: call.metadata.callerAvatar
        };
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

        incomingCallTimeout = setTimeout(() => {
            if (!isInCall && incomingCallData) {
                hideModal();
                ui.incomingCallAudio.pause();
                ui.incomingCallAudio.currentTime = 0;
                incomingCallData = null;
                if (mediaConnection) {
                    mediaConnection.close();
                    mediaConnection = null;
                }
            }
        }, 30000);

        call.on('close', () => {
            if (isInCall) {
                endCall();
                showInfoModal('Call Ended', 'The call has ended.');
            }
        });

        call.on('error', (err) => {
            hideModal();
            ui.incomingCallAudio.pause();
            ui.incomingCallAudio.currentTime = 0;
            showInfoModal('Call Error', 'Could not establish call connection.');
        });
    };

    ui.acceptCallBtn.onclick = async () => {
        if (!incomingCallData) {
            return;
        }

        isInCall = true;

        hideModal();
        ui.incomingCallAudio.pause();
        ui.incomingCallAudio.currentTime = 0;

        if (incomingCallTimeout) {
            clearTimeout(incomingCallTimeout);
            incomingCallTimeout = null;
        }

        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            const callerId = incomingCallData.from;
            const callChannel = supabase.channel(`call-invite-${callerId}`, {
                config: { broadcast: { self: false } }
            });

            await new Promise((resolve) => {
                callChannel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        resolve();
                    }
                });
            });

            await callChannel.send({
                type: 'broadcast',
                event: 'call_accepted',
                payload: {
                    acceptedBy: currentUser.id,
                    accepterPeerId: peer.id,
                    timestamp: Date.now()
                }
            });
            ui.callSection.classList.remove('hidden');
            ui.chatView.classList.add('hidden');
            ui.videoGrid.innerHTML = '';

            addVideoStream('local', localStream, currentUser);

            if (mediaConnection) {
                mediaConnection.answer(localStream);

                mediaConnection.on('stream', (remoteStream) => {
                    addVideoStream('remote', remoteStream, friends[callerId]);
                });
            } else {
            }

            const userId1 = currentUser.id < callerId ? currentUser.id : callerId;
            const userId2 = currentUser.id < callerId ? callerId : currentUser.id;
            const sessionChannelName = `call-session-${userId1}-${userId2}`;
            const sessionChannel = supabase.channel(sessionChannelName);
            await sessionChannel.subscribe();

            sessionChannel.on('broadcast', { event: 'track_state_change' }, (payload) => {
                const { trackType, enabled, fromUser } = payload.payload;
                if (trackType === 'video') {
                    if (fromUser) {
                        remoteVideoStates[fromUser] = enabled;
                    } else {
                    }

                    const remoteTile = document.getElementById('remote-video');
                    if (remoteTile) {
                        if (enabled) {
                            remoteTile.classList.remove('video-off');
                        } else {
                            remoteTile.classList.add('video-off');
                        }

                        updateVideoState(remoteTile.querySelector('video'), 'remote', {
                            id: fromUser,
                            username: remoteTile.querySelector('.participant-name')?.textContent || 'Remote User'
                        });

                        const remoteVideoElement = remoteTile.querySelector('video');
                        if (remoteVideoElement && document.body.contains(remoteVideoElement)) {
                            if (enabled) {
                                remoteVideoElement.play().catch(e => { });
                            } else {
                                remoteVideoElement.pause();
                            }
                        }
                    } else {
                    }
                }
            });

            sessionChannel.on('broadcast', { event: 'call_ended' }, () => {
                endCall();
            });

            subscriptions.push(sessionChannel);

        } catch (error) {
            isInCall = false;
            endCall();
            showInfoModal('Call Error', 'Failed to start call. Please try again.');
        }
    };

    ui.declineCallBtn.onclick = async () => {
        hideModal();
        ui.incomingCallAudio.pause();
        ui.incomingCallAudio.currentTime = 0;

        if (mediaConnection) {
            mediaConnection.close();
            mediaConnection = null;
        }

        const userId1 = currentUser.id < calleeId ? currentUser.id : calleeId;
        const userId2 = currentUser.id < calleeId ? calleeId : currentUser.id;
        const callChannel = supabase.channel(`call-session-${userId1}-${userId2}`);

        await callChannel.send({
            type: 'broadcast',
            event: 'call_declined',
            payload: {
                declinedBy: currentUser.id,
                timestamp: Date.now()
            }
        });

        incomingCallData = null;
    };

    const showOutgoingCallUI = (friendName) => {
        const callUIHTML = `
        <div id="outgoing-call-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10000; color: white;">
            <div class="avatar" style="width: 120px; height: 120px; font-size: 48px; margin-bottom: 2rem;">${friendName[0].toUpperCase()}</div>
            <h2 style="margin-bottom: 0.5rem;">Calling ${friendName}...</h2>
            <p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 3rem;">Waiting for response</p>
            <button id="cancel-outgoing-call" style="padding: 1rem 2rem; background: var(--error); color: white; border: none; border-radius: var(--button-border-radius); cursor: pointer; font-size: 1rem;">
                <i class="fa-solid fa-phone-slash"></i> Cancel
            </button>
        </div>
    `;
        const overlay = document.createElement('div');
        overlay.innerHTML = callUIHTML;
        document.body.appendChild(overlay.firstElementChild);

        document.getElementById('cancel-outgoing-call').onclick = async () => {
            clearCallInvite();

            const outgoingOverlay = document.getElementById('outgoing-call-overlay');
            if (outgoingOverlay) outgoingOverlay.remove();

            if (activeCallInvite) {
                const callChannel = supabase.channel(`call-invite-${activeCallInvite.calleeId}`);
                await callChannel.subscribe();
                await callChannel.send({
                    type: 'broadcast',
                    event: 'call_cancelled',
                    payload: {
                        callerId: currentUser.id,
                        timestamp: Date.now()
                    }
                });
            }

            if (mediaConnection) {
                mediaConnection.close();
                mediaConnection = null;
            }
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }
        };
    };

    const hideOutgoingCallUI = () => {
        const outgoingOverlay = document.getElementById('outgoing-call-overlay');
        if (outgoingOverlay) {
            outgoingOverlay.remove();
        }
    };

    async function detectUserTable() {
        const tables = ['users', 'profiles', 'auth_users'];
        for (const table of tables) {
            try {
                const { data, error } = await supabaseClient
                    .from(table)
                    .select('username')
                    .limit(1);

                if (!error) {
                    return table;
                }
            } catch (e) {
                continue;
            }
        }
        return 'profiles';
    }

    const startCall = async () => {
        if (!currentChatFriend || currentChatType !== 'friend') {
            return;
        }

        if (activeCallInvite) {
            showInfoModal('Call in progress', 'You already have an active call invitation.');
            return;
        }

        const isHTTP = window.location.protocol === 'http:' && window.location.hostname !== 'localhost';
        if (isHTTP) {
            showInfoModal('HTTPS Required', 'Video calling requires HTTPS. Please access this site via HTTPS or use localhost.');
            return;
        }

        showOutgoingCallUI(currentChatFriend.username);

        activeCallInvite = {
            calleeId: currentChatFriend.id,
            calleeName: currentChatFriend.username,
            startTime: Date.now()
        };

        const callChannel = supabase.channel(`call-invite-${currentChatFriend.id}`, {
            config: {
                broadcast: {
                    self: false,
                    ack: true
                }
            }
        });

        callChannel.on('broadcast', { event: 'call_accepted' }, async (payload) => {
            if (payload.payload.acceptedBy === currentChatFriend.id) {
                clearCallInvite();
                await initiateCallConnection(currentChatFriend.id, payload.payload.accepterPeerId);
            }
        });

        callChannel.on('broadcast', { event: 'call_declined' }, (payload) => {
            if (payload.payload.declinedBy === currentChatFriend.id) {
                clearCallInvite();
                hideOutgoingCallUI();
                showInfoModal('Call Declined', 'The user declined your call.');
            }
        });

        const subscriptionPromise = new Promise((resolve) => {
            callChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    resolve();
                }
            });
        });

        await subscriptionPromise;
        subscriptions.push(callChannel);

        const sendCallInvite = async () => {
            await callChannel.send({
                type: 'broadcast',
                event: 'incoming_call',
                payload: {
                    callerId: currentUser.id,
                    callerName: currentUser.username,
                    callerAvatar: currentUser.avatar_url,
                    callerPeerId: peer.id,
                    timestamp: Date.now()
                }
            });
        };

        await sendCallInvite();

        callRetryInterval = setInterval(async () => {
            if (activeCallInvite) {
                await sendCallInvite();
            }
        }, 3000);

        callInviteTimeout = setTimeout(() => {
            clearCallInvite();
            hideOutgoingCallUI();
            showInfoModal('No Response', 'The user did not answer the call.');
        }, 20000);
    };

    const initiateCallConnection = async (calleeId, calleePeerId) => {
        try {
            if (!localStream) {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } else {
            }
            const call = peer.call(calleePeerId, localStream, {
                metadata: {
                    from: currentUser.id,
                    timestamp: Date.now()
                }
            });

            if (!call) {
                throw new Error('Failed to create call');
            }

            mediaConnection = call;
            let callEstablished = false;
            const startTime = Date.now();
            const connectionTimeout = setTimeout(() => {
                if (!callEstablished) {
                    call.close();
                    hideOutgoingCallUI();
                    if (localStream) {
                        localStream.getTracks().forEach(track => track.stop());
                        localStream = null;
                    }
                    showInfoModal('Connection Failed', 'Could not establish connection.');
                }
            }, 30000);

            call.on('stream', (remoteStream) => {
                if (callEstablished) {
                    return;
                }

                callEstablished = true;
                clearTimeout(connectionTimeout);
                hideOutgoingCallUI();

                ui.callSection.classList.remove('hidden');
                ui.chatView.classList.add('hidden');
                ui.welcomeScreen.classList.add('hidden');
                isInCall = true;

                ui.videoGrid.innerHTML = '';
                addVideoStream('local', localStream, currentUser);
                addVideoStream('remote', remoteStream, friends[calleeId]);
            });

            call.on('close', async () => {
                clearTimeout(connectionTimeout);
                hideOutgoingCallUI();
                const duration = Math.floor((Date.now() - startTime) / 1000);
                await saveCallRecord(calleeId, duration);
                endCall();
            });

            call.on('error', (err) => {
                clearTimeout(connectionTimeout);
                hideOutgoingCallUI();
                if (localStream) {
                    localStream.getTracks().forEach(track => track.stop());
                    localStream = null;
                }
                showInfoModal('Call Failed', 'Could not establish connection.');
            });

            const peerConnection = call.peerConnection;
            if (peerConnection) {
                peerConnection.oniceconnectionstatechange = () => {
                    if (peerConnection.iceConnectionState === 'connected') {
                        callEstablished = true;
                    } else if (peerConnection.iceConnectionState === 'disconnected' ||
                        peerConnection.iceConnectionState === 'failed') {
                        if (callEstablished) {
                            hideOutgoingCallUI();
                            endCall();
                            showInfoModal('Connection Lost', 'Call connection was lost.');
                        }
                    }
                };
            }

            const userId1 = currentUser.id < calleeId ? currentUser.id : calleeId;
            const userId2 = currentUser.id < calleeId ? calleeId : currentUser.id;
            const callChannel = supabase.channel(`call-session-${userId1}-${userId2}`);
            await callChannel.subscribe();

            callChannel.on('broadcast', { event: 'track_state_change' }, (payload) => {
                const { trackType, enabled, fromUser } = payload.payload;
                if (trackType === 'video') {
                    if (fromUser) {
                        remoteVideoStates[fromUser] = enabled;
                    } else {
                    }

                    const remoteTile = document.getElementById('remote-video');
                    if (remoteTile) {
                        if (enabled) {
                            remoteTile.classList.remove('video-off');
                        } else {
                            remoteTile.classList.add('video-off');
                        }
                    } else {
                    }
                }
            });

            callChannel.on('broadcast', { event: 'call_ended' }, () => {
                hideOutgoingCallUI();
                endCall();
            });

            subscriptions.push(callChannel);

            callChannel.on('broadcast', { event: 'call_ended' }, () => {
                hideOutgoingCallUI();
                endCall();
            });

            subscriptions.push(callChannel);

            callChannel.on('broadcast', { event: 'call_ended' }, () => {
                hideOutgoingCallUI();
                endCall();
            });

            subscriptions.push(callChannel);

        } catch (error) {
            hideOutgoingCallUI();
            let errorMsg = 'Could not access camera/microphone.';
            if (error.name === 'NotAllowedError') {
                errorMsg = 'Camera/microphone permission denied. Please allow access in your browser settings.';
            } else if (error.name === 'NotFoundError') {
                errorMsg = 'No camera or microphone found on this device.';
            } else if (error.name === 'NotReadableError') {
                errorMsg = 'Camera/microphone is already in use by another application.';
            }
            showInfoModal('Media Error', errorMsg);
        }
    };

    const clearCallInvite = () => {
        if (callRetryInterval) {
            clearInterval(callRetryInterval);
            callRetryInterval = null;
        }
        if (callInviteTimeout) {
            clearTimeout(callInviteTimeout);
            callInviteTimeout = null;
        }
        activeCallInvite = null;
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

    const addVideoStream = (type, stream, user) => {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        let track = null;
        if (videoTracks.length > 0) {
            track = videoTracks[0];
        }

        const existingTile = document.getElementById(`${type}-video`);
        if (existingTile) {
            existingTile.remove();
        }

        const pollingInterval = setInterval(() => {
            if (!track) {
                clearInterval(pollingInterval);
                return;
            }
            const currentEnabled = track.enabled;
            if (track._lastEnabled !== currentEnabled) {
                track._lastEnabled = currentEnabled;

                if (type === 'local') {
                    checkVideoState();
                }
            }
        }, 100);

        const tile = document.createElement('div');
        tile.className = 'participant-tile';
        tile.id = `${type}-video`;
        tile.dataset.type = type;
        tile.dataset.streamId = stream.id;
        tile.dataset.userId = user.id;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', '');

        if (type === 'local') {
            video.muted = true;
            video.setAttribute('muted', '');
        } else {
            video.muted = false;
        }

        video.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: var(--primary-bg);
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
`;

        video.onloadedmetadata = () => {
            video.play().then(() => {
                checkVideoState();
            }).catch(err => {
                if (!video.muted && type === 'remote') {
                    video.muted = true;
                    video.play().catch(e => { });
                }
            });
        };

        const placeholder = document.createElement('div');
        placeholder.className = 'video-off-placeholder';
        placeholder.innerHTML = `
    <div class="avatar large-avatar">${user.username[0].toUpperCase()}</div>
    <span>${user.username}</span>
`;

        const nameTag = document.createElement('div');
        nameTag.className = 'participant-name';
        nameTag.textContent = user.username;

        tile.appendChild(video);
        tile.appendChild(placeholder);
        tile.appendChild(nameTag);

        if (type === 'local' && isMobileDevice()) {
            const flipBtn = document.createElement('button');
            flipBtn.className = 'flip-camera-btn';
            flipBtn.innerHTML = '<i class="fa-solid fa-camera-rotate"></i>';
            flipBtn.onclick = (e) => {
                e.stopPropagation();
                switchCamera();
            };
            tile.appendChild(flipBtn);
        }

        tile.addEventListener('click', () => {
            tile.classList.toggle('fullscreen');
        });

        ui.videoGrid.appendChild(tile);
        const checkVideoState = () => {
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length === 0) {
                tile.classList.add('video-off');
                return;
            }

            const track = videoTracks[0];
            const isEnabled = track.enabled;
            const isMuted = track.muted;
            const readyState = track.readyState;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            let isVideoOff;

            if (type === 'remote') {
                const otherUserId = user.id;
                const remoteState = remoteVideoStates[otherUserId];
                if (remoteState !== undefined) {
                    isVideoOff = !remoteState;
                } else {
                    isVideoOff = !isEnabled || readyState !== 'live';
                }
            } else {
                isVideoOff = !isEnabled || readyState !== 'live';
            }
            if (isVideoOff) {
                tile.classList.add('video-off');
            } else {
                tile.classList.remove('video-off');
            }

            const placeholder = tile.querySelector('.video-off-placeholder');
            if (placeholder) {
                const computedStyle = window.getComputedStyle(placeholder);
            }
        };

        const updateVideoState = () => {
            checkVideoState();
        };

        if (videoTracks.length > 0) {
            const track = videoTracks[0];
            track._lastEnabled = track.enabled;

            setTimeout(() => {
                checkVideoState();
            }, 500);

            track.addEventListener('mute', () => {
                updateVideoState();
            });

            track.addEventListener('unmute', () => {
                updateVideoState();
            });

            track.addEventListener('ended', () => {
                updateVideoState();
            });

            stream.addEventListener('removetrack', (e) => {
                updateVideoState();
            });

            stream.addEventListener('addtrack', (e) => {
                updateVideoState();
            });
        } else {
            tile.classList.add('video-off');
        }

        video.addEventListener('loadeddata', () => {
            checkVideoState();
        });

        video.addEventListener('playing', () => {
            checkVideoState();
        });

        setTimeout(() => {
            checkVideoState();
        }, 1000);
    };

    const updateVideoState = (id, enabled) => {
        const tile = document.getElementById(`video-${id}`);
        if (tile) {
            tile.classList.toggle('video-off', !enabled);
            const video = tile.querySelector('video');
            if (video && video.srcObject) {
                const videoTrack = video.srcObject.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = enabled;
                }
            }
        }
    };

    const endCall = async () => {
        remoteVideoStates = {};

        if (incomingCallTimeout) {
            clearTimeout(incomingCallTimeout);
            incomingCallTimeout = null;
        }

        const floatingIndicator = document.getElementById('floating-call-indicator');
        if (floatingIndicator) {
            floatingIndicator.remove();
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        if (mediaConnection) {
            const otherUserId = currentChatFriend?.id || incomingCallData?.from;

            mediaConnection.close();

            if (otherUserId) {
                const userId1 = currentUser.id < otherUserId ? currentUser.id : otherUserId;
                const userId2 = currentUser.id < otherUserId ? otherUserId : currentUser.id;
                const sessionChannelName = `call-session-${userId1}-${userId2}`;

                const callChannel = supabase.channel(sessionChannelName);
                await callChannel.subscribe();
                await callChannel.send({
                    type: 'broadcast',
                    event: 'call_ended',
                    payload: { userId: currentUser.id, timestamp: Date.now() }
                });
            }

            mediaConnection = null;
        }

        ui.videoGrid.innerHTML = '';
        ui.callSection.classList.add('hidden');
        ui.chatView.classList.remove('hidden');
        isInCall = false;
        incomingCallData = null;
        callState = { isMuted: false, isVideoEnabled: true, isScreenSharing: false };

        ui.muteBtn.classList.remove('danger');
        ui.muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        ui.toggleVideoBtn.classList.add('active');
        ui.toggleVideoBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        ui.shareScreenBtn.classList.remove('active');
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
        if (localStream) {
            localStream.getVideoTracks().forEach(t => {
                t.enabled = callState.isVideoEnabled;
            });
        }

        const localTile = document.getElementById('local-video');
        if (localTile) {
            if (callState.isVideoEnabled) {
                localTile.classList.remove('video-off');
            } else {
                localTile.classList.add('video-off');
            }
        }

        ui.toggleVideoBtn.classList.toggle('active', callState.isVideoEnabled);
        ui.toggleVideoBtn.innerHTML = callState.isVideoEnabled ?
            '<i class="fa-solid fa-video"></i>' :
            '<i class="fa-solid fa-video-slash"></i>';

        const otherUserId = currentChatFriend?.id || incomingCallData?.from;
        if (otherUserId) {
            const userId1 = currentUser.id < otherUserId ? currentUser.id : otherUserId;
            const userId2 = currentUser.id < otherUserId ? otherUserId : currentUser.id;
            const channelName = `call-session-${userId1}-${userId2}`;

            let callChannel = subscriptions.find(s => s.topic === `realtime:${channelName}`);

            if (!callChannel) {
                callChannel = supabase.channel(channelName);

                const subscribePromise = new Promise((resolve) => {
                    callChannel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            resolve();
                        }
                    });
                });

                await subscribePromise;
                subscriptions.push(callChannel);
            } else {
            }

            await callChannel.send({
                type: 'broadcast',
                event: 'track_state_change',
                payload: {
                    trackType: 'video',
                    enabled: callState.isVideoEnabled,
                    peerId: peer.id,
                    fromUser: currentUser.id
                }
            });
        } else {
        }
    };

    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    const switchCamera = async () => {
        if (!localStream) return;

        const videoTrack = localStream.getVideoTracks()[0];
        const currentFacingMode = videoTrack.getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: newFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            const sender = mediaConnection.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');

            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }

            videoTrack.stop();
            localStream.removeTrack(videoTrack);
            localStream.addTrack(newVideoTrack);

            const localVideo = document.querySelector('#local-video video');
            if (localVideo) {
                localVideo.srcObject = localStream;
            }
        } catch (error) {
            showInfoModal('Error', 'Could not switch camera. Please try again.');
        }
    };

    const getDesktopScreenShareStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });
            return stream;
        } catch (error) {
            throw new Error('Screen sharing not available or permission denied');
        }
    };

    ui.shareScreenBtn.onclick = async () => {
        if (callState.isScreenSharing) {
            try {
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: false
                });
                const videoTrack = cameraStream.getVideoTracks()[0];
                const sender = mediaConnection.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
                if (localStream) {
                    const currentVideoTrack = localStream.getVideoTracks()[0];
                    if (currentVideoTrack) {
                        currentVideoTrack.stop();
                        localStream.removeTrack(currentVideoTrack);
                    }
                    localStream.addTrack(videoTrack);
                }
                callState.isScreenSharing = false;
                ui.shareScreenBtn.classList.remove('active');
            } catch (error) {
                showInfoModal('Error', 'Could not stop screen sharing.');
            }
        } else {
            try {
                const screenStream = await getDesktopScreenShareStream();

                const screenTrack = screenStream.getVideoTracks()[0];

                const sender = mediaConnection.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }

                if (localStream) {
                    const oldTrack = localStream.getVideoTracks()[0];
                    if (oldTrack) {
                        localStream.removeTrack(oldTrack);
                    }
                    localStream.addTrack(screenTrack);
                }

                callState.isScreenSharing = true;
                ui.shareScreenBtn.classList.add('active');

                showInfoModal('Screen Share Started', 'Your screen is now being shared.');

                screenTrack.onended = async () => {
                    try {
                        const cameraStream = await navigator.mediaDevices.getUserMedia({
                            video: {
                                width: { ideal: 1280 },
                                height: { ideal: 720 },
                                facingMode: 'user'
                            },
                            audio: false
                        });
                        const videoTrack = cameraStream.getVideoTracks()[0];
                        const sender = mediaConnection.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                        if (sender) {
                            await sender.replaceTrack(videoTrack);
                        }
                        if (localStream) {
                            const currentVideoTrack = localStream.getVideoTracks()[0];
                            if (currentVideoTrack) {
                                localStream.removeTrack(currentVideoTrack);
                            }
                            localStream.addTrack(videoTrack);
                        }
                        callState.isScreenSharing = false;
                        ui.shareScreenBtn.classList.remove('active');
                    } catch (err) {
                    }
                };
            } catch (error) {
                let errorMessage = 'Could not start screen sharing. Please try again.';
                let errorTitle = 'Screen Share Error';

                if (error.message.includes('permission denied')) {
                    errorMessage = 'Screen sharing permission was denied. Please allow screen sharing and try again.';
                    errorTitle = 'Permission Denied';
                } else if (error.message.includes('not available')) {
                    errorMessage = 'Screen sharing is not available in this browser. Please try using Chrome, Firefox, or Edge.';
                    errorTitle = 'Browser Not Supported';
                }

                showInfoModal(errorTitle, errorMessage);
            }
        }
    };

    const setupSettingsDrag = () => {
        if (window.innerWidth > 768) {
            return;
        }

        let isDragging = false;
        let startY = 0;
        let currentTranslate = 0;

        const dragStart = (e) => {
            if (window.innerWidth > 768) return;
            isDragging = true;
            startY = e.pageY || e.touches[0].pageY;
            currentTranslate = 0;
            ui.settingsModalPane.style.transition = 'none';
        };

        const dragMove = (e) => {
            if (!isDragging || window.innerWidth > 768) return;
            const currentY = e.pageY || e.touches[0].pageY;
            const diffY = currentY - startY;

            if (diffY > 0) {
                currentTranslate = diffY;
                ui.settingsModalPane.style.transform = `translateY(${diffY}px)`;
            }
        };

        const dragEnd = (e) => {
            if (!isDragging || window.innerWidth > 768) return;
            isDragging = false;

            const currentY = e.pageY || e.changedTouches[0].pageY;
            const diffY = currentY - startY;

            if (diffY > 100) {
                ui.settingsModalPane.style.transition = 'transform 0.3s ease-out';
                ui.settingsModalPane.style.transform = 'translateY(100%)';

                if (ui.settingsModalBody._scrollListener) {
                    ui.settingsModalBody.removeEventListener('scroll', ui.settingsModalBody._scrollListener);
                    delete ui.settingsModalBody._scrollListener;
                }

                document.documentElement.style.setProperty('--settings-modal-after-opacity', 1);

                setTimeout(() => {
                    ui.settingsModalContainer.classList.remove('visible');
                    ui.settingsModalPane.classList.remove('visible');
                    ui.settingsModalPane.style.transform = '';
                    ui.settingsModalPane.style.transition = '';

                    if (window.location.pathname === '/settings') {
                        updateURLPath('personal');
                    }
                }, 300);
            } else {
                ui.settingsModalPane.style.transition = 'transform 0.3s ease-out';
                ui.settingsModalPane.style.transform = 'translateY(0)';

                setTimeout(() => {
                    ui.settingsModalPane.style.transition = '';
                }, 300);
            }
        };

        ui.settingsModalHeader.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);

        ui.settingsModalHeader.addEventListener('touchstart', dragStart, { passive: true });
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('touchend', dragEnd, { passive: true });
    };

    ui.settingsModalContainer.addEventListener('click', (e) => {
        if (e.target === ui.settingsModalContainer) {
            hideSettingsModal();
        } else {
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ui.settingsModalContainer.classList.contains('visible')) {
            hideSettingsModal();
        }
    });

    ui.chatOptionsModal.addEventListener('click', (e) => {
        if (e.target === ui.chatOptionsModal) {
            hideModal();
        }
    });

    ui.friendProfileModal.addEventListener('click', (e) => {
        if (e.target === ui.friendProfileModal && window.innerWidth > 768) {
            hideModal();
        }
    });

    ui.confirmationModal.addEventListener('click', (e) => {
        if (e.target === ui.confirmationModal && window.innerWidth > 768) {
            hideModal();
        }
    });

    ui.infoModal.addEventListener('click', (e) => {
        if (e.target === ui.infoModal && window.innerWidth > 768) {
            hideModal();
        }
    });

    setupSettingsDrag();

    const showSettingsModal = () => {
        ui.settingsModalContainer.classList.add('visible');
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                ui.settingsModalPane.classList.add('visible');
            }, 10);
        } else {
        }

        const handleSettingsScroll = () => {
            const scrollTop = ui.settingsModalBody.scrollTop;
            const fadeStart = 50;
            const fadeEnd = 200;

            let opacity = 1;
            if (scrollTop > fadeStart) {
                const fadeRange = fadeEnd - fadeStart;
                const fadeProgress = Math.min((scrollTop - fadeStart) / fadeRange, 1);
                opacity = 1 - fadeProgress;
            }

            document.documentElement.style.setProperty('--settings-modal-after-opacity', opacity);
        };

        handleSettingsScroll();
        ui.settingsModalBody.addEventListener('scroll', handleSettingsScroll);
        ui.settingsModalBody._scrollListener = handleSettingsScroll;
    };

    const hideSettingsModal = () => {
        if (window.location.pathname === '/settings') {
            updateURLPath('personal');
        }

        if (ui.settingsModalBody._scrollListener) {
            ui.settingsModalBody.removeEventListener('scroll', ui.settingsModalBody._scrollListener);
            delete ui.settingsModalBody._scrollListener;
        }

        document.documentElement.style.setProperty('--settings-modal-after-opacity', 1);

        if (window.innerWidth <= 768) {
            ui.settingsModalPane.classList.remove('visible');

            setTimeout(() => {
                ui.settingsModalContainer.classList.remove('visible');
                ui.settingsModalPane.style.transform = '';
            }, 300);
        } else {
            ui.settingsModalContainer.classList.remove('visible');
        }
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

    const handleRouting = async () => {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);

        if (parts.length === 0) {
            await switchTab('personal');
            return;
        }

        const route = parts[0];
        const id = parts[1];

        switch (route) {
            case 'personal':
                await switchTab('personal');
                break;

            case 'global':
                await switchTab('global');
                break;

            case 'settings':
                showSettingsModal();
                break;

            case 'chat':
                if (id && friends[id]) {
                    if (currentTab !== 'personal') {
                        await switchTab('personal');
                    }
                    setTimeout(() => {
                        window.openChat(id, 'friend');
                    }, currentTab !== 'personal' ? 500 : 100);
                } else {
                    await switchTab('personal');
                }
                break;

            case 'server':
                if (id) {
                    if (currentTab !== 'global') {
                        await switchTab('global');
                        await loadServers();
                    }
                    setTimeout(async () => {
                        const server = servers.find(s => s.id === id);
                        if (server) {
                            await openServerChat(server);
                        }
                    }, currentTab !== 'global' ? 800 : 100);
                } else {
                    await switchTab('global');
                }
                break;

            case 'friend-requests':
                await switchTab('personal');
                setTimeout(() => {
                    window.showFriendRequestsModal();
                }, 500);
                break;

            case 'messages':
                await switchTab('personal');
                break;

            default:
                await switchTab('personal');
                break;
        }
    };

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path) {
            handleRouting();
        } else {
            ui.chatView.classList.add('hidden');
            ui.welcomeScreen.classList.remove('hidden');
            currentChatFriend = null;
            currentServer = null;
        }
    });

    setTimeout(() => {
        if (currentUser) {
            handleRouting();
        }
    }, 1500);
    setTimeout(initializeFileAttachment, 500);
});