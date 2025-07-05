// src/components/LiteChat/common/LoadingStateWrapper.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateWrapperProps {
  isLoading: boolean;
  error?: string | null;
  data?: any[] | Record<string, any> | null
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  loadingClassName?: string;
  errorClassName?: string;
  emptyClassName?: string;
}

const DefaultLoading: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <div className="flex items-center justify-center p-4 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('loadingStateWrapper.loading')}
    </div>
  );
};

const DefaultError: React.FC<{ error: string }> = ({ error }) => {
  const { t } = useTranslation('common');
  return (
    <div className="p-4 text-destructive text-center">{t('loadingStateWrapper.error', { error })}</div>
  );
};

const DefaultEmpty: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <div className="p-4 text-muted-foreground text-center">{t('loadingStateWrapper.noItems')}</div>
  );
};

export const LoadingStateWrapper: React.FC<LoadingStateWrapperProps> = ({
  isLoading,
  error,
  data,
  loadingComponent,
  errorComponent,
  emptyComponent,
  children,
  className,
  loadingClassName,
  errorClassName,
  emptyClassName,
}) => {
  if (isLoading) {
    return (
      <div className={cn(loadingClassName)}>
        {loadingComponent ?? <DefaultLoading />}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(errorClassName)}>
        {errorComponent ?? <DefaultError error={error} />}
      </div>
    );
  }

  const isEmpty =
    data === null ||
    data === undefined ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === "object" && Object.keys(data).length === 0);

  if (isEmpty) {
    return (
      <div className={cn(emptyClassName)}>
        {emptyComponent ?? <DefaultEmpty />}
      </div>
    );
  }

  return <div className={cn(className)}>{children}</div>;
};

// Example Skeleton Loading Component (can be customized per usage)
export const DefaultListLoadingSkeleton: React.FC<{ count?: number }> = ({
  count = 3,
}) => (
  <div className="space-y-2 p-2">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-10 w-full" />
    ))}
  </div>
);
