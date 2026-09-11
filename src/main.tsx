import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installAudioGovernor} from './audio/audioGovernor';
import {installInteractionPacing} from './simulation/interactionPacing';
import {installWorldPacing} from './simulation/worldPacing';
import './index.css';

installInteractionPacing();
installWorldPacing();
installAudioGovernor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
