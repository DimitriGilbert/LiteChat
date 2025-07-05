// src/components/LiteChat/settings/SettingsGitConfig.tsx

import React, { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { SettingsSection } from "@/components/LiteChat/common/SettingsSection";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const gitConfigSchema = (t: (key: string) => string) => z.object({
  gitUserName: z.string().min(1, t('config.errors.userNameEmpty')),
  gitUserEmail: z.string().email(t('config.errors.emailInvalid')),
  gitGlobalPat: z.string(),
});

// Utility component for field meta messages
function FieldMetaMessages({ field, t }: { field: AnyFieldApi, t: (key: string) => string }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <em className="text-xs text-destructive mt-1 block">
          {field.state.meta.errors.map((err: unknown) => {
            if (typeof err === 'string') return err;
            // Check if it's an object with a string 'message' property
            if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
              return (err as any).message;
            }
            // Fallback if the error is an object but not in the expected shape
            // This could happen if TanStack Form or Zod adapter places an unexpected error structure.
            // For Zod, error messages are usually strings.
            console.warn("FieldMetaMessages encountered an unexpected error object:", err);
            return t('config.errors.invalidInput'); 
          }).join(", ")}
        </em>
      ) : null}
    </>
  );
}

const SettingsGitConfigComponent: React.FC = () => {
  const { t } = useTranslation('git');
  const { gitUserName, setGitUserName, gitUserEmail, setGitUserEmail, gitGlobalPat, setGitGlobalPat } =
    useSettingsStore(
      useShallow((state) => ({
        gitUserName: state.gitUserName,
        setGitUserName: state.setGitUserName,
        gitUserEmail: state.gitUserEmail,
        setGitUserEmail: state.setGitUserEmail,
        gitGlobalPat: state.gitGlobalPat,
        setGitGlobalPat: state.setGitGlobalPat,
      }))
    );

  const form = useForm({
    defaultValues: {
      gitUserName: gitUserName ?? "",
      gitUserEmail: gitUserEmail ?? "",
      gitGlobalPat: gitGlobalPat ?? "",
    },
    validators: {
      onChange: gitConfigSchema(t),
    },
    onSubmit: async ({ value }) => {
      try {
        setGitUserName(value.gitUserName);
        setGitUserEmail(value.gitUserEmail);
        setGitGlobalPat(value.gitGlobalPat || null);
        toast.success(t('config.successToast', "Git user configuration updated!"));
      } catch (error) {
        toast.error(t('config.errorToast', "Failed to update Git configuration."));
        console.error("Error submitting Git config form:", error);
      }
    },
  });

  useEffect(() => {
    form.reset({
      gitUserName: gitUserName ?? "",
      gitUserEmail: gitUserEmail ?? "",
      gitGlobalPat: gitGlobalPat ?? "",
    });
  }, [gitUserName, gitUserEmail, gitGlobalPat, form]);

  return (
    <div className="space-y-4 p-1">
      <SettingsSection
        title={t('config.title', "Git User Configuration")}
        description={t('config.description', "Set your user name and email for Git commits made within the VFS. This is required for committing changes.")}
        contentClassName="rounded-lg border p-3 shadow-sm bg-card" // Apply card styling to content
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field
              name="gitUserName"
              children={(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>{t('config.userNameLabel', 'Git User Name')}</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('config.userNamePlaceholder', 'Your Name')}
                    className={field.state.meta.errors.length ? "border-destructive" : ""}
                  />
                  <FieldMetaMessages field={field} t={t} />
                </div>
              )}
            />
            <form.Field
              name="gitUserEmail"
              children={(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>{t('config.userEmailLabel', 'Git User Email')}</Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('config.userEmailPlaceholder', 'your.email@example.com')}
                    className={field.state.meta.errors.length ? "border-destructive" : ""}
                  />
                  <FieldMetaMessages field={field} t={t} />
                </div>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <form.Field
              name="gitGlobalPat"
              children={(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>{t('config.patLabel', 'Global Personal Access Token')}</Label>
                  <Input
                    id={field.name}
                    type="password"
                    value={field.state.value || ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('config.patPlaceholder', 'ghp_xxxxxxxxxxxxxxxxxxxx')}
                    className={field.state.meta.errors.length ? "border-destructive" : ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('config.patDescription', 'Used for Git operations when no repo-specific auth is configured')}
                  </p>
                  <FieldMetaMessages field={field} t={t} />
                </div>
              )}
            />
          </div>
          <div className="flex justify-end pt-2">
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting, state.isValidating, state.isValid] as const}
              children={([canSubmit, isSubmitting, isValidating, isValid]) => (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || isSubmitting || isValidating || !isValid}
                >
                  {isSubmitting ? t('config.savingButton', 'Saving...') : isValidating ? t('config.validatingButton', 'Validating...') : t('config.saveButton', 'Save Git Config')}
                </Button>
              )}
            />
          </div>
        </form>
      </SettingsSection>
    </div>
  );
};

export const SettingsGitConfig = React.memo(SettingsGitConfigComponent);
