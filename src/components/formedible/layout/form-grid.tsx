"use client";
import React from "react";
import { cn } from "@/lib/utils";

interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  gap?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
  responsive?: boolean;
  className?: string;
}

export const FormGrid: React.FC<FormGridProps> = ({
  children,
  columns = 2,
  gap = "4",
  responsive = true,
  className,
}) => {
  const gapClasses = {
    '0': 'gap-0', '1': 'gap-1', '2': 'gap-2', '3': 'gap-3', '4': 'gap-4',
    '5': 'gap-5', '6': 'gap-6', '7': 'gap-7', '8': 'gap-8', '9': 'gap-9',
    '10': 'gap-10', '11': 'gap-11', '12': 'gap-12'
  };

  const gridColsClasses = {
    1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
    5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8',
    9: 'grid-cols-9', 10: 'grid-cols-10', 11: 'grid-cols-11', 12: 'grid-cols-12'
  };

  const gridClasses = cn(
    "grid",
    gapClasses[gap as keyof typeof gapClasses],
    responsive ? {
      "grid-cols-1": true,
      "md:grid-cols-2": columns >= 2,
      "lg:grid-cols-3": columns >= 3,
      "xl:grid-cols-4": columns >= 4,
    } : gridColsClasses[columns as keyof typeof gridColsClasses],
    className
  );

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};