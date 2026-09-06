import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './Admin';

const isAdmin = window.location.pathname.startsWith('/admin');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </React.StrictMode>
);
