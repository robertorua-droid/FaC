// js/features/notes/notes-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.notes = window.AppModules.notes || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    // Salvataggio note
    $('#save-notes-btn').click(async () => {
      if (!currentUser) {
        alert('Utente non autenticato.');
        return;
      }
      await saveDataToCloud('notes', { userId: currentUser.uid, text: $('#notes-textarea').val() }, currentUser.uid);
      alert('Note salvate!');
    });
  }

  window.AppModules.notes.bind = bind;
})();
