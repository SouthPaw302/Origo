import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installAudioGovernor} from './audio/audioGovernor';
import {installWorldPacing} from './simulation/worldPacing';
import './index.css';

installWorldPacing();
installAudioGovernor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
