import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check, X, Shield, Network, GitCompare, ListOrdered } from 'lucide-react';
import { helpApi } from '../services/api';

interface TourOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to TRACE-X",
      subtitle: "AI-Powered Graph Investigation & Cryptographic Chain-of-Custody",
      icon: Sparkles,
      iconColor: "text-cyan-400",
      content: "TRACE-X uncovers hidden relationships across FIRs, call detail records (CDRs), banking transactions, and surveillance footage — anchoring every finding in a verifiable cryptographic chain of custody.",
      tip: "Built for Smart India Hackathon Problem SIH26189."
    },
    {
      title: "1. Multi-Source Ingestion & Evidence Graph",
      subtitle: "4-Dimensional Evidence Quality Graph ($Q = 0.35S + 0.20T + 0.30C + 0.15D$)",
      icon: Network,
      iconColor: "text-emerald-400",
      content: "Upload synthetic FIR documents, CDR CSVs, or transaction logs. Entities (people, phones, vehicles, organizations) are automatically extracted, deduplicated via Jaro-Winkler fuzzy matching, and scored across 4 quality dimensions.",
      tip: "Evidence Quality rings in the Graph Workspace visually signal evidence reliability at a glance."
    },
    {
      title: "2. Competing Hypotheses (Richards Heuer ACH)",
      subtitle: "1.5x Contradiction Diagnostic Weighting Penalty",
      icon: GitCompare,
      iconColor: "text-purple-400",
      content: "Test rival crime theories side-by-side. The Heuer engine applies a 1.5x diagnostic penalty to contradicting evidence, preventing confirmation bias and calibrating mathematical likelihoods.",
      tip: "Integrity warnings immediately flag hypotheses supported by compromised evidence."
    },
    {
      title: "3. Value-of-Information (VoI) Action Prioritizer",
      subtitle: "Expected Information Gain ($\text{EIG} = \text{Base} \cdot \mu_{\text{gap}} \cdot \mu_{\text{hyp}} \cdot \phi$)",
      icon: ListOrdered,
      iconColor: "text-amber-400",
      content: "Never wonder what to do next. TRACE-X evaluates knowledge gaps across poorly understood suspects and closely contested hypotheses to rank the highest-gain investigative moves.",
      tip: "Complete actions to log feedback and trigger automatic graph re-ranking."
    },
    {
      title: "4. Cryptographic Chain-of-Custody & Court Reports",
      subtitle: "NIST SHA-256 Ingestion Hashing & Defensible Audit Trails",
      icon: Shield,
      iconColor: "text-cyan-400",
      content: "Every evidence item is SHA-256 hashed on intake. Any modification is detected instantly. Export court-ready PDF dossiers and official Chain-of-Custody Integrity Audit reports with a single click.",
      tip: "Use the 'Simulate Tamper' demo action to demonstrate live tamper detection to judges."
    }
  ];

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      helpApi.completeTour().catch(() => {});
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step Indicator */}
        <div className="flex items-center space-x-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? 'w-8 bg-cyan-400'
                  : idx < currentStep
                  ? 'w-4 bg-cyan-800'
                  : 'w-4 bg-slate-800'
              }`}
            />
          ))}
          <span className="text-[10px] uppercase font-mono text-slate-500 ml-2">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        {/* Step Header */}
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 shrink-0">
            <step.icon className={`w-7 h-7 ${step.iconColor}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{step.title}</h3>
            <p className="text-xs text-cyan-400 font-mono mt-0.5">{step.subtitle}</p>
          </div>
        </div>

        {/* Step Body */}
        <p className="text-xs text-slate-300 leading-relaxed">
          {step.content}
        </p>

        {/* Tip Box */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-400">
          <strong className="text-slate-200">Investigator Pro-Tip:</strong> {step.tip}
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Skip Tour
            </button>

            <button
              onClick={handleNext}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-600/30 transition-all"
            >
              <span>{isLast ? 'Get Started' : 'Next Step'}</span>
              {isLast ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
