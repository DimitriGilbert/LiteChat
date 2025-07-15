// src/controls/components/marketplace-settings/AddMarketplaceSourceForm.tsx

import React from "react";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useShallow } from "zustand/react/shallow";
import { useFormedible } from "@/hooks/use-formedible";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const addSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
});

export const AddMarketplaceSourceForm: React.FC = () => {
  const { t } = useTranslation('settings');

  const { addMarketplaceSource } = useMarketplaceStore(
    useShallow((state) => ({
      addMarketplaceSource: state.addMarketplaceSource,
    }))
  );

  const { Form } = useFormedible({
    schema: addSourceSchema,
    fields: [
      { 
        name: "name", 
        type: "text", 
        label: t('marketplace.sources.form.name', 'Name'),
        placeholder: t('marketplace.sources.form.namePlaceholder', 'My Custom Marketplace')
      },
      { 
        name: "url", 
        type: "url", 
        label: t('marketplace.sources.form.url', 'URL'),
        placeholder: "https://example.com/marketplace/index.json"
      }
    ],
    formOptions: {
      defaultValues: {
        name: "",
        url: ""
      },
      onSubmit: async ({ value }) => {
        await addMarketplaceSource({
          name: value.name,
          url: value.url,
          enabled: true,
        });
      }
    },
    resetOnSubmitSuccess: true,
    submitLabel: t('marketplace.sources.add', 'Add Source'),
    formClassName: "space-y-4"
  });

  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="font-medium">
        {t('marketplace.sources.addNew', 'Add New Marketplace Source')}
      </h4>
      <Form />
    </div>
  );
};