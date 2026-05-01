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


    $(document).off('click', '#toggle-password-visibility').on('click', '#toggle-password-visibility', function () {
      const $password = $('#password');
      const $icon = $(this).find('i');
      const isVisible = $password.attr('type') === 'text';
      $password.attr('type', isVisible ? 'password' : 'text');
      $(this).attr('title', isVisible ? 'Mostra password' : 'Nascondi password');
      $(this).attr('aria-label', isVisible ? 'Mostra password' : 'Nascondi password');
      $icon.toggleClass('fa-eye fa-eye-slash');
    });



    $(document).off('click', '#btn-open-password-reset').on('click', '#btn-open-password-reset', function () {
      const currentEmail = String($('#email').val() || '').trim();
      $('#reset-email').val(currentEmail);
      $('#password-reset-success, #password-reset-error').addClass('d-none').text('');
      $('#password-reset-feedback').addClass('d-none').text('');
      const modalEl = document.getElementById('passwordResetModal');
      if (modalEl && window.bootstrap && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      } else {
        $('#reset-email').trigger('focus');
      }
    });

    $(document).off('submit', '#password-reset-form').on('submit', function (e) {
      e.preventDefault();

      const email = String($('#reset-email').val() || '').trim();
      if (!email) {
        $('#password-reset-error').removeClass('d-none').text('Inserisci un indirizzo email valido.');
        $('#password-reset-success').addClass('d-none').text('');
        return;
      }

      $('#password-reset-success, #password-reset-error').addClass('d-none').text('');
      $('#password-reset-spinner').removeClass('d-none');
      $('#btn-send-password-reset').prop('disabled', true);

      try {
        if (auth) auth.languageCode = 'it';
      } catch (langErr) {
        console.warn('Impossibile impostare la lingua Firebase Auth:', langErr);
      }

      auth
        .sendPasswordResetEmail(email)
        .then(() => {
          const message = 'Se l’indirizzo è registrato, riceverai un’email con il link per reimpostare la password.';
          $('#password-reset-success').removeClass('d-none').text(message);
          $('#password-reset-feedback').removeClass('d-none').text(message);
          $('#password-reset-form')[0].reset();
        })
        .catch((err) => {
          console.error('Password reset error:', err);
          const neutralMessage = 'Se l’indirizzo è registrato, riceverai un’email con il link per reimpostare la password.';
          if (err && err.code === 'auth/user-not-found') {
            $('#password-reset-success').removeClass('d-none').text(neutralMessage);
            $('#password-reset-feedback').removeClass('d-none').text(neutralMessage);
            $('#password-reset-form')[0].reset();
            return;
          }

          let message = 'Non è stato possibile inviare il link di reset. Verifica l’indirizzo email e riprova.';
          if (err && err.code === 'auth/invalid-email') {
            message = 'L’indirizzo email inserito non è valido.';
          } else if (err && err.code === 'auth/too-many-requests') {
            message = 'Troppe richieste ravvicinate. Riprova più tardi.';
          }
          $('#password-reset-error').removeClass('d-none').text(message);
        })
        .finally(() => {
          $('#password-reset-spinner').addClass('d-none');
          $('#btn-send-password-reset').prop('disabled', false);
        });
    });

    $('#login-form').on('submit', function (e) {
      e.preventDefault();
      $('#login-error').addClass('d-none');
      $('#password-reset-feedback').addClass('d-none').text('');
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
