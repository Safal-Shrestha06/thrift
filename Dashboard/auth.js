// =====================================================================
// auth.js — shared Firebase Authentication setup.
// Imported by login.js, signup.js, and thrift.js so every page uses
// the exact same Firebase project/auth instance.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
	apiKey: "AIzaSyBKoqxEtKM0bqJNEA1nGAp7den0Z3jFEyk",
	authDomain: "thriftstore-8e197.firebaseapp.com",
	projectId: "thriftstore-8e197",
	storageBucket: "thriftstore-8e197.firebasestorage.app",
	messagingSenderId: "904578696771",
	appId: "1:904578696771:web:30283b46a5066b1ac836f6",
	measurementId: "G-3SGMZE55JR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
