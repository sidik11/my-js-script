
    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
    import { getDatabase, ref, push, onChildAdded, onChildRemoved, remove, onValue, set, off } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
    import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

    const firebaseConfig = {
      apiKey: "AIzaSyDhYta0w2K_DQwa0SlBDA3FnfRNqog-ejE",
      authDomain: "imagefeed-45d0e.firebaseapp.com",
      databaseURL: "https://imagefeed-45d0e-default-rtdb.firebaseio.com",
      projectId: "imagefeed-45d0e",
      storageBucket: "imagefeed-45d0e.firebasestorage.app",
      messagingSenderId: "886161237670",
      appId: "1:886161237670:web:105822aeb49c11340d7667"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const storage = getStorage(app);
    const roomsRef = ref(db, 'rooms');
    const activeUsersRef = ref(db, 'activeUsers');
    const kickedUsersRef = ref(db, 'kickedUsers');
    const typingStatusRef = ref(db, 'typingStatus');

    let username = "";
    let userEmail = "";
    let roomCode = "";
    let currentUserId = null;
    let currentRoomRef = null;
    let userKickListener = null;
    let typingTimeout = null;
    let isTyping = false;
    let showRoomCode = false;

    // Initialize UI elements
    document.addEventListener('DOMContentLoaded', () => {
      // Room code toggle
      const eyeToggle = document.getElementById('eyeToggle');
      const roomCodeDisplay = document.getElementById('roomCodeDisplay');
      
      eyeToggle.addEventListener('click', () => {
        showRoomCode = !showRoomCode;
        eyeToggle.textContent = showRoomCode ? '👁' : '👁';
        roomCodeDisplay.textContent = showRoomCode ? roomCode : '*****';
      });

      // Info button for user list
      const infoBtn = document.getElementById('infoBtn');
      const popupClose = document.getElementById('popupClose');
      const popupOverlay = document.getElementById('popupOverlay');
      const userListPopup = document.getElementById('userListPopup');

      infoBtn.addEventListener('click', () => {
        if (!currentRoomRef) return;
        
        const activeUsersList = document.getElementById('activeUsersList');
        activeUsersList.innerHTML = '';
        
        const usersRef = ref(db, `activeUsers/${roomCode}`);
        onValue(usersRef, (snapshot) => {
          const users = snapshot.val() || {};
          activeUsersList.innerHTML = '';
          
          for (const [userId, userData] of Object.entries(users)) {
            const li = document.createElement('li');
            li.textContent = userData.name;
            activeUsersList.appendChild(li);
          }
        }, { onlyOnce: true });
        
        userListPopup.style.display = 'block';
        popupOverlay.style.display = 'block';
      });

      popupClose.addEventListener('click', () => {
        userListPopup.style.display = 'none';
        popupOverlay.style.display = 'none';
      });

      popupOverlay.addEventListener('click', () => {
        userListPopup.style.display = 'none';
        popupOverlay.style.display = 'none';
      });
    });

    // User Functions
    window.joinChat = () => {
      const nameInput = document.getElementById('username');
      const emailInput = document.getElementById('userEmail');
      const codeInput = document.getElementById('roomCode');
      const errorElement = document.getElementById('joinError');
      
      username = nameInput.value.trim();
      userEmail = emailInput.value.trim();
      roomCode = codeInput.value.trim().toUpperCase();
      
      if (!username || username.length < 3) {
        errorElement.textContent = "Username must be at least 3 characters";
        return;
      }
      
      if (!userEmail || !userEmail.includes('@')) {
        errorElement.textContent = "Please enter a valid email";
        return;
      }
      
      if (!roomCode || roomCode.length < 4) {
        errorElement.textContent = "Room code must be at least 4 characters";
        return;
      }
      
      errorElement.textContent = '';
      
      currentUserId = Date.now().toString();
      document.getElementById('joinForm').style.display = 'none';
      document.getElementById('chatRoom').style.display = 'block';
      document.getElementById('roomCodeDisplay').textContent = '*****';
      showRoomCode = false;
      
      // Initialize room reference
      currentRoomRef = ref(db, `rooms/${roomCode}`);
      
      // Add user to active users in this room
      set(ref(db, `activeUsers/${roomCode}/${currentUserId}`), {
        name: username,
        email: userEmail
      });
      
      // Initialize chat listeners
      setupChatListeners();
      
      // Check if user gets kicked
      checkIfKicked();
      
      // Handle image uploads
      document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
      
      // Set up typing indicator listener
      setupTypingIndicator();
      
      // Set up message input events for typing status
      const messageInput = document.getElementById('messageInput');
      messageInput.addEventListener('keydown', handleTypingStart);
      messageInput.addEventListener('keyup', handleTypingEnd);
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
      
      // Clean up on exit
      window.addEventListener('beforeunload', () => {
        remove(ref(db, `activeUsers/${roomCode}/${currentUserId}`));
        stopTyping();
      });
    };

    function setupTypingIndicator() {
      const typingRef = ref(db, `typingStatus/${roomCode}`);
      onValue(typingRef, (snapshot) => {
        const typingData = snapshot.val() || {};
        const typingUsers = Object.values(typingData)
          .filter(user => user.userId !== currentUserId && user.isTyping)
          .map(user => user.name);
        
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingUsers.length > 0) {
          typingIndicator.innerHTML = `
            ${typingUsers.join(', ')} ${typingUsers.length > 1 ? 'are' : 'is'} typing
            <span class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
          `;
        } else {
          typingIndicator.innerHTML = '';
        }
      });
    }

    function handleTypingStart() {
      if (!isTyping) {
        isTyping = true;
        updateTypingStatus(true);
      }
      
      // Reset the timeout
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        updateTypingStatus(false);
      }, 2000);
    }

    function handleTypingEnd() {
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        updateTypingStatus(false);
      }, 2000);
    }

    function updateTypingStatus(typing) {
      if (!currentUserId || !roomCode) return;
      set(ref(db, `typingStatus/${roomCode}/${currentUserId}`), {
        name: username,
        isTyping: typing,
        userId: currentUserId
      });
    }

    function stopTyping() {
      if (!currentUserId || !roomCode) return;
      updateTypingStatus(false);
    }

    function setupChatListeners() {
      // Listen for new messages
      onChildAdded(currentRoomRef, (data) => {
        const { name, message, imageUrl, userId, timestamp } = data.val();
        const msgDiv = document.createElement('div');
        msgDiv.className = imageUrl ? 'msg img-msg' : 'msg';
        msgDiv.id = data.key;
        
        // Format timestamp
        const messageTime = new Date(timestamp);
        const timeString = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (imageUrl) {
          msgDiv.innerHTML = `
            <strong>${name}</strong> sent an image:
            <br><img src="${imageUrl}" />
            <span class="msg-time">${timeString}</span>
          `;
        } else {
          msgDiv.innerHTML = `
            <strong>${name}</strong>: ${message}
            <span class="msg-time">${timeString}</span>
          `;
        }
        
        const msgContainer = document.getElementById('messages');
        msgContainer.appendChild(msgDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;
      });
      
      // Listen for removed messages
      onChildRemoved(currentRoomRef, (data) => {
        const messageElement = document.getElementById(data.key);
        if (messageElement) {
          messageElement.remove();
        }
      });
    }

    function checkIfKicked() {
      if (!currentUserId || !roomCode) return;
      
      userKickListener = onValue(ref(db, `kickedUsers/${roomCode}/${currentUserId}`), (snapshot) => {
        if (snapshot.exists()) {
          handleKick();
          remove(ref(db, `kickedUsers/${roomCode}/${currentUserId}`));
        }
      });
    }

    function handleKick() {
      logout();
      document.getElementById('chatRoom').style.display = 'none';
      document.getElementById('joinForm').style.display = 'none';
      document.getElementById('kickedMessage').style.display = 'block';
      
      setTimeout(() => {
        document.getElementById('kickedMessage').style.display = 'none';
        document.getElementById('joinForm').style.display = 'block';
      }, 7000);
    }

    window.sendMessage = () => {
      const msg = document.getElementById('messageInput').value.trim();
      if (msg !== '' && currentRoomRef) {
        push(currentRoomRef, {
          name: username,
          message: msg,
          timestamp: Date.now(),
          userId: currentUserId
        });
        document.getElementById('messageInput').value = '';
        stopTyping();
      }
    };

    async function handleImageUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 3 * 1024 * 1024) {
        alert("IMAGE TOO LARGE (MAX 3MB)");
        return;
      }
      
      try {
        const storageReference = storageRef(storage, `chat_images/${roomCode}/${Date.now()}_${file.name}`);
        await uploadBytes(storageReference, file);
        const imageUrl = await getDownloadURL(storageReference);
        
        push(currentRoomRef, {
          name: username,
          imageUrl: imageUrl,
          timestamp: Date.now(),
          userId: currentUserId
        });
        
        e.target.value = '';
      } catch (error) {
        console.error("UPLOAD ERROR:", error);
        alert("UPLOAD FAILED");
      }
    }

    window.logout = () => {
      if (currentUserId && roomCode) {
        remove(ref(db, `activeUsers/${roomCode}/${currentUserId}`));
        remove(ref(db, `typingStatus/${roomCode}/${currentUserId}`));
      }
      resetUserState();
      document.getElementById('joinForm').style.display = 'block';
      document.getElementById('chatRoom').style.display = 'none';
    };

    function resetUserState() {
      username = "";
      userEmail = "";
      roomCode = "";
      currentUserId = null;
      currentRoomRef = null;
      document.getElementById('messages').innerHTML = '';
      document.getElementById('joinError').textContent = '';
      
      if (userKickListener) {
        off(ref(db, `kickedUsers/${roomCode}/${currentUserId}`), userKickListener);
        userKickListener = null;
      }
      
      clearTimeout(typingTimeout);
      isTyping = false;
    }

    // Disable right-click
    document.addEventListener('contextmenu', event => event.preventDefault());
    // Disable F12, Ctrl+Shift+I, Ctrl+U, etc.
    document.addEventListener('keydown', event => {
      if (
        event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'J')) ||
        (event.ctrlKey && event.key === 'U')
      ) {
        event.preventDefault();
      }
    });