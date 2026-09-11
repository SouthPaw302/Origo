import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installAudioGovernor} from './audio/audioGovernor';
import {installEnvironmentCurriculum} from './simulation/environmentCurriculum';
import {installCurriculumUiLabels} from './simulation/curriculumUiLabels';
import {installInteractionPacing} from './simulation/interactionPacing';
import {installWorldPacing} from './simulation/worldPacing';
import './index.css';

// Install adaptive wrappers before the first SimulationEngine is constructed.
installEnvironmentCurriculum();
installCurriculumUiLabels();
installInteractionPacing();
installWorldPacing();
installAudioGovernor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
