// src/controls/components/data-settings/SettingsDataTabbed.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { TabbedLayout } from "@/components/LiteChat/common/TabbedLayout";
import { SettingsDataManagement } from "./SettingsDataManagement";
import { SettingsConfigSync } from "../config-sync-settings/SettingsConfigSync";

const SettingsDataTabbedComponent: React.FC = () => {
  const { t } = useTranslation('settings');

  const tabs = [
    {
      value: "import-export",
      label: t('dataManagement.tabs.importExport'),
      content: <SettingsDataManagement />,
      order: 1,
    },
    {
      value: "config-sync", 
      label: t('dataManagement.tabs.configSync'),
      content: <SettingsConfigSync />,
      order: 2,
    },
  ];

  return (
    <TabbedLayout
      tabs={tabs.sort((a, b) => (a.order || 0) - (b.order || 0))}
      defaultValue="import-export"
      scrollable={true}
    />
  );
};

export const SettingsDataTabbed = SettingsDataTabbedComponent;