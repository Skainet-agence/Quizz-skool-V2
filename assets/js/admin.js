// DevlopIA Admin Logic - Secure GitHub Integration

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// --- Authentication & Config ---

// --- Authentication & Config ---

// SECURITY WARNING: Token is hardcoded as per user request for ease of use.
// In a production environment with multiple users, this should be handled via a backend proxy.
const CONFIG = {
    token: 'pot_PLACEHOLDER_TOKEN_TO_BE_REPLACED',
    user: 'Skainet-agence', // Verified via API call
    repo: 'devlopia-quiz'
};

/*
    Auto-Login Logic:
    Instead of asking the user to input credentials, we inject them directly.
*/

function checkAuth() {
    // Force set credentials in LocalStorage if missing or different
    if (localStorage.getItem('gh_token') !== CONFIG.token) {
        localStorage.setItem('gh_token', CONFIG.token);
        localStorage.setItem('gh_user', CONFIG.user);
        localStorage.setItem('gh_repo', CONFIG.repo);
    }

    // Always show upload section since we are hardcoded authenticated
    document.getElementById('config-section').classList.add('hidden');
    document.getElementById('upload-section').classList.remove('hidden');
}

function saveConfig() {
    // Kept for compatibility but effectively disabled/hidden by CSS
    console.log("Config is managed automatically.");
}

function logout() {
    if (confirm('Voulez-vous supprimer les accès locaux ? (Ils reviendront au rechargement car hardcodés)')) {
        localStorage.clear();
        location.reload();
    }
}

function logout() {
    if (confirm('Voulez-vous supprimer les accès de ce navigateur ?')) {
        localStorage.clear();
        location.reload();
    }
}

// --- Core Logic: Publish Quiz ---

async function processAndPublish() {
    const btn = document.getElementById('btn-publish');
    const statusDiv = document.getElementById('status-msg');

    // 1. Validate Inputs
    const title = document.getElementById('quiz-title').value;
    const week = document.getElementById('quiz-week').value;
    const duration = document.getElementById('quiz-duration').value;
    const rawHtml = document.getElementById('raw-html').value;

    if (!title || !rawHtml) {
        showMessage('status-msg', 'Titre et Code HTML requis.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement...';
    showMessage('status-msg', 'Analyse du quiz...', 'info');

    try {
        // 2. Parse Raw HTML to extract Questions
        const questions = parseNotebookLMHtml(rawHtml);
        if (questions.length === 0) throw new Error("Aucune question trouvée dans le HTML. Vérifiez le format.");

        console.log("Extracted Questions:", questions);

        // 3. Generate New Filename (slug)
        const slug = 'quiz-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const fileName = `${slug}.html`;

        // 4. Generate Final HTML Content
        const finalHtml = generateQuizTemplate(title, week, questions);

        // 5. Commit HTML File to GitHub
        showMessage('status-msg', 'Upload du fichier HTML sur GitHub...', 'info');
        await uploadToGitHub(fileName, finalHtml, `Add quiz: ${title}`);

        // 6. Update quiz-list.json
        showMessage('status-msg', 'Mise à jour du sommaire...', 'info');
        await updateQuizList(title, week, duration, fileName);

        showMessage('status-msg', '✅ Quiz publié avec succès ! Redirection...', 'success');
        setTimeout(() => window.location.href = '../index.html', 2000);

    } catch (error) {
        console.error(error);
        showMessage('status-msg', `Erreur: ${error.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Réessayer';
    }
}

// --- Helper: GitHub API ---

async function uploadToGitHub(path, content, message) {
    const token = localStorage.getItem('gh_token');
    const user = localStorage.getItem('gh_user');
    const repo = localStorage.getItem('gh_repo');
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;

    // Check if file exists to get SHA (for update)
    let sha = null;
    try {
        const check = await fetch(url, { headers: { Authorization: `token ${token}` } });
        if (check.ok) {
            const data = await check.json();
            sha = data.sha;
        }
    } catch (e) { /* ignore if new file */ }

    // Prepare payload
    const body = {
        message: message,
        content: btoa(unescape(encodeURIComponent(content))), // UTF-8 Base64 encode
        ...(sha && { sha }) // Include SHA if updating
    };

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`GitHub Error: ${err.message}`);
    }
}

async function updateQuizList(title, week, duration, fileName) {
    const token = localStorage.getItem('gh_token');
    const user = localStorage.getItem('gh_user');
    const repo = localStorage.getItem('gh_repo');
    const path = 'data/quiz-list.json';
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;

    // 1. Get current list
    const getRes = await fetch(url, { headers: { Authorization: `token ${token}` } });
    if (!getRes.ok) throw new Error("Impossible de lire quiz-list.json");

    const data = await getRes.json();
    // Clean content (remove newlines from GitHub API response)
    const cleanContent = data.content.replace(/\n/g, '');

    let currentList;
    try {
        const decoded = decodeURIComponent(escape(atob(cleanContent))); // Base64 decode with UTF-8 support
        currentList = JSON.parse(decoded);
    } catch (e) {
        console.warn("Erreur parsing JSON ou fichier vide, initialisation nouveau tableau.", e);
        currentList = [];
    }

    if (!Array.isArray(currentList)) {
        console.warn("Le contenu n'était pas un tableau. Réinitialisation.");
        currentList = [];
    }
    const sha = data.sha;

    // 2. Add new quiz
    const newQuiz = {
        id: Date.now(),
        title: title,
        week: week,
        duration: duration,
        file: fileName,
        date: new Date().toISOString()
    };

    currentList.push(newQuiz);

    // 3. Save back
    const body = {
        message: `Update list for ${title}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(currentList, null, 2)))),
        sha: sha
    };

    const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!putRes.ok) throw new Error("Erreur mise à jour quiz-list.json");
}

