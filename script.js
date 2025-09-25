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
// Make sure this is the correct config for your "pro-tracker-final" project
const firebaseConfig = {
  apiKey: "AIzaSyBBcIzVdT6Ce6aPAotw1kdCK4wFRiEo5QQ",
  authDomain: "pro-tracker-final.firebaseapp.com",
  projectId: "pro-tracker-final",
  storageBucket: "pro-tracker-final.firebasestorage.app",
  messagingSenderId: "236431092015",
  appId: "1:236431092015:web:0704d2762aa34d60f559da"
};

// --- DATA CONFIGURATION (This will become dynamic later) ---
// Note: These constants are for the old subject page. We will replace this system soon.
const TASK_COLUMNS = ['Videos', 'Notes', 'Book Examples', 'DPPs', 'Workbook Exercises', 'PYQs', 'Test Series', 'Bites & Bytes', 'ISRO/ESE PYQs', 'Revision 1', 'Revision 2', 'ME Short Notes'];
const TOPICS = {
    'MATH': ['Linear Algebra', 'Calculus', 'Differential Equations', 'Complex Variables', 'Probability'],
};

// --- FIREBASE INITIALIZATION ---
let app, db, auth, userId, unsubscribeSnapshot = null;
app = initializeApp(firebaseConfig);
db = getFirestore(app);
auth = getAuth(app);

// --- DOM ELEMENTS ---
const mainContent = document.getElementById('main-content');
const homePage = document.getElementById('home-page');
const subjectPage = document.getElementById('subject-page');
const backButton = document.getElementById('back-button');
const subjectTitle = document.getElementById('subject-title');
const topicCardsContainer = document.getElementById('topic-cards-container');

// NEW/MODIFIED DOM ELEMENTS
const createTrackerButton = document.getElementById('create-tracker-button');
const trackerGrid = document.getElementById('tracker-grid');

// AUTH UI ELEMENTS
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
        
        // Render the new trackers page instead of the old homepage
        renderTrackersPage(); 
    } else {
        userId = null;
        mainContent.classList.add('hidden');
        userProfile.classList.add('hidden');
        signInButton.classList.remove('hidden');
        welcomeMessage.textContent = 'Track your progress, achieve your goals.';
        trackerGrid.innerHTML = '';
    }
});

const signIn = async () => { /* ... (no changes) ... */ };
const signOutUser = async () => { /* ... (no changes) ... */ };

signInButton.addEventListener('click', signIn);
signOutButton.addEventListener('click', signOutUser);
createTrackerButton.addEventListener('click', createNewTracker); // New event listener

// --- NEW DYNAMIC TRACKER FUNCTIONS ---

/**
 * Fetches all trackers for the current user from Firestore and displays them.
 */
async function renderTrackersPage() {
    trackerGrid.innerHTML = ''; // Clear existing trackers
    
    try {
        const trackersRef = collection(db, "users", userId, "trackers");
        const q = query(trackersRef, orderBy("createdAt", "desc")); // Show newest first
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            trackerGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">No trackers found. Create one to get started!</p>`;
        } else {
            querySnapshot.forEach((doc) => {
                const tracker = doc.data();
                const card = document.createElement('div');
                card.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:bg-purple-50 dark:hover:bg-gray-700';
                card.innerHTML = `<h3 class="text-lg font-bold text-center text-purple-700 dark:text-purple-300">${tracker.name}</h3>`;
                // We'll add the click event to open the tracker in the next step
                // card.addEventListener('click', () => openTracker(doc.id));
                trackerGrid.appendChild(card);
            });
        }
    } catch (error) {
        console.error("Error fetching trackers:", error);
        trackerGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Could not load trackers.</p>`;
    }
}

/**
 * Prompts the user for a new tracker name and saves it to Firestore.
 */
async function createNewTracker() {
    const trackerName = prompt("Enter the name for your new tracker (e.g., 'UPSC 2026', 'Semester Project'):");

    if (trackerName && trackerName.trim() !== '') {
        try {
            const trackersRef = collection(db, "users", userId, "trackers");
            await addDoc(trackersRef, {
                name: trackerName.trim(),
                createdAt: serverTimestamp()
            });
            // Refresh the list to show the new tracker
            renderTrackersPage();
        } catch (error) {
            console.error("Error creating tracker:", error);
            alert("Could not create tracker. Please try again.");
        }
    }
}


// --- OLD SUBJECT/TOPIC PAGE LOGIC (To be replaced) ---
backButton.addEventListener('click', () => {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    homePage.classList.remove('hidden');
    subjectPage.classList.add('hidden');
    // We will need to update this logic later
});

function showSubjectPage(subject) { /* ... (no changes for now) ... */ }
function renderTopicCards(subject, subjectData) { /* ... (no changes for now) ... */ }
function updateOverallSubjectProgress(subject, subjectData) { /* ... (no changes for now) ... */ }
async function handleCheckboxChange(event) { /* ... (no changes for now) ... */ }