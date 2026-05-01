// js/features/theme/theme-module.js

(function () {
    const THEME_KEY = 'app-pref-theme';

    const ThemeModule = {
        init() {
            const savedTheme = localStorage.getItem(THEME_KEY) || 'system';
            this.applyTheme(savedTheme);
            this.syncControls(savedTheme);

            // Ascolta cambiamenti di sistema se in modalità "system"
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (localStorage.getItem(THEME_KEY) === 'system' || !localStorage.getItem(THEME_KEY)) {
                    this.applyTheme('system');
                    this.syncControls('system');
                }
            });
        },

        bind() {
            $(document).on('change', '#app-theme-select', (e) => {
                const newTheme = $(e.target).val();
                this.setTheme(newTheme);
            });

            $(document).on('change', '#sidebar-darkmode-toggle', (e) => {
                const newTheme = e.target.checked ? 'dark' : 'light';
                this.setTheme(newTheme);
            });
        },

        setTheme(theme) {
            this.applyTheme(theme);
            localStorage.setItem(THEME_KEY, theme);
            this.syncControls(theme);
        },

        syncControls(theme) {
            const effectiveTheme = this.getEffectiveTheme(theme);
            const $select = $('#app-theme-select');
            if ($select.length) {
                $select.val(theme);
            }
            const $toggle = $('#sidebar-darkmode-toggle');
            if ($toggle.length) {
                $toggle.prop('checked', effectiveTheme === 'dark');
                $toggle.prop('title', theme === 'system'
                    ? `Tema attuale: ${effectiveTheme === 'dark' ? 'scuro' : 'chiaro'} (segue il sistema)`
                    : `Tema attuale: ${effectiveTheme === 'dark' ? 'scuro' : 'chiaro'}`);
            }
        },

        getEffectiveTheme(theme) {
            if (theme === 'system') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return theme;
        },

        applyTheme(theme) {
            const html = document.documentElement;
            html.setAttribute('data-theme', this.getEffectiveTheme(theme));
        }
    };

    // Esposizione globale
    window.AppModules = window.AppModules || {};
    window.AppModules.theme = ThemeModule;

    // Inizializzazione immediata per evitare flash di colore sbagliato
    ThemeModule.init();
})();
