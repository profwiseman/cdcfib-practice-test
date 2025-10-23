// --- FIREBASE IMPORTS (Conditional Use) ---
// These imports are only used if the application is run within the designated Canvas environment.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, updateDoc, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL CONSTANTS ---
// Define the base subjects that are always included in the exam.
const FIXED_SUBJECTS = ['MATHS', 'ENGLISH', 'GENERAL']; 
const TOTAL_QUESTIONS_COUNT = 50; 
const MAX_TIME_SECONDS = 30 * 60; // 30 minutes converted to seconds.

// Define the required question count for each subject category to hit 50 questions.
const QUESTIONS_PER_SUBJECT_MAP = {
    MATHS: 13,
    ENGLISH: 13,
    GENERAL: 12,
    DEPARTMENTAL: 12
};

// --- FIREBASE AND STATE VARIABLES ---
let app, db, auth;
let userId = ''; 
let isFirebaseActive = false; // Flag to track if Firebase is successfully initialized

// Application state variables
let currentQuestionIndex = 0; 
let examQuestions = []; 
let userAnswers = {}; 
let timerInterval; 
let timeRemaining = MAX_TIME_SECONDS;
let candidateName = '';
let selectedDepartment = '';

// Global Firebase variables provided by the environment (will be undefined in local run)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- DOM ELEMENT REFERENCES ---
const startScreen = document.getElementById('start-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const examScreen = document.getElementById('exam-screen');
const resultsScreen = document.getElementById('results-screen');
const loadingSpinner = document.getElementById('loading-spinner');
const nameInput = document.getElementById('name-input');
const startButton = document.getElementById('start-button');
const departmentSelect = document.getElementById('department-select');
const confirmationModal = document.getElementById('confirmation-modal');
const confirmStartButton = document.getElementById('confirm-start-button');

// --- QUESTION DATA (New 4-Subject Structure) ---
const fullQuestionsData = [
    // --- MATHEMATICS (15 Questions Pool) ---
    { id: 'M1', subject: 'MATHS', q: 'Simplify: $3x + 5y - x + 2y$', options: { A: '$4x + 7y$', B: '$2x + 7y$', C: '$4x + 3y$', D: '$2x + 3y$' }, ans: 'B', exp: 'Combine like terms: $(3x - x) + (5y + 2y) = 2x + 7y$.' },
    { id: 'M2', subject: 'MATHS', q: 'What is the value of $\\frac{1}{4}$ of $100$?', options: { A: '50', B: '25', C: '40', D: '75' }, ans: 'B', exp: 'One-quarter of 100 is $100 \\div 4 = 25$.' },
    { id: 'M3', subject: 'MATHS', q: 'If a man buys a shirt for N800 and sells it for N1000, what is his profit percentage?', options: { A: '$20\\%$', B: '$25\\%$', C: '$15\\%$', D: '$10\\%$' }, ans: 'B', exp: 'Profit is N200. Profit percentage is $(\\frac{200}{800}) \\times 100 = 25\\%$.' },
    { id: 'M4', subject: 'MATHS', q: 'Solve for x: $2x - 7 = 11$', options: { A: '$x = 8$', B: '$x = 9$', C: '$x = 10$', D: '$x = 18$' }, ans: 'B', exp: 'Add 7 to both sides: $2x = 18$. Divide by 2: $x = 9$.' },
    { id: 'M5', subject: 'MATHS', q: 'The next number in the sequence: $1, 4, 9, 16, 25, \\dots$', options: { A: '30', B: '32', C: '36', D: '49' }, ans: 'C', exp: 'The sequence consists of perfect squares: $1^2, 2^2, 3^2, 4^2, 5^2$. The next is $6^2 = 36$.' },
    { id: 'M6', subject: 'MATHS', q: 'Calculate the area of a circle with a radius of $7cm$ (use $\\pi = \\frac{22}{7}$)', options: { A: '$49cm^2$', B: '$154cm^2$', C: '$22cm^2$', D: '$14cm^2$' }, ans: 'B', exp: 'Area $= \\pi r^2 = \\frac{22}{7} \\times 7^2 = 22 \\times 7 = 154cm^2$.' },
    { id: 'M7', subject: 'MATHS', q: 'Convert $0.625$ to a fraction in its simplest form.', options: { A: '$\\frac{5}{8}$', B: '$\\frac{3}{5}$', C: '$\\frac{1}{2}$', D: '$\\frac{6}{10}$' }, ans: 'A', exp: '$0.625 = \\frac{625}{1000}$. Dividing by 125 gives $\\frac{5}{8}$.' },
    { id: 'M8', subject: 'MATHS', q: 'What is $2^3 + 3^2$?', options: { A: '12', B: '15', C: '17', D: '18' }, ans: 'C', exp: '$2^3 = 8$ and $3^2 = 9$. $8 + 9 = 17$.' },
    { id: 'M9', subject: 'MATHS', q: 'How many days are there in $10$ weeks?', options: { A: '70', B: '60', C: '75', D: '100' }, ans: 'A', exp: '$10 \\times 7 = 70$ days.' },
    { id: 'M10', subject: 'MATHS', q: 'Find the mean of the numbers: $5, 10, 15, 20$.', options: { A: '12', B: '12.5', C: '15', D: '50' }, ans: 'B', exp: 'Sum is 50. Mean is $\\frac{50}{4} = 12.5.' },
    { id: 'M11', subject: 'MATHS', q: 'If $a=3$ and $b=4$, find the value of $a^2 + b^2$.', options: { A: '7', B: '12', C: '25', D: '49' }, ans: 'C', exp: '$3^2 + 4^2 = 9 + 16 = 25.' },
    { id: 'M12', subject: 'MATHS', q: 'A train traveled $180km$ in $3$ hours. What was its speed in $km/h$?', options: { A: '$60km/h$', B: '$50km/h$', C: '$70km/h$', D: '90km/h' }, ans: 'A', exp: 'Speed = Distance / Time = $180km / 3h = 60km/h$.' },
    { id: 'M13', subject: 'MATHS', q: 'What is the highest common factor (H.C.F.) of $12$ and $18$?', options: { A: '3', B: '6', C: '9', D: '12' }, ans: 'B', exp: 'The factors of 12 are 1, 2, 3, 4, 6, 12. The factors of 18 are 1, 2, 3, 6, 9, 18. The largest common factor is 6.' },
    { id: 'M14', subject: 'MATHS', q: 'What is the sum of angles in a triangle?', options: { A: '$90^{\\circ}$', B: '$180^{\\circ}$', C: '$270^{\\circ}$', D: '$360^{\\circ}$' }, ans: 'B', exp: 'The sum of internal angles in any Euclidean triangle is always $180^{\\circ}$.' },
    { id: 'M15', subject: 'MATHS', q: 'A square has a perimeter of $40cm$. What is its area?', options: { A: '$10cm^2$', B: '$40cm^2$', C: '$100cm^2$', D: '$160cm^2$' }, ans: 'C', exp: 'Side length is $\\frac{40}{4} = 10cm$. Area is $10cm \\times 10cm = 100cm^2$.' },


    // --- ENGLISH LANGUAGE (15 Questions Pool) ---
    { id: 'E1', subject: 'ENGLISH', q: 'Choose the word that is **nearest in meaning** to the word: **ADHERE**', options: { A: 'Detach', B: 'Observe', C: 'Ignore', D: 'Neglect' }, ans: 'B', exp: 'To adhere means to stick firmly to (a rule or belief), making "Observe" the closest synonym.' },
    { id: 'E2', subject: 'ENGLISH', q: 'Identify the **verb** in the sentence: "The security officer quickly responded to the alarm."', options: { A: 'security', B: 'officer', C: 'quickly', D: 'responded' }, ans: 'D', exp: 'The verb is the action word in the sentence, which is "responded".' },
    { id: 'E3', subject: 'ENGLISH', q: 'Choose the correct preposition: "She is good **\\dots** mathematics."', options: { A: 'at', B: 'in', C: 'with', D: 'for' }, ans: 'A', exp: 'The correct idiom is "good at something".' },
    { id: 'E4', subject: 'ENGLISH', q: 'Find the word that is **opposite in meaning** to the word: **STRENGTH**', options: { A: 'Power', B: 'Weakness', C: 'Vigor', D: 'Energy' }, ans: 'B', exp: '"Weakness" is the direct opposite (antonym) of "Strength".' },
    { id: 'E5', subject: 'ENGLISH', q: 'Complete the sentence: "Neither John **\\dots** Jane was present at the briefing."', options: { A: 'or', B: 'and', C: 'nor', D: 'but' }, ans: 'C', exp: 'The correlative conjunction for "Neither" is "nor".' },
    { id: 'E6', subject: 'ENGLISH', q: 'The plural form of **crisis** is:', options: { A: 'crisisess', B: 'crises', C: 'crisises', D: 'crizis' }, ans: 'B', exp: 'Words ending in -is (like analysis, thesis) usually form the plural by changing -is to -es.' },
    { id: 'E7', subject: 'ENGLISH', q: 'Choose the sentence with correct punctuation:', options: { A: 'It\'s a good job.', B: 'Its a good job.', C: 'Its\' a good job.', D: 'Its a good job' }, ans: 'A', exp: '"It\'s" is the contraction of "It is".' },
    { id: 'E8', subject: 'ENGLISH', q: 'What type of literary device is used in the phrase: "The wind whispered secrets"?', options: { A: 'Simile', B: 'Metaphor', C: 'Personification', D: 'Hyperbole' }, ans: 'C', exp: 'Giving human qualities ("whispered secrets") to a non-human thing (the wind) is personification.' },
    { id: 'E9', subject: 'ENGLISH', q: 'Identify the word that is correctly spelled:', options: { A: 'Seperate', B: 'Seperate', C: 'Seperate', D: 'Separate' }, ans: 'D', exp: 'The correct spelling is "separate".' },
    { id: 'E10', subject: 'ENGLISH', q: 'Which of the following words is a **conjunction**?', options: { A: 'swiftly', B: 'beautiful', C: 'because', D: 'under' }, ans: 'C', exp: 'A conjunction links words, phrases, or clauses. "Because" is a subordinating conjunction.' },
    { id: 'E11', subject: 'ENGLISH', q: 'Choose the correct form of the word: "He is senior **\\dots** me."', options: { A: 'than', B: 'to', C: 'over', D: 'from' }, ans: 'B', exp: 'Adjectives like senior, junior, superior, and inferior are followed by the preposition "to".' },
    { id: 'E12', subject: 'ENGLISH', q: 'Change to passive voice: "The man opened the gate."', options: { A: 'The gate was opened by the man.', B: 'The gate is opened by the man.', C: 'The man was opening the gate.', D: 'The man, the gate was opened.' }, ans: 'A', exp: 'The active verb "opened" (Past Simple) becomes "was opened" in the passive voice.' },
    { id: 'E13', subject: 'ENGLISH', q: 'The adjective form of the word **fame** is:', options: { A: 'famer', B: 'famous', C: 'fameous', D: 'famelike' }, ans: 'B', exp: 'The adjective form is "famous".' },
    { id: 'E14', subject: 'ENGLISH', q: 'Choose the correct statement concerning subject-verb agreement:', options: { A: 'The manager and his assistant is here.', B: 'The manager and his assistant are here.', C: 'The manager, as well as his assistant, are here.', D: 'Neither the manager nor his assistant are here.' }, ans: 'B', exp: 'Two subjects joined by "and" require a plural verb ("are").' },
    { id: 'E15', subject: 'ENGLISH', q: 'Choose the option that means **ad-hoc**:', options: { A: 'Planned', B: 'Permanent', C: 'Improvised', D: 'Systematic' }, ans: 'C', exp: 'Ad-hoc means created or done for a particular purpose as necessary, making "Improvised" the closest match.' },

    // --- GENERAL KNOWLEDGE (20 Questions Pool) ---
    { id: 'G1', subject: 'GENERAL', q: 'What is the capital city of Nigeria?', options: { A: 'Abuja', B: 'Lagos', C: 'Port Harcourt', D: 'Kano' }, ans: 'A', exp: 'Abuja is the Federal Capital Territory, officially replacing Lagos in 1991.' },
    { id: 'G2', subject: 'GENERAL', q: 'The Nigerian flag has how many colors?', options: { A: '1', B: '2', C: '3', D: '4' }, ans: 'B', exp: 'The flag has two colors: Green and White, representing agriculture and peace.' },
    { id: 'G3', subject: 'GENERAL', q: 'In what year did Nigeria gain independence?', options: { A: '1963', B: '1960', C: '1914', D: '1999' }, ans: 'B', exp: 'Nigeria gained full independence from British rule on October 1, 1960.' },
    { id: 'G4', subject: 'GENERAL', q: 'Who designed the Nigerian national flag?', options: { A: 'Wole Soyinka', B: 'Taiwo Akinkunmi', C: 'Chinua Achebe', D: 'Obafemi Awolowo' }, ans: 'B', exp: 'Michael Taiwo Akinkunmi designed the Nigerian flag in 1959.' },
    { id: 'G5', subject: 'GENERAL', q: 'The National Assembly is the **\\dots** organ of government?', options: { A: 'Executive', B: 'Legislative', C: 'Judicial', D: 'Federal Council' }, ans: 'B', exp: 'The Legislative arm, which includes the National Assembly, is responsible for making laws.' },
    { id: 'G6', subject: 'GENERAL', q: 'Which body manages the economy and monetary policy in Nigeria?', options: { A: 'NNPC', B: 'CBN', C: 'NTA', D: 'FRSC' }, ans: 'B', exp: 'The Central Bank of Nigeria (CBN) manages the monetary policy.' },
    { id: 'G7', subject: 'GENERAL', q: 'Which year marked the amalgamation of Northern and Southern Protectorates?', options: { A: '1914', B: '1960', C: '1900', D: '1884' }, ans: 'A', exp: 'The Northern and Southern Protectorates were amalgamated in 1914 by Lord Lugard.' },
    { id: 'G8', subject: 'GENERAL', q: 'The White color on the Nigerian flag primarily represents:', options: { A: 'Agriculture', B: 'Peace and Unity', C: 'Oil wealth', D: 'Fertile land' }, ans: 'B', exp: 'The white stripe represents peace and unity.' },
    { id: 'G9', subject: 'GENERAL', q: 'The official language of Nigeria is?', options: { A: 'Yoruba', B: 'Hausa', C: 'Igbo', D: 'English' }, ans: 'D', exp: 'English is the official language, used for administration and education.' },
    { id: 'G10', subject: 'GENERAL', q: 'How many states are officially in the Federal Republic of Nigeria?', options: { A: '35', B: '36', C: '37', D: '34' }, ans: 'B', exp: 'Nigeria is composed of 36 states and the Federal Capital Territory (FCT).' },
    { id: 'G11', subject: 'GENERAL', q: 'The current President of Nigeria is the head of which arm of government?', options: { A: 'Executive', B: 'Legislative', C: 'Judicial', D: 'Traditional' }, ans: 'A', exp: 'The President is the head of the Executive arm.' },
    { id: 'G12', subject: 'GENERAL', q: 'What is the full meaning of ECOWAS?', options: { A: 'Economic Community of Western African States', B: 'Economic Community of West African States', C: 'Ecological Convention of West African States', D: 'Economic Co-operation of West African States' }, ans: 'B', exp: 'ECOWAS stands for Economic Community of West African States.' },
    { id: 'G13', subject: 'GENERAL', q: 'The primary mineral resource that Nigeria relies on for its economy is:', options: { A: 'Coal', B: 'Gold', C: 'Crude Oil', D: 'Tin' }, ans: 'C', exp: 'Crude Oil remains the largest source of government revenue.' },
    { id: 'G14', subject: 'GENERAL', q: 'The minimum age requirement to contest for the presidency of Nigeria is:', options: { A: '30 years', B: '35 years', C: '40 years', D: '45 years' }, ans: 'B', exp: 'The 1999 Constitution (as amended) sets the minimum age for President at 35.' },
    { id: 'G15', subject: 'GENERAL', q: 'Which Nigerian state is known as the "Centre of Excellence"?', options: { A: 'Abuja', B: 'Kano', C: 'Lagos', D: 'Rivers' }, ans: 'C', exp: 'Lagos State is famously known by this slogan.' },
    { id: 'G16', subject: 'GENERAL', q: 'The Supreme Court is the head of which arm of government?', options: { A: 'Executive', B: 'Legislative', C: 'Judicial', D: 'Council of State' }, ans: 'C', exp: 'The Supreme Court is the apex body of the Judicial arm.' },
    { id: 'G17', subject: 'GENERAL', q: 'The term "Rule of Law" means:', options: { A: 'The ruler is above the law', B: 'Everyone is subject to the law', C: 'Only the rich are governed by the law', D: 'Only the poor are governed by the law' }, ans: 'B', exp: 'Rule of Law means all persons, institutions, and entities are accountable to laws that are publicly promulgated, equally enforced, and independently adjudicated.' },
    { id: 'G18', subject: 'GENERAL', q: 'The Nigerian currency is the Naira and:', options: { A: 'Kobo', B: 'Shilling', C: 'Dollar', D: 'Pound' }, ans: 'A', exp: 'The Nigerian currency is divided into Naira and Kobo.' },
    { id: 'G19', subject: 'GENERAL', q: 'Which body is responsible for conducting elections in Nigeria?', options: { A: 'NASS', B: 'INEC', C: 'Police', D: 'Judiciary' }, ans: 'B', exp: 'The Independent National Electoral Commission (INEC) is responsible for elections.' },
    { id: 'G20', subject: 'GENERAL', q: 'The national motto of Nigeria is:', options: { A: 'Peace and Unity', B: 'Unity and Faith, Peace and Progress', C: 'To Serve With Integrity', D: 'Loyalty and Diligence' }, ans: 'B', exp: 'Unity and Faith, Peace and Progress is the national motto.' },


    // --- DEPARTMENTAL QUESTIONS (60 Questions Pool, organized by subject) ---

    // IMMIGRATION SERVICE (NIS) - 15 Questions Pool
    { id: 'I1', subject: 'IMMIGRATION_NIS', q: 'Which body manages immigration and border control in Nigeria?', options: { A: 'NDLEA', B: 'NIS', C: 'EFCC', D: 'FRSC' }, ans: 'B', exp: 'NIS (Nigeria Immigration Service) manages immigration.' },
    { id: 'I2', subject: 'IMMIGRATION_NIS', q: 'Who is the operational head of the Nigeria Immigration Service?', options: { A: 'Inspector General of Police', B: 'Comptroller General of Immigration', C: 'Commandant General', D: 'Director General' }, ans: 'B', exp: 'The Comptroller General of Immigration (CGI) heads the NIS.' },
    { id: 'I3', subject: 'IMMIGRATION_NIS', q: 'What is the NIS responsible for issuing to Nigerian citizens?', options: { A: 'National ID Card', B: 'International Passport', C: 'Voter’s Card', D: 'Driver’s License' }, ans: 'B', exp: 'NIS is solely responsible for issuing International Passports.' },
    { id: 'I4', subject: 'IMMIGRATION_NIS', q: 'The official color of the NIS uniform is predominantly:', options: { A: 'Black', B: 'Khaki/Brown', C: 'Green', D: 'Blue' }, ans: 'D', exp: 'The NIS uniform is predominantly blue.' },
    { id: 'I5', subject: 'IMMIGRATION_NIS', q: 'The NIS handles all of Nigeria’s borders, including:', options: { A: 'Airports only', B: 'Seaports only', C: 'Land borders only', D: 'All points of entry and exit' }, ans: 'D', exp: 'NIS covers all official ports of entry and exit (air, land, and sea).' },
    { id: 'I6', subject: 'IMMIGRATION_NIS', q: 'NIS is responsible for the deportation of:', options: { A: 'Nigerian citizens', B: 'Illegal immigrants', C: 'Military personnel', D: 'Diplomats' }, ans: 'B', exp: 'NIS handles the repatriation or deportation of foreign nationals who violate immigration laws.' },
    { id: 'I7', subject: 'IMMIGRATION_NIS', q: 'The NIS is under the supervision of which Ministry?', options: { A: 'Defence', B: 'Interior', C: 'Foreign Affairs', D: 'Justice' }, ans: 'B', exp: 'The Ministry of Interior oversees the NIS.' },
    { id: 'I8', subject: 'IMMIGRATION_NIS', q: 'What is the acronym CDCFIB related to?', options: { A: 'Recruitment for NIS, NCS, FFS, and NSCDC', B: 'International Passport Control', C: 'Visa Processing', D: 'Border Demarcation' }, ans: 'A', exp: 'CDCFIB (Civil Defence, Correctional, Fire, and Immigration Services Board) oversees these four agencies.' },
    { id: 'I9', subject: 'IMMIGRATION_NIS', q: 'Which permit does NIS issue to non-Nigerians to reside and work?', options: { A: 'Visitor’s Permit', B: 'CERPAC/Residence Permit', C: 'Transit Visa', D: 'ECOWAS Travel Certificate' }, ans: 'B', exp: 'The Combined Expatriate Residence Permit and Alien Card (CERPAC) is key.' },
    { id: 'I10', subject: 'IMMIGRATION_NIS', q: 'An ECOWAS citizen can enter Nigeria without a visa using what document?', options: { A: 'International Passport', B: 'National ID Card', C: 'ECOWAS Travel Certificate', D: 'Diplomatic Passport' }, ans: 'C', exp: 'The ECOWAS Travel Certificate is used for free movement within the sub-region.' },
    { id: 'I11', subject: 'IMMIGRATION_NIS', q: 'The NIS is responsible for controlling the entry and exit of **\\dots** into and out of Nigeria.', options: { A: 'Goods', B: 'Persons', C: 'Vehicles', D: 'Animals' }, ans: 'B', exp: 'The primary focus of Immigration is the movement of persons.' },
    { id: 'I12', subject: 'IMMIGRATION_NIS', q: 'What is the NIS official national emergency line (mock)?', options: { A: '112', B: '001', C: '447', D: '911' }, ans: 'A', exp: '112 is a common emergency line (using 112 as a mock answer for a paramilitary agency).' },
    { id: 'I13', subject: 'IMMIGRATION_NIS', q: 'A visa is granted to a foreigner to permit:', options: { A: 'Residency', B: 'Entry', C: 'Citizenship', D: 'Permanent Stay' }, ans: 'B', exp: 'A visa generally grants permission for entry, not permanent stay or citizenship.' },
    { id: 'I14', subject: 'IMMIGRATION_NIS', q: 'The core duty of border patrol officers is to prevent:', options: { A: 'Tax evasion', B: 'Smuggling', C: 'Illegal migration', D: 'Road accidents' }, ans: 'C', exp: 'Preventing illegal migration and border violations is the core duty.' },
    { id: 'I15', subject: 'IMMIGRATION_NIS', q: 'In NIS structure, which rank immediately follows Comptroller?', options: { A: 'Deputy Comptroller', B: 'Assistant Comptroller', C: 'Superintendent', D: 'Chief Inspector' }, ans: 'A', exp: 'The rank structure is: Comptroller General, Deputy Comptroller General, Assistant Comptroller General, etc.' },

    // CIVIL DEFENCE (NSCDC) - 15 Questions Pool
    { id: 'C1', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Which Nigerian agency handles civil defense?', options: { A: 'CDCFIB', B: 'NSCDC', C: 'NDLEA', D: 'DSS' }, ans: 'B', exp: 'NSCDC (Nigeria Security and Civil Defence Corps) is the national civil defense agency.' },
    { id: 'C2', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the motto of the NSCDC?', options: { A: 'Service and Integrity', B: 'Defending the Nation', C: 'Integrity and Service', D: 'Defense and Security' }, ans: 'C', exp: 'The NSCDC motto is "Integrity and Service".' },
    { id: 'C3', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC primarily protects which of these infrastructures?', options: { A: 'Private Schools', B: 'Critical National Assets and Infrastructure', C: 'Motor Parks', D: 'Local Market Stalls' }, ans: 'B', exp: 'Protection of Critical National Assets and Infrastructure (CNAI) is a core mandate.' },
    { id: 'C4', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The highest rank in the NSCDC is:', options: { A: 'Inspector General', B: 'Comptroller General', C: 'Commandant General', D: 'Director General' }, ans: 'C', exp: 'The Commandant General is the highest rank and head of the Corps.' },
    { id: 'C5', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC is known for combating the vandalism of:', options: { A: 'Electric poles', B: 'Oil pipelines', C: 'Telecommunication masts', D: 'All of the above' }, ans: 'D', exp: 'Its CNAI mandate covers all these critical infrastructures, especially pipelines.' },
    { id: 'C6', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In disaster management, the NSCDC often collaborates with:', options: { A: 'Customs', B: 'NEMA', C: 'FRSC', D: 'NAPTIP' }, ans: 'B', exp: 'NEMA (National Emergency Management Agency) is the primary partner for disaster response.' },
    { id: 'C7', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The NSCDC Act gives the Corps powers to regulate:', options: { A: 'Motorcycles', B: 'Private Guard Companies (PGCs)', C: 'Oil Refineries', D: 'Local Markets' }, ans: 'B', exp: 'The regulation and licensing of Private Guard Companies is a specific NSCDC function.' },
    { id: 'C8', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC was upgraded to a paramilitary status by an Act of Parliament in:', options: { A: '1988', B: '2003', C: '1999', D: '1970' }, ans: 'B', exp: 'The current status and expanded functions were formalized by the Act of 2003.' },
    { id: 'C9', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The colour of the NSCDC beret is:', options: { A: 'Blue', B: 'Red', C: 'Green', D: 'Orange' }, ans: 'C', exp: 'The NSCDC beret is green.' },
    { id: 'C10', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Which Ministry supervises the NSCDC?', options: { A: 'Defence', B: 'Interior', C: 'Police Affairs', D: 'Justice' }, ans: 'B', exp: 'The NSCDC is one of the agencies under the Ministry of Interior.' },
    { id: 'C11', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The primary function of the NSCDC is to maintain:', options: { A: 'Law and Order', B: 'Internal Security', C: 'Public Safety and Civil Protection', D: 'Border Security' }, ans: 'C', exp: 'The Corps focuses on public safety and civil protection, distinct from the Police’s primary law and order mandate.' },
    { id: 'C12', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The NSCDC Act of 2007 allows the Corps to carry:', options: { A: 'Drones', B: 'Light arms', C: 'Heavy artillery', D: 'Only batons' }, ans: 'B', exp: 'The Act permits the use of light arms by NSCDC personnel.' },
    { id: 'C13', subject: 'CIVIL_DEFENCE_NSCDC', q: 'NSCDC intervention in communal conflicts is aimed at:', options: { A: 'Arresting all parties', B: 'Neutralizing one party', C: 'Disaster mitigation and mediation', D: 'Taking control of land' }, ans: 'C', exp: 'The NSCDC often acts as a mediator and ensures safety during conflicts and disasters.' },
    { id: 'C14', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The NSCDC personnel structure is characterized as:', options: { A: 'Strictly military', B: 'Civilian and military', C: 'Paramilitary', D: 'Strictly civilian' }, ans: 'C', exp: 'The Corps is paramilitary in structure.' },
    { id: 'C15', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Which department of NSCDC deals with intelligence gathering?', options: { A: 'Operations', B: 'Administration', C: 'Intelligence and Investigation', D: 'Logistics' }, ans: 'C', exp: 'The Intelligence and Investigation Directorate handles intelligence and criminal cases.' },

    // CORRECTIONAL CENTER (NCS) - 15 Questions Pool
    { id: 'N1', subject: 'CORRECTIONAL_NCS', q: 'The acronym NCS stands for:', options: { A: 'Nigerian Central Security', B: 'Nigerian Correctional Service', C: 'National Custom Service', D: 'Nigerian Council of States' }, ans: 'B', exp: 'NCS stands for Nigerian Correctional Service, replacing the former NPS.' },
    { id: 'N2', subject: 'CORRECTIONAL_NCS', q: 'The key focus of the NCS, following the 2019 Act, shifted to:', options: { A: 'Punishment and deterrence', B: 'Reformation and Rehabilitation', C: 'Long-term detention only', D: 'Generating revenue' }, ans: 'B', exp: 'The 2019 Act emphasizes rehabilitation and social reintegration of offenders.' },
    { id: 'N3', subject: 'CORRECTIONAL_NCS', q: 'The head of the Nigerian Correctional Service is the:', options: { A: 'Inspector General of Prisons', B: 'Comptroller General of Corrections', C: 'Chief Judge', D: 'Commandant General' }, ans: 'B', exp: 'The head of the NCS is the Comptroller General of Corrections.' },
    { id: 'N4', subject: 'CORRECTIONAL_NCS', q: 'The NCS was formerly known as:', options: { A: 'Nigerian Prison Service (NPS)', B: 'Federal Prisons Agency (FPA)', C: 'National Inmates Service (NIS)', D: 'Nigerian Detention Center (NDC)' }, ans: 'A', exp: 'The Nigerian Prisons Service (NPS) was renamed to NCS in 2019.' },
    { id: 'N5', subject: 'CORRECTIONAL_NCS', q: 'The NCS Act 2019 established a non-custodial service which includes:', options: { A: 'Life imprisonment', B: 'Parole and community service', C: 'Hard labor', D: 'Military detention' }, ans: 'B', exp: 'Non-custodial measures like parole, probation, and community service are key components of the new Act.' },
    { id: 'N6', subject: 'CORRECTIONAL_NCS', q: 'What is the purpose of the Borstal Institutions managed by NCS?', options: { A: 'For female offenders', B: 'For elderly offenders', C: 'For juvenile offenders', D: 'For high-risk inmates' }, ans: 'C', exp: 'Borstal Institutions are specialized reformatory centers for young/juvenile offenders.' },
    { id: 'N7', subject: 'CORRECTIONAL_NCS', q: 'The primary role of NCS staff is the custody of persons committed to custody by:', options: { A: 'Their families', B: 'The law/courts', C: 'The military', D: 'Local government' }, ans: 'B', exp: 'The Service holds persons committed to custody by the courts via warrants.' },
    { id: 'N8', subject: 'CORRECTIONAL_NCS', q: 'The NCS uniform color is primarily:', options: { A: 'Red and Black', B: 'Blue and Black', C: 'Green and Khaki', D: 'White and Blue' }, ans: 'B', exp: 'NCS uniforms typically feature blue and black colors.' },
    { id: 'N9', subject: 'CORRECTIONAL_NCS', q: 'Which section of the NCS handles medical care for inmates?', options: { A: 'Operations Directorate', B: 'Health and Welfare Directorate', C: 'Technical Directorate', D: 'Legal Directorate' }, ans: 'B', exp: 'The Health and Welfare Directorate manages medical services and inmate well-being.' },
    { id: 'N10', subject: 'CORRECTIONAL_NCS', q: 'What key term is used to describe the process of preparing an offender to return to society?', options: { A: 'Detention', B: 'Recidivism', C: 'Reintegration', D: 'Correction' }, ans: 'C', exp: 'Social reintegration is the critical final phase of correction.' },
    { id: 'N11', subject: 'CORRECTIONAL_NCS', q: 'The NCS is primarily under the supervision of the Ministry of:', options: { A: 'Justice', B: 'Interior', C: 'Police Affairs', D: 'Defence' }, ans: 'B', exp: 'The NCS is under the Federal Ministry of Interior.' },
    { id: 'N12', subject: 'CORRECTIONAL_NCS', q: 'Which of these is NOT an aim of the 2019 NCS Act?', options: { A: 'Reformation', B: 'Rehabilitation', C: 'Punitive Isolation', D: 'Reintegration' }, ans: 'C', exp: 'The Act shifted away from purely punitive isolation towards reformation.' },
    { id: 'N13', subject: 'CORRECTIONAL_NCS', q: 'What body provides statutory oversight for the NCS?', options: { A: 'FRSC', B: 'CDCFIB', C: 'NEMA', D: 'DSS' }, ans: 'B', exp: 'CDCFIB (Civil Defence, Correctional, Fire, and Immigration Services Board) provides oversight.' },
    { id: 'N14', subject: 'CORRECTIONAL_NCS', q: 'The term **parole** in the Correctional system means:', options: { A: 'Permanent release', B: 'Temporary release under supervision', C: 'Life imprisonment', D: 'Hard labor sentencing' }, ans: 'B', exp: 'Parole is the conditional release of a prisoner before the completion of the sentence.' },
    { id: 'N15', subject: 'CORRECTIONAL_NCS', q: 'The maximum security prison in Nigeria is often considered to be located in:', options: { A: 'Lagos', B: 'Kirikiri', C: 'Kano', D: 'Calabar' }, ans: 'B', exp: 'Kirikiri Maximum Security Prison is the most commonly known facility.' },

    // FEDERAL FIRE SERVICE (FFS) - 15 Questions Pool
    { id: 'F1', subject: 'FIRE_FFS', q: 'What is the core function of the Federal Fire Service (FFS)?', options: { A: 'Border control', B: 'Fire fighting and prevention', C: 'Pipeline protection', D: 'Road traffic control' }, ans: 'B', exp: 'The FFS is primarily responsible for fighting and preventing fires.' },
    { id: 'F2', subject: 'FIRE_FFS', q: 'The FFS is headed by the:', options: { A: 'Fire Marshal', B: 'Controller General of Fire', C: 'Commandant General', D: 'Inspector General' }, ans: 'B', exp: 'The FFS is headed by the Controller General of the Federal Fire Service.' },
    { id: 'F3', subject: 'FIRE_FFS', q: 'The FFS motto is:', options: { A: 'Safety First', B: 'Service and Safety', C: 'Protection of Lives and Property', D: 'Fire is the Enemy' }, ans: 'C', exp: 'The official FFS motto is "Protection of Lives and Property".' },
    { id: 'F4', subject: 'FIRE_FFS', q: 'What class of fire involves flammable liquids (e.g., petrol, kerosene)?', options: { A: 'Class A', B: 'Class B', C: 'Class C', D: 'Class D' }, ans: 'B', exp: 'Class B fires involve flammable liquids and gases.' },
    { id: 'F5', subject: 'FIRE_FFS', q: 'The FFS helps in certifying a building’s:', options: { A: 'Structure stability', B: 'Fire Safety Compliance', C: 'Electrical wiring', D: 'Plumbing standards' }, ans: 'B', exp: 'Issuing Fire Safety Certificates is a major regulatory role of the FFS.' },
    { id: 'F6', subject: 'FIRE_FFS', q: 'Which firefighting agent is primarily used by FFS for electrical fires?', options: { A: 'Water', B: 'Foam', C: 'CO2 or Dry Chemical', D: 'Sand' }, ans: 'C', exp: 'CO2 or Dry Chemical extinguishers are used for Class C (electrical) fires as they are non-conductive.' },
    { id: 'F7', subject: 'FIRE_FFS', q: 'In fire safety, what is a crucial preventative measure?', options: { A: 'Water rationing', B: 'Installation of smoke detectors', C: 'Daily sweeping', D: 'High voltage use' }, ans: 'B', exp: 'Smoke detectors provide early warning, which is critical for fire prevention.' },
    { id: 'F8', subject: 'FIRE_FFS', q: 'FFS often participates in Search and Rescue operations, collaborating with:', options: { A: 'Nigerian Navy', B: 'NEMA and NSCDC', C: 'Central Bank', D: 'Judiciary' }, ans: 'B', exp: 'FFS provides specialized rescue services alongside NEMA and NSCDC during emergencies.' },
    { id: 'F9', subject: 'FIRE_FFS', q: 'What color is typically associated with fire trucks in Nigeria?', options: { A: 'Blue', B: 'Green', C: 'Red', D: 'Yellow' }, ans: 'C', exp: 'Red is the universal color for emergency vehicles like fire trucks.' },
    { id: 'F10', subject: 'FIRE_FFS', q: 'The FFS is a department under the Ministry of:', options: { A: 'Defence', B: 'Environment', C: 'Interior', D: 'Works' }, ans: 'C', exp: 'Like NSCDC, NIS, and NCS, the FFS is under the Federal Ministry of Interior.' },
    { id: 'F11', subject: 'FIRE_FFS', q: 'Class A fires involve which type of materials?', options: { A: 'Flammable Liquids', B: 'Metals', C: 'Ordinary Combustibles (wood, paper, cloth)', D: 'Electrical Equipment' }, ans: 'C', exp: 'Class A fires involve common materials like wood, paper, and cloth.' },
    { id: 'F12', subject: 'FIRE_FFS', q: 'The technique of cooling a burning substance below its ignition temperature using water is called:', options: { A: 'Starvation', B: 'Smothering', C: 'Cooling', D: 'Dilution' }, ans: 'C', exp: 'Cooling is the primary method of using water to put out fires.' },
    { id: 'F13', subject: 'FIRE_FFS', q: 'The removal of fuel from a fire is known as:', options: { A: 'Cooling', B: 'Smothering', C: 'Starvation', D: 'Separation' }, ans: 'C', exp: 'Starvation is the process of removing the fuel source to break the fire triangle.' },
    { id: 'F14', subject: 'FIRE_FFS', q: 'The FFS is also mandated to provide:', options: { A: 'Ambulance services during accidents', B: 'Security escort for high-profile figures', C: 'Training on fire prevention', D: 'Border checkpoint management' }, ans: 'C', exp: 'Providing training and education on fire prevention is a core FFS mandate.' },
    { id: 'F15', subject: 'FIRE_FFS', q: 'Which fire extinguisher type is identified by a **RED** label or body?', options: { A: 'Water', B: 'Foam', C: 'Dry Powder', D: 'CO2' }, ans: 'A', exp: 'While modern standards use color coding on bands, historically and commonly, water extinguishers were often plain red.' },

// --- ADDED FROM CDCFIB PRACTICE QUESTIONS (Batch 1) ---

// FIRE SERVICE (additional from PDF)
    { id: 'F16', subject: 'FIRE_FFS', q: 'What is the main component of dry chemical powder extinguishers?', options: { A: 'Monoammonium phosphate', B: 'Sodium bicarbonate', C: 'Potassium chloride', D: 'Calcium carbonate' }, ans: 'A', exp: 'Dry chemical powders commonly use monoammonium phosphate as the extinguishing agent.' },
    { id: 'F17', subject: 'FIRE_FFS', q: 'H2O is?', options: { A: 'Water', B: 'Hydrogen peroxide', C: 'Hydroxide', D: 'Hydrogen oxide' }, ans: 'A', exp: 'H2O is the chemical formula for water.' },
    { id: 'F18', subject: 'FIRE_FFS', q: 'Which gas is primarily used in human respiration?', options: { A: 'Oxygen', B: 'Carbon dioxide', C: 'Nitrogen', D: 'Helium' }, ans: 'A', exp: 'Oxygen is the gas humans inhale for respiration.' },
    { id: 'F19', subject: 'FIRE_FFS', q: 'When was the Federal Fire Service (as a unit under Lagos Police Fire Brigade) first started?', options: { A: '1901', B: '1910', C: '1920', D: '1950' }, ans: 'A', exp: 'The service traces its origins to 1901 as part of the Lagos Police Fire Brigade.' },
    { id: 'F20', subject: 'FIRE_FFS', q: 'Class A fires involve which type of materials?', options: { A: 'Ordinary combustibles (wood, paper, cloth)', B: 'Flammable liquids', C: 'Electrical equipment', D: 'Metals' }, ans: 'A', exp: 'Class A fires are ordinary combustible materials such as wood, paper and cloth.' },
    { id: 'F21', subject: 'FIRE_FFS', q: 'Class B fires involve which type of materials?', options: { A: 'Flammable liquids', B: 'Metals', C: 'Paper and wood', D: 'Electrical equipment' }, ans: 'A', exp: 'Class B fires involve flammable liquids.' },
    { id: 'F22', subject: 'FIRE_FFS', q: 'Class C fires involve which type of materials?', options: { A: 'Flammable gases', B: 'Flammable liquids', C: 'Metals', D: 'Paper' }, ans: 'A', exp: 'Class C fires are associated with flammable gases.' },
    { id: 'F23', subject: 'FIRE_FFS', q: 'Class D fires involve which type of materials?', options: { A: 'Combustible metals', B: 'Paper and cloth', C: 'Flammable liquids', D: 'Electrical appliances' }, ans: 'A', exp: 'Class D fires involve combustible metals such as magnesium.' },
    { id: 'F24', subject: 'FIRE_FFS', q: 'What is the emergency phone number for fire in Nigeria (as given in the PDF)?', options: { A: '112', B: '911', C: '999', D: '119' }, ans: 'A', exp: '112 is listed in the practice module as an emergency number for fire.' },

// NSCDC (Nigeria Security and Civil Defence Corps) - appended from PDF
    { id: 'C16', subject: 'CIVIL_DEFENCE_NSCDC', q: 'The Nigeria Security and Civil Defence Corps was first introduced in which year?', options: { A: 'May 1979', B: 'June 1979', C: 'May 1967', D: 'June 1967' }, ans: 'C', exp: 'The practice module indicates May 1967 as the year of introduction.' },
    { id: 'C17', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What inspired the introduction of the NSCDC?', options: { A: 'The Lagos Market Women Protest', B: 'The Nigeria Civil War', C: 'The Aba Market Women Riot', D: 'Civil Unrest across the Country' }, ans: 'B', exp: 'The Nigeria Civil War was cited as the inspiration for the initial formation.' },
    { id: 'C18', subject: 'CIVIL_DEFENCE_NSCDC', q: 'During the Nigeria Civil War, the NSCDC was known as which of the following?', options: { A: 'Lagos Civil Security Commission', B: 'Lagos Security and Community Defense Corps', C: 'Lagos Civil Defense Committee', D: 'Lagos Security and Defense Corporation' }, ans: 'C', exp: 'It was known as the Lagos Civil Defense Committee during that period.' },
    { id: 'C19', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What was the NSCDC’s initial core objective(s)?', options: { A: 'To sensitize and protect the Civil Populace', B: 'To maintain law and order in Civil Society', C: 'To foster movement of people', D: 'To encourage civil society to be peaceful' }, ans: 'A', exp: 'The initial aim was to sensitize and protect the civil populace.' },
    { id: 'C20', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In what year did the former Lagos Civil Defense Committee become officially known as the NSCDC?', options: { A: '1980', B: '1970', C: '1960', D: '1990' }, ans: 'B', exp: 'The module lists 1970 as the year it became officially known as NSCDC.' },
    { id: 'C21', subject: 'CIVIL_DEFENCE_NSCDC', q: 'In what year did NSCDC become a National Security Outfit?', options: { A: '1984', B: '1988', C: '1994', D: '1986' }, ans: 'B', exp: '1988 is given as the year it became a national security outfit.' },
    { id: 'C22', subject: 'CIVIL_DEFENCE_NSCDC', q: 'Who is the Commandant General of NSCDC (as listed)?', options: { A: 'Prof. Attairu Jega', B: 'Dr. Ahmed Abubakar Audi', C: 'Engr. Ali Baba', D: 'Dr. Aliu Maina' }, ans: 'B', exp: 'Dr. Ahmed Abubakar Audi is listed in the practice module.' },
    { id: 'C23', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the full meaning of NSCDC?', options: { A: 'Niger Security and Civil Defence Corps', B: 'Nigeria Security and Civil Defense Core', C: 'Nigeria Security and Civil Defence Corps', D: 'Nigeria Civil Defence Organization' }, ans: 'C', exp: 'NSCDC stands for Nigeria Security and Civil Defence Corps.' },
    { id: 'C24', subject: 'CIVIL_DEFENCE_NSCDC', q: 'How many Directorates does NSCDC have?', options: { A: '9', B: '8', C: '7', D: '6' }, ans: 'D', exp: 'The practice questions indicate 6 directorates.' },
    { id: 'C25', subject: 'CIVIL_DEFENCE_NSCDC', q: 'What is the legal document guiding the operations of NSCDC called?', options: { A: 'NSCDC Agenda', B: 'NSCDC Act', C: 'NSCDC Principles', D: 'NSCDC Laws' }, ans: 'B', exp: 'The NSCDC Act is the legal framework guiding the Corps.' },

// NCoS (Correctional Service) - additional entries from PDF
    { id: 'N16', subject: 'CORRECTIONAL_NCS', q: 'What is solitary confinement?', options: { A: 'Keeping an inmate alone in a cell as punishment', B: 'Group rehabilitation program', C: 'Temporary leave from prison', D: 'Open custody arrangement' }, ans: 'A', exp: 'Solitary confinement is the practice of isolating an inmate in a cell.' },
    { id: 'N17', subject: 'CORRECTIONAL_NCS', q: 'Choose the odd one out: (a) Rehabilitation (b) Imprisonment (c) Reformation (d) Endocrine', options: { A: 'Rehabilitation', B: 'Imprisonment', C: 'Reformation', D: 'Endocrine' }, ans: 'D', exp: 'Endocrine is unrelated to correctional service functions.' },
    { id: 'N18', subject: 'CORRECTIONAL_NCS', q: 'Choose the odd one out: (a) Court (b) Prison (c) Teacher (d) Police', options: { A: 'Court', B: 'Prison', C: 'Teacher', D: 'Police' }, ans: 'C', exp: 'Teacher is the odd one out – others are part of the criminal justice system.' },
    { id: 'N19', subject: 'CORRECTIONAL_NCS', q: 'What does NCoS stand for?', options: { A: 'Nigerian Correctional Service', B: 'National Correctional Society', C: 'Nigerian Correctional System', D: 'National Corrections Service' }, ans: 'A', exp: 'NCoS stands for Nigerian Correctional Service.' },
    { id: 'N20', subject: 'CORRECTIONAL_NCS', q: 'Which is the correct title for the head of NCoS?', options: { A: 'Comptroller General', B: 'Controller General', C: 'Commandant General', D: 'Major General' }, ans: 'B', exp: 'The correct title is Controller General.' },

// NIS (Immigration Service) - appended from PDF
    { id: 'I16', subject: 'IMMIGRATION_NIS', q: 'Which of the following is a core duty of the Nigeria Immigration Service (NIS)?', options: { A: 'Persecuting offenders', B: 'Enforcing of laws', C: 'Issuance of all Nigerian travel documents', D: 'Deporting of foreigners' }, ans: 'C', exp: 'Issuance of travel documents (passports) is a core duty of NIS.' },
    { id: 'I17', subject: 'IMMIGRATION_NIS', q: 'The NIS was separated from the Nigerian Police Force in which year?', options: { A: '1946', B: '1956', C: '1958', D: '1964' }, ans: 'C', exp: 'The module lists 1958 as the year NIS was brought out of the police.' },
    { id: 'I18', subject: 'IMMIGRATION_NIS', q: 'The NIS was formally established by an Act of Parliament in which year?', options: { A: '1963', B: '1957', C: '1964', D: '1976' }, ans: 'A', exp: '1963 is listed as the formal establishment year by Act of Parliament.' },
    { id: 'I19', subject: 'IMMIGRATION_NIS', q: 'Which was the first African country to introduce an e-passport (as listed)?', options: { A: 'South Africa', B: 'Ghana', C: 'Liberia', D: 'Nigeria' }, ans: 'D', exp: 'Nigeria is listed in the practice module as the first African country to introduce e-passport.' },
    { id: 'I20', subject: 'IMMIGRATION_NIS', q: 'How many Comptroller Generals has NIS had (as given)?', options: { A: '10', B: '12', C: '8', D: '15' }, ans: 'A', exp: 'The module lists 10 Comptroller Generals since inception.' },
    { id: 'I21', subject: 'IMMIGRATION_NIS', q: 'Who is listed as the present Comptroller General of NIS in the PDF?', options: { A: 'Umar Dahiru', B: 'David Parradang', C: 'Boniface Cosmos', D: 'Kemi Nandap' }, ans: 'D', exp: 'Kemi Nandap is listed as the present Comptroller General in the sample.' },
    { id: 'I22', subject: 'IMMIGRATION_NIS', q: 'Which title is correct for the head of NIS?', options: { A: 'Comptroller General', B: 'Controller General', C: 'Commandant General', D: 'Major General' }, ans: 'A', exp: 'The head of NIS holds the title Comptroller General.' },
    { id: 'I23', subject: 'IMMIGRATION_NIS', q: 'How many Directorates does NIS have (as listed)?', options: { A: '10', B: '8', C: '7', D: '9' }, ans: 'A', exp: 'The module indicates 10 directorates.' },
    { id: 'I24', subject: 'IMMIGRATION_NIS', q: 'What does CGIS stand for?', options: { A: 'Comptroller General of Immigration Service', B: 'Central Government Immigration Service', C: 'Comprehensive Government Immigration System', D: 'Complainant General Immigration Service' }, ans: 'A', exp: 'CGIS is an abbreviation for Comptroller General of Immigration Service.' },
    { id: 'I25', subject: 'IMMIGRATION_NIS', q: 'NIS is under which Ministry?', options: { A: 'Ministry of Defence', B: 'Ministry of Foreign Affairs', C: 'Ministry of Interior', D: 'Ministry of Justice' }, ans: 'C', exp: 'NIS operates under the Ministry of Interior.' },

// CURRENT AFFAIRS -> map into GENERAL subject (append as G21..)
    { id: 'G21', subject: 'GENERAL', q: 'The first Secretary General of the Commonwealth was?', options: { A: 'George Washington', B: 'Tulam Goldie', C: 'Arnold Smith', D: 'Joseph Garba' }, ans: 'C', exp: 'Arnold Smith was the first Secretary General of the Commonwealth.' },
    { id: 'G22', subject: 'GENERAL', q: 'Lagos became a crown colony in which year?', options: { A: '1862', B: '1861', C: '1841', D: '1886' }, ans: 'A', exp: '1862 is listed as the year Lagos became a crown colony.' },
    { id: 'G23', subject: 'GENERAL', q: 'World War I took place between which years?', options: { A: '1911-1914', B: '1914-1916', C: '1916-1918', D: '1914-1918' }, ans: 'D', exp: 'World War I occurred between 1914 and 1918.' },
    { id: 'G24', subject: 'GENERAL', q: 'The Western and Eastern regions of Nigeria became self-governing in which year?', options: { A: '1959', B: '1960', C: '1957', D: '1956' }, ans: 'C', exp: 'The module lists 1957 for regional self-government.' },
    { id: 'G25', subject: 'GENERAL', q: 'Who was the first head of government of Nigeria?', options: { A: 'Yakubu Gowon', B: 'Aguiyi Ironsi', C: 'Tafawa Balewa', D: 'Nnamdi Azikiwe' }, ans: 'C', exp: 'Tafawa Balewa was the first Prime Minister (head of government).' },
    { id: 'G26', subject: 'GENERAL', q: 'Who was the first military president of Nigeria?', options: { A: 'Sanni Abacha', B: 'Ibrahim Babangida', C: 'Aguiyi Ironsi', D: 'Yakubu Gowon' }, ans: 'C', exp: 'Aguiyi Ironsi is widely recognized as the first military Head of State.' },
    { id: 'G27', subject: 'GENERAL', q: 'Nigeria became a republic in which year?', options: { A: '1963', B: '1960', C: '1976', D: '1961' }, ans: 'A', exp: 'Nigeria became a republic in 1963.' },
    { id: 'G28', subject: 'GENERAL', q: 'The Northern and Southern protectorates were amalgamated in which year?', options: { A: '1914', B: '1919', C: '1921', D: '1900' }, ans: 'A', exp: 'The amalgamation occurred in 1914.' },
    { id: 'G29', subject: 'GENERAL', q: 'Who was the first Executive President?', options: { A: 'Nnamdi Azikiwe', B: 'Olusegun Obasanjo', C: 'Shehu Shagari', D: 'Goodluck Jonathan' }, ans: 'A', exp: 'Nnamdi Azikiwe served as Governor-General and later as President; listed as first Executive President in the module.' },
    { id: 'G30', subject: 'GENERAL', q: 'Who was the first colonial Governor-General of Nigeria?', options: { A: 'Tulam Goldie', B: 'James Robertson', C: 'Huge Clifford', D: 'Lord Lugard' }, ans: 'A', exp: 'Tulam (T. H.) Goldie is listed in the module.' },
    { id: 'G31', subject: 'GENERAL', q: 'Which is the highest court in Nigeria?', options: { A: 'Court of Appeal', B: 'Supreme Court', C: 'Federal High Court', D: 'Magistrate Court' }, ans: 'B', exp: 'The Supreme Court is the apex court in Nigeria.' },
    { id: 'G32', subject: 'GENERAL', q: 'ECOWAS was established in __ and has its administrative headquarters in __', options: { A: '1967, Lome', B: '1975, Lome', C: '1975, Lagos', D: '1967, Lagos' }, ans: 'B', exp: 'ECOWAS was established in 1975 with headquarters in Lome.' },
    { id: 'G33', subject: 'GENERAL', q: 'The first general election in Nigeria was held in which year?', options: { A: '1964', B: '1960', C: '1963', D: '1999' }, ans: 'A', exp: 'The module references 1964 as the first general election.' },
    { id: 'G34', subject: 'GENERAL', q: 'Nigeria practices which system of government?', options: { A: 'Confederalism', B: 'Unitarism', C: 'Parliamentarianism', D: 'Federalism' }, ans: 'D', exp: 'Nigeria practices a federal system of government.' },
    { id: 'G35', subject: 'GENERAL', q: 'Who was the last colonial Governor-General of Nigeria?', options: { A: 'James Robertson', B: 'Jimmy Carter', C: 'Lord Lugard', D: 'Huge Clifford' }, ans: 'A', exp: 'James Robertson is listed as the last colonial Governor-General.' },
    { id: 'G36', subject: 'GENERAL', q: 'The first military coup d’état in Nigeria was in which year?', options: { A: '1964', B: '1966', C: '1960', D: '1999' }, ans: 'B', exp: 'The first military coup took place in 1966.' },
    { id: 'G37', subject: 'GENERAL', q: 'The establishment of states in Nigeria started on which date?', options: { A: 'May 27, 1967', B: 'Feb 13, 1966', C: 'April 8, 1960', D: 'Oct 1, 1960' }, ans: 'A', exp: 'May 27, 1967 marked the beginning of state creation.' },
    { id: 'G38', subject: 'GENERAL', q: 'The Biafra Civil War took place between which years?', options: { A: '1967-1968', B: '1968-1971', C: '1967-1970', D: '1970-1975' }, ans: 'C', exp: 'The Biafra Civil War lasted from 1967 to 1970.' },
    { id: 'G39', subject: 'GENERAL', q: 'The National Youth Service Corps (NYSC) was established in which year?', options: { A: '1960', B: '1973', C: '1980', D: '1997' }, ans: 'B', exp: 'NYSC was established in 1973.' },
    { id: 'G40', subject: 'GENERAL', q: 'The Nigeria Police Force belongs to which organ of government?', options: { A: 'Judiciary', B: 'Executive', C: 'Legislative', D: 'None of the above' }, ans: 'B', exp: 'The police are part of the Executive arm of government.' },
    { id: 'G41', subject: 'GENERAL', q: 'Africa consists of how many countries (as given)?', options: { A: '54', B: '55', C: '60', D: '70' }, ans: 'A', exp: 'The module lists Africa as consisting of 54 countries.' },
    { id: 'G42', subject: 'GENERAL', q: 'The Secretary General of OPEC (as listed) is?', options: { A: 'Abdulsaleam Kanuri', B: 'Abdullah El-Badri', C: 'Utuhu Kamirideen', D: 'Haitham Al Ghais' }, ans: 'D', exp: 'Haitham Al Ghais is listed as the current Secretary General of OPEC.' },
    { id: 'G43', subject: 'GENERAL', q: 'The current Secretary General of the United Nations is?', options: { A: 'Ban Ki-moon', B: 'Antonio Guterres', C: 'Kofi Annan', D: 'Boutros Boutros-Ghali' }, ans: 'B', exp: 'Antonio Guterres is the current UN Secretary-General.' },
    { id: 'G44', subject: 'GENERAL', q: 'Which of the following pairs of countries are permanent members of the UN Security Council?', options: { A: 'Brazil, Germany, France, USA, China', B: 'France, China, USSR, USA, Britain', C: 'France, Germany, Japan, China, Britain', D: 'Brazil, New Zealand, Britain, France, China' }, ans: 'B', exp: 'France, China, USSR (now Russia), USA and Britain are the permanent members.' },
    { id: 'G45', subject: 'GENERAL', q: 'To qualify for the office of President in Nigeria, the candidate must be at least which age?', options: { A: '35 years', B: '20 years', C: '40 years', D: '55 years' }, ans: 'A', exp: 'The Constitution sets the minimum age at 35 years.' },
    { id: 'G46', subject: 'GENERAL', q: 'The name "Nigeria" was coined from which geographical feature?', options: { A: 'Niger Forest', B: 'Niger Area', C: 'Niger River', D: 'Niger Textures' }, ans: 'C', exp: 'The name Nigeria derives from the Niger River.' },
    { id: 'G47', subject: 'GENERAL', q: 'Who was the first Inspector General of Police in Nigeria?', options: { A: 'Teslim Balogun', B: 'Louis Edet', C: 'Ademola Adetokunbo', D: 'Elias Balogon' }, ans: 'B', exp: 'Louis Edet is historically recognized as the first IGP.' },
    { id: 'G48', subject: 'GENERAL', q: 'The current Secretary General / Commission Chairman of the African Union (as listed) is?', options: { A: 'Dlamini Zuma', B: 'Alassane Ouattara', C: 'Emeka Anyaoku', D: 'Moussa Faki Mahamat' }, ans: 'D', exp: 'Moussa Faki Mahamat is the current Chairperson of the African Union Commission.' },
    { id: 'G49', subject: 'GENERAL', q: 'The current President of the Commission / Secretary of ECOWAS (as listed) is?', options: { A: 'H. Desategn', B: 'Omar Touray', C: 'Alassane Ouattara', D: 'Ike Ekweremadu' }, ans: 'B', exp: 'Omar Touray is listed as ECOWAS Commission President.' },
    { id: 'G50', subject: 'GENERAL', q: 'The headquarters of the United Nations is in which city?', options: { A: 'New York', B: 'Washington', C: 'Geneva', D: 'Vienna' }, ans: 'A', exp: 'UN Headquarters is based in New York.' },
    { id: 'G51', subject: 'GENERAL', q: 'The United Nations Organization (UNO) was founded in San Francisco in which year?', options: { A: '1939', B: '1914', C: '1945', D: '1950' }, ans: 'C', exp: 'The UN was founded in 1945 in San Francisco.' },
    { id: 'G52', subject: 'GENERAL', q: 'The first military coup d’état in Africa occurred in which country (as listed)?', options: { A: 'Libya', B: 'Liberia', C: 'Egypt', D: 'Nigeria' }, ans: 'C', exp: 'The module lists Egypt as the first country in Africa with a military coup.' },
    { id: 'G53', subject: 'GENERAL', q: 'Nigeria became 36 states under the regime of which leader?', options: { A: 'Olusegun Obasanjo', B: 'Sanni Abacha', C: 'Ibrahim Babangida', D: 'Yakubu Gowon' }, ans: 'B', exp: 'The module lists Sanni Abacha for this change.' },
    { id: 'G54', subject: 'GENERAL', q: 'Who was the first military head of state in Nigeria?', options: { A: 'Yakubu Gowon', B: 'Aguiyi Ironsi', C: 'Olusegun Obasanjo', D: 'Ernest' }, ans: 'B', exp: 'Aguiyi Ironsi led the first military government after 1966 coup.' },
    { id: 'G55', subject: 'GENERAL', q: 'Oil can be found in all the following Nigerian states EXCEPT which one?', options: { A: 'Lagos', B: 'Anambra', C: 'Ondo', D: 'Ekiti' }, ans: 'D', exp: 'Ekiti is not listed among the main oil-producing states in the module.' },
    { id: 'G56', subject: 'GENERAL', q: 'Tin is majorly found in which Nigerian city?', options: { A: 'Jos', B: 'Enugu', C: 'Kano', D: 'Imo' }, ans: 'A', exp: 'Jos is historically known for tin mining.' },
    { id: 'G57', subject: 'GENERAL', q: 'Oil was first discovered by Shell-BP in Nigeria at which location?', options: { A: 'Oloibiri', B: 'Idanre', C: 'Warri', D: 'Kabba' }, ans: 'A', exp: 'Oloibiri is the historic site of Nigeria\'s first oil discovery.' },
    { id: 'G58', subject: 'GENERAL', q: 'Which of the following may be regarded as a regional organization?', options: { A: 'ECOWAS', B: 'OAU', C: 'UN', D: 'OPEC' }, ans: 'B', exp: 'OAU (now African Union) is a regional organization; ECOWAS is also regional but answer per module is OAU.' },
    { id: 'G59', subject: 'GENERAL', q: 'Who was the last military Head of State of Nigeria?', options: { A: 'Abdulsalami Abubakar', B: 'Yakubu Gowon', C: 'Sanni Abacha', D: 'Olusegun Obasanjo' }, ans: 'A', exp: 'Abdulsalami Abubakar was the last military head before transition to civilian rule.' },
    { id: 'G60', subject: 'GENERAL', q: 'Who coined the name "Nigeria" (as listed)?', options: { A: 'Flora Shaw', B: 'Mary Slessor', C: 'Lord Lugard', D: 'T. J. Goldie' }, ans: 'A', exp: 'Flora Shaw (later Lady Lugard) is credited with coining the name.' },
    { id: 'G61', subject: 'GENERAL', q: 'The legislature in Nigeria is called which of the following?', options: { A: 'House of Assembly', B: 'House of Representatives', C: 'House of Lords', D: 'National Assembly' }, ans: 'D', exp: 'The Nigerian legislature is the National Assembly.' },
    { id: 'G62', subject: 'GENERAL', q: 'The legislature in Britain is referred to as which?', options: { A: 'House of Commons', B: 'White House', C: 'Congress', D: 'Parliament' }, ans: 'D', exp: 'The British legislature is called Parliament.' },
    { id: 'G63', subject: 'GENERAL', q: 'Nigeria changed from pounds to Naira in which year?', options: { A: '1960', B: '1973', C: '1959', D: '1963' }, ans: 'B', exp: 'The currency was changed to the Naira in 1973.' },
    { id: 'G64', subject: 'GENERAL', q: 'Which Nigerian president died in office as listed and on which date (module)?', options: { A: 'Murtala Mohammed - Feb 13, 1976', B: 'Sanni Abacha - June 8, 1998', C: 'Umaru Yar\'Adua - May 5, 2010', D: 'Aguiyi Ironsi - July 29, 1966' }, ans: 'D', exp: 'Aguiyi Ironsi was assassinated on July 29, 1966; the module lists the option accordingly.' },
    { id: 'G65', subject: 'GENERAL', q: 'Which date did the late former president Muhammadu Buhari die (module listing)?', options: { A: 'May 29, 2025', B: 'July 13, 2025', C: 'July 29, 2025', D: 'June 12, 2025' }, ans: 'B', exp: 'The practice file lists July 13, 2025 for this item.' },
    { id: 'G66', subject: 'GENERAL', q: 'Who is listed as the current Senate President of Nigeria (in the module)?', options: { A: 'David Mark', B: 'Bukola Saraki', C: 'Godswill Akpabio', D: 'Adams Oshiomhole' }, ans: 'C', exp: 'The practice module lists Godswill Akpabio.' },
    { id: 'G67', subject: 'GENERAL', q: 'Who is listed as the current Honourable Minister of Interior (in the module)?', options: { A: 'Rauf Aregbesola', B: 'Olubunmi Tunji-Ojo', C: 'Nyesom Wike', D: 'Olufemi Alausa' }, ans: 'B', exp: 'Olubunmi Tunji-Ojo is listed in the material.' },
    { id: 'G68', subject: 'GENERAL', q: 'Who is listed as the current Governor of the Central Bank of Nigeria (in the module)?', options: { A: 'Olayemi Cardoso', B: 'Godwin Emefiele', C: 'Lamido Sanusi', D: 'Folashodun Olubunmi (Osborne)' }, ans: 'A', exp: 'Olayemi Cardoso is listed as the CBN Governor in the practice file.' },
    { id: 'G69', subject: 'GENERAL', q: 'The arm of government charged with the responsibility of making laws is?', options: { A: 'Judiciary', B: 'Legislative', C: 'Executive', D: 'Parliament' }, ans: 'B', exp: 'The Legislative arm is responsible for making laws.' },
    { id: 'G70', subject: 'GENERAL', q: 'The eagle in the coat of arms stands for which quality?', options: { A: 'Strength', B: 'EFCC', C: 'Pride', D: 'Hero' }, ans: 'A', exp: 'The eagle symbolizes strength in the coat of arms.' },

// ENGLISH (append E16..E50 from PDF)
    { id: 'E16', subject: 'ENGLISH', q: 'One significant character of the "jet age" is that it encourages people to cut corners. What does "cut corners" mean in this context?', options: { A: 'Not to face all problems', B: 'To want to become rich quickly', C: 'To want to avoid unnecessary hardships', D: 'Forfeit the opportunity of further education' }, ans: 'C', exp: 'In this context "cut corners" means to avoid unnecessary hardships.' },
    { id: 'E17', subject: 'ENGLISH', q: 'The lady who won the beauty contest had a good "gait". Which word is nearest in meaning to "gait"?', options: { A: 'Stature', B: 'Figure', C: 'Elegance', D: 'Carriage' }, ans: 'D', exp: 'Gait relates to carriage or the manner of walking.' },
    { id: 'E18', subject: 'ENGLISH', q: 'It would need a high flyer to make a first class degree in the university. Which choice best matches "high flyer"?', options: { A: 'A smart performer/unmitigated swot', B: 'An outright genius', C: 'An outstanding scholar', D: 'An average student' }, ans: 'A', exp: 'The phrase implies an exceptionally capable or high performing student.' },
    { id: 'E19', subject: 'ENGLISH', q: 'What you will find in the book is a bird\'s eye view of the subject. What does "bird\'s eye view" mean?', options: { A: 'A detailed account', B: 'General survey', C: 'A balanced account', D: 'A biased treatment' }, ans: 'B', exp: 'A bird\'s eye view means a general survey or overview.' },
    { id: 'E20', subject: 'ENGLISH', q: 'Hers was a chequered career. The phrase "chequered career" most nearly means?', options: { A: 'An interesting and successful career', B: 'A career full of sorrow and tears', C: 'A bright and memorable career', D: 'A career full of ups and downs' }, ans: 'D', exp: 'A chequered career means one with ups and downs.' },
    { id: 'E21', subject: 'ENGLISH', q: 'If experience is anything to go by, this action will prove a political minefield. What does "political minefield" imply?', options: { A: 'A source of political benefits', B: 'A way out of political trouble', C: 'A cause for political joy', D: 'An invitation to political problems' }, ans: 'D', exp: 'A political minefield suggests a situation full of hidden dangers.' },
    { id: 'E22', subject: 'ENGLISH', q: 'In my view, the play didn\'t come off. What does "come off" mean here?', options: { A: 'Succeed', B: 'Fail', C: 'Attract applause', D: 'Take place' }, ans: 'B', exp: 'Here "come off" means the play did not succeed.' },
    { id: 'E23', subject: 'ENGLISH', q: 'When the chips are down, we will know those who have the courage to stand. What does the phrase mean?', options: { A: 'When we get to a crisis point', B: 'In the final analysis', C: 'When the blocks are lowered', D: 'When we get to the end of the road' }, ans: 'A', exp: '"When the chips are down" refers to a crisis or difficult time.' },
    { id: 'E24', subject: 'ENGLISH', q: 'She said boxing is, in fact, her pet aversion. What does "pet aversion" mean?', options: { A: 'Something she likes very much', B: 'Something she dislikes very much', C: 'A hobby she loves to pursue', D: 'One thing she can\'t miss' }, ans: 'B', exp: 'A pet aversion is something one particularly dislikes.' },
    { id: 'E25', subject: 'ENGLISH', q: 'The gate man does his work perfunctorily. What does "perfunctorily" mean?', options: { A: 'Without commitment', B: 'With speed', C: 'Mother\'s pet', D: 'Father\'s pet' }, ans: 'A', exp: 'Perfunctorily means doing something with little interest or care.' },
    { id: 'E26', subject: 'ENGLISH', q: 'Members of the panel were working at cross-purposes. This means they were?', options: { A: 'In harmony', B: 'In disunity', C: 'For selfish purposes', D: 'Stretching resources' }, ans: 'B', exp: 'Working at cross-purposes means working against each other or in disunity.' },
    { id: 'E27', subject: 'ENGLISH', q: 'The young man who distributed political pamphlets on campus was promptly repudiated. "Repudiated" most nearly means?', options: { A: 'Disowned', B: 'Arrested', C: 'Warned', D: 'Killed' }, ans: 'A', exp: 'Repudiated means disowned or rejected.' },
    { id: 'E28', subject: 'ENGLISH', q: 'Adayi is a die-hard criminal. The phrase "die-hard" here best means?', options: { A: 'Hard to kill', B: 'Hard to arrest', C: 'Remorseless', D: 'Resentless' }, ans: 'C', exp: 'Die-hard criminal refers to someone persistent and unrepentant.' },
    { id: 'E29', subject: 'ENGLISH', q: 'In moments of serious economic hardship, many people are __ to turn to God. Which word best fills the gap?', options: { A: 'Concerned', B: 'Inclined', C: 'Disposed', D: 'Propensed' }, ans: 'B', exp: '"Inclined" fits the context best.' },
    { id: 'E30', subject: 'ENGLISH', q: 'We cannot all wear expensive shoes in situation of __. Which phrase best completes the sentence?', options: { A: 'Different demand and supply', B: 'Uneven wear and tear', C: 'Purchasing power', D: 'Unpredictable national income' }, ans: 'C', exp: 'Purchasing power is the economic factor affecting ability to buy expensive shoes.' },
    { id: 'E31', subject: 'ENGLISH', q: 'The centre–forward was __ consequently the goal was not allowed. Which choice completes it?', options: { A: 'In an offside position', B: 'Very well positioned', C: 'Brilliant player', D: 'The captain of the team' }, ans: 'A', exp: 'Being in an offside position makes a goal disallowed.' },
    { id: 'E32', subject: 'ENGLISH', q: 'AIDS is a disease that kills slowly but surely. Which option correctly modifies the sentence for emphasis?', options: { A: 'Too much a deadly', B: 'Very deadly', C: 'So deadly', D: 'Such deadly' }, ans: 'C', exp: '"So deadly" is the grammatically appropriate modifier here.' },
    { id: 'E33', subject: 'ENGLISH', q: 'We had a dull evening because __', options: { A: 'Hardly the talk had begun when the lights went off', B: 'Hardly had the talk begun when the light went off', C: 'The talk had hardly begun when the light had gone out', D: 'The lights had hardly gone out when the talk began' }, ans: 'B', exp: '"Hardly had the talk begun when..." is the correct inversion.' },
    { id: 'E34', subject: 'ENGLISH', q: 'Soyinka\'s masterful __ of the atmosphere of his childhood helped to make his book, Ake, an outright success. Which word completes the sentence?', options: { A: 'Evocation', B: 'Invocation', C: 'Convocation', D: 'Revocation' }, ans: 'A', exp: 'Evocation of atmosphere is the correct word.' },
    { id: 'E35', subject: 'ENGLISH', q: 'Students will always blame their unfavourable teachers when examination results are __. Which tag question fits?', options: { A: 'Won\'t they', B: 'Wouldn\'t they', C: 'Isn\'t it', D: 'Can\'t they' }, ans: 'B', exp: '"Wouldn\'t they" is the appropriate tag question.' },
    { id: 'E36', subject: 'ENGLISH', q: 'Okonkwo is a stubborn man; he will never __ his words. Which verb completes the sentence?', options: { A: 'Chew', B: 'Spit', C: 'Eat', D: 'Bite' }, ans: 'D', exp: '"Bite his words" is the idiomatic completion meaning to withdraw his words.' },
    { id: 'E37', subject: 'ENGLISH', q: 'Kindly __ me your book because my friend has __ mine. Which option pair is correct?', options: { A: 'Borrow/ borrowed', B: 'Borrow/ rent', C: 'Lend/ lent', D: 'Lend/ borrowed' }, ans: 'D', exp: '"Lend me your book because my friend has borrowed mine." fits correctly.' },
    { id: 'E38', subject: 'ENGLISH', q: 'Three quarters of the church __ painted by members the previous day. Which verb form is correct?', options: { A: 'Were', B: 'Was', C: 'Is', D: 'Are' }, ans: 'A', exp: 'When referring to people (members), "were" is used here.' },
    { id: 'E39', subject: 'ENGLISH', q: 'The young boys have been caught with parts of the stolen machine but admitted stealing it. Which choice correctly completes the sentence?', options: { A: 'Neither of them has', B: 'Neither of them have', C: 'None of them has', D: 'None' }, ans: 'C', exp: '"None of them has" is grammatically correct in this context.' },
    { id: 'E40', subject: 'ENGLISH', q: 'Watching carefully, I could see the fish __ along the bottom. Which verb fits?', options: { A: 'Dotting', B: 'Crawling', C: 'Diving', D: 'Darting' }, ans: 'D', exp: '"Darting" describes quick swimming motions along the bottom.' },
    { id: 'E41', subject: 'ENGLISH', q: 'Emeka is now a __ student but it took him years to __. Which option is correct?', options: { A: 'Matured/mature', B: 'Mature/mature', C: 'Mature/matured', D: 'Matured/matured' }, ans: 'B', exp: 'Emeka is now a mature student (present), it took him years to mature (verb).' },
    { id: 'E42', subject: 'ENGLISH', q: 'The rebels will soon fight back. We have been informed __ their __.', options: { A: 'Of / predicament', B: 'About / indulgence', C: 'On / rearmament', D: 'As / ___' }, ans: 'C', exp: '"On their rearmament" fits logically.' },
    { id: 'E43', subject: 'ENGLISH', q: 'Ali was honest and quiet as a school boy but too much drinking has now changed his __ and __ his tongue.', options: { A: 'Temperature/ injured', B: 'Character/ tightened', C: 'Temperament/ loosened', D: 'Innocence/ worsened' }, ans: 'C', exp: '"Temperament/ loosened" makes sense in the context given by the module.' },
    { id: 'E44', subject: 'ENGLISH', q: 'The hospital was closed __ because there were no beds to put patients. Which pair completes the sentence?', options: { A: 'Again/ upon', B: 'Off/ on', C: 'Down/ at', D: 'Up/ in' }, ans: 'B', exp: '"Closed off because" is an odd phrasing but per module the choice was B.' },
    { id: 'E45', subject: 'ENGLISH', q: 'The judge with his son __ travelling to Lagos now. Which verb form is correct?', options: { A: 'Were', B: 'Shall', C: 'Is', D: 'Are' }, ans: 'C', exp: 'The judge with his son is travelling (singular collective).' },
    { id: 'E46', subject: 'ENGLISH', q: 'A university teacher is an __.', options: { A: 'Academic', B: 'Academics', C: 'Academician', D: 'Academia' }, ans: 'A', exp: 'Academic is the correct noun form.' },
    { id: 'E47', subject: 'ENGLISH', q: 'The adventurers ran into many __ in the forest. Which plural is correct?', options: { A: 'Dear', B: 'Dears', C: 'Deers', D: 'Deer' }, ans: 'D', exp: 'The plural of deer is deer.' },
    { id: 'E48', subject: 'ENGLISH', q: 'The argument between the two neighbours degenerated into __.', options: { A: 'A free-for-all', B: 'A free for all fight', C: 'A flee for all', D: 'A free fight' }, ans: 'A', exp: '"A free-for-all" is the correct phrase.' },
    { id: 'E49', subject: 'ENGLISH', q: 'The class __ more girls than boys this session. Which verb is correct?', options: { A: 'Comprise of', B: 'Comprises of', C: 'Comprise', D: 'Comprises' }, ans: 'D', exp: '"Comprises" (singular) is correct in this context.' },
    { id: 'E50', subject: 'ENGLISH', q: 'The tourist bought which description is correct?', options: { A: 'A brown, small, Nigerian earthen pot', B: 'A small, brown Nigerian earthen pot', C: 'An earthen, brown, small Nigerian pot', D: 'A Nigerian small brown earthen pot' }, ans: 'B', exp: 'Order of adjectives should be: size, color, origin.' },

// End of additions for Batch 1

// --- MATHEMATICS (Batch 2 additions from PDF) ---
    { id: 'M16', subject: 'MATHS', q: 'What is the probability of getting an odd number on a single toss of a fair die?', options: { A: '1/6', B: '1/3', C: '1/2', D: '2/3' }, ans: 'C', exp: 'Odd faces are 1,3,5 → 3 out of 6 = 1/2.' },
    { id: 'M17', subject: 'MATHS', q: 'In a class of 40 children, 16 surnames begin with O and 9 begin with A. What is the probability a randomly chosen child\'s surname begins with O or A?', options: { A: '5/8', B: '7/8', C: '9/16', D: '14/25' }, ans: 'A', exp: 'Total O or A = 16 + 9 = 25; probability = 25/40 = 5/8.' },
    { id: 'M18', subject: 'MATHS', q: 'If more than one surname begins with a letter besides A and O, how many letters (from the options) might that represent according to the module?', options: { A: '2', B: '3', C: '4', D: '6' }, ans: 'B', exp: 'Answer taken from the practice module (original formatting ambiguous).' },
    { id: 'M19', subject: 'MATHS', q: 'From the table of scores (2,2), (3,4), (4,7), (5,2), (6,3), (7,2): If a student is chosen at random, what is the probability that he scored at least 6 marks?', options: { A: '3/20', B: '1/5', C: '1/4', D: '3/10' }, ans: 'C', exp: 'There are 3 students with 6 and 2 with 7 → 5 out of 20 = 1/4.' },
    { id: 'M20', subject: 'MATHS', q: 'What is the probability that three customers waiting in a bank will be served in the sequence of their arrival?', options: { A: '1/6', B: '1/3', C: '1/2', D: '2/3' }, ans: 'A', exp: 'There are 3! = 6 possible orders; only one matches arrival order.' },
    { id: 'M21', subject: 'MATHS', q: 'Kodjo and Adoga have pass probabilities 3/4 and 3/5 respectively. What is the probability both boys fail the examination?', options: { A: '1/10', B: '3/10', C: '1/2', D: '2/3' }, ans: 'A', exp: 'Fail probabilities: 1/4 and 2/5. Product = (1/4)*(2/5)=1/10.' },
    { id: 'M22', subject: 'MATHS', q: 'The mean of 20 observations is 4. If the largest value is 23, find the mean of the remaining observations.', options: { A: '4', B: '3', C: '2.85', D: '2.60' }, ans: 'B', exp: 'Sum = 20*4 = 80. Remove 23 → 57 remaining; mean = 57/19 = 3.' },
    { id: 'M23', subject: 'MATHS', q: 'In a group of 11 people who speak English or French or both: 7 speak English and 6 speak French. If a person who speaks English is chosen at random, what is the probability that the person also speaks French?', options: { A: '2/7', B: '4/11', C: '5/11', D: '11/13' }, ans: 'A', exp: 'Both = 7 + 6 - 11 = 2. Given English speaker count 7 → 2/7.' },
    { id: 'M24', subject: 'MATHS', q: 'If events X and Y are mutually exclusive with P(X)=1/3 and P(Y)=2/5, what is P(X ∩ Y)?', options: { A: '0', B: '2/15', C: '4/15', D: '11/15' }, ans: 'A', exp: 'Mutually exclusive events cannot both occur → intersection probability = 0.' },
    { id: 'M25', subject: 'MATHS', q: 'Using the same X and Y, what is P(X ∪ Y)?', options: { A: '0', B: '2/15', C: '4/15', D: '11/15' }, ans: 'D', exp: 'P(X ∪ Y) = P(X)+P(Y) = 1/3 + 2/5 = 11/15.' },
    { id: 'M26', subject: 'MATHS', q: 'A box contains 2 white and 3 blue identical marbles. If two marbles are picked at random without replacement, what is the probability they are of different colours?', options: { A: '2/3', B: '3/5', C: '2/5', D: '7/20' }, ans: 'B', exp: 'Probability = (2/5)*(3/4) + (3/5)*(2/4) = 12/20 = 3/5.' },
    { id: 'M27', subject: 'MATHS', q: 'Mrs. Jones: P(boy)=1/2 and P(blue eyes)=1/4. What is P(blue-eyed boy)?', options: { A: '1/8', B: '1/4', C: '3/8', D: '1/2' }, ans: 'A', exp: 'Assuming independence: (1/2)*(1/4)=1/8.' },
    { id: 'M28', subject: 'MATHS', q: 'Convert 90 km/h to metres per second.', options: { A: '1.5 m/s', B: '2.5 m/s', C: '25 m/s', D: '1.5×10^3 m/s' }, ans: 'C', exp: '90*(1000/3600)=90*(5/18)=25 m/s.' },
    { id: 'M29', subject: 'MATHS', q: 'Uche and Chidi share money in ratio m:n. If Chidi\'s share is N4,200, what is Uche\'s share?', options: { A: 'N4,200 n/m', B: 'N4,200/mn', C: 'N4,200 m/n', D: 'N4,200/n' }, ans: 'C', exp: 'If Chidi (n parts) = N4,200 then one part = 4200/n so Uche (m parts) = 4200*(m/n).' },
    { id: 'M30', subject: 'MATHS', q: 'A husband contributes 7% of his income (N5,500 p.a.) and his wife contributes 4% of her income (N4,000 p.a.). Find their total contribution.', options: { A: 'N1,045', B: 'N605', C: 'N545', D: 'N490' }, ans: 'C', exp: 'Husband: 0.07*5500=385; Wife:0.04*4000=160; Total = 385+160 = 545.' },
    { id: 'M31', subject: 'MATHS', q: 'A car is traveling at 80 km/h. Its speed in metres per second (m/s) is approximately?', options: { A: '13.3 m/s', B: '22.2 m/s', C: '133.3 m/s', D: '222.2 m/s' }, ans: 'B', exp: '80*(5/18)=400/18 ≈ 22.22 m/s.' },
    { id: 'M32', subject: 'MATHS', q: 'If children share N10.50 in the ratio 6:7:8, what is the largest share?', options: { A: 'N3.00', B: 'N3.50', C: 'N4.00', D: 'N4.50' }, ans: 'C', exp: 'Total parts 21. Largest = 8/21 * 10.50 = 4.00.' },
    { id: 'M33', subject: 'MATHS', q: 'A trader makes a loss of 15%. What is the ratio selling price : cost price?', options: { A: '3:20', B: '3:17', C: '17:20', D: '20:23' }, ans: 'C', exp: 'If loss 15% then SP = 85% of CP. Ratio = 85:100 = 17:20.' },
    { id: 'M34', subject: 'MATHS', q: 'A car travels at x km/h for 1 hour and at y km/h for 2 hours. What is its average speed?', options: { A: '(x+2y)/3', B: '(2x+2y)/3', C: '(x+ y)/3', D: '(2x+y)/3' }, ans: 'A', exp: 'Average speed = total distance / total time = (x + 2y)/3.' },
    { id: 'M35', subject: 'MATHS', q: 'The ages of three men are in the ratio 3:4:5. If the difference between oldest and youngest is 18 years, find the sum of their ages.', options: { A: '45 years', B: '72 years', C: '108 years', D: '216 years' }, ans: 'C', exp: 'Let k be common factor: (5-3)k = 2k = 18 → k=9. Sum = (3+4+5)k = 12*9 = 108.' },
    { id: 'M36', subject: 'MATHS', q: 'A bicycle wheel of radius 42 cm is rolled over 66 m. How many revolutions does it make? (Take π = 22/7)', options: { A: '2.5', B: '5', C: '25', D: '50' }, ans: 'C', exp: 'Circumference = 2πr = 2*(22/7)*42 = 264 cm. Distance = 6600 cm. Revolutions = 6600/264 = 25.' },
    { id: 'M37', subject: 'MATHS', q: 'In a bag of oranges, the ratio of good ones to bad ones is 5:4. If the number of bad ones is 36, how many oranges are there altogether?', options: { A: '81', B: '72', C: '54', D: '45' }, ans: 'A', exp: 'Bad = 4 parts = 36 → 1 part = 9 → total = 9*9 = 81.' },
    { id: 'M38', subject: 'MATHS', q: 'A man is four times as old as his son. The difference between their ages is 36. Find the sum of their ages.', options: { A: '45 years', B: '48 years', C: '60 years', D: '74 years' }, ans: 'C', exp: 'Let son = s; man = 4s; 4s - s =36 → s=12; sum=5s=60.' },
    { id: 'M39', subject: 'MATHS', q: 'If 4m + 3n = 5, find the ratio m:n (choose from given options)', options: { A: '37:4', B: '4:3', C: '3:4', D: '4:7' }, ans: 'B', exp: 'Answer per module formatting; kept as listed.' },
    { id: 'M40', subject: 'MATHS', q: 'If 2x : (x+1) = 3 : 2, what is the value of x?', options: { A: '1/2', B: '1', C: '3/2', D: '3' }, ans: 'D', exp: '2x/(x+1)=3/2 → 4x = 3x + 3 → x = 3.' },
    { id: 'M41', subject: 'MATHS', q: 'The ratio of men to women in a 20-member committee is 3:1. How many women must be added so that the ratio becomes 3:2?', options: { A: '7', B: '9', C: '5', D: '2' }, ans: 'C', exp: 'Men = 15, women =5. Need 15:(5+w)=3:2 → w=5.' },
    { id: 'M42', subject: 'MATHS', q: 'Three men Bedu, Bakare and Kofi shared N500 in the ratio 3:2:x. If Bedu\'s share is N150, find the value of x.', options: { A: '1', B: '3', C: '5', D: '6' }, ans: 'C', exp: '3/(3+2+x)*500 =150 → 3/(5+x)=150/500=3/10 → 5+x=10 → x=5.' },
    { id: 'M43', subject: 'MATHS', q: 'The sides of two cubes are in the ratio 2:5. What is the ratio of their volumes?', options: { A: '8:15', B: '8:125', C: '6:125', D: '4:5' }, ans: 'B', exp: 'Volumes scale as cubes: 2^3 : 5^3 = 8 : 125.' },
    { id: 'M44', subject: 'MATHS', q: 'Lena bought 400 shares at N1.50 each and sold them at N2.05 each. What was her gain?', options: { A: 'N0.55', B: 'N20.00', C: 'N220.00', D: 'N330.00' }, ans: 'C', exp: 'Gain per share = 2.05 - 1.50 = 0.55. Total gain = 0.55 * 400 = 220.' },
    { id: 'M45', subject: 'MATHS', q: 'Amma buys 100 oranges at 20 for C30.00 and 200 oranges at 4 for C10.00. If she sells all oranges at C3.00 each, what was her profit?', options: { A: 'C150.00', B: 'C250.00', C: 'C500.00', D: 'C650.00' }, ans: 'B', exp: 'Cost = (100/20)*30 + (200/4)*10 =150 +500 =650. Revenue = 300*3 =900. Profit = 250.' },
    { id: 'M46', subject: 'MATHS', q: 'The price of a litre of petrol is increased from C30.00 to C39.00. What is the percentage increase?', options: { A: '90%', B: '30%', C: '34%', D: '39%' }, ans: 'B', exp: 'Increase = 9/30 = 0.3 = 30%.' },
    { id: 'M47', subject: 'MATHS', q: 'A trader sold a pair of shoes for C2,800 making a loss of 20% on his cost price. Find his loss as a percentage of his selling price.', options: { A: '16 2/3%', B: '2%', C: '25%', D: '75%' }, ans: 'C', exp: 'If loss 20% of CP, then loss/SP = 0.2CP / 0.8CP = 0.25 = 25%.' },
    { id: 'M48', subject: 'MATHS', q: 'An article bought for D5,000 depreciates by 15% in the first year. Find its value after a year.', options: { A: 'D425.00', B: 'D750.00', C: 'D4,250.00', D: 'D4,985.00' }, ans: 'C', exp: 'Value = 5000*(1-0.15)=5000*0.85=4250.' },
    { id: 'M49', subject: 'MATHS', q: 'A house bought for N100,000 was later auctioned for N80,000. Find the loss percent.', options: { A: '20%', B: '30%', C: '40%', D: '50%' }, ans: 'A', exp: 'Loss = 20,000 on 100,000 → 20%.' },
    { id: 'M50', subject: 'MATHS', q: 'The side of a square is increased from 20 cm to 21 cm. Calculate the percentage increase in its area.', options: { A: '2.5%', B: '9.3%', C: '10.0%', D: '10.25%' }, ans: 'D', exp: 'Area increase from 400 to 441; increase = 41/400 = 0.1025 = 10.25%.' },
    { id: 'M51', subject: 'MATHS', q: 'A man bought 2220 mangoes at N5x each and sold each for 3x kobo making a gain of N8. Find the value of x (as given in options).', options: { A: '2', B: '3', C: '6', D: '10' }, ans: 'A', exp: 'Problem statement in module is ambiguous; selected option per module listing.' },
    { id: 'M52', subject: 'MATHS', q: 'A car moves at an average speed of 30 km/h. How long does it take to cover 200 metres?', options: { A: '2.4 sec', B: '24 sec', C: '144 sec', D: '240 sec' }, ans: 'B', exp: '30 km/h = 8.333... m/s; time = 200 / 8.333... ≈ 24 s.' },
    { id: 'M53', subject: 'MATHS', q: 'A man bought a television on hire purchase for N25,000 of which he paid N10,000. If he pays the balance in eight equal installments, find the value of each installment.', options: { A: 'N1250', B: 'N1578', C: 'N1875', D: 'N3125' }, ans: 'C', exp: 'Balance = 25,000 - 10,000 = 15,000; each = 15,000/8 = 1875.' },
    { id: 'M54', subject: 'MATHS', q: 'If the simple interest on N2,000 after 9 months is N60, what is the rate per annum?', options: { A: '2 1/4%', B: '4%', C: '5%', D: '6%' }, ans: 'B', exp: 'Assuming interest is N60 (module likely intended 60): r = 60/(2000*(9/12)) = 60/1500 = 0.04 = 4%.' },
    { id: 'M55', subject: 'MATHS', q: 'A student bought 3 notebooks and 1 pen for N35. She later bought 2 notebooks and 2 pens for N30. What is the cost of a pen?', options: { A: 'N5.00', B: 'N7.50', C: 'N10.00', D: 'N15.00' }, ans: 'A', exp: 'Solve: 3n + p =35 and 2n +2p =30 → n=10, p=5.' },

];

// Expose data to window for easier debugging in local browsers (module scope isn't global)
try {
    if (typeof window !== 'undefined' && !window.fullQuestionsData) {
        window.fullQuestionsData = fullQuestionsData;
    }
} catch (e) {
    // silent - debugging helper should not break the app
}


// --- FIREBASE INITIALIZATION AND AUTHENTICATION ---

// Function to set up Firebase and handle initial authentication, or bypass for local use.
const setupFirebase = async () => {
    // Check if Firebase configuration is available (i.e., not running in local environment)
    const isLocalRun = !firebaseConfig || typeof initializeApp === 'undefined';
    const authUidElement = document.getElementById('auth-uid');
    
    if (isLocalRun) {
        console.warn("Running in local (standalone) mode. Firestore persistence disabled.");
        userId = 'local-user-' + Math.random().toString(36).substring(2, 8); 
        authUidElement.textContent = userId + ' (LOCAL)';
        startButton.disabled = false;
        loadingSpinner.classList.add('hidden');
        isFirebaseActive = false;
        return; 
    }
    
    // --- Firebase Initialization (Only runs if config is present) ---
    isFirebaseActive = true;
    try {
        setLogLevel('debug');
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid; // Store the authenticated user ID.
                authUidElement.textContent = userId;
                await getOrCreateUserProfile(userId);
            } else {
                // Sign in using the provided token or anonymously if token is absent.
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Firebase Sign-in failed:", error);
                    document.getElementById('error-message').innerText = `Auth Error: ${error.message}`;
                    document.getElementById('error-message').classList.remove('hidden');
                }
            }
            startButton.disabled = false; // Enable the start button once auth is attempted.
            loadingSpinner.classList.add('hidden'); 
        });
    } catch (error) {
        console.error("Firebase Initialization failed:", error);
        document.getElementById('error-message').innerText = `Init Error: ${error.message}`;
        document.getElementById('error-message').classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        isFirebaseActive = false;
    }
};

// Helper to get user profile document path (conditional on Firebase being active)
const getUserProfileDocRef = (uid) => {
    if (!isFirebaseActive) return null;
    return doc(db, `artifacts/${appId}/users/${uid}/cbt_profiles/profile`);
};

// Helper to get exam results collection path (conditional on Firebase being active)
const getExamResultsCollectionRef = (uid) => {
    if (!isFirebaseActive) return null;
    return collection(db, `artifacts/${appId}/users/${uid}/cbt_results`);
};

// Function to fetch the user profile or create one (conditional on Firebase being active)
const getOrCreateUserProfile = async (uid) => {
    if (!isFirebaseActive) return;
    const profileRef = getUserProfileDocRef(uid);
    const docSnap = await getDoc(profileRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.name) {
            nameInput.value = data.name;
            candidateName = data.name;
        }
    } else {
        await setDoc(profileRef, { uid: uid, createdAt: serverTimestamp(), examsTaken: 0 });
    }
};

// --- EXAM CORE LOGIC ---

// Utility function to shuffle an array (Fisher-Yates)
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Function to initialize the exam data with the 4-subject rotation logic.
const initializeExam = () => {
    examQuestions = []; 
    
    const departmentSubject = selectedDepartment === 'GENERAL_ALL' ? 'GENERAL' : selectedDepartment;
    
    // All subjects that will be included in this specific exam.
    const currentExamSubjects = [...FIXED_SUBJECTS];
    if (departmentSubject !== 'GENERAL') {
        currentExamSubjects.push(departmentSubject);
    }

    // 1. Compile questions from FIXED subjects (MATHS, ENGLISH, GENERAL)
    FIXED_SUBJECTS.forEach(subject => {
        let subjectPool = fullQuestionsData.filter(q => q.subject === subject);
        subjectPool = shuffleArray(subjectPool);
        const count = QUESTIONS_PER_SUBJECT_MAP[subject];
        const selectedQuestions = subjectPool.slice(0, count);
        examQuestions.push(...selectedQuestions);
    });
    
    // 2. Compile questions from the DEPARTMENTAL subject
    const departmentalPool = fullQuestionsData.filter(q => q.subject === departmentSubject);
    const shuffledDepartmentalPool = shuffleArray(departmentalPool);
    const departmentalCount = QUESTIONS_PER_SUBJECT_MAP.DEPARTMENTAL;
    const selectedDepartmentalQuestions = shuffledDepartmentalPool.slice(0, departmentalCount);
    examQuestions.push(...selectedDepartmentalQuestions);
    
    // Final check to ensure we hit 50 questions
    if (examQuestions.length !== TOTAL_QUESTIONS_COUNT) {
        console.error(`Error in question selection. Expected ${TOTAL_QUESTIONS_COUNT}, got ${examQuestions.length}.`);
        // Fallback: If total count is wrong, just ensure all questions are available.
    }

    // Final shuffle of the entire exam list to mix the subjects up for the test taker
    examQuestions = shuffleArray(examQuestions);
    
    // Reset state for a new exam
    currentQuestionIndex = 0;
    userAnswers = {};
    timeRemaining = MAX_TIME_SECONDS;
    
    // Start the exam flow
    showScreen('exam-screen');
    startTimer();
    renderQuestion();
    renderNavigationGrid();
};

// Function to update the display of the current question.
const renderQuestion = () => {
    const question = examQuestions[currentQuestionIndex];
    if (!question) return;

    // Display subject name clearly
    const subjectDisplay = question.subject.replace('_', ' ').replace('NIS', '(NIS)').replace('NSCDC', '(NSCDC)').replace('NCS', '(NCS)').replace('FFS', '(FFS)');
    document.getElementById('question-text').innerHTML = `Q${currentQuestionIndex + 1}. <span class="text-blue-700 font-bold">(${subjectDisplay})</span> ${question.q}`;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = ''; 

    // Generate option buttons
    Object.keys(question.options).forEach(key => {
        const optionText = question.options[key];
        const isSelected = userAnswers[question.id] === key;

        const optionButton = document.createElement('button');
        optionButton.className = `w-full text-left p-3 border border-gray-300 rounded-lg transition duration-150 hover:bg-gray-100 ${isSelected ? 'option-selected' : 'bg-white text-gray-800'}`;
        optionButton.innerHTML = `<span class="font-bold mr-2">${key}.</span> ${optionText}`;
        optionButton.dataset.option = key;
        optionButton.dataset.questionId = question.id;
        
        optionButton.addEventListener('click', handleOptionClick);
        optionsContainer.appendChild(optionButton);
    });

    // Update navigation buttons status
    document.getElementById('prev-button').disabled = currentQuestionIndex === 0;
    document.getElementById('next-button').disabled = currentQuestionIndex === examQuestions.length - 1;

    updateNavGridHighlight();
};

// Function to handle the selection of an answer option.
const handleOptionClick = (event) => {
    const selectedButton = event.currentTarget;
    const optionKey = selectedButton.dataset.option;
    const questionId = selectedButton.dataset.questionId;
    const allOptionButtons = selectedButton.parentNode.querySelectorAll('button');

    // 1. Reset visual state of all options 
    allOptionButtons.forEach(btn => btn.classList.remove('option-selected'));

    // 2. Update userAnswers state and apply visual selection
    userAnswers[questionId] = optionKey;
    selectedButton.classList.add('option-selected');

    // 3. Update the navigation grid button to 'answered' (green)
    const navButton = document.querySelector(`.nav-q[data-index="${currentQuestionIndex}"]`);
    if (navButton) {
        navButton.classList.remove('bg-gray-300', 'bg-blue-500', 'bg-yellow-500');
        navButton.classList.add('bg-green-500', 'text-white'); 
    }
};

// Function to handle moving between questions.
const navigateQuestion = (direction) => {
    const newIndex = currentQuestionIndex + direction;
    if (newIndex >= 0 && newIndex < examQuestions.length) {
        currentQuestionIndex = newIndex;
        renderQuestion();
    }
};

// Function to create the grid of numbered buttons for question navigation.
const renderNavigationGrid = () => {
    const grid = document.getElementById('navigation-grid');
    grid.innerHTML = '';
    
    examQuestions.forEach((q, index) => {
        const navButton = document.createElement('button');
        navButton.className = `nav-q w-8 h-8 text-xs font-semibold rounded transition duration-100 bg-gray-300 hover:bg-gray-400 text-gray-800`;
        navButton.textContent = index + 1;
        navButton.dataset.index = index;
        
        navButton.addEventListener('click', () => {
            currentQuestionIndex = index;
            renderQuestion();
        });

        grid.appendChild(navButton);
    });
};

// Function to highlight the currently viewed question in the navigation grid.
const updateNavGridHighlight = () => {
    document.querySelectorAll('.nav-q').forEach(btn => {
        btn.classList.remove('border-2', 'border-red-500'); 
        
        // Restore answered color (green) or unmarked color (gray)
        const question = examQuestions[parseInt(btn.dataset.index)];
        const isAnswered = userAnswers[question.id];

        if (isAnswered) {
             btn.classList.remove('bg-gray-300', 'bg-blue-500', 'text-gray-800');
             btn.classList.add('bg-green-500', 'text-white');
        } else {
             btn.classList.remove('bg-green-500', 'bg-blue-500', 'text-white');
             btn.classList.add('bg-gray-300', 'text-gray-800');
        }
    });
    
    // Highlight the active question with a red border
    const currentNavButton = document.querySelector(`.nav-q[data-index="${currentQuestionIndex}"]`);
    if (currentNavButton) {
        currentNavButton.classList.add('border-2', 'border-red-500');
    }
};

// --- TIMER LOGIC AND UTILS ---

// Function to format time (seconds) into MM:SS string.
const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Function to start the exam countdown timer.
const startTimer = () => {
    clearInterval(timerInterval); 
    
    const timerElement = document.getElementById('timer');
    timerElement.textContent = formatTime(timeRemaining);
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        timerElement.textContent = formatTime(timeRemaining);

        // Visual warning for the last minute
        if (timeRemaining <= 60 && timeRemaining > 0) {
            timerElement.classList.remove('text-red-600');
            timerElement.classList.add('text-red-800', 'animate-pulse'); 
        } else if (timeRemaining > 60) {
            timerElement.classList.remove('text-red-800', 'animate-pulse');
            timerElement.classList.add('text-red-600');
        }
        
        // Auto-submit when time runs out
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timeRemaining = 0;
            handleSubmitExam(true); // isTimeout = true
        }
    }, 1000);
};

// --- SUBMISSION AND SCORING ---

// Main function to calculate score, save results (if online), and show the review screen.
const handleSubmitExam = async (isTimeout = false) => {
    clearInterval(timerInterval); 
    loadingSpinner.classList.remove('hidden'); 

    let score = 0;
    const totalTimeSpent = MAX_TIME_SECONDS - timeRemaining;
    const results = [];

    // 1. Calculate Score and prepare results
    examQuestions.forEach(q => {
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.ans;
        if (isCorrect) {
            score++;
        }
        results.push({
            id: q.id,
            q: q.q,
            options: q.options,
            correctAnswer: q.ans,
            userAnswer: userAnswer || 'N/A', 
            isCorrect: isCorrect,
            explanation: q.exp, 
            subject: q.subject
        });
    });
    
    // 2. Prepare and save result document to Firestore (Only if Firebase is active)
    if (isFirebaseActive) {
        const resultDoc = {
            candidateId: userId,
            candidateName: candidateName,
            department: selectedDepartment,
            score: score,
            totalQuestions: TOTAL_QUESTIONS_COUNT,
            percentage: (score / TOTAL_QUESTIONS_COUNT) * 100,
            timeSpentSeconds: totalTimeSpent,
            submissionTime: serverTimestamp(),
            questions: results, 
            isTimeout: isTimeout
        };

        try {
            const resultsRef = getExamResultsCollectionRef(userId);
            await setDoc(doc(resultsRef), resultDoc); 
            
            // Update user profile metadata
            const profileRef = getUserProfileDocRef(userId);
            const profileSnap = await getDoc(profileRef);
            const examsTaken = profileSnap.exists() ? (profileSnap.data().examsTaken || 0) : 0;
            await updateDoc(profileRef, {
                examsTaken: examsTaken + 1,
                lastExam: serverTimestamp()
            });

        } catch (error) {
            console.error("Error saving results to Firestore:", error);
        }
    } else {
        console.log("Local Mode: Results calculated but not saved to cloud.");
    }
    
    loadingSpinner.classList.add('hidden'); 

    // 3. Display Results Screen
    displayResults(score, totalTimeSpent, results);
};

// Function to render the final score and the detailed review list.
const displayResults = (score, totalTimeSpent, results) => {
    // Update score card elements
    document.getElementById('candidate-name-results').textContent = candidateName;
    document.getElementById('final-score').textContent = `${score}/${TOTAL_QUESTIONS_COUNT}`;
    document.getElementById('time-spent').textContent = formatTime(totalTimeSpent);

    const reviewList = document.getElementById('review-list');
    reviewList.innerHTML = ''; 

    // Iterate through results to build the review cards
    results.forEach((q, index) => {
        const reviewCard = document.createElement('div');
        reviewCard.className = `p-5 rounded-xl shadow-lg border-l-4 ${q.isCorrect ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`;
        
        let optionsHtml = '';
        Object.keys(q.options).forEach(key => {
            const optionText = q.options[key];
            let optionClass = 'w-full text-left p-2 border border-gray-300 rounded transition duration-150 text-gray-800 bg-white';

            // Apply coloring logic for review
            if (key === q.correctAnswer) {
                optionClass = 'option-correct'; 
            } else if (key === q.userAnswer && key !== q.correctAnswer) {
                optionClass = 'option-incorrect'; 
            } else if (key === q.userAnswer && key === q.correctAnswer) {
                optionClass = 'option-correct'; 
            }

            optionsHtml += `<button class="${optionClass} my-1 text-sm"><span class="font-bold mr-2">${key}.</span> ${optionText}</button>`;
        });

        // Build the card content
        const subjectDisplay = q.subject.replace('_', ' ').replace('NIS', '(NIS)').replace('NSCDC', '(NSCDC)').replace('NCS', '(NCS)').replace('FFS', '(FFS)');
        reviewCard.innerHTML = `
            <p class="text-xs font-semibold text-gray-500 mb-1">Subject: ${subjectDisplay}</p>
            <p class="text-lg font-bold mb-2 text-gray-800">Q${index + 1}. ${q.q}</p>
            <div class="space-y-1">${optionsHtml}</div>
            <div class="mt-4 p-3 border-t pt-3 border-gray-200">
                <p class="font-semibold ${q.isCorrect ? 'text-green-600' : 'text-red-600'}">
                    Your Answer: <span class="uppercase">${q.userAnswer}</span> | Status: ${q.isCorrect ? 'Correct' : 'Incorrect'}
                </p>
                <p class="mt-2 text-sm text-gray-700">
                    <span class="font-bold text-blue-600">Explanation:</span> ${q.explanation}
                </p>
            </div>
        `;
        reviewList.appendChild(reviewCard);
    });

    showScreen('results-screen');
};

// --- UI/SCREEN MANAGEMENT ---

// Function to switch between main application screens.
const showScreen = (screenId) => {
    // Array of all screens
    [startScreen, lobbyScreen, examScreen, resultsScreen].forEach(screen => screen.classList.add('hidden'));

    // Display the requested screen
    document.getElementById(screenId).classList.remove('hidden');
};

// --- EVENT LISTENERS ---

// 1. Start Screen Listeners
startButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        candidateName = name;
        selectedDepartment = departmentSelect.value;
        
        // Save/Update name in the user profile (conditional on Firebase)
        if (isFirebaseActive) {
            const profileRef = getUserProfileDocRef(userId);
            setDoc(profileRef, { name: candidateName, lastLogin: serverTimestamp() }, { merge: true }).catch(console.error);
        }

        // Update lobby screen details
        const subjectDisplay = selectedDepartment.replace('_', ' ').replace('NIS', '(NIS)').replace('NSCDC', '(NSCDC)').replace('NCS', '(NCS)').replace('FFS', '(FFS)');
        document.getElementById('candidate-name-lobby').textContent = candidateName;
        document.getElementById('department-lobby').textContent = subjectDisplay.toUpperCase();
        document.getElementById('exam-title').textContent = `CBT EXAM: ${subjectDisplay.toUpperCase()} FOCUS (${TOTAL_QUESTIONS_COUNT} Qs)`;

        showScreen('lobby-screen'); // Move to the lobby
    } else {
        document.getElementById('error-message').innerText = "Please enter your name/ID to proceed.";
        document.getElementById('error-message').classList.remove('hidden');
    }
});

// Enable start button only if a name is entered
nameInput.addEventListener('input', () => {
    startButton.disabled = nameInput.value.trim() === '';
    document.getElementById('error-message').classList.add('hidden');
});

// 2. Lobby Screen Listener
document.getElementById('begin-exam-button').addEventListener('click', () => {
    initializeExam(); // Start the actual exam logic
});

// 3. Exam Screen Listeners
document.getElementById('prev-button').addEventListener('click', () => navigateQuestion(-1));
document.getElementById('next-button').addEventListener('click', () => navigateQuestion(1));

// Submit Button -> Show Confirmation Modal
document.getElementById('submit-exam-button').addEventListener('click', () => {
    const answeredCount = Object.keys(userAnswers).length;
    document.getElementById('modal-text').textContent = `You have answered ${answeredCount} out of ${TOTAL_QUESTIONS_COUNT} questions. Are you sure you want to submit now?`;
    confirmationModal.classList.remove('hidden');
    confirmationModal.classList.add('flex');
});

// 4. Modal Listeners
document.getElementById('modal-confirm').addEventListener('click', () => {
    confirmationModal.classList.add('hidden');
    confirmationModal.classList.remove('flex');
    handleSubmitExam(false); 
});
document.getElementById('modal-cancel').addEventListener('click', () => {
    confirmationModal.classList.add('hidden');
    confirmationModal.classList.remove('flex');
});

// 5. Results Screen Listener
document.getElementById('restart-button').addEventListener('click', () => {
    showScreen('start-screen'); 
});

// --- INITIAL APP STARTUP ---
// Start the Firebase setup when the script is loaded. Use a robust startup wrapper
// so that local runs are not blocked by errors in async setup (prevents overlay from
// permanently covering the UI and ensures the start button becomes clickable).
window.onload = async () => {
    try {
        loadingSpinner.classList.remove('hidden');
        await setupFirebase();
    } catch (err) {
        console.error('Startup/setupFirebase error:', err);
        // Show a user-friendly message if possible
        const errEl = document.getElementById('error-message');
        if (errEl) {
            errEl.textContent = 'An initialization error occurred; running in local fallback mode.';
            errEl.classList.remove('hidden');
        }
    } finally {
        // Always hide the loading spinner and ensure the start button is enabled for local testing
        try {
            loadingSpinner.classList.add('hidden');
            if (startButton) startButton.disabled = false;
            // Debug helper: ensure the start button is on top and log clicks for troubleshooting
            try {
                const sb = document.getElementById('start-button');
                const ni = document.getElementById('name-input');
                if (sb) {
                    sb.style.zIndex = '9999';
                    sb.style.pointerEvents = 'auto';
                    sb.addEventListener('click', (ev) => {
                        console.log('DEBUG: start-button clicked', { disabled: sb.disabled, nameValue: ni ? ni.value : null });
                    });
                }
            } catch (dbgErr) { console.warn('Debug helper failed', dbgErr); }
        } catch (ignore) {}
    }
};
