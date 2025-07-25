// src/controls/components/canvas/RaceResultExportControl.tsx
import React from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { DownloadIcon } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { useTranslation } from "react-i18next";

interface RaceResultExportControlProps {
  interactionId: string;
  conversationId: string;
}

export const RaceResultExportControl: React.FC<RaceResultExportControlProps> = ({ 
  interactionId, 
  conversationId 
}) => {
  const { t } = useTranslation('canvas');
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    emitter.emit(canvasEvent.raceResultExportRequest, { 
      interactionId, 
      conversationId 
    });
  };

  return (
    <ActionTooltipButton
      tooltipText={t('actions.exportRaceResults', 'Export Race Results')}
      onClick={handleClick}
      aria-label={t('actions.exportRaceResultsAriaLabel', 'Export race results to ZIP file')}
      icon={<DownloadIcon />}
      className="h-5 w-5 md:h-6 md:w-6"
    />
  );
};