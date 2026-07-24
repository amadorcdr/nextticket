import { useState } from 'react';
import { ValidatorLayout } from './ValidatorLayout';
import { ValidatorTopbar } from './ValidatorTopbar';
import { ValidationStats } from './ValidationStats';
import { TicketScanner, ManualFolioForm, SimulationControls } from './ScannerPanel';
import { ValidationResultToast } from './ValidationResultToast';
import { colors } from './theme';
import type { ValidationResultType } from './data';

export function ValidatorPage() {
  const [folio, setFolio] = useState('');
  const [result, setResult] = useState<ValidationResultType>(null);

  const handleValidate = () => setResult('success');
  const handleReset = () => {
    setResult(null);
    setFolio('');
  };

  return (
    <ValidatorLayout
      activeRoute="/validator"
      topbar={(sidebar) => <ValidatorTopbar onMenuToggle={sidebar.onToggle} showSearch={false} />}
    >
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, color: colors.onBackground, fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Validación de boletos
        </h1>
        <p style={{ marginTop: 8, color: 'rgba(204,195,216,0.55)', fontSize: 13, lineHeight: '22px' }}>
          Selecciona un evento para empezar a validar boletos
        </p>
      </div>

      {/* Stats */}
      <div style={{ width: '100%', marginBottom: 28 }}>
        <ValidationStats onRejectedClick={() => setResult('rejected')} />
      </div>

      {/* Scanner + validación manual, lado a lado, mismo ancho que las stat cards */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TicketScanner />
          <ManualFolioForm folio={folio} onFolioChange={setFolio} onValidate={handleValidate} />
        </div>
        <SimulationControls onSimulate={setResult} />
      </div>

      <ValidationResultToast result={result} onReset={handleReset} />

      <style>{`
        @keyframes validator-scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .validator-scanner-line {
          height: 2px;
          background: linear-gradient(90deg, transparent, ${colors.primary}, transparent);
          box-shadow: 0 0 15px ${colors.primary};
          animation: validator-scan 2.5s infinite ease-in-out;
        }
      `}</style>
    </ValidatorLayout>
  );
}
