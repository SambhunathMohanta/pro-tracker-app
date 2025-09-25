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
    doc, 
    setDoc, 
    onSnapshot, 
    getDoc,
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
let app, db, auth, userId;
let currentTrackerId = null; // Variable to keep track of the currently open tracker
app = initializeApp(firebaseConfig);
db = getFirestore(app);
auth = getAuth(app);

// --- DOM ELEMENTS ---
const mainContent = document.getElementById('main-content');
const homePage = document.getElementById('home-page');
const backButton = document.getElementById('back-button');

// TRACKER PAGE ELEMENTS
const createTrackerButton = document.getElementById('create-tracker-button');
const trackerGrid = document.getElementById('tracker-grid');

// SUBJECTS PAGE ELEMENTS
const subjectsPage = document.getElementById('subjects-page');
const trackerTitle = document.getElementById('tracker-title');
const createSubjectButton = document.getElementById('create-subject-button');
const subjectCardsContainer = document.getElementById('subject-cards-container');

// AUTH UI ELEMENTS
// ... (no changes) ...

// --- AUTHENTICATION LOGIC ---
onAuthStateChanged(auth, user => {
    // ... (no changes) ...
});

// ... (signIn and signOutUser functions are unchanged) ...

// --- EVENT LISTENERS ---
signInButton.addEventListener('click', signIn);
signOutButton.addEventListener('click', signOutUser);
createTrackerButton.addEventListener('click', createNewTracker);
createSubjectButton.addEventListener('clcick', createNewSubject); // New listener for subjects
backButton.addEventListener('click', () => {
    // This button now always takes you back to the home/trackers page
    homePage.classList.remove('hidden');
    subjectsPage.classList.add('hidden');
    currentTrackerId = null; // Reset the current tracker
});

// --- DYNAMIC TRACKER/SUBJECT FUNCTIONS ---

/**
 * Fetches and displays all trackers for the current user.
 */
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
                
                // *** NEW: Add click event listener to open the tracker ***
                card.addEventListener('click', () => openTracker(doc.id, tracker.name));
                trackerGrid.appendChild(card);
            });
        }
    } catch (error) { /* ... (no changes) ... */ }
}

/**
 * Prompts for and creates a new tracker in Firestore.
 */
async function createNewTracker() { /* ... (no changes) ... */ }

/**
 * Hides the trackers page and shows the subjects page for a specific tracker.
 * @param {string} trackerId The ID of the tracker document in Firestore.
 * @param {string} trackerName The name of the tracker.
 */
function openTracker(trackerId, trackerName) {
    currentTrackerId = trackerId; // Set the current tracker context
    homePage.classList.add('hidden');
    subjectsPage.classList.remove('hidden');
    trackerTitle.textContent = trackerName;
    renderSubjects(); // Load the subjects for this tracker
}

/**
 * Fetches and displays all subjects for the currently open tracker.
 */
async function renderSubjects() {
    if (!currentTrackerId) return; // Safety check

    subjectCardsContainer.innerHTML = '';
    try {
        const subjectsRef = collection(db, "users", userId, "trackers", currentTrackerId, "subjects");
        const q = query(subjectsRef, orderBy("createdAt", "asc")); // Show oldest first
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            subjectCardsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">No subjects yet. Add one to begin!</p>`;
        } else {
            querySnapshot.forEach((doc) => {
                const subject = doc.data();
                const card = document.createElement('div');
                card.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:bg-green-50 dark:hover:bg-gray-700';
                card.innerHTML = `<h3 class="text-lg font-bold text-center text-green-700 dark:text-green-300">${subject.name}</h3>`;
                // In the final step, we'll make these cards open the task view.
                subjectCardsContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error("Error fetching subjects:", error);
        subjectCardsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Could not load subjects.</p>`;
    }
}

/**
 * Prompts for and creates a new subject within the current tracker.
 */
async function createNewSubject() {
    if (!currentTrackerId) return; // Safety check

    const subjectName = prompt("Enter the name for your new subject (e.g., 'Mathematics', 'Chapter 1'):");

    if (subjectName && subjectName.trim() !== '') {
        try {
            const subjectsRef = collection(db, "users", userId, "trackers", currentTrackerId, "subjects");
            await addDoc(subjectsRef, {
                name: subjectName.trim(),
                createdAt: serverTimestamp()
            });
            renderSubjects(); // Refresh the list to show the new subject
        } catch (error) {
            console.error("Error creating subject:", error);
            alert("Could not create subject. Please try again.");
        }
    }
}