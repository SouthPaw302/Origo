import React, { useEffect } from 'react';
import { Activity, Dna, Music2, Repeat2, Scale, Waves } from 'lucide-react';
import { origoMusicSystem } from '../music/musicSystem';

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function MusicalAnalysisPanel() {
  const [, refresh] = React.useState(0);
  useEffect(() => origoMusicSystem.subscribe(() => refresh((value) => value + 1)), []);
  const analysis = origoMusicSystem.getAnalysis();

  return (
    <section className="border border-[#262626] bg-[#080808] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#777]">Musical DNA</p>
          <p className="mt-1 text-xs font-medium text-white">What shape is this world taking?</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#777]">These are descriptive signals, not a quality score. Future evolution can trade them off instead of chasing one definition of “good music.”</p>
        </div>
        <Dna className={`h-4 w-4 flex-shrink-0 ${analysis ? 'text-[#00ff41]' : 'text-[#444]'}`} />
      </div>

      {!analysis ? (
        <div className="mt-3 border border-dashed border-[#292929] bg-[#0b0b0b] p-3 text-center">
          <p className="text-[10px] text-[#777]">Record a few musical events and Origo will map the structure here.</p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <DnaMetric icon={<Waves className="h-3 w-3" />} label="Space" value={percent(analysis.silenceRatio)} hint="Unused musical slots" />
            <DnaMetric icon={<Activity className="h-3 w-3" />} label="Rhythm" value={percent(analysis.rhythmicRegularity)} hint="Repeated timing identity" />
            <DnaMetric icon={<Repeat2 className="h-3 w-3" />} label="Motifs" value={percent(analysis.motifRecurrence)} hint={`${Math.round(analysis.motifRecall * 100)}% deliberate recall`} />
            <DnaMetric icon={<Scale className="h-3 w-3" />} label="Balance" value={percent(analysis.speciesBalance)} hint="Species contribution" />
            <DnaMetric icon={<Music2 className="h-3 w-3" />} label="Dynamics" value={percent(analysis.dynamicRange)} hint="Velocity range" />
            <DnaMetric icon={<Dna className="h-3 w-3" />} label="Contrast" value={percent(analysis.sectionContrast)} hint="Recent section change" />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden border border-[#202020] bg-[#202020]">
            <SmallMetric label="Density" value={percent(analysis.eventDensity)} />
            <SmallMetric label="Pitch spread" value={percent(analysis.pitchSpread)} />
            <SmallMetric label="Pitch classes" value={percent(analysis.pitchClassDiversity)} />
          </div>
        </>
      )}
    </section>
  );
}

function DnaMetric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="min-h-20 border border-[#202020] bg-[#0b0b0b] p-2">
    <div className="flex items-center gap-1 text-[#00ff41]">{icon}<span className="font-mono text-[7px] uppercase tracking-wider text-[#666]">{label}</span></div>
    <p className="mt-1 font-mono text-sm text-white">{value}</p>
    <p className="mt-1 text-[7px] leading-tight text-[#555]">{hint}</p>
  </div>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#090909] p-2 text-center"><p className="font-mono text-[10px] text-[#bbb]">{value}</p><p className="font-mono text-[7px] uppercase tracking-wider text-[#555]">{label}</p></div>;
}
