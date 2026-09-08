import React from 'react';
import { Info } from 'lucide-react';

export const SafetyDisclaimer: React.FC = () => {
  return (
    <footer className="safety-disclaimer-banner" role="contentinfo">
      <Info className="disclaimer-icon" />
      <div>
        <strong>Safety & Prototype Disclaimer: </strong>
        ChemDiag AI is a student prototype for demonstration and educational purposes.
        It is not a certified industrial safety, control, or process protection system.
        All hardware integration is designed strictly for low-voltage (6V DC) ambient water circulation experiments without mains electrical switching.
      </div>
    </footer>
  );
};
