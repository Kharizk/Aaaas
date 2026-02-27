import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/supabase';
import { CurrencySymbolType } from '../types';

interface SystemSettings {
  orgName: string;
  expiryAlertDays: number;
  currencySymbolType: CurrencySymbolType;
  currencySymbolImage: string | null;
  taxRate: number;
  receiptHeader: string;
  receiptFooter: string;
}

interface SystemSettingsContextType {
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: SystemSettings = {
  orgName: 'مؤسسة إدارة المتجر',
  expiryAlertDays: 60,
  currencySymbolType: 'text',
  currencySymbolImage: null,
  taxRate: 15,
  receiptHeader: '',
  receiptFooter: ''
};

const SystemSettingsContext = createContext<SystemSettingsContextType>({
  settings: defaultSettings,
  updateSettings: async () => {},
  isLoading: true
});

export const useSystemSettings = () => useContext(SystemSettingsContext);

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await db.settings.get();
        setSettings({ ...defaultSettings, ...data });
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await db.settings.upsert(updated);
    } catch (e) {
      console.error("Failed to save settings", e);
      throw e;
    }
  };

  return (
    <SystemSettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SystemSettingsContext.Provider>
  );
};
