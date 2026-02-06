// js/features/auth/auth-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.auth = window.AppModules.auth || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    // AUTH
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;

        // Nascondo login, mostro loading
        $('#login-container').addClass('d-none');
        $('#loading-screen').removeClass('d-none');

        try {
          await loadAllDataFromCloud();
          $('#loading-screen').addClass('d-none');
          $('#main-app').removeClass('d-none');
          renderAll();

          // Avvio monitoraggio inattivita
          if (typeof startInactivityWatch === 'function') startInactivityWatch();
        } catch (error) {
          alert('Errore DB: ' + error.message);
          $('#loading-screen').addClass('d-none');
        }
      } else {
        currentUser = null;
        $('#main-app').addClass('d-none');
        $('#loading-screen').addClass('d-none');
        $('#login-container').removeClass('d-none');

        // Stop monitoraggio inattivita
        if (typeof stopInactivityWatch === 'function') stopInactivityWatch();
      }
    });

    $('#login-form').on('submit', function (e) {
      e.preventDefault();
      $('#login-error').addClass('d-none');
      $('#login-spinner').removeClass('d-none');
      $('#btn-login-submit').prop('disabled', true);

      const email = $('#email').val();
      const password = $('#password').val();

      auth
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          $('#login-spinner').addClass('d-none');
          $('#btn-login-submit').prop('disabled', false);
        })
        .catch((err) => {
          console.error('Login Error:', err);
          $('#login-error').removeClass('d-none');
          $('#login-spinner').addClass('d-none');
          $('#btn-login-submit').prop('disabled', false);
        });
    });

    $('#logout-btn').on('click', function (e) {
      e.preventDefault();
      if (typeof stopInactivityWatch === 'function') {
        try {
          stopInactivityWatch();
        } catch (e2) {}
      }
      auth.signOut().then(() => {
        // signOut risolve -> lo stato auth.onAuthStateChanged fara il resto
        location.reload();
      });
    });
  }

  window.AppModules.auth.bind = bind;
})();
