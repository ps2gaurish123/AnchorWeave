import React from 'react';
import ReactDOM from 'react-dom/client';
import { EarthViewer } from './components/EarthViewer';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EarthViewer />
  </React.StrictMode>
);
