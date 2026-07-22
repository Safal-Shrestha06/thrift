// =====================================================================
// auth.js — shared Firebase Authentication setup.
// Imported by login.js, signup.js, and thrift.js so every page uses
// the exact same Firebase project/auth instance.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
	apiKey: "AIzaSyC8P6Ws_QBB3cXmdPjTQx1jGVqD8PYCYOw",
	authDomain: "thriftstore01.firebaseapp.com",
	projectId: "thriftstore01",
	storageBucket: "thriftstore01.firebasestorage.app",
	messagingSenderId: "904619736486",
	appId: "1:904619736486:web:d153c192f51a168e09a367",
	measurementId: "G-K2XFJ7V9WF"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
