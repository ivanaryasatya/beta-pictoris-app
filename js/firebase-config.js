// Firebase Configuration File
// REPLACE WITH YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyAIBdhO3OfKWXTPZoowuRNbxNTCQ6vW2qo",
  authDomain: "sollarion-f7d4f.firebaseapp.com",
  databaseURL: "https://sollarion-f7d4f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sollarion-f7d4f",
  storageBucket: "sollarion-f7d4f.firebasestorage.app",
  messagingSenderId: "443730729017",
  appId: "1:443730729017:web:6346048d0d1192008f95e8",
  measurementId: "G-XNM9Y96J8C"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase Initialized");
} catch (e) {
    console.warn("Firebase Initialization Error (Check config):", e);
}

const auth = firebase.auth();
const database = firebase.database();

// Make globally available
window.auth = auth;
window.database = database;
