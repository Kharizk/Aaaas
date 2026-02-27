import React, { useState } from 'react';
import { X, Delete, Equal } from 'lucide-react';

interface CalculatorProps {
  onClose: () => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');

  const handleNumber = (num: string) => {
    setDisplay(prev => prev === '0' ? num : prev + num);
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const calculate = () => {
    try {
      const result = eval(equation + display);
      setDisplay(String(result));
      setEquation('');
    } catch (e) {
      setDisplay('Error');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
  };

  return (
    <div className="fixed bottom-20 left-6 z-[100] bg-gray-900 text-white p-4 rounded-3xl shadow-2xl w-72 border border-gray-700 animate-in slide-in-from-bottom-10 fade-in">
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-bold text-gray-400">آلة حاسبة</span>
        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full"><X size={16}/></button>
      </div>
      
      <div className="bg-black/50 p-4 rounded-2xl mb-4 text-right">
        <div className="text-xs text-gray-500 h-4">{equation}</div>
        <div className="text-3xl font-mono font-bold tracking-widest">{display}</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={clear} className="col-span-2 bg-red-500/20 text-red-400 p-3 rounded-xl font-bold hover:bg-red-500/30">C</button>
        <button onClick={() => setDisplay(prev => prev.slice(0, -1) || '0')} className="col-span-2 bg-gray-800 p-3 rounded-xl hover:bg-gray-700"><Delete size={20} className="mx-auto"/></button>
        
        {['7','8','9','/'].map(btn => (
          <button key={btn} onClick={() => ['/','*','-','+'].includes(btn) ? handleOperator(btn) : handleNumber(btn)} className={`p-3 rounded-xl font-bold text-lg ${['/','*','-','+'].includes(btn) ? 'bg-sap-primary text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>{btn}</button>
        ))}
        {['4','5','6','*'].map(btn => (
          <button key={btn} onClick={() => ['/','*','-','+'].includes(btn) ? handleOperator(btn) : handleNumber(btn)} className={`p-3 rounded-xl font-bold text-lg ${['/','*','-','+'].includes(btn) ? 'bg-sap-primary text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>{btn === '*' ? '×' : btn}</button>
        ))}
        {['1','2','3','-'].map(btn => (
          <button key={btn} onClick={() => ['/','*','-','+'].includes(btn) ? handleOperator(btn) : handleNumber(btn)} className={`p-3 rounded-xl font-bold text-lg ${['/','*','-','+'].includes(btn) ? 'bg-sap-primary text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>{btn}</button>
        ))}
        {['0','.','=','+'].map(btn => (
          <button key={btn} onClick={() => btn === '=' ? calculate() : ['/','*','-','+'].includes(btn) ? handleOperator(btn) : handleNumber(btn)} className={`p-3 rounded-xl font-bold text-lg ${btn === '=' ? 'bg-emerald-600 col-span-1' : ['/','*','-','+'].includes(btn) ? 'bg-sap-primary' : 'bg-gray-800 hover:bg-gray-700'}`}>{btn}</button>
        ))}
      </div>
    </div>
  );
};
