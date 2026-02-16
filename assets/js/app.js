// DevlopIA Main Application Logic

document.addEventListener('DOMContentLoaded', () => {
    loadQuizzes();
});

async function loadQuizzes() {
    const grid = document.getElementById('base-ia-grid');

    try {
        // Fetch data from local JSON file
        const response = await fetch('data/quiz-list.json');
        if (!response.ok) throw new Error('Erreur chargement quiz');

        const quizzes = await response.json();

        // Clear loading message
        grid.innerHTML = '';

        if (quizzes.length === 0) {
            grid.innerHTML = '<p class="no-quiz">Aucun quiz disponible pour le moment.</p>';
            return;
        }

        // Generate HTML for each quiz
        quizzes.forEach(quiz => {
            const card = document.createElement('article');
            card.className = 'quiz-card';
            card.onclick = () => window.location.href = quiz.file; // Clickable card

            card.innerHTML = `
                <div class="card-icon">
                    <i class="fa-solid fa-clipboard-question" style="font-size: 2rem; color: var(--primary-blue); margin-bottom: 15px;"></i>
                </div>
                <h3>${quiz.title}</h3>
                <p>${quiz.week} • ${quiz.duration} min</p>
                <span class="btn-start">Commencer <i class="fa-solid fa-arrow-right"></i></span>
            `;

            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Erreur:', error);
        grid.innerHTML = '<p style="color: var(--error);">Impossible de charger les quiz via quiz-list.json.</p>';
    }
}
