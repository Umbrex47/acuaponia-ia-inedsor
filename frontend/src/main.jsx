import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AquaponicProvider } from './context/AquaponicProvider.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AquaponicProvider>
        <App />
      </AquaponicProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
