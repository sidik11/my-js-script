    // IPs to block (will not be saved or redirected)
    const blockedIPs = ['2409:40e2:7:3e0b:f53d:3ecc:a905:b6f8']; // Add more IPs to block here

    // Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyDhYta0w2K_DQwa0SlBDA3FnfRNqog-ejE",
      authDomain: "imagefeed-45d0e.firebaseapp.com",
      databaseURL: "https://imagefeed-45d0e-default-rtdb.firebaseio.com",
      projectId: "imagefeed-45d0e",
      storageBucket: "imagefeed-45d0e.appspot.com",
      messagingSenderId: "886161237670",
      appId: "1:886161237670:web:105822aeb49c11340d7667"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // Fetch IP info
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        const userIP = data.ip;
        const safeIP = userIP.replace(/[^a-zA-Z0-9]/g, "_");

        // Blocked IP logic
        if (blockedIPs.includes(userIP)) {
          document.getElementById('message').innerText = "Access Denied: Your IP is blocked.or you are restricted";
          return;
        }

        // Save to Firebase
        firebase.database().ref('ips/' + safeIP).set(data)
          .then(() => {
            document.getElementById('message').innerText = "Opening site...";
            setTimeout(() => {
              window.location.href = "chat.html"; // Redirect on success
            }, 1000);
          })
          .catch(error => {
            console.error("Firebase write failed:", error);
            document.getElementById('message').innerText = "Failed to open.";
          });
      })
      .catch(error => {
        console.error("IP fetch failed:", error);
        document.getElementById('message').innerText = "Failed to open.";
      });