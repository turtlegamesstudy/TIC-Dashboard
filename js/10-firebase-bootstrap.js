'use strict';

(() => {
  const firebaseConfig = {
    apiKey: 'AIzaSyA74-TR7aL2sgadtgVa_3mic2-6oL8bvrY',
    authDomain: 'ina-tions.firebaseapp.com',
    databaseURL: 'https://ina-tions-default-rtdb.firebaseio.com',
    projectId: 'ina-tions',
    storageBucket: 'ina-tions.firebasestorage.app',
    messagingSenderId: '887758000401',
    appId: '1:887758000401:web:effcd6cceacd30dfe33cb0',
    measurementId: 'G-ZKYE27E58N'
  };

  try {
    if (!window.firebase) {
      throw new Error('No se pudo cargar Firebase. Verifica tu conexión e inténtalo de nuevo.');
    }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    window.FirebaseServices = {
      app,
      auth: firebase.auth(),
      database: firebase.database(),
      storage: firebase.storage(),
      error: null
    };
  } catch (error) {
    console.error('No se pudo inicializar Firebase:', error);
    window.FirebaseServices = { error };
  }
})();
