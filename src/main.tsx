import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Zalo Mini App injects <div id="app"></div> into its native WebView shell
const container = 
  document.getElementById('app') || 
  document.getElementById('root') || 
  (() => {
    const el = document.createElement('div');
    el.id = 'app';
    document.body.appendChild(el);
    return el;
  })();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
