// --- IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, getDocs, getDoc, setDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
let currentSubjectId = null;

// --- MAIN APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM ELEMENTS ---
    const mainContent = document.getElementById('main-content');
    const homePage = document.getElementById('home-page');
    const createTrackerButton = document.getElementById('create-tracker-button');
    const trackerGrid = document.getElementById('tracker-grid');
    const subjectsPage = document.getElementById('subjects-page');
    const backToTrackersButton = document.getElementById('back-to-trackers');
    const trackerTitle = document.getElementById('tracker-title');
    const createSubjectButton = document.getElementById('create-subject-button');
    const subjectCardsContainer = document.getElementById('subject-cards-container');
    const tasksPage = document.getElementById('tasks-page');
    const backToSubjectsButton = document.getElementById('back-to-subjects');
    const subjectTitleTasks = document.getElementById('subject-title-tasks');
    const taskProgressBar = document.getElementById('task-progress-bar');
    const taskProgressText = document.getElementById('task-progress-text');
    const addTaskForm = document.getElementById('add-task-form');
    const newTaskInput = document.getElementById('new-task-input');
    const taskListContainer = document.getElementById('task-list-container');
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
        try { await signInWithPopup(auth, provider); } catch (error) { console.error("Authentication failed:", error); }
    };
    const signOutUser = async () => {
        try { await signOut(auth); } catch (error) { console.error("Sign out failed:", error); }
    };

    // --- EVENT LISTENERS (CORRECTED) ---
    signInButton.addEventListener('click', signIn);
    signOutButton.addEventListener('click', signOutUser);
    createTrackerButton.addEventListener('click', createNewTracker);
    createSubjectButton.addEventListener('click', createNewSubject);
    addTaskForm.addEventListener('submit', handleAddTask);
    backToTrackersButton.addEventListener('click', () => {
        homePage.classList.remove('hidden');
        subjectsPage.classList.add('hidden');
        currentTrackerId = null;
    });
    backToSubjectsButton.addEventListener('click', () => {
        subjectsPage.classList.remove('hidden');
        tasksPage.classList.add('hidden');
        currentSubjectId = null;
        renderSubjects(); // Re-render subjects when going back
    });

    // --- RENDER TRACKERS PAGE ---
    async function renderTrackersPage() {
        // ... (This function is correct, no changes needed)
    }

    // --- CREATE NEW TRACKER ---
    async function createNewTracker() {
        // ... (This function is correct, no changes needed)
    }

    // --- OPEN TRACKER ---
    function openTracker(trackerId, trackerName) {
        currentTrackerId = trackerId;
        homePage.classList.add('hidden');
        subjectsPage.classList.remove('hidden');
        trackerTitle.textContent = trackerName;
        renderSubjects();
    }

    // --- RENDER SUBJECTS PAGE ---
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
                    card.addEventListener('click', () => openSubject(doc.id, subject.name));
                    subjectCardsContainer.appendChild(card);
                });
            }
        } catch (error) { console.error("Error fetching subjects:", error); }
    }
    
    // --- CREATE NEW SUBJECT ---
    async function createNewSubject() {
        // ... (This function is correct, no changes needed)
    }

    // --- OPEN SUBJECT / TASKS PAGE ---
    function openSubject(subjectId, subjectName) {
        currentSubjectId = subjectId;
        subjectsPage.classList.add('hidden');
        tasksPage.classList.remove('hidden');
        subjectTitleTasks.textContent = subjectName;
        renderTasks();
    }
    /**
     * Renders the checklist of tasks for the currently open subject.
     */
    async function renderTasks() {
        if (!currentSubjectId) return;
        taskListContainer.innerHTML = '';

        const subjectRef = doc(db, "users", userId, "trackers", currentTrackerId, "subjects", currentSubjectId);
        const docSnap = await getDoc(subjectRef);

        if (!docSnap.exists() || !docSnap.data().tasks) {
            updateTaskProgress(0, 0); // Reset progress bar
            return;
        }

        const tasks = docSnap.data().tasks;
        let completedTasks = 0;

        tasks.forEach((task, index) => {
            if (task.completed) completedTasks++;
            const taskItem = document.createElement('label');
            taskItem.className = 'flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700';
            taskItem.innerHTML = `
                <input type="checkbox" data-index="${index}" class="h-5 w-5 rounded text-purple-600 bg-gray-200 border-gray-300 focus:ring-purple-500" ${task.completed ? 'checked' : ''}>
                <span class="ml-3 text-md ${task.completed ? 'line-through text-gray-500' : ''}">${task.name}</span>
            `;
            const checkbox = taskItem.querySelector('input');
            checkbox.addEventListener('change', handleTaskToggle);
            taskListContainer.appendChild(taskItem);
        });

        updateTaskProgress(completedTasks, tasks.length);
    }

    /**
     * Handles the form submission for adding a new task.
     */
    async function handleAddTask(event) {
        event.preventDefault();
        const taskName = newTaskInput.value.trim();
        if (taskName === '' || !currentSubjectId) return;

        const subjectRef = doc(db, "users", userId, "trackers", currentTrackerId, "subjects", currentSubjectId);
        
        try {
            const docSnap = await getDoc(subjectRef);
            const existingTasks = docSnap.exists() && docSnap.data().tasks ? docSnap.data().tasks : [];
            
            const newTasks = [...existingTasks, { name: taskName, completed: false }];
            await setDoc(subjectRef, { tasks: newTasks }, { merge: true });

            newTaskInput.value = ''; // Clear input field
            renderTasks(); // Refresh the list
        } catch (error) {
            console.error("Error adding task: ", error);
        }
    }

    /**
     * Handles toggling a task's completion status.
     */
    async function handleTaskToggle(event) {
        const taskIndex = parseInt(event.target.dataset.index);
        const isChecked = event.target.checked;

        const subjectRef = doc(db, "users", userId, "trackers", currentTrackerId, "subjects", currentSubjectId);

        try {
            const docSnap = await getDoc(subjectRef);
            if (!docSnap.exists()) return;

            const tasks = docSnap.data().tasks;
            tasks[taskIndex].completed = isChecked;

            await setDoc(subjectRef, { tasks: tasks }, { merge: true });
            renderTasks(); // Refresh list to update progress and styles
        } catch (error) {
            console.error("Error updating task: ", error);
        }
    }

    /**
     * Updates the task progress bar and text.
     */
    function updateTaskProgress(completed, total) {
        if (total === 0) {
            taskProgressBar.style.width = '0%';
            taskProgressText.textContent = '0%';
            return;
        }
        const percentage = Math.round((completed / total) * 100);
        taskProgressBar.style.width = `${percentage}%`;
        taskProgressText.textContent = `${percentage}%`;
    }
});