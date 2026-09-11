import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installAudioGovernor} from './audio/audioGovernor';
import {installEnvironmentCurriculum} from './simulation/environmentCurriculum';
import {installInteractionPacing} from './simulation/interactionPacing';
import {installWorldPacing} from './simulation/worldPacing';
import './index.css';

// Install deterministic/adaptive wrappers before the first SimulationEngine is constructed.
installEnvironmentCurriculum();
installInteractionPacing();
installWorldPacing();
installAudioGovernor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
