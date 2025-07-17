    async function fetchRepos(user = 'tailwindlabs') {
      const url = `https://api.github.com/users/${user}/repos?per_page=10&sort=updated`;
      const res = await fetch(url);
      if (!res.ok) {
        document.getElementById('reposContainer').innerHTML = '<p class="text-red-500">Failed to load repos.</p>';
        return;
      }
      const repos = await res.json();
      const container = document.getElementById('reposContainer');

      container.innerHTML = repos.map(repo => `
        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h3 class="text-xl font-semibold text-blue-600 mb-2 hover:underline">${repo.name}</h3>
          <p class="text-gray-700 mb-4">${repo.description || 'No description provided.'}</p>
          <div class="flex items-center space-x-4 text-sm text-gray-500">
            <span>⭐ ${repo.stargazers_count}</span>
            <span>🍴 ${repo.forks_count}</span>
            <span>🛠 ${repo.language || 'N/A'}</span>
          </div>
        </a>
      `).join('');
    }

    fetchRepos();