// --- Helper: Parsers & Generators ---

function parseNotebookLMHtml(html) {
    // Basic parser strategy: look for patterns in raw HTML
    // This is a simplified Mock parser. In production, we'd use DOMParser.
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // ADAPTATION REQUIRED: This logic depends on NotebookLM's output format.
    // Assuming a standard structure or text-based extraction for now.
    // Strategy: Look for specific classes or list items.

    // MOCK extraction for demo purposes (robustify based on real HTML sample)
    const extracted = [];

    // IMPORTANT: User needs to provide real HTML sample to refine this.
    // For now, let's assume a generic <ul> structure if found, otherwise manual parse

    // NOTE: Implementing a generic fall-back parser
    // Trying to find text blocks that look like questions?
    // Let's create a dummy list for testing if parsing fails

    // TODO: Implement Real Parser based on user provided HTML
    // Returning Mock Data to prove flow works
    return [
        {
            question: "Question Générée Automatiquement 1 ?",
            options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
            correct: 0, // Index A
            explanation: "Explication générée..."
        },
        {
            question: "Question Générée 2 ?",
            options: ["Faux", "Vrai"],
            correct: 1,
            explanation: "C'est vrai."
        }
    ];
}


function generateQuizTemplate(title, week, questions) {
    // Serialize questions to JSON to embed in the script
    const questionsJson = JSON.stringify(questions);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - DevlopIA</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
    <style>
        /* Quiz Specific Styles */
        .quiz-container { max-width: 800px; margin: 40px auto; padding: 40px; border-radius: 20px; }
        .question-box { margin-bottom: 30px; }
        .question-text { font-size: 1.5rem; font-weight: bold; color: var(--text-dark); margin-bottom: 25px; line-height: 1.4; }
        .options-grid { display: grid; gap: 15px; }
        .option-btn { padding: 20px 25px; border: 2px solid #eee; border-radius: 12px; background: white; text-align: left; cursor: pointer; transition: 0.2s; font-size: 1.15rem; font-weight: 500; }
        .option-btn:hover { border-color: var(--primary-blue); background: #f0f7ff; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
        .option-btn.correct { background: #d4edda; border-color: #c3e6cb; color: #155724; }
        .option-btn.wrong { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        .feedback { margin-top: 25px; padding: 20px; border-radius: 12px; background: #f8f9fa; display: none; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .controls { display: flex; justify-content: space-between; margin-top: 40px; }
        .progress-bar { height: 12px; background: #eee; border-radius: 6px; margin-bottom: 40px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--primary-blue); width: 0%; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
    </style>
</head>
<body>
    <header>
        <div class="container header-content">
            <a href="index.html" class="logo">
                <img src="assets/images/logo.svg" alt="DevlopIA Logo">
            </a>
            <a href="index.html" class="btn-start" style="padding: 8px 20px; font-size: 0.9rem;">Quitter</a>
        </div>
    </header>

    <main class="container">
        <div class="quiz-container">
            <div class="progress-bar"><div class="progress-fill" id="progress"></div></div>
            
            <div id="quiz-content">
                <!-- Question injected here -->
            </div>

            <div class="controls">
                <button id="btn-next" class="btn-start" style="display:none;" onclick="nextQuestion()">Suivant <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>
    </main>

    <script>
        const quizData = ${questionsJson};
        let currentQuestion = 0;
        let score = 0;

        function loadQuestion() {
            const data = quizData[currentQuestion];
            document.getElementById('progress').style.width = ((currentQuestion + 1) / quizData.length * 100) + '%';
            
            let html = \`<div class="question-box fade-in">
                <div class="question-text">\${currentQuestion + 1}. \${data.question}</div>
                <div class="options-grid">\`;
            
            data.options.forEach((opt, index) => {
                html += \`<button class="option-btn" onclick="checkAnswer(this, \${index})">\${opt}</button>\`;
            });

            html += \`</div><div id="feedback-box" class="feedback"></div></div>\`;
            document.getElementById('quiz-content').innerHTML = html;
            document.getElementById('btn-next').style.display = 'none';
        }

        function checkAnswer(btn, index) {
            const data = quizData[currentQuestion];
            const allBtns = document.querySelectorAll('.option-btn');
            const feedback = document.getElementById('feedback-box');
            
            // Disable all buttons
            allBtns.forEach(b => b.disabled = true);

            if (index === data.correct) {
                btn.classList.add('correct');
                feedback.innerHTML = '<i class="fa-solid fa-check-circle" style="color:var(--success)"></i> <strong>Bonne réponse !</strong> <br><div style="margin-top:10px">' + data.explanation + '</div>';
                feedback.style.display = 'block';
                feedback.style.borderLeft = '5px solid var(--success)';
                score++;
                confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 }, colors: ['#5B9FFF', '#2ECC71'] });
            } else {
                btn.classList.add('wrong');
                allBtns[data.correct].classList.add('correct'); // Show correct one
                feedback.innerHTML = '<i class="fa-solid fa-times-circle" style="color:var(--error)"></i> <strong>Mauvaise réponse.</strong> <br><div style="margin-top:10px">' + data.explanation + '</div>';
                feedback.style.display = 'block';
                feedback.style.borderLeft = '5px solid var(--error)';
            }

            document.getElementById('btn-next').style.display = 'inline-block';
        }

        function nextQuestion() {
            currentQuestion++;
            if (currentQuestion < quizData.length) {
                loadQuestion();
            } else {
                showResults();
            }
        }

        function showResults() {
            const percentage = Math.round((score / quizData.length) * 100);
            let message = "";
            let emoji = "";

            if (percentage >= 80) {
                message = "Woaw ! A ce rythme c'est toi qui va donner les cours ! 🚀";
                emoji = "🏆";
                // Big Celebration
                var duration = 3 * 1000;
                var animationEnd = Date.now() + duration;
                var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
                function random(min, max) { return Math.random() * (max - min) + min; }
                var interval = setInterval(function() {
                    var timeLeft = animationEnd - Date.now();
                    if (timeLeft <= 0) { return clearInterval(interval); }
                    var particleCount = 50 * (timeLeft / duration);
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } }));
                    confetti(Object.assign({}, defaults, { particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } }));
                }, 250);

            } else if (percentage >= 50) {
                message = "Presque parfait, l'erreur est humaine après tout, c'est pour ça qu'on utilise l'IA (héhé) 😉";
                emoji = "🥈";
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } else if (percentage >= 30) {
                 message = "Je te conseille de revoir le cours, tu as certainement loupé quelques trucs pendant que tu étais aux toilettes... 🚽";
                 emoji = "🥉";
            } else {
                message = "Tu es sûr que tu as vu le bon cours ? 🤨";
                emoji = "📉";
            }

            document.getElementById('quiz-content').innerHTML = \`
                <div class="result-card fade-in">
                    <div style="font-size: 5rem; margin-bottom: 20px;">\${emoji}</div>
                    <h2>Quiz Terminé !</h2>
                    <div class="score-text">\${score}/\${quizData.length}</div>
                    <p style="font-size: 1.2rem; color: #7f8c8d; margin-bottom: 30px;">Soit <strong>\${percentage}%</strong> de réussite</p>
                    <div class="fun-message">\${message}</div>
                    <br>
                    <a href="index.html" class="btn-start" style="padding: 12px 30px; font-size: 1.1rem;">Retour au sommaire</a>
                </div>
            \`;
            document.getElementById('btn-next').style.display = 'none';
            document.getElementById('progress').style.width = '100%';
        }

        // Init
        loadQuestion();
    </script>
</body>
</html>`;
}

function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    el.innerHTML = text;
    el.className = type === 'error' ? 'error-msg' : 'success-msg';
}
