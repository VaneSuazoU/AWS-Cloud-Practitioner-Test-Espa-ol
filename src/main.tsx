import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { setupIonicReact } from '@ionic/react';

// Configuración de Ionic
setupIonicReact();

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);