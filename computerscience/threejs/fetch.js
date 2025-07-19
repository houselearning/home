// fetch.js
async function fetchRepos(user = 'Threejs') {
  const url = `https://api.github.com/users/${user}/repos?per_page=10&sort=updated`;
  const container = document.getElementById('reposContainer');

  try {
    const res = await fetch(url);
    if (!res.ok) {
      container.innerHTML = '<p style="color:#ff6666;">Failed to load repos.</p>';
      return;
    }

    const repos = await res.json();

    if (repos.length === 0) {
      container.innerHTML = '<p>No repos found.</p>';
      return;
    }

    container.innerHTML = repos.map(repo => `
      <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">
        <h3>${repo.name}</h3>
        <p>${repo.description ? repo.description : 'No description provided.'}</p>
        <div class="meta">
          <span>⭐ ${repo.stargazers_count}</span>
          <span>🍴 ${repo.forks_count}</span>
          <span>🛠 ${repo.language || 'N/A'}</span>
        </div>
      </a>
    `).join('');
  } catch (error) {
    container.innerHTML = `<p style="color:#ff6666;">Error: ${error.message}</p>`;
  }
}

fetchRepos();
