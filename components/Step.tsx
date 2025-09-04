
import React from 'react';

interface StepProps {
  stepNumber: number;
  title: string;
  description: string;
  isComplete: boolean;
  children: React.ReactNode;
  collapsible?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

const CheckIcon: React.FC = () => (
  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </svg>
);

const NumberIcon: React.FC<{ number: number }> = ({ number }) => (
  <div className="w-6 h-6 flex items-center justify-center text-base font-bold bg-slate-600 text-slate-100 rounded-full">
    {number}
  </div>
);


export const Step: React.FC<StepProps> = ({ stepNumber, title, description, isComplete, children, collapsible, isOpen, onToggle }) => {
  const header = (
    <div 
      className={`flex items-start gap-4 ${collapsible ? 'cursor-pointer' : ''}`}
      onClick={collapsible ? onToggle : undefined}
    >
      <div>{isComplete ? <CheckIcon /> : <NumberIcon number={stepNumber} />}</div>
      <div className="flex-1">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-slate-400 text-base mt-1">{description}</p>
      </div>
      {collapsible && (
        <div className="flex-shrink-0">
          <svg className={`w-6 h-6 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-6 transition-all duration-300 ${isComplete ? 'border-green-500/50' : 'border-slate-700'}`}>
      {header}
      {(!collapsible || isOpen) && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};
