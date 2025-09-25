// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    collection,
    addDoc,
    getDocs,
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBBcIzVdT6Ce6aPAotw1kdCK4wFRiEo5QQ",
    authDomain: "pro-tracker-final.firebaseapp.com",
    projectId: "pro-tracker-final",
    storageBucket: "pro-tracker-final.firebasestorage.app",
    messagingSenderId: "236431092015",
    appId: "1:236431092015:web:0704d2762aa34d60f559da"
};

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- GLOBAL VARIABLES ---
let userId;
let currentTrackerId = null;

// --- MAIN APP INITIALIZATION ---
// This listener waits for the HTML to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM ELEMENTS ---
    const mainContent = document.getElementById('main-content');
    const homePage = document.getElementById('home-page');
    const backButton = document.getElementById('back-button');
    const createTrackerButton = document.getElementById('create-tracker-button');
    const trackerGrid = document.getElementById('tracker-grid');
    const subjectsPage = document.getElementById('subjects-page');
    const trackerTitle = document.getElementById('tracker-title');
    const createSubjectButton = document.getElementById('create-subject-button');
    const subjectCardsContainer = document.getElementById('subject-cards-container');
    const signInButton = document.getElementById('sign-in-button');
    const signOutButton = document.getElementById('sign-out-button');
    const userProfile = document.getElementById('user-profile');
    const userPhoto = document.getElementById('user-photo');
    const welcomeMessage = document.getElementById('welcome-message');

    // --- AUTHENTICATION LOGIC ---
    onAuthStateChanged(auth, user => {
        if (user) {
            userId = user.uid;
            mainContent.classList.remove('hidden');
            userProfile.classList.remove('hidden');
            signInButton.classList.add('hidden');
            userPhoto.src = user.photoURL;
            const welcomeText = user.displayName ? `Welcome, ${user.displayName.split(' ')[0]}!` : 'Welcome!';
            welcomeMessage.textContent = welcomeText;
            renderTrackersPage(); 
        } else {
            userId = null;
            mainContent.classList.add('hidden');
            userProfile.classList.add('hidden');
            signInButton.classList.remove('hidden');
            welcomeMessage.textContent = 'Track your progress, achieve your goals.';
            if (trackerGrid) trackerGrid.innerHTML = '';
        }
    });

    const signIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Authentication failed:", error);
        }
    };

    const signOutUser = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign out failed:", error);
        }
    };

    // --- EVENT LISTENERS ---
    signInButton.addEventListener('click', signIn);
    signOutButton.addEventListener('click', signOutUser);
    createTrackerButton.addEventListener('click', createNewTracker);
    createSubjectButton.addEventListener('click', createNewSubject);
    backButton.addEventListener('click', () => {
        homePage.classList.remove('hidden');
        subjectsPage.classList.add('hidden');
        currentTrackerId = null; 
    });

    // --- DYNAMIC TRACKER/SUBJECT FUNCTIONS ---

    async function renderTrackersPage() {
        trackerGrid.innerHTML = '';
        try {
            const trackersRef = collection(db, "users", userId, "trackers");
            const q = query(trackersRef, orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                trackerGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">No trackers found. Create one to get started!</p>`;
            } else {
                querySnapshot.forEach((doc) => {
                    const tracker = doc.data();
                    const card = document.createElement('div');
                    card.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:bg-purple-50 dark:hover:bg-gray-700';
                    card.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-700 dark:text-purple-300">${tracker.name}</h3>`;
                    card.addEventListener('click', () => openTracker(doc.id, tracker.name));
                    trackerGrid.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Error fetching trackers:", error);
            trackerGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Could not load trackers.</p>`;
        }
    }

    async function createNewTracker() {
        const trackerName = prompt("Enter the name for your new tracker (e.g., 'UPSC 2026', 'Semester Project'):");
        if (trackerName && trackerName.trim() !== '') {
            try {
                const trackersRef = collection(db, "users", userId, "trackers");
                await addDoc(trackersRef, {
                    name: trackerName.trim(),
                    createdAt: serverTimestamp()
                });
                renderTrackersPage();
            } catch (error) {
                console.error("Error creating tracker:", error);
                alert("Could not create tracker. Please try again.");
            }
        }
    }

    function openTracker(trackerId, trackerName) {
        currentTrackerId = trackerId;
        homePage.classList.add('hidden');
        subjectsPage.classList.remove('hidden');
        trackerTitle.textContent = trackerName;
        renderSubjects();
    }

    async function renderSubjects() {
        if (!currentTrackerId) return;
        subjectCardsContainer.innerHTML = '';
        try {
            const subjectsRef = collection(db, "users", userId, "trackers", currentTrackerId, "subjects");
            const q = query(subjectsRef, orderBy("createdAt", "asc"));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                subjectCardsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">No subjects yet. Add one to begin!</p>`;
            } else {
                querySnapshot.forEach((doc) => {
                    const subject = doc.data();
                    const card = document.createElement('div');
                    card.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:bg-green-50 dark:hover:bg-gray-700';
                    card.innerHTML = `<h3 class="text-lg font-bold text-center text-green-700 dark:text-green-300">${subject.name}</h3>`;
                    subjectCardsContainer.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Error fetching subjects:", error);
            subjectCardsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Could not load subjects.</p>`;
        }
    }

    async function createNewSubject() {
        if (!currentTrackerId) return;
        const subjectName = prompt("Enter the name for your new subject (e.g., 'Mathematics', 'Chapter 1'):");
        if (subjectName && subjectName.trim() !== '') {
            try {
                const subjectsRef = collection(db, "users", userId, "trackers", currentTrackerId, "subjects");
                await addDoc(subjectsRef, {
                    name: subjectName.trim(),
                    createdAt: serverTimestamp()
                });
                renderSubjects();
            } catch (error) {
                console.error("Error creating subject:", error);
                alert("Could not create subject. Please try again.");
            }
        }
    }
});