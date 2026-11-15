(function() {
    const savedTheme = localStorage.getItem('skincheck_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    window.toggleTheme = function() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('skincheck_theme', newTheme);
        updateToggleButtons(newTheme);
        window.dispatchEvent(new CustomEvent('skincheck_theme_change', { detail: { theme: newTheme } }));
    };

    window.setTheme = function(theme) {
        if (theme !== 'dark' && theme !== 'light') return;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('skincheck_theme', theme);
        updateToggleButtons(theme);
        window.dispatchEvent(new CustomEvent('skincheck_theme_change', { detail: { theme: theme } }));
    };

    function updateToggleButtons(theme) {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            if (theme === 'dark') {
                btn.innerHTML = '☀️ <span>Terang</span>';
                btn.setAttribute('title', 'Beralih ke Mode Terang');
            } else {
                btn.innerHTML = '🌙 <span>Gelap</span>';
                btn.setAttribute('title', 'Beralih ke Mode Gelap');
            }
        });

        // Update radio or select inputs if present on settings page
        const lightRadio = document.getElementById('theme-light-radio');
        const darkRadio = document.getElementById('theme-dark-radio');
        if (lightRadio && darkRadio) {
            if (theme === 'dark') {
                darkRadio.checked = true;
            } else {
                lightRadio.checked = true;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        updateToggleButtons(currentTheme);

        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.toggleTheme();
            });
        });
    });
})();
