document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ui = {
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
        addFriendBtn: document.getElementById('add-friend-btn'),
        friendsList: document.getElementById('friends-list'),
        chatContainer: document.getElementById('chat-container'),
        welcomeScreen: document.getElementById('welcome-screen'),
        chatView: document.getElementById('chat-view'),
        chatHeader: document.getElementById('chat-header'),
        chatAvatar: document.getElementById('chat-avatar'),
        chatFriendName: document.getElementById('chat-friend-name'),
        backToFriendsBtn: document.getElementById('back-to-friends-btn'),
        callBtn: document.getElementById('call-btn'),
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
        chatOverlay: document.getElementById('chat-overlay'),
        chatOverlayHeader: document.getElementById('chat-overlay-header'),
        chatOverlayContent: document.getElementById('chat-overlay-content'),
        chatOverlayBackdrop: document.getElementById('chat-overlay-backdrop'),
    };

    let peer, localStream, dataConnection, mediaConnection, currentUser, currentChatFriend, friends = {}, subscriptions = [];
    let callState = { isMuted: false, isVideoEnabled: true, isScreenSharing: false };
    let incomingCallData = null;
    let onlineUsers = new Set();
    let isInCall = false;

    const showLoader = (show) => ui.appLoader.classList.toggle('hidden', !show);
    const showAuth = (show) => ui.authContainer.classList.toggle('hidden', !show);
    const showApp = (show) => ui.mainApp.classList.toggle('hidden', !show);
    const setAuthStatus = (message, isError = true) => {
        ui.authStatus.textContent = message;
        ui.authStatus.style.color = isError ? 'var(--error)' : 'var(--success)';
    };

    const initializePeer = async (userId) => {
        if (peer && !peer.destroyed) peer.destroy();
        ui.callBtn.disabled = true;

        peer = new Peer(undefined, {
            config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        peer.on('open', async (id) => {
            console.log('PeerJS connection opened with server-assigned ID:', id);
            await supabase.from('profiles').update({ peer_id: id }).eq('id', userId);
            setupPeerListeners();
            if (currentChatFriend) ui.callBtn.disabled = false;
        });

        peer.on('disconnected', () => {
            console.warn('PeerJS disconnected.');
            ui.callBtn.disabled = true;
        });

        peer.on('close', () => {
            console.warn('PeerJS connection closed.');
            ui.callBtn.disabled = true;
        });

        peer.on('error', err => {
            console.error('PeerJS Error:', err);
            ui.callBtn.disabled = true;
            if (err.type === 'peer-unavailable') {
                showInfoModal('User Offline', "The user you are trying to call is currently offline.");
                ui.callBtn.disabled = false;
                ui.callBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
            } else if (err.type === 'network') {
                showInfoModal("Connection Error", "Connection to the signaling server lost. Calls are temporarily unavailable.");
            }
        });
    };

    const setupDataConnectionListeners = (conn) => {
        conn.on('data', (data) => {
            if (data.type === 'chat-message' && currentChatFriend && data.sender_id === currentChatFriend.id) {
                addMessageToUI(data.message);
            }
        });
    };

    const setupPeerListeners = () => {
        peer.on('connection', conn => {
            dataConnection = conn;
            setupDataConnectionListeners(dataConnection);
        });

        peer.on('call', async call => {
            mediaConnection = call;
            let friend = Object.values(friends).find(f => f.peer_id === call.peer);

            if (!friend) {
                const { data: callerProfile, error } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('peer_id', call.peer)
                    .single();

                if (error || !callerProfile) {
                    return call.close();
                }
                friend = { ...callerProfile };
            }

            if (!friend) return;
            incomingCallData = { peerId: call.peer, friend };
            showIncomingCallModal(friend);
        });
    };

    const showInfoModal = (title, message) => {
        ui.infoTitle.textContent = title;
        ui.infoMessage.textContent = message;
        showModal('info');
    };

    const showModal = (type) => {
        ui.modalContainer.classList.remove('hidden');
        ui.addFriendModal.classList.toggle('hidden', type !== 'addFriend');
        ui.incomingCallModal.classList.toggle('hidden', type !== 'incomingCall');
        ui.confirmationModal.classList.toggle('hidden', type !== 'confirmation');
        ui.infoModal.classList.toggle('hidden', type !== 'info');

        if (type === 'info') {
            ui.modalContainer.classList.add('is-info-modal');
        }
    };

    const hideModal = () => {
        ui.modalContainer.classList.add('hidden');
        ui.modalContainer.classList.remove('is-info-modal');
        ui.incomingCallAudio.pause();
        ui.incomingCallAudio.currentTime = 0;
    };

    let confirmCallback = null;
    const showConfirmationModal = (message, onConfirm, title = 'Are you sure?', confirmText = 'Confirm', confirmClass = 'danger') => {
        ui.confirmationMessage.textContent = message;
        ui.confirmationTitle.textContent = title;
        ui.confirmBtn.textContent = confirmText;

        ui.confirmBtn.className = '';
        ui.confirmBtn.classList.add(confirmClass);

        confirmCallback = onConfirm;
        showModal('confirmation');
    };

    const showIncomingCallModal = (friend) => {
        ui.callerAvatar.textContent = friend.username.charAt(0);
        ui.callerName.textContent = friend.username;
        showModal('incomingCall');
        ui.incomingCallAudio.play().catch(e => console.warn("Audio play failed. User interaction may be required."));
    };

    const loadFriends = async () => {
        const { data, error } = await supabase.rpc('get_friends', { user_id_param: currentUser.id });
        if (error) return;
        friends = data.reduce((acc, friend) => {
            acc[friend.id] = friend;
            return acc;
        }, {});
        renderFriendsList();
    };

    const renderFriendsList = () => {
        ui.friendsList.innerHTML = '';
        const sortedFriends = Object.values(friends).sort((a, b) => a.username.localeCompare(b.username));
        sortedFriends.forEach(friend => {
            const el = document.createElement('div');
            el.className = 'friend-item';
            el.dataset.id = friend.id;
            if (friend.status === 'pending') el.classList.add('pending');
            const isOnline = onlineUsers.has(friend.id);

            el.innerHTML = `
                <div class="avatar-wrapper">
                    <div class="avatar">${friend.username.charAt(0)}</div>
                    <div class="status-indicator ${isOnline ? 'online' : ''}"></div>
                </div>
                <span class="friend-name">${friend.username}</span>
                ${friend.status === 'pending' && friend.action_user_id !== currentUser.id
                    ? `<div class="friend-actions">
                         <button class="success" data-action="accept" title="Accept"><i class="fa-solid fa-check"></i></button>
                         <button class="danger" data-action="decline" title="Decline"><i class="fa-solid fa-times"></i></button>
                       </div>`
                    : friend.status === 'pending' ? '<span class="pending-tag">PENDING</span>' : ''
                }
            `;
            ui.friendsList.appendChild(el);
        });
    };

    const openChat = async (friendId) => {
        currentChatFriend = friends[friendId];
        if (!currentChatFriend) {
            history.pushState(null, '', '/');
            handleRouteChange();
            return;
        }

        ui.welcomeScreen.classList.add('hidden');
        ui.chatView.classList.remove('hidden');
        ui.chatAvatar.textContent = currentChatFriend.username.charAt(0);
        ui.chatFriendName.textContent = currentChatFriend.username;
        ui.chatFriendStatus.classList.toggle('online', onlineUsers.has(friendId));

        if (onlineUsers.has(friendId) && peer && !peer.destroyed && (!dataConnection || dataConnection.peer !== currentChatFriend.peer_id)) {
            if (dataConnection) dataConnection.close();
            const { data: profile } = await supabase.from('profiles').select('peer_id').eq('id', friendId).single();
            if (profile && profile.peer_id) {
                dataConnection = peer.connect(profile.peer_id);
                dataConnection.on('open', () => setupDataConnectionListeners(dataConnection));
            }
        }

        document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active'));
        const friendItem = document.querySelector(`.friend-item[data-id="${friendId}"]`);
        if (friendItem) {
            friendItem.classList.add('active');
            const indicator = friendItem.querySelector('.unread-indicator');
            if (indicator) indicator.remove();
        }

        if (window.innerWidth <= 768) {
            ui.sidebar.classList.add('hidden');
            ui.chatContainer.classList.add('active');
        }

        if (`/#/dm/${friendId}` !== window.location.hash) {
            history.pushState({ friendId }, '', `/#/dm/${friendId}`);
        }

        ui.callBtn.disabled = (!peer || peer.disconnected || peer.destroyed);
        loadMessages(friendId);
    };

    const loadMessages = async (friendId) => {
        ui.messagesContainer.innerHTML = '<div class="message-list"></div>';
        const { data } = await supabase.from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false }).limit(50);
        if (data) data.reverse().forEach(addMessageToUI);
    };

    const addMessageToUI = (message) => {
        const el = document.createElement('div');
        const isSent = message.sender_id === currentUser.id;
        el.className = `message ${isSent ? 'sent' : 'received'}`;
        el.innerHTML = `
            ${!isSent ? `<div class="avatar">${friends[message.sender_id]?.username.charAt(0) || '?'}</div>` : ''}
            <div class="message-content">
                <p class="text">${message.content}</p>
            </div>
        `;
        ui.messagesContainer.querySelector('.message-list').appendChild(el);
        ui.messagesContainer.scrollTop = ui.messagesContainer.scrollHeight;
    };

    const startCall = async (friend) => {
        if (!onlineUsers.has(friend.id)) {
            showInfoModal('User Offline', `${friend.username} appears to be offline.`);
            return;
        }

        if (!peer || peer.disconnected || peer.destroyed) {
            console.error(
                'Call failed: PeerJS connection not ready.',
                { peer, disconnected: peer?.disconnected, destroyed: peer?.destroyed }
            );
            showInfoModal('Connection Error', 'Your connection is not ready yet. Please wait a moment and try again.');
            return;
        }

        ui.callBtn.disabled = true;
        ui.callBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const resetCallButton = () => {
            ui.callBtn.disabled = false;
            ui.callBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        };

        try {
            const { data: friendProfile, error: profileError } = await supabase
                .from('profiles')
                .select('peer_id, username')
                .eq('id', friend.id)
                .single();

            if (profileError || !friendProfile || !friendProfile.peer_id) {
                throw new Error(`${friend.username} is not available to call or is offline.`);
            }

            const friendPeerId = friendProfile.peer_id;
            if (dataConnection) dataConnection.close();
            dataConnection = peer.connect(friendPeerId);

            if (!dataConnection) {
                throw new Error("Failed to create a data connection. The peer might be offline.");
            }

            dataConnection.on('open', async () => {
                setupDataConnectionListeners(dataConnection);
                await startLocalMedia();
                mediaConnection = peer.call(friendPeerId, localStream);
                setupMediaConnectionListeners(mediaConnection, friend);
                showCallUI(true);
                addVideoStream('local', localStream, true, currentUser.profile.username);
            });

            dataConnection.on('error', (err) => {
                console.error('Connection Error:', err);
                showInfoModal('Connection Failed', `An error occurred while connecting to ${friend.username}.`);
                resetCallButton();
                endCall();
            });

        } catch (error) {
            console.error('Call Initiation Error:', error);
            showInfoModal('Call Failed', error.message || 'Could not start the call. Please check your connection and try again.');
            resetCallButton();
        }
    };

    const acceptCall = async () => {
        hideModal();
        const friend = incomingCallData.friend;

        if (!friends[friend.id]) {
            friends[friend.id] = friend;
        }

        currentChatFriend = friend;
        ui.chatAvatar.textContent = currentChatFriend.username.charAt(0);
        ui.chatFriendName.textContent = currentChatFriend.username;
        ui.chatFriendStatus.classList.toggle('online', onlineUsers.has(friend.id));
        await loadMessages(friend.id);
        ui.welcomeScreen.classList.add('hidden');
        ui.chatView.classList.remove('hidden');

        await startLocalMedia();
        mediaConnection.answer(localStream);
        setupMediaConnectionListeners(mediaConnection, friend);
        showCallUI(true);
        addVideoStream('local', localStream, true, currentUser.profile.username);
    };

    const declineCall = () => {
        mediaConnection?.close();
        hideModal();
    };

    const startLocalMedia = async (video = true) => {
        try {
            if (localStream) localStream.getTracks().forEach(track => track.stop());
            localStream = await navigator.mediaDevices.getUserMedia({
                video: video ? { echoCancellation: true } : false,
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            callState.isVideoEnabled = video;
        } catch (err) {
            if (video) return startLocalMedia(false);
            alert('Could not access camera/mic.');
            throw err;
        }
    };

    const setupMediaConnectionListeners = (conn, friend) => {
        conn.on('stream', remoteStream => {
            addVideoStream('remote', remoteStream, false, friend.username);
        });
        conn.on('close', endCall);
        conn.on('error', endCall);
    };

    const showCallUI = (show) => {
        ui.callSection.classList.toggle('hidden', !show);
        ui.mainApp.style.display = show ? 'none' : 'flex';
        isInCall = show;
    };

    const addVideoStream = (id, stream, isLocal, name) => {
        let tile = document.querySelector(`.participant-tile[data-id="${id}"]`);
        if (!tile) {
            tile = document.createElement('div');
            tile.className = `participant-tile ${isLocal ? 'local' : 'remote'}`;
            tile.dataset.id = id;
            tile.innerHTML = `
                <video playsinline autoplay ${isLocal ? 'muted' : ''}></video>
                <div class="video-off-placeholder">
                    <div class="avatar">${name.charAt(0)}</div>
                </div>`;
            ui.videoGrid.appendChild(tile);
        }
        tile.querySelector('video').srcObject = stream;
        updateVideoState(id, isLocal ? callState.isVideoEnabled : true);
    };

    const updateVideoState = (id, isEnabled) => {
        const tile = document.querySelector(`.participant-tile[data-id="${id}"]`);
        if (tile) tile.classList.toggle('video-off', !isEnabled);
    };

    const endCall = () => {
        mediaConnection?.close();
        dataConnection?.close();
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        ui.videoGrid.innerHTML = '';
        showCallUI(false);
        ui.callBtn.disabled = false;
        ui.callBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        ui.shareScreenBtn.classList.remove('active');
        callState.isScreenSharing = false;
        ui.toggleChatBtn.innerHTML = '<i class="fa-solid fa-comment"></i>';
    };

    ui.shareScreenBtn.onclick = async () => {
        if (!mediaConnection || !mediaConnection.peerConnection) {
            return showInfoModal('Error', 'A call connection is required to share your screen.');
        }

        if (callState.isScreenSharing) {
            await startLocalMedia(true);
            const videoSender = mediaConnection.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (videoSender && localStream.getVideoTracks()[0]) {
                videoSender.replaceTrack(localStream.getVideoTracks()[0]);
            }
            addVideoStream('local', localStream, true, currentUser.profile.username);
            callState.isScreenSharing = false;
            ui.shareScreenBtn.classList.remove('active');
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                const videoSender = mediaConnection.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(screenTrack);
                }

                addVideoStream('local', screenStream, true, "Your Screen");

                callState.isScreenSharing = true;
                ui.shareScreenBtn.classList.add('active');

                screenTrack.onended = () => {
                    if (callState.isScreenSharing) {
                        ui.shareScreenBtn.click();
                    }
                };
            } catch (err) {
                console.error("Screen share error", err);
                showInfoModal('Screen Share Failed', 'Could not start screen sharing. Please grant permission and try again.');
            }
        }
    };

    const handleNewMessage = (payload) => {
        const message = payload.new;

        if (currentChatFriend && message.sender_id === currentChatFriend.id) {
            addMessageToUI(message);
        } else {
            const friendItem = document.querySelector(`.friend-item[data-id="${message.sender_id}"]`);
            if (friendItem && !friendItem.querySelector('.unread-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'unread-indicator';
                friendItem.appendChild(indicator);
            }
        }
    };

    const handleFriendUpdate = async () => {
        await loadFriends();
        if (currentChatFriend) {
            const updatedFriend = friends[currentChatFriend.id];
            if (!updatedFriend || updatedFriend.status !== 'accepted') {
                history.pushState(null, '', '/');
                handleRouteChange();
            }
        }
    };

    const handleRealtimeEvents = async (payload) => {
        if (payload.table === 'friends') {
            await loadFriends();
            if (currentChatFriend) {
                const updatedFriend = friends[currentChatFriend.id];
                if (!updatedFriend || updatedFriend.status !== 'accepted') {
                    history.pushState(null, '', '/');
                    handleRouteChange();
                }
            }
        }
    };

    const subscribeToChannels = () => {
        const friendsChannel = supabase.channel(`friends-for-${currentUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `or(user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id})` }, handleRealtimeEvents)
            .subscribe();

        subscriptions.push(friendsChannel);
        setupPresence();
    };

    const unsubscribeChannels = () => {
        supabase.removeAllChannels();
        subscriptions = [];
    };

    const updateUserStatusUI = (userId, isOnline) => {
        const friendItem = document.querySelector(`.friend-item[data-id="${userId}"] .status-indicator`);
        if (friendItem) {
            friendItem.classList.toggle('online', isOnline);
        }
        if (currentChatFriend && currentChatFriend.id === userId) {
            ui.chatFriendStatus.classList.toggle('online', isOnline);
        }
    };

    const setupPresence = () => {
        const presenceChannel = supabase.channel('online-users');

        presenceChannel.on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const presences = Object.keys(state).map(id => state[id][0]);
            onlineUsers = new Set(presences.map(p => p.user_id));
            renderFriendsList();
        });

        presenceChannel.on('presence', { event: 'join' }, ({ newPresences }) => {
            newPresences.forEach(p => {
                onlineUsers.add(p.user_id);
                updateUserStatusUI(p.user_id, true);
            });
        });

        presenceChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
            leftPresences.forEach(p => {
                onlineUsers.delete(p.user_id);
                updateUserStatusUI(p.user_id, false);
            });
        });

        presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({ user_id: currentUser.id });
            }
        });
        subscriptions.push(presenceChannel);
    };

    const handleRouteChange = () => {
        const hash = window.location.hash;
        if (hash.startsWith('/#/dm/')) {
            const friendId = hash.substring(6);
            if (friends[friendId]) {
                openChat(friendId);
            } else {
                ui.welcomeScreen.classList.remove('hidden');
                ui.chatView.classList.add('hidden');
            }
        } else {
            ui.welcomeScreen.classList.remove('hidden');
            ui.chatView.classList.add('hidden');
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active'));
            currentChatFriend = null;
        }
    };

    const initApp = async (session) => {
        currentUser = session.user;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();

        if (!profile) return;

        currentUser.profile = profile;
        ui.usernameDisplay.textContent = profile.username;
        ui.userAvatar.textContent = profile.username.charAt(0);
        await initializePeer(currentUser.id);
        await loadFriends();
        subscribeToChannels();
        showLoader(false);
        showAuth(false);
        showApp(true);
        handleRouteChange();
    };

    const handleAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await initApp(session);
        } else {
            showLoader(false);
            showAuth(true);
        }
    };

    ui.showSignup.onclick = (e) => {
        e.preventDefault();
        ui.loginForm.classList.add('hidden');
        ui.signupForm.classList.remove('hidden');
    };
    ui.showLogin.onclick = (e) => {
        e.preventDefault();
        ui.signupForm.classList.add('hidden');
        ui.loginForm.classList.remove('hidden');
    };

    const toggleChatOverlay = (show) => {
        if (show) {
            ui.chatOverlayContent.appendChild(ui.chatView);
            ui.chatOverlay.classList.remove('hidden');
            ui.chatOverlayBackdrop.classList.remove('hidden');
            setTimeout(() => {
                ui.chatOverlay.classList.add('visible');
                ui.chatOverlayBackdrop.classList.add('visible');
            }, 10);
        } else {
            ui.chatOverlay.classList.remove('visible');
            ui.chatOverlayBackdrop.classList.remove('visible');
            const onTransitionEnd = () => {
                ui.chatOverlay.classList.add('hidden');
                ui.chatOverlayBackdrop.classList.add('hidden');
                ui.chatContainer.appendChild(ui.chatView);
                ui.chatOverlay.removeEventListener('transitionend', onTransitionEnd);
            };
            ui.chatOverlay.addEventListener('transitionend', onTransitionEnd);
        }
    };

    ui.toggleChatBtn.onclick = () => {
        if (window.innerWidth <= 768 && isInCall) {
            const isOverlayVisible = ui.chatOverlay.classList.contains('visible');
            toggleChatOverlay(!isOverlayVisible);
        } else {
            const isShowingCall = !ui.callSection.classList.contains('hidden');
            showCallUI(!isShowingCall);
            if (isShowingCall) {
                ui.toggleChatBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
            } else {
                ui.toggleChatBtn.innerHTML = '<i class="fa-solid fa-comment"></i>';
            }
        }
    };

    ui.loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = e.target.elements['login-username'].value.trim();
        const password = e.target.elements['login-password'].value;
        const email = `${username}@peer2peer.app`;

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthStatus('Invalid username or password.');
        else setAuthStatus('');
    };

    ui.signupForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = e.target.elements['signup-username'].value.trim();
        const password = e.target.elements['signup-password'].value;

        if (!username || !password) {
            return setAuthStatus('Username and password cannot be empty.');
        }

        const email = `${username}@peer2peer.app`;

        const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', username).single();
        if (existingUser) return setAuthStatus('Username is already taken.');

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return setAuthStatus(error.message);

        if (data.user) {
            await supabase.from('profiles').insert({ id: data.user.id, username });
            setAuthStatus('Account created! You can now log in.', false);
        }
    };

    supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            showAuth(false);
            if (!currentUser || currentUser.id !== session.user.id) {
                initApp(session);
            }
        } else {
            unsubscribeChannels();
            showApp(false);
            showAuth(true);
            currentUser = null;
        }
    });

    ui.logoutBtn.onclick = () => {
        showConfirmationModal('This will end your current session.', async () => {
            await supabase.auth.signOut();
            peer.destroy();
            window.location.reload();
        }, 'Log out?', 'Logout');
    };

    ui.addFriendBtn.onclick = () => showModal('addFriend');
    ui.closeModalBtn.onclick = hideModal;
    ui.modalContainer.onclick = (e) => { if (e.target === ui.modalContainer) hideModal(); };

    ui.addFriendForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = ui.friendUsernameInput.value.trim();
        if (username === currentUser.profile.username) return;

        const { data: friend, error } = await supabase.from('profiles').select('id').eq('username', username).single();
        if (error || !friend) return showInfoModal('Not Found', 'That user could not be found.');

        const { error: insertError } = await supabase.from('friends').insert({
            user_id_1: currentUser.id,
            user_id_2: friend.id,
            status: 'pending',
            action_user_id: currentUser.id,
        });

        if (insertError) {
            showInfoModal('Request Failed', 'Could not send friend request. You may already be friends or have a pending request.');
        } else {
            hideModal();
            ui.friendUsernameInput.value = '';
        }
    };

    ui.friendsList.onclick = async (e) => {
        const target = e.target.closest('button');
        const friendItem = e.target.closest('.friend-item');
        if (!friendItem) return;

        const friendId = friendItem.dataset.id;
        if (target) {
            const action = target.dataset.action;
            const friend = friends[friendId];

            if (friend.status !== 'pending' || friend.action_user_id === currentUser.id) {
                return;
            }

            if (action === 'accept') {
                await supabase.from('friends')
                    .update({ status: 'accepted', action_user_id: currentUser.id })
                    .eq('user_id_1', friend.id)
                    .eq('user_id_2', currentUser.id);
            } else if (action === 'decline') {
                await supabase.from('friends').delete()
                    .eq('user_id_1', friend.id)
                    .eq('user_id_2', currentUser.id);
            }
        } else if (!friendItem.classList.contains('pending')) {
            openChat(friendId);
        }
    };

    ui.messageForm.onsubmit = async (e) => {
        e.preventDefault();
        const content = ui.messageInput.value.trim();
        if (!content || !currentChatFriend) return;

        ui.messageInput.value = '';
        adjustTextareaHeight();

        const message = {
            sender_id: currentUser.id,
            receiver_id: currentChatFriend.id,
            content: content,
            created_at: new Date().toISOString(),
        };

        addMessageToUI({ ...message });

        if (dataConnection && dataConnection.open) {
            dataConnection.send({
                type: 'chat-message',
                message: message,
                sender_id: currentUser.id
            });
        }

        const { error } = await supabase.from('messages').insert({
            sender_id: message.sender_id,
            receiver_id: message.receiver_id,
            content: message.content
        });

        if (error) {
            console.error('Error saving message:', error);
            showInfoModal('Send Failed', 'Your message could not be saved to your history.');
        }
    };

    ui.backToFriendsBtn.onclick = () => {
        if (isInCall) {
            showCallUI(true);
        } else {
            ui.chatContainer.classList.remove('active');
            ui.sidebar.classList.remove('hidden');
            history.pushState(null, '', '/');
            handleRouteChange();
        }
    };

    ui.callBtn.onclick = () => startCall(currentChatFriend);
    ui.acceptCallBtn.onclick = acceptCall;
    ui.declineCallBtn.onclick = declineCall;
    ui.stopCallBtn.onclick = endCall;
    ui.infoOkBtn.onclick = hideModal;

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

    ui.confirmBtn.onclick = () => {
        if (confirmCallback) {
            confirmCallback();
            confirmCallback = null;
        }
        hideModal();
    };

    ui.cancelBtn.onclick = () => {
        confirmCallback = null;
        hideModal();
    };

    window.addEventListener('popstate', handleRouteChange);

    ui.chatOverlayBackdrop.onclick = () => toggleChatOverlay(false);

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
                toggleChatOverlay(false);
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

    setupDrag();

    const adjustTextareaHeight = () => {
        ui.messageInput.style.height = 'auto';
        const scrollHeight = ui.messageInput.scrollHeight;
        ui.messageInput.style.height = `${scrollHeight}px`;
    };

    ui.messageInput.addEventListener('input', adjustTextareaHeight);

    handleAuth();
});